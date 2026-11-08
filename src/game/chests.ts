import * as THREE from 'three';
import { CHAPTERS, getRiverPath, getRiverBedElevationAt } from './worldGen';

/**
 * One big glowing treasure chest near the end of each part of the river (plus one in the
 * Grand Lake for free swimming). Swimming anywhere above it opens it, so it can't be missed
 * by depth, only by steering away.
 */
interface RiverChest {
  group: THREE.Group;
  lid: THREE.Group;
  beamMat: THREE.MeshBasicMaterial;
  gems: THREE.Group;
  distance: number;
  lateral: number;
  opened: boolean;
  openAnim: number;
  phase: number;
}

const OPEN_DIST_ALONG = 4;
const OPEN_DIST_ACROSS = 5;

export class ChestManager {
  public group = new THREE.Group();
  private chests: RiverChest[] = [];
  private disposables: { dispose: () => void }[] = [];

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.group);

    const woodMat = new THREE.MeshStandardMaterial({ color: '#8a4b22', roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#ffcc33',
      emissive: '#b37400',
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.25,
    });
    const gemMats = ['#ff4d8d', '#4de3ff', '#7dff6b', '#c58bff', '#ffd84d'].map(
      (c) =>
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.2 })
    );

    const baseGeo = new THREE.BoxGeometry(1.8, 1.0, 1.2);
    const bandGeo = new THREE.BoxGeometry(0.16, 1.04, 1.24);
    const lidGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.8, 24, 1, false, 0, Math.PI);
    // Half-cylinder with its curved side up and its axis running left-right.
    lidGeo.rotateZ(Math.PI / 2);
    const lidBandGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24, 1, false, 0, Math.PI);
    lidBandGeo.rotateZ(Math.PI / 2);
    const lockGeo = new THREE.BoxGeometry(0.3, 0.36, 0.12);
    const gemGeo = new THREE.OctahedronGeometry(0.2, 0);
    const beamGeo = new THREE.CylinderGeometry(0.9, 1.4, 1, 20, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.disposables.push(woodMat, goldMat, ...gemMats, baseGeo, bandGeo, lidGeo, lidBandGeo, lockGeo, gemGeo, beamGeo);

    const spots = CHAPTERS.slice(0, 4).map((c) => c.endDist - 40);
    spots.push(2700);

    spots.forEach((dist) => {
      const { position, tangent, normal } = getRiverPath(dist);
      const lateral = 0;
      const bedY = getRiverBedElevationAt(dist, lateral);

      const chest = new THREE.Group();
      const base = new THREE.Mesh(baseGeo, woodMat);
      base.position.y = 0.5;
      chest.add(base);
      [-0.6, 0.6].forEach((x) => {
        const band = new THREE.Mesh(bandGeo, goldMat);
        band.position.set(x, 0.5, 0);
        chest.add(band);
      });

      // Lid pivots on its back edge.
      const lid = new THREE.Group();
      lid.position.set(0, 1.0, -0.6);
      const lidMesh = new THREE.Mesh(lidGeo, woodMat);
      lidMesh.position.z = 0.6;
      lid.add(lidMesh);
      [-0.6, 0.6].forEach((x) => {
        const lb = new THREE.Mesh(lidBandGeo, goldMat);
        lb.position.set(x, 0, 0.6);
        lid.add(lb);
      });
      const lock = new THREE.Mesh(lockGeo, goldMat);
      lock.position.set(0, -0.05, 1.22);
      lid.add(lock);
      chest.add(lid);

      // Gems that pop up when it opens.
      const gems = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const gem = new THREE.Mesh(gemGeo, gemMats[i % gemMats.length]);
        gem.position.set((i - 3) * 0.22, 0.95, (i % 2) * 0.2 - 0.1);
        gems.add(gem);
      }
      gems.visible = false;
      chest.add(gems);

      // Soft golden light beam up to the surface so it can be spotted from far away.
      const beamMat = new THREE.MeshBasicMaterial({
        color: '#ffe680',
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.disposables.push(beamMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.scale.y = Math.max(1, -bedY);
      beam.position.y = 1.0;
      chest.add(beam);

      chest.position.set(position.x + normal.x * lateral, bedY, position.z + normal.z * lateral);
      // Face upstream, toward the approaching player.
      chest.rotation.y = Math.atan2(-tangent.x, -tangent.z);
      chest.scale.setScalar(1.2);
      this.group.add(chest);

      this.chests.push({
        group: chest,
        lid,
        beamMat,
        gems,
        distance: dist,
        lateral,
        opened: false,
        openAnim: 0,
        phase: Math.random() * 6,
      });
    });
  }

  /** Returns how many chests Whiskers opened this frame. */
  public update(dt: number, playerDist: number, playerLateral: number): number {
    let openedNow = 0;
    for (const chest of this.chests) {
      if (Math.abs(chest.distance - playerDist) > 120) continue;
      chest.phase += dt;

      if (!chest.opened) {
        chest.beamMat.opacity = 0.32 + Math.sin(chest.phase * 2.5) * 0.08;
        if (
          Math.abs(chest.distance - playerDist) < OPEN_DIST_ALONG &&
          Math.abs(chest.lateral - playerLateral) < OPEN_DIST_ACROSS
        ) {
          chest.opened = true;
          chest.gems.visible = true;
          openedNow += 1;
        }
      } else if (chest.openAnim < 1) {
        chest.openAnim = Math.min(1, chest.openAnim + dt * 1.6);
        const t = 1 - Math.pow(1 - chest.openAnim, 3);
        chest.lid.rotation.x = -1.9 * t;
        chest.gems.children.forEach((gem, i) => {
          gem.position.y = 0.95 + t * (0.5 + (i % 3) * 0.25);
          gem.rotation.y += dt * 4;
        });
        chest.beamMat.opacity = 0.5 * (1 - t);
      } else {
        chest.gems.children.forEach((gem, i) => {
          gem.rotation.y += dt * 2;
          gem.position.y += Math.sin(chest.phase * 2 + i) * 0.002;
        });
      }
    }
    return openedNow;
  }

  public reset() {
    for (const chest of this.chests) {
      chest.opened = false;
      chest.openAnim = 0;
      chest.lid.rotation.x = 0;
      chest.gems.visible = false;
      chest.gems.children.forEach((gem, i) => {
        gem.position.y = 0.95;
        gem.position.x = (i - 3) * 0.22;
      });
      chest.beamMat.opacity = 0.35;
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.scene.remove(this.group);
  }
}
