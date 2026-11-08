import * as THREE from 'three';
import { mergeStaticMeshes } from './perf';
import {
  getRiverPath,
  getRiverBedElevationAt,
  createDetailedSmallFishGeometry,
  createSmoothSmallFinGeometries,
} from './worldGen';
import { getGameTextures } from './textures';
import { sound } from './audio';

export type ItemType =
  | 'larva'
  | 'tiny_fish'
  | 'berry'
  | 'star'
  | 'smooth_stone'
  | 'shimmering_scale'
  | 'lost_trinket'
  | 'pearl';

export interface RiverItem {
  id: number;
  type: ItemType;
  label: string;
  group: THREE.Group;
  position: THREE.Vector3;
  baseY: number;
  distance: number;
  lateralOffset: number;
  collected: boolean;
  /** Caught by Whiskers' barbel magnet: stops idling and zips toward him. */
  attracted: boolean;
  hungerRestore: number;
  pointsValue: number;
  isTreasure: boolean;
  phase: number;
  /** Minnow tail fin, animated separately. */
  tail?: THREE.Object3D;
}

function createStarGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  const outerR = 0.55;
  const innerR = 0.27;

  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    curveSegments: 24,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.045,
    bevelThickness: 0.045,
  });
}

function createScaleGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.bezierCurveTo(0.38, -0.42, 0.48, -0.1, 0.42, 0.18);
  shape.bezierCurveTo(0.28, 0.48, -0.28, 0.48, -0.42, 0.18);
  shape.bezierCurveTo(-0.48, -0.1, -0.38, -0.42, 0, -0.45);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    curveSegments: 28,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.026,
    bevelThickness: 0.026,
  });
}

const _pullDir = new THREE.Vector3();

/**
 * Item Manager with high-polygon 3D anatomical Minnows, Segmented Larvae,
 * and PBR Shiny Treasures positioned across organic riffles, point bars, and deep scour pools.
 */
export class ItemManager {
  public scene: THREE.Scene;
  public items: RiverItem[] = [];
  public itemGroup: THREE.Group;
  private templates = new Map<ItemType, THREE.Group>();

  private starGeo: THREE.BufferGeometry;
  private scaleGeo: THREE.BufferGeometry;
  private minnowBodyGeo: THREE.BufferGeometry;
  private minnowTailGeo: THREE.BufferGeometry;
  private minnowDorsalGeo: THREE.BufferGeometry;
  private minnowPecGeo: THREE.BufferGeometry;

  private starMat: THREE.MeshPhysicalMaterial;
  private larvaMat: THREE.MeshPhysicalMaterial;
  private larvaHeadMat: THREE.MeshPhysicalMaterial;
  private tinyFishMat: THREE.MeshPhysicalMaterial;
  private tinyFishFinMat: THREE.MeshPhysicalMaterial;
  private berryMat: THREE.MeshPhysicalMaterial;
  private pearlMat: THREE.MeshPhysicalMaterial;
  private smoothStoneMat: THREE.MeshPhysicalMaterial;
  private shimmeringScaleMat: THREE.MeshPhysicalMaterial;
  private trinketGoldMat: THREE.MeshPhysicalMaterial;
  private trinketGemMat: THREE.MeshPhysicalMaterial;
  private eyeMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.itemGroup = new THREE.Group();
    this.scene.add(this.itemGroup);

    const textures = getGameTextures();

    this.starGeo = createStarGeometry();
    this.scaleGeo = createScaleGeometry();
    this.minnowBodyGeo = createDetailedSmallFishGeometry(0.56);

    const smallFins = createSmoothSmallFinGeometries(1.1);
    this.minnowTailGeo = smallFins.tailGeo;
    this.minnowDorsalGeo = smallFins.dorsalGeo;
    this.minnowPecGeo = smallFins.pecGeo;

    this.starMat = new THREE.MeshPhysicalMaterial({
      color: 0xffea00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.78,
      clearcoat: 1.0,
    });

    this.larvaMat = new THREE.MeshPhysicalMaterial({
      color: 0xf24438,
      emissive: 0x8f1810,
      emissiveIntensity: 0.3,
      roughness: 0.22,
      clearcoat: 0.95, // Glossy chitinous cuticle
    });

    this.larvaHeadMat = new THREE.MeshPhysicalMaterial({
      color: 0x59150e,
      roughness: 0.25,
      clearcoat: 0.9,
    });

    this.tinyFishMat = new THREE.MeshPhysicalMaterial({
      map: textures.minnowScaleAlbedo,
      roughness: 0.14,
      metalness: 0.65,
      clearcoat: 1.0,
      iridescence: 0.85,
      iridescenceIOR: 1.33,
    });

    this.tinyFishFinMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f7ff,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    this.berryMat = new THREE.MeshPhysicalMaterial({
      color: 0xc2185b,
      emissive: 0x5c0a30,
      emissiveIntensity: 0.25,
      roughness: 0.15,
      clearcoat: 1.0,
    });

    this.pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fcff,
      emissive: 0x88d4ff,
      emissiveIntensity: 0.4,
      roughness: 0.06,
      metalness: 0.3,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.5,
    });

    this.smoothStoneMat = new THREE.MeshPhysicalMaterial({
      map: textures.rockAlbedo,
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.32,
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 1.0,
    });

    this.shimmeringScaleMat = new THREE.MeshPhysicalMaterial({
      map: textures.minnowScaleAlbedo,
      color: 0xe879f9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.82,
      clearcoat: 1.0,
      iridescence: 1.0,
    });

    this.trinketGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xffc107,
      emissive: 0xd97706,
      emissiveIntensity: 0.38,
      roughness: 0.14,
      metalness: 0.92,
      clearcoat: 0.8,
    });

    this.trinketGemMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.6,
      roughness: 0.08,
      clearcoat: 1.0,
    });

    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    this.spawnRiverItems();
  }

  private spawnRiverItems() {
    let idCounter = 1;
    const totalDist = 3100;

    for (let dist = 20; dist < totalDist; dist += 10) {
      const { position, normal, width, featureType } = getRiverPath(dist);

      // 1. Plentiful Food Items adapted to stream geomorphology
      if (Math.random() < 0.88) {
        const isTinyFish = Math.random() < 0.44;
        const lateral = (Math.random() - 0.5) * (width * 0.72);
        const bedY = getRiverBedElevationAt(dist, lateral);
        const depthY = isTinyFish
          ? Math.min(-0.85, bedY + 1.2 + Math.random() * 1.1)
          : Math.min(-0.9, bedY + 0.38);

        this.createItem(
          idCounter++,
          isTinyFish ? 'tiny_fish' : 'larva',
          dist,
          lateral,
          depthY,
          position,
          normal
        );
      }

      if (dist % 30 === 0) {
        const lateral = (Math.random() - 0.5) * (width * 0.52);
        const bedY = getRiverBedElevationAt(dist + 4, lateral);
        const isBerry = dist % 60 === 0;
        this.createItem(
          idCounter++,
          isBerry ? 'berry' : 'larva',
          dist + 4,
          lateral,
          isBerry ? -0.85 : Math.min(-0.9, bedY + 0.38),
          position,
          normal
        );
      }

      // 2. Golden River Stars
      if (Math.random() < 0.68) {
        const lateral = Math.sin(dist * 0.08) * 0.5 * (width * 0.6);
        const bedY = getRiverBedElevationAt(dist, lateral);
        const starY = Math.max(bedY + 0.7, -1.2 + Math.sin(dist * 0.05) * 0.95);
        this.createItem(idCounter++, 'star', dist, lateral, starY, position, normal);
      }

      // 3. Collectible Shiny Treasures resting on point bars, riffle cobbles, and deep scour pools!
      if (Math.random() < 0.58) {
        const lateral = (Math.random() - 0.5) * (width * 0.68);
        const bedY = getRiverBedElevationAt(dist + 2, lateral);
        const roll = Math.random();
        let tType: ItemType = 'smooth_stone';
        let tY = Math.min(-0.9, bedY + 0.42);

        if (featureType === 'pool' && roll < 0.45) {
          tType = roll < 0.25 ? 'lost_trinket' : 'pearl';
        } else if (roll < 0.36) {
          tType = 'smooth_stone';
        } else if (roll < 0.66) {
          tType = 'shimmering_scale';
          tY = Math.min(-0.95, bedY + 0.85);
        } else if (roll < 0.86) {
          tType = 'lost_trinket';
        } else {
          tType = 'pearl';
        }

        this.createItem(idCounter++, tType, dist + 2, lateral, tY, position, normal);
      }
    }
  }

  private createItem(
    id: number,
    type: ItemType,
    dist: number,
    lateral: number,
    baseY: number,
    riverPos: THREE.Vector3,
    riverNormal: THREE.Vector3
  ) {
    // Every item of a type looks the same, so build it once, merge its pieces into a few
    // meshes, and share that template's geometry and materials across all copies.
    const template = this.templates.get(type);
    const build = !template;
    const group = template ? template.clone() : new THREE.Group();
    let label = 'Item';
    let hungerRestore = 0;
    let pointsValue = 5;
    let isTreasure = false;

    if (type === 'star') {
      label = 'Golden River Star';
      pointsValue = 10;
      isTreasure = false;

      if (build) {
        const starMesh = new THREE.Mesh(this.starGeo, this.starMat);
        starMesh.scale.set(0.9, 0.9, 0.9);
        group.add(starMesh);

        const haloGeo = new THREE.RingGeometry(0.5, 0.75, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xffea00,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        group.add(new THREE.Mesh(haloGeo, haloMat));
      }
    } else if (type === 'larva') {
      label = 'Juicy River Larva';
      hungerRestore = 20;
      pointsValue = 5;

      if (build) {
        // High-poly 6 Articulated Chitinous Larva Segments + Smooth Head Capsule + Curved Prolegs & Antennae
        const headGeo = new THREE.SphereGeometry(0.145, 10, 8);
        headGeo.scale(1.0, 0.9, 1.05);
        const headMesh = new THREE.Mesh(headGeo, this.larvaHeadMat);
        headMesh.position.set(0, 0.32, 0.09);
        group.add(headMesh);

        // Curved delicate antennae
        const antGeo = new THREE.CapsuleGeometry(0.01, 0.08, 2, 4);
        const antL = new THREE.Mesh(antGeo, this.larvaHeadMat);
        antL.position.set(0.06, 0.43, 0.14);
        antL.rotation.set(0.4, 0, -0.45);
        const antR = new THREE.Mesh(antGeo, this.larvaHeadMat);
        antR.position.set(-0.06, 0.43, 0.14);
        antR.rotation.set(0.4, 0, 0.45);
        group.add(antL, antR);

        const segGeo = new THREE.SphereGeometry(0.165, 10, 8);
        const legGeo = new THREE.CapsuleGeometry(0.012, 0.14, 2, 4);
        for (let s = 0; s < 6; s++) {
          const t = s / 5;
          const archZ = Math.sin(t * Math.PI) * 0.11;
          const seg = new THREE.Mesh(segGeo, this.larvaMat);
          seg.position.set(0, 0.17 - s * 0.115, archZ);
          const radScale = 1.0 - s * 0.1;
          seg.scale.set(radScale, 0.82, radScale * 1.12);
          group.add(seg);

          // Smooth curved thoracic prolegs on first 3 segments
          if (s < 3) {
            const legL = new THREE.Mesh(legGeo, this.larvaHeadMat);
            legL.position.set(0.12, 0.17 - s * 0.115, archZ + 0.06);
            legL.rotation.set(0.3, 0, 0.65);
            const legR = new THREE.Mesh(legGeo, this.larvaHeadMat);
            legR.position.set(-0.12, 0.17 - s * 0.115, archZ + 0.06);
            legR.rotation.set(0.3, 0, -0.65);
            group.add(legL, legR);
          }
        }
        group.rotation.z = Math.PI / 3;
      }
    } else if (type === 'tiny_fish') {
      label = 'Silver Feeder Minnow';
      hungerRestore = 28;
      pointsValue = 8;

      if (build) {
        // High-poly Fusiform Minnow with Iridescent Scales, 3D Eyes, Curved Dorsal/Pectoral Fins & Rounded Forked Tail
        const bodyMesh = new THREE.Mesh(this.minnowBodyGeo, this.tinyFishMat);
        const tailMesh = new THREE.Mesh(this.minnowTailGeo, this.tinyFishFinMat);
        tailMesh.position.z = -0.25;
        tailMesh.name = 'minnowTail';

        const dorsalMesh = new THREE.Mesh(this.minnowDorsalGeo, this.tinyFishFinMat);
        dorsalMesh.position.set(0, 0.11, 0.04);

        const pecL = new THREE.Mesh(this.minnowPecGeo, this.tinyFishFinMat);
        pecL.position.set(0.065, -0.035, 0.09);
        pecL.rotation.set(0.28, -0.45, -0.35);
        const pecR = new THREE.Mesh(this.minnowPecGeo, this.tinyFishFinMat);
        pecR.position.set(-0.065, -0.035, 0.09);
        pecR.rotation.set(0.28, 0.45, 0.35);
        pecR.scale.set(-1, 1, 1);

        const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
        const eyeL = new THREE.Mesh(eyeGeo, this.eyeMat);
        eyeL.position.set(0.058, 0.025, 0.18);
        const eyeR = new THREE.Mesh(eyeGeo, this.eyeMat);
        eyeR.position.set(-0.058, 0.025, 0.18);

        group.add(bodyMesh, tailMesh, dorsalMesh, pecL, pecR, eyeL, eyeR);
      }
    } else if (type === 'berry') {
      label = 'Camu-Camu River Berry';
      hungerRestore = 35;
      pointsValue = 10;

      if (build) {
        const berryGeo = new THREE.SphereGeometry(0.28, 12, 10);
        const berryMesh = new THREE.Mesh(berryGeo, this.berryMat);
        const leafGeo = new THREE.SphereGeometry(0.11, 6, 5);
        leafGeo.scale(1.4, 0.35, 0.8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.4 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(0.04, 0.28, 0);
        leaf.rotation.z = -0.3;
        group.add(berryMesh, leaf);
      }
    } else if (type === 'smooth_stone') {
      label = 'Smooth Jade River Stone';
      pointsValue = 15;
      isTreasure = true;

      if (build) {
        const stoneGeo = new THREE.SphereGeometry(0.38, 14, 10);
        stoneGeo.scale(1.32, 0.62, 1.05);
        const stoneMesh = new THREE.Mesh(stoneGeo, this.smoothStoneMat);

        const bandGeo = new THREE.TorusGeometry(0.37, 0.045, 6, 20);
        bandGeo.rotateX(Math.PI / 2);
        bandGeo.scale(1.32, 1.05, 1.0);
        const bandMesh = new THREE.Mesh(bandGeo, this.trinketGoldMat);

        group.add(stoneMesh, bandMesh);
      }
    } else if (type === 'shimmering_scale') {
      label = 'Shimmering Arapaima Scale';
      pointsValue = 25;
      isTreasure = true;

      if (build) {
        const scaleMesh = new THREE.Mesh(this.scaleGeo, this.shimmeringScaleMat);
        const auraGeo = new THREE.RingGeometry(0.45, 0.62, 32);
        const auraMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
        group.add(scaleMesh, new THREE.Mesh(auraGeo, auraMat));
      }
    } else if (type === 'lost_trinket') {
      label = 'Sunken Golden Compass Trinket';
      pointsValue = 40;
      isTreasure = true;

      if (build) {
        const ringGeo = new THREE.TorusGeometry(0.36, 0.09, 8, 20);
        const ringMesh = new THREE.Mesh(ringGeo, this.trinketGoldMat);
        const crownGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 10);
        const crownMesh = new THREE.Mesh(crownGeo, this.trinketGoldMat);
        crownMesh.position.y = 0.44;
        const gemGeo = new THREE.IcosahedronGeometry(0.24, 1);
        const gemMesh = new THREE.Mesh(gemGeo, this.trinketGemMat);
        group.add(ringMesh, crownMesh, gemMesh);
      }
    } else if (type === 'pearl') {
      label = 'Glowing River Pearl';
      pointsValue = 30;
      isTreasure = true;

      if (build) {
        const shellMat = new THREE.MeshPhysicalMaterial({
          color: 0x6d4c41,
          roughness: 0.45,
          clearcoat: 0.7,
          side: THREE.DoubleSide,
        });
        const bottomShellGeo = new THREE.SphereGeometry(
          0.44,
          14,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.5
        );
        bottomShellGeo.scale(1.18, 0.45, 1.02);
        const bottomShell = new THREE.Mesh(bottomShellGeo, shellMat);
        bottomShell.rotation.x = Math.PI;
        bottomShell.position.y = -0.1;

        const topShell = new THREE.Mesh(bottomShellGeo, shellMat);
        topShell.position.set(0, 0.12, -0.25);
        topShell.rotation.x = -0.65;

        const pearlGeo = new THREE.SphereGeometry(0.26, 12, 10);
        const pearlMesh = new THREE.Mesh(pearlGeo, this.pearlMat);
        pearlMesh.position.y = 0.06;
        group.add(bottomShell, topShell, pearlMesh);
      }
    }

    if (build) {
      if (type === 'tiny_fish' && group.children[1]) group.children[1].name = 'tail';
      const tailPart = group.getObjectByName('tail');
      mergeStaticMeshes(group, tailPart ? [tailPart] : []);
      this.templates.set(type, group.clone());
    }

    const worldX = riverPos.x + riverNormal.x * lateral;
    const worldZ = riverPos.z + riverNormal.z * lateral;
    group.position.set(worldX, baseY, worldZ);

    this.itemGroup.add(group);

    this.items.push({
      id,
      type,
      label,
      group,
      position: new THREE.Vector3(worldX, baseY, worldZ),
      baseY,
      distance: dist,
      lateralOffset: lateral,
      collected: false,
      attracted: false,
      hungerRestore,
      pointsValue,
      isTreasure,
      phase: Math.random() * Math.PI * 2,
      tail: group.getObjectByName('tail') ?? undefined,
    });
  }

  public updateAndCheckCollisions(
    dt: number,
    playerPosition: THREE.Vector3,
    magnetRadius: number,
    onCollectItem: (item: RiverItem) => void
  ) {
    const collectRadius = 1.45;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.collected) continue;

      const distZ = Math.abs(item.position.z - playerPosition.z);
      if (distZ > 75) continue;

      item.phase += dt * 3.0;

      if (item.attracted) {
        // Spin while flying in; skip the idle bobbing so nothing overrides the pull.
        item.group.rotation.y += dt * 6.0;
      } else if (item.type === 'star' || item.isTreasure) {
        item.group.rotation.y += dt * 2.1;
        item.group.position.y = item.baseY + Math.sin(item.phase) * 0.16;
      } else if (item.type === 'larva') {
        item.group.rotation.z = Math.sin(item.phase * 1.8) * 0.35 + Math.PI / 3;
        item.group.position.y = item.baseY + Math.sin(item.phase * 0.9) * 0.1;
      } else if (item.type === 'tiny_fish') {
        item.group.position.x = item.position.x + Math.sin(item.phase * 1.4) * 0.65;
        item.group.position.y = item.baseY + Math.cos(item.phase) * 0.14;
        item.group.rotation.y = Math.cos(item.phase * 1.4) * 0.65;
        if (item.tail) {
          item.tail.rotation.y = Math.sin(item.phase * 7.0) * 0.42;
        }
      } else {
        item.group.rotation.y += dt * 1.5;
        item.group.position.y = item.baseY + Math.sin(item.phase) * 0.15;
      }

      const dist = item.group.position.distanceTo(playerPosition);

      if (dist < magnetRadius) {
        item.attracted = true;
      }
      if (item.attracted) {
        // Faster than Whiskers can swim (even boosting), and never overshoots him.
        _pullDir.subVectors(playerPosition, item.group.position).normalize();
        const pullSpeed = 14.0 + dist * 2.0;
        item.group.position.addScaledVector(_pullDir, Math.min(dist, pullSpeed * dt));
      }

      if (dist < collectRadius) {
        item.collected = true;
        item.group.visible = false;

        if (item.hungerRestore > 0) {
          sound.playEatFood(item.type === 'tiny_fish');
        } else {
          sound.playCollectTreasure(
            item.type as
              | 'star'
              | 'smooth_stone'
              | 'shimmering_scale'
              | 'lost_trinket'
              | 'pearl'
          );
        }

        onCollectItem(item);
      }
    }
  }

  public resetItems() {
    this.items.forEach((item) => {
      item.collected = false;
      item.attracted = false;
      item.group.visible = true;
      item.group.position.copy(item.position);
    });
  }

  public dispose() {
    this.starGeo.dispose();
    this.scaleGeo.dispose();
    this.minnowBodyGeo.dispose();
    this.minnowTailGeo.dispose();
    this.minnowDorsalGeo.dispose();
    this.minnowPecGeo.dispose();
    this.starMat.dispose();
    this.larvaMat.dispose();
    this.larvaHeadMat.dispose();
    this.tinyFishMat.dispose();
    this.tinyFishFinMat.dispose();
    this.berryMat.dispose();
    this.pearlMat.dispose();
    this.smoothStoneMat.dispose();
    this.shimmeringScaleMat.dispose();
    this.trinketGoldMat.dispose();
    this.trinketGemMat.dispose();
    this.eyeMat.dispose();
  }
}
