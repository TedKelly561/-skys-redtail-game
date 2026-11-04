import * as THREE from 'three';
import { getRiverPath } from './worldGen';
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
  hungerRestore: number; // > 0 for food items
  pointsValue: number; // points awarded
  isTreasure: boolean;
  phase: number;
}

function createStarGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  const outerR = 0.55;
  const innerR = 0.26;

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
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  });
}

function createScaleGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.quadraticCurveTo(0.45, -0.35, 0.42, 0.15);
  shape.quadraticCurveTo(0, 0.55, -0.42, 0.15);
  shape.quadraticCurveTo(-0.45, -0.35, 0, -0.45);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
}

/**
 * Item Manager for Plentiful Food (Larvae, Tiny Fish, Berries) and
 * Shiny Collectible Treasures (Stars, Smooth Stones, Shimmering Scales, Lost Trinkets, Pearls)
 */
export class ItemManager {
  public scene: THREE.Scene;
  public items: RiverItem[] = [];
  public itemGroup: THREE.Group;

  private starGeo: THREE.BufferGeometry;
  private scaleGeo: THREE.BufferGeometry;
  private starMat: THREE.MeshStandardMaterial;
  private larvaMat: THREE.MeshStandardMaterial;
  private tinyFishMat: THREE.MeshStandardMaterial;
  private berryMat: THREE.MeshStandardMaterial;
  private pearlMat: THREE.MeshStandardMaterial;
  private smoothStoneMat: THREE.MeshStandardMaterial;
  private shimmeringScaleMat: THREE.MeshStandardMaterial;
  private trinketGoldMat: THREE.MeshStandardMaterial;
  private trinketGemMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.itemGroup = new THREE.Group();
    this.scene.add(this.itemGroup);

    this.starGeo = createStarGeometry();
    this.scaleGeo = createScaleGeometry();

    this.starMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.48,
      roughness: 0.18,
      metalness: 0.72,
    });

    this.larvaMat = new THREE.MeshStandardMaterial({
      color: 0xf24438,
      emissive: 0x9e1c14,
      emissiveIntensity: 0.35,
      roughness: 0.38,
    });

    this.tinyFishMat = new THREE.MeshStandardMaterial({
      color: 0xd8f3ff,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.25,
      roughness: 0.15,
      metalness: 0.85,
    });

    this.berryMat = new THREE.MeshStandardMaterial({
      color: 0xc2185b,
      emissive: 0x6a0dad,
      emissiveIntensity: 0.3,
      roughness: 0.2,
    });

    this.pearlMat = new THREE.MeshStandardMaterial({
      color: 0xf5faff,
      emissive: 0x88d4ff,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.88,
    });

    this.smoothStoneMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.45,
    });

    this.shimmeringScaleMat = new THREE.MeshStandardMaterial({
      color: 0xe879f9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      roughness: 0.12,
      metalness: 0.9,
    });

    this.trinketGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffc107,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      metalness: 0.92,
    });

    this.trinketGemMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });

    this.spawnRiverItems();
  }

  private spawnRiverItems() {
    let idCounter = 1;
    const totalDist = 3100;

    // Spawn items every 10 meters so food and treasures are plentiful and exciting to discover!
    for (let dist = 20; dist < totalDist; dist += 10) {
      const { position, normal, width } = getRiverPath(dist);

      // 1. Plentiful Food Item (Larvae on the riverbed OR Tiny Feeder Fish in mid-water)
      if (Math.random() < 0.88) {
        const isTinyFish = Math.random() < 0.42;
        const lateral = (Math.random() - 0.5) * (width * 0.72);
        const depthY = isTinyFish
          ? -1.4 - Math.random() * 1.4
          : -2.7 - Math.random() * 1.0;
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

      // Extra snack cluster every 30m so young players never struggle to find food
      if (dist % 30 === 0) {
        const lateral = (Math.random() - 0.5) * (width * 0.5);
        this.createItem(
          idCounter++,
          dist % 60 === 0 ? 'berry' : 'larva',
          dist + 4,
          lateral,
          dist % 60 === 0 ? -0.9 : -3.1,
          position,
          normal
        );
      }

      // 2. Golden River Stars along scenic arcs
      if (Math.random() < 0.68) {
        const lateral = Math.sin(dist * 0.08) * 0.5 * (width * 0.6);
        const starY = -1.2 + Math.sin(dist * 0.05) * 0.95;
        this.createItem(idCounter++, 'star', dist, lateral, starY, position, normal);
      }

      // 3. Collectible Shiny Treasures scattered along the river (Smooth Stones, Shimmering Scales, Lost Trinkets, Pearls)
      if (Math.random() < 0.55) {
        const lateral = (Math.random() - 0.5) * (width * 0.68);
        const roll = Math.random();
        let tType: ItemType = 'smooth_stone';
        let tY = -3.2;

        if (roll < 0.36) {
          tType = 'smooth_stone';
          tY = -3.35;
        } else if (roll < 0.66) {
          tType = 'shimmering_scale';
          tY = -2.3 - Math.random() * 0.9;
        } else if (roll < 0.86) {
          tType = 'lost_trinket';
          tY = -2.9;
        } else {
          tType = 'pearl';
          tY = -3.3;
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
    const group = new THREE.Group();
    let label = 'Item';
    let hungerRestore = 0;
    let pointsValue = 5;
    let isTreasure = false;

    if (type === 'star') {
      label = 'Golden River Star';
      pointsValue = 10;
      isTreasure = false;

      const starMesh = new THREE.Mesh(this.starGeo, this.starMat);
      starMesh.scale.set(0.9, 0.9, 0.9);
      group.add(starMesh);

      const haloGeo = new THREE.RingGeometry(0.5, 0.75, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffea00,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(haloGeo, haloMat));
    } else if (type === 'larva') {
      label = 'Juicy River Larva';
      hungerRestore = 20;
      pointsValue = 5;

      const segGeo = new THREE.SphereGeometry(0.19, 10, 10);
      for (let s = 0; s < 3; s++) {
        const seg = new THREE.Mesh(segGeo, this.larvaMat);
        seg.position.set(0, s * 0.22, 0);
        seg.scale.set(1.0 - s * 0.14, 0.9, 1.0 - s * 0.14);
        group.add(seg);
      }
      group.rotation.z = Math.PI / 4;
    } else if (type === 'tiny_fish') {
      label = 'Silver Feeder Minnow';
      hungerRestore = 28;
      pointsValue = 8;

      const bodyGeo = new THREE.ConeGeometry(0.16, 0.55, 10);
      bodyGeo.rotateX(Math.PI / 2);
      bodyGeo.scale(0.85, 1.1, 1.0);
      const bodyMesh = new THREE.Mesh(bodyGeo, this.tinyFishMat);

      const tailGeo = new THREE.ConeGeometry(0.14, 0.22, 4);
      tailGeo.rotateX(-Math.PI / 2);
      const tailMesh = new THREE.Mesh(tailGeo, this.tinyFishMat);
      tailMesh.position.z = -0.32;

      group.add(bodyMesh, tailMesh);
    } else if (type === 'berry') {
      label = 'Camu-Camu River Berry';
      hungerRestore = 35;
      pointsValue = 10;

      const berryGeo = new THREE.SphereGeometry(0.28, 12, 12);
      const berryMesh = new THREE.Mesh(berryGeo, this.berryMat);
      const leafGeo = new THREE.ConeGeometry(0.1, 0.25, 4);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 0.3;
      group.add(berryMesh, leaf);
    } else if (type === 'smooth_stone') {
      label = 'Smooth Jade River Stone';
      pointsValue = 15;
      isTreasure = true;

      // Glossy polished river pebble with golden band
      const stoneGeo = new THREE.SphereGeometry(0.38, 16, 12);
      stoneGeo.scale(1.3, 0.62, 1.05);
      const stoneMesh = new THREE.Mesh(stoneGeo, this.smoothStoneMat);

      const bandGeo = new THREE.TorusGeometry(0.37, 0.045, 8, 20);
      bandGeo.rotateX(Math.PI / 2);
      bandGeo.scale(1.3, 1.05, 1.0);
      const bandMesh = new THREE.Mesh(bandGeo, this.trinketGoldMat);

      group.add(stoneMesh, bandMesh);
    } else if (type === 'shimmering_scale') {
      label = 'Shimmering Arapaima Scale';
      pointsValue = 25;
      isTreasure = true;

      const scaleMesh = new THREE.Mesh(this.scaleGeo, this.shimmeringScaleMat);
      const auraGeo = new THREE.RingGeometry(0.45, 0.62, 16);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      group.add(scaleMesh, new THREE.Mesh(auraGeo, auraMat));
    } else if (type === 'lost_trinket') {
      label = 'Sunken Golden Compass Trinket';
      pointsValue = 40;
      isTreasure = true;

      // Ornate golden ring + glowing turquoise jewel core
      const ringGeo = new THREE.TorusGeometry(0.36, 0.09, 10, 20);
      const ringMesh = new THREE.Mesh(ringGeo, this.trinketGoldMat);
      const crownGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 8);
      const crownMesh = new THREE.Mesh(crownGeo, this.trinketGoldMat);
      crownMesh.position.y = 0.44;
      const gemGeo = new THREE.OctahedronGeometry(0.24, 0);
      const gemMesh = new THREE.Mesh(gemGeo, this.trinketGemMat);
      group.add(ringMesh, crownMesh, gemMesh);
    } else if (type === 'pearl') {
      label = 'Glowing River Pearl';
      pointsValue = 30;
      isTreasure = true;

      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x6d4c41,
        roughness: 0.6,
      });
      const bottomShellGeo = new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
      bottomShellGeo.scale(1.1, 0.45, 1.0);
      const bottomShell = new THREE.Mesh(bottomShellGeo, shellMat);
      bottomShell.rotation.x = Math.PI;
      bottomShell.position.y = -0.1;

      const pearlGeo = new THREE.SphereGeometry(0.28, 16, 16);
      const pearlMesh = new THREE.Mesh(pearlGeo, this.pearlMat);
      pearlMesh.position.y = 0.06;
      group.add(bottomShell, pearlMesh);
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
      hungerRestore,
      pointsValue,
      isTreasure,
      phase: Math.random() * Math.PI * 2,
    });
  }

  public updateAndCheckCollisions(
    dt: number,
    playerPosition: THREE.Vector3,
    onCollectItem: (item: RiverItem) => void
  ) {
    const magnetRadius = 3.5; // Generous magnetic pull for young players
    const collectRadius = 1.45;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.collected) continue;

      const distZ = Math.abs(item.position.z - playerPosition.z);
      if (distZ > 75) continue;

      item.phase += dt * 3.0;

      if (item.type === 'star' || item.isTreasure) {
        item.group.rotation.y += dt * 2.1;
        item.group.position.y = item.baseY + Math.sin(item.phase) * 0.16;
      } else if (item.type === 'larva') {
        item.group.rotation.z = Math.sin(item.phase * 1.6) * 0.4 + 0.3;
        item.group.position.y = item.baseY + Math.sin(item.phase * 0.9) * 0.12;
      } else if (item.type === 'tiny_fish') {
        // Little feeder fish swims in tiny figure-8 wiggle
        item.group.position.x = item.position.x + Math.sin(item.phase * 1.4) * 0.55;
        item.group.position.y = item.baseY + Math.cos(item.phase) * 0.14;
        item.group.rotation.y = Math.cos(item.phase * 1.4) * 0.6;
      } else {
        item.group.rotation.y += dt * 1.5;
        item.group.position.y = item.baseY + Math.sin(item.phase) * 0.15;
      }

      const dist = item.group.position.distanceTo(playerPosition);

      if (dist < magnetRadius) {
        const pullDir = new THREE.Vector3()
          .subVectors(playerPosition, item.group.position)
          .normalize();
        const pullSpeed = (magnetRadius - dist) * 8.0;
        item.group.position.addScaledVector(pullDir, pullSpeed * dt);
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
      item.group.visible = true;
      item.group.position.copy(item.position);
    });
  }

  public dispose() {
    this.starGeo.dispose();
    this.scaleGeo.dispose();
    this.starMat.dispose();
    this.larvaMat.dispose();
    this.tinyFishMat.dispose();
    this.berryMat.dispose();
    this.pearlMat.dispose();
    this.smoothStoneMat.dispose();
    this.shimmeringScaleMat.dispose();
    this.trinketGoldMat.dispose();
    this.trinketGemMat.dispose();
  }
}
