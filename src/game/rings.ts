import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';

/**
 * Trails of glowing bubble rings. Swimming through a ring gives a star; getting every
 * ring in a trail gives a "Perfect!" bonus. Hit area is generous for small hands.
 */
interface RiverRing {
  group: THREE.Group;
  ringMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  distance: number;
  lateral: number;
  depth: number;
  state: 'waiting' | 'passed' | 'missed';
  fade: number;
  phase: number;
}

interface RingTrail {
  rings: RiverRing[];
  passed: number;
}

export interface RingEvent {
  trailComplete: boolean;
}

const RINGS_PER_TRAIL = 5;
const RING_SPACING = 8;
const HIT_RADIUS = 1.8;

export class RingManager {
  private group = new THREE.Group();
  private trails: RingTrail[] = [];
  private rings: RiverRing[] = [];
  private torusGeo = new THREE.TorusGeometry(1.25, 0.16, 12, 40);
  private glowGeo = new THREE.CircleGeometry(1.15, 32);

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.group);
    for (let start = 70; start < 2300; start += 150) {
      this.createTrail(start);
    }
  }

  private createTrail(startDist: number) {
    const trail: RingTrail = { rings: [], passed: 0 };
    const { width } = getRiverPath(startDist);
    const baseLateral = (Math.random() - 0.5) * width * 0.4;
    const swing = (Math.random() < 0.5 ? -1 : 1) * 2.4;

    for (let i = 0; i < RINGS_PER_TRAIL; i++) {
      const dist = startDist + i * RING_SPACING;
      const t = i / (RINGS_PER_TRAIL - 1);
      const { position, tangent, normal, width: w } = getRiverPath(dist);
      const maxLat = w / 2 - 3;
      const lateral = THREE.MathUtils.clamp(baseLateral + Math.sin(t * Math.PI) * swing, -maxLat, maxLat);
      const bed = getRiverBedElevationAt(dist, lateral);
      // A gentle dip in the middle of the trail; always clear of the riverbed and surface.
      const wanted = -1.4 - Math.sin(t * Math.PI) * 1.2;
      const depth = Math.min(-1.1, Math.max(wanted, bed + 1.5));

      // Strong warm color so the rings still read as gold through the teal water.
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#ffb000',
        emissive: '#ff9500',
        emissiveIntensity: 1.5,
        roughness: 0.3,
        transparent: true,
        opacity: 1,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#ffe680',
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.torusGeo, ringMat), new THREE.Mesh(this.glowGeo, glowMat));
      g.position.set(position.x + normal.x * lateral, depth, position.z + normal.z * lateral);
      g.rotation.y = Math.atan2(tangent.x, tangent.z);
      this.group.add(g);

      const ring: RiverRing = {
        group: g,
        ringMat,
        glowMat,
        distance: dist,
        lateral,
        depth,
        state: 'waiting',
        fade: 0,
        phase: Math.random() * Math.PI * 2,
      };
      trail.rings.push(ring);
      this.rings.push(ring);
    }
    this.trails.push(trail);
  }

  /**
   * Checks whether Whiskers crossed any ring this frame (prevDist -> currDist) and animates.
   */
  public update(
    dt: number,
    prevDist: number,
    currDist: number,
    lateral: number,
    depth: number
  ): RingEvent[] {
    const events: RingEvent[] = [];

    for (const trail of this.trails) {
      for (const ring of trail.rings) {
        if (Math.abs(ring.distance - currDist) > 90) continue;
        ring.phase += dt * 2.2;

        if (ring.state === 'waiting') {
          const s = 1 + Math.sin(ring.phase) * 0.05;
          ring.group.scale.setScalar(s);
          if (prevDist < ring.distance && currDist >= ring.distance) {
            const off = Math.hypot(lateral - ring.lateral, depth - ring.depth);
            if (off < HIT_RADIUS) {
              ring.state = 'passed';
              trail.passed += 1;
              events.push({ trailComplete: trail.passed === RINGS_PER_TRAIL });
            } else {
              ring.state = 'missed';
            }
          }
        } else if (ring.state === 'passed' && ring.group.visible) {
          ring.fade = Math.min(1, ring.fade + dt * 2.5);
          ring.group.scale.setScalar(1 + ring.fade * 0.8);
          ring.ringMat.opacity = 1 - ring.fade;
          ring.glowMat.opacity = 0.5 * (1 - ring.fade);
          if (ring.fade >= 1) ring.group.visible = false;
        } else if (ring.state === 'missed') {
          ring.ringMat.opacity = THREE.MathUtils.damp(ring.ringMat.opacity, 0.3, 3, dt);
          ring.ringMat.emissiveIntensity = THREE.MathUtils.damp(ring.ringMat.emissiveIntensity, 0.3, 3, dt);
        }
      }
    }
    return events;
  }

  public reset() {
    for (const trail of this.trails) {
      trail.passed = 0;
      for (const ring of trail.rings) {
        ring.state = 'waiting';
        ring.fade = 0;
        ring.group.visible = true;
        ring.group.scale.setScalar(1);
        ring.ringMat.opacity = 1;
        ring.ringMat.emissiveIntensity = 1.5;
        ring.glowMat.opacity = 0.18;
      }
    }
  }

  public dispose() {
    this.torusGeo.dispose();
    this.glowGeo.dispose();
    for (const ring of this.rings) {
      ring.ringMat.dispose();
      ring.glowMat.dispose();
    }
    this.scene.remove(this.group);
  }
}
