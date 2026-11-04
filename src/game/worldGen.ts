import * as THREE from 'three';

export interface RiverChapterInfo {
  id: number;
  name: string;
  subtitle: string;
  startDist: number;
  endDist: number;
  waterColor: string;
  fogColor: string;
  ambientLightColor: string;
  description: string;
}

export const CHAPTERS: RiverChapterInfo[] = [
  {
    id: 1,
    name: 'Whispering Shallows',
    subtitle: 'Sunlit sands, neon tetras & gentle bends',
    startDist: 0,
    endDist: 480,
    waterColor: '#1ca9b0',
    fogColor: '#c4f2ec',
    ambientLightColor: '#dff8fc',
    description:
      'Swim alongside friendly neon tetra schools, snack on larvae, and find smooth river stones!',
  },
  {
    id: 2,
    name: 'Sunlit Lotus Groves',
    subtitle: 'Giant lily pads, hopping frogs & hollow logs',
    startDist: 480,
    endDist: 1050,
    waterColor: '#199988',
    fogColor: '#bcefd9',
    ambientLightColor: '#d8faea',
    description:
      'Wave to hopping lily-pad frogs, paddling turtles, and capybaras while searching hollow logs!',
  },
  {
    id: 3,
    name: 'Emerald Canyon Rapids',
    subtitle: 'Swirling currents, driftwood & shimmering scales',
    startDist: 1050,
    endDist: 1680,
    waterColor: '#128e9e',
    fogColor: '#b0ecf0',
    ambientLightColor: '#cff6fa',
    description:
      'Ride the sparkling aqua river currents and weave around sunken logs for lost trinkets!',
  },
  {
    id: 4,
    name: 'Golden Canopy Mangroves',
    subtitle: 'Darting dragonflies & pink river dolphins',
    startDist: 1680,
    endDist: 2350,
    waterColor: '#1d75a8',
    fogColor: '#b8dcf5',
    ambientLightColor: '#d9ecfc',
    description:
      'Boto the pink river dolphin leaps beside you while blue dragonflies dance above the water!',
  },
  {
    id: 5,
    name: 'The Great Grand Lake',
    subtitle: 'Sunlit Paradise of the Redtail Catfish',
    startDist: 2350,
    endDist: 3200,
    waterColor: '#159bc7',
    fogColor: '#c6f4ff',
    ambientLightColor: '#ebfcff',
    description:
      'You made it! A breathtaking sunlit lake filled with your Redtail Catfish family and celebration!',
  },
];

export interface RiverCurrentZone {
  distance: number;
  lateralOffset: number;
  radius: number;
  length: number;
  boostSpeed: number;
  swirlPush: number;
  group: THREE.Group;
  position: THREE.Vector3;
}

export interface LogObstacle {
  distance: number;
  lateralOffset: number;
  y: number;
  radius: number;
  length: number;
  isHollow: boolean;
  position: THREE.Vector3;
}

/**
 * Calculates smooth winding river path with lively S-bends at any downstream distance
 */
export function getRiverPath(distance: number): {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
} {
  const z = -distance;
  // Enhanced multi-frequency meandering river bends for engaging navigation
  const x =
    Math.sin(distance * 0.0085) * 26 +
    Math.sin(distance * 0.023) * 11 +
    Math.cos(distance * 0.014) * 6.5;
  const y = 0;

  let width = 30;
  if (distance > 2300) {
    const lakeProgress = Math.min(1.0, (distance - 2300) / 300);
    width = 30 + lakeProgress * 95;
  } else if (distance > 1050 && distance < 1680) {
    width = 25;
  }

  const aheadDist = distance + 1.0;
  const aheadZ = -aheadDist;
  const aheadX =
    Math.sin(aheadDist * 0.0085) * 26 +
    Math.sin(aheadDist * 0.023) * 11 +
    Math.cos(aheadDist * 0.014) * 6.5;
  const tangent = new THREE.Vector3(aheadX - x, 0, aheadZ - z).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  return {
    position: new THREE.Vector3(x, y, z),
    tangent,
    normal,
    width,
  };
}

/**
 * River World Manager: instanced riverbed, sunlit bank trees, currents, hollow logs,
 * schools of small fish, turtles, frogs, dragonflies, capybaras, pink dolphins, and Grand Lake.
 */
export class RiverWorld {
  public scene: THREE.Scene;
  public riverBedGroup: THREE.Group;
  public treesGroup: THREE.Group;
  public waterMesh: THREE.Mesh;
  public plantInstancedMesh: THREE.InstancedMesh;
  public stoneInstancedMesh: THREE.InstancedMesh;
  public lilyPadsGroup: THREE.Group;
  public hollowLogsGroup: THREE.Group;
  public currentsGroup: THREE.Group;
  public animalsGroup: THREE.Group;
  public grandLakeCelebrationGroup: THREE.Group;

  // Interactive Currents and Logs
  public currentZones: RiverCurrentZone[] = [];
  public logObstacles: LogObstacle[] = [];

  // Animated Friendly Creatures
  public dolphins: { group: THREE.Group; startZ: number; speed: number; phase: number }[] = [];
  public fishSchools: {
    group: THREE.Group;
    centerPos: THREE.Vector3;
    radius: number;
    speed: number;
    phase: number;
  }[] = [];
  public turtles: {
    group: THREE.Group;
    basePos: THREE.Vector3;
    flippers: THREE.Mesh[];
    phase: number;
    speed: number;
  }[] = [];
  public frogs: {
    group: THREE.Group;
    baseY: number;
    phase: number;
  }[] = [];
  public dragonflies: {
    group: THREE.Group;
    basePos: THREE.Vector3;
    wings: THREE.Mesh[];
    phase: number;
  }[] = [];
  public grandLakeCatfish: {
    group: THREE.Group;
    basePos: THREE.Vector3;
    orbitRadius: number;
    phase: number;
    speed: number;
    name: string;
  }[] = [];

  public bubbleParticles: THREE.Points;
  private bubblePosArray: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.riverBedGroup = new THREE.Group();
    this.treesGroup = new THREE.Group();
    this.lilyPadsGroup = new THREE.Group();
    this.hollowLogsGroup = new THREE.Group();
    this.currentsGroup = new THREE.Group();
    this.animalsGroup = new THREE.Group();
    this.grandLakeCelebrationGroup = new THREE.Group();

    this.scene.add(this.riverBedGroup);
    this.scene.add(this.treesGroup);
    this.scene.add(this.lilyPadsGroup);
    this.scene.add(this.hollowLogsGroup);
    this.scene.add(this.currentsGroup);
    this.scene.add(this.animalsGroup);
    this.scene.add(this.grandLakeCelebrationGroup);

    // 1. Water Surface (Bright, sunlit tropical river water)
    const waterGeo = new THREE.PlaneGeometry(180, 620, 32, 64);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#20b2be'),
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(0, 0, 0);
    this.scene.add(this.waterMesh);

    // 2. Instanced Aquatic Plants
    const plantGeo = this.createAquaticPlantGeometry();
    const plantMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#34a853'),
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const maxPlants = 480;
    this.plantInstancedMesh = new THREE.InstancedMesh(plantGeo, plantMat, maxPlants);
    this.plantInstancedMesh.receiveShadow = true;
    this.scene.add(this.plantInstancedMesh);

    // 3. Instanced Smooth River Stones
    const stoneGeo = new THREE.DodecahedronGeometry(0.75, 1);
    stoneGeo.scale(1.25, 0.6, 1.05);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8a7b65'),
      roughness: 0.8,
    });
    const maxStones = 340;
    this.stoneInstancedMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, maxStones);
    this.stoneInstancedMesh.receiveShadow = true;
    this.scene.add(this.stoneInstancedMesh);

    // 4. Bubble Particle System
    const bubbleCount = 650;
    const bubbleGeo = new THREE.BufferGeometry();
    this.bubblePosArray = new Float32Array(bubbleCount * 3);
    for (let i = 0; i < bubbleCount; i++) {
      this.bubblePosArray[i * 3 + 0] = (Math.random() - 0.5) * 32;
      this.bubblePosArray[i * 3 + 1] = -Math.random() * 4.5;
      this.bubblePosArray[i * 3 + 2] = -Math.random() * 200;
    }
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(this.bubblePosArray, 3));

    const bCanvas = document.createElement('canvas');
    bCanvas.width = 64;
    bCanvas.height = 64;
    const bCtx = bCanvas.getContext('2d')!;
    bCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    bCtx.lineWidth = 4;
    bCtx.beginPath();
    bCtx.arc(32, 32, 26, 0, Math.PI * 2);
    bCtx.stroke();
    bCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    bCtx.fill();
    const bTex = new THREE.CanvasTexture(bCanvas);
    bTex.colorSpace = THREE.SRGBColorSpace;

    const bubbleMat = new THREE.PointsMaterial({
      size: 0.45,
      map: bTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.bubbleParticles = new THREE.Points(bubbleGeo, bubbleMat);
    this.scene.add(this.bubbleParticles);

    this.populateRiverElements();
  }

  private createAquaticPlantGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    const bladeAngles = [0, 2.1, 4.2];
    bladeAngles.forEach((ang) => {
      const vOffset = vertices.length / 3;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const height = 1.8 + Math.random() * 1.0;
      const sway = 0.5;

      for (let s = 0; s <= 4; s++) {
        const t = s / 4;
        const y = t * height;
        const xOffset = cosA * 0.18 * (1 - t) + Math.sin(t * Math.PI) * sway * cosA;
        const zOffset = sinA * 0.18 * (1 - t) + Math.sin(t * Math.PI) * sway * sinA;
        const w = (1 - t * 0.6) * 0.18;

        vertices.push(xOffset - sinA * w, y, zOffset + cosA * w);
        vertices.push(xOffset + sinA * w, y, zOffset - cosA * w);
      }

      for (let s = 0; s < 4; s++) {
        const i0 = vOffset + s * 2;
        const i1 = i0 + 1;
        const i2 = i0 + 2;
        const i3 = i0 + 3;
        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  public generateRiverbedTerrain() {
    const totalDist = 3300;
    const step = 7;
    const segments = Math.floor(totalDist / step);
    const crossPoints = 16;

    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const sandColor = new THREE.Color('#e2cfab');
    const mossColor = new THREE.Color('#5cb85c');
    const bankGrassColor = new THREE.Color('#6ec965');
    const canyonColor = new THREE.Color('#5a755c');
    const lakeSandColor = new THREE.Color('#f0e6c2');

    for (let i = 0; i <= segments; i++) {
      const dist = i * step;
      const { position, normal, width } = getRiverPath(dist);

      let bedDepth = -4.2;
      let curColor = sandColor;
      if (dist >= 1050 && dist < 1680) {
        curColor = canyonColor;
        bedDepth = -4.9;
      } else if (dist >= 480 && dist < 1050) {
        curColor = mossColor;
      } else if (dist >= 2350) {
        curColor = lakeSandColor;
        bedDepth = -4.8;
      }

      for (let j = 0; j < crossPoints; j++) {
        const u = j / (crossPoints - 1);
        const offset = (u - 0.5) * width * 1.65;

        const crossY = (Math.pow((u - 0.5) * 2, 2) - 1.0) * (-bedDepth * 0.72) + bedDepth;
        let finalY = crossY;
        if (Math.abs(u - 0.5) > 0.39) {
          finalY = 1.4 + (Math.abs(u - 0.5) - 0.39) * 14.0;
        }

        const vx = position.x + normal.x * offset;
        const vy = finalY;
        const vz = position.z + normal.z * offset;

        vertices.push(vx, vy, vz);

        const isBank = Math.abs(u - 0.5) > 0.38;
        const c = isBank ? bankGrassColor : curColor;
        colors.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < crossPoints - 1; j++) {
        const row1 = i * crossPoints + j;
        const row2 = (i + 1) * crossPoints + j;
        indices.push(row1, row1 + 1, row2);
        indices.push(row1 + 1, row2 + 1, row2);
      }
    }

    const bedGeo = new THREE.BufferGeometry();
    bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bedGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    bedGeo.setIndex(indices);
    bedGeo.computeVertexNormals();

    const bedMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.04,
    });

    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.receiveShadow = true;
    this.riverBedGroup.add(bedMesh);
  }

  public populateRiverElements() {
    this.generateRiverbedTerrain();

    const dummy = new THREE.Object3D();
    let plantIdx = 0;
    let stoneIdx = 0;

    for (let dist = 25; dist < 3000; dist += 16) {
      const { position, normal, width } = getRiverPath(dist);

      for (let p = 0; p < 2; p++) {
        if (plantIdx < 480) {
          const lateral = (Math.random() - 0.5) * (width * 0.68);
          dummy.position.set(
            position.x + normal.x * lateral,
            -3.6 + Math.random() * 0.4,
            position.z + normal.z * lateral
          );
          dummy.rotation.y = Math.random() * Math.PI * 2;
          const s = 0.85 + Math.random() * 0.5;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          this.plantInstancedMesh.setMatrixAt(plantIdx++, dummy.matrix);
        }
      }

      if (stoneIdx < 340) {
        const lateral = (Math.random() - 0.5) * (width * 0.72);
        dummy.position.set(
          position.x + normal.x * lateral,
          -3.85,
          position.z + normal.z * lateral
        );
        dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        const s = 0.75 + Math.random() * 0.65;
        dummy.scale.set(s, s * 0.6, s);
        dummy.updateMatrix();
        this.stoneInstancedMesh.setMatrixAt(stoneIdx++, dummy.matrix);
      }
    }
    this.plantInstancedMesh.instanceMatrix.needsUpdate = true;
    this.stoneInstancedMesh.instanceMatrix.needsUpdate = true;

    // Lush Sunlit Background Trees along both riverbanks
    this.createSunlitBankTrees();

    // Victoria Amazonica Lily Pads & Friendly Hopping Frogs
    this.createLilyPadsAndFrogs();

    // Hollow Sunken Logs & Driftwood Obstacles
    this.createLogsAndDriftwood();

    // Swirling Aqua River Currents
    this.createRiverCurrents();

    // Friendly River Creatures: Fish Schools, Turtles, Dragonflies, Capybaras, Dolphins
    this.createFishSchools();
    this.createFriendlyTurtles();
    this.createDartingDragonflies();
    this.createFriendlyCapybaras();
    this.createPinkRiverDolphins();

    // Grand Lake Catfish School Celebration
    this.createGrandLakeParadise();
  }

  /**
   * Adds bright, sunlit tropical palm trees and flowering rainforest canopy trees along the banks
   * Uses warm emissive bounce tinting and no shadow-casting on water so the river stays bright!
   */
  private createSunlitBankTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8f6843'),
      roughness: 0.8,
    });
    const leafMatBright = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4cd964'),
      emissive: new THREE.Color('#1f5e28'),
      emissiveIntensity: 0.22,
      roughness: 0.5,
    });
    const leafMatLush = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#34c759'),
      emissive: new THREE.Color('#194d22'),
      emissiveIntensity: 0.18,
      roughness: 0.55,
    });
    const yellowBloomMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffdd33'),
      emissive: new THREE.Color('#ffaa00'),
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const coralBloomMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff6b8b'),
      emissive: new THREE.Color('#d9385a'),
      emissiveIntensity: 0.3,
      roughness: 0.3,
    });

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.52, 5.8, 8);
    const canopyGeo = new THREE.DodecahedronGeometry(2.3, 1);
    canopyGeo.scale(1.25, 0.72, 1.25);
    const frondGeo = new THREE.ConeGeometry(0.65, 3.2, 5);
    frondGeo.rotateX(Math.PI / 2.4);
    const bloomGeo = new THREE.SphereGeometry(0.42, 8, 8);

    for (let dist = 20; dist < 2900; dist += 32) {
      const { position, normal, width } = getRiverPath(dist);

      // Place trees on both left (-1) and right (+1) banks
      [-1, 1].forEach((side) => {
        const treeGroup = new THREE.Group();
        const isPalm = (Math.floor(dist) + (side > 0 ? 1 : 0)) % 2 === 0;

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2.9;
        trunk.rotation.z = side * -0.12; // Lean slightly over the scenic river
        treeGroup.add(trunk);

        if (isPalm) {
          // Tropical Amazonian Palm with radiating sunlit fronds
          for (let f = 0; f < 6; f++) {
            const frondPivot = new THREE.Group();
            frondPivot.position.set(side * 0.35, 5.6, 0);
            frondPivot.rotation.y = (f / 6) * Math.PI * 2 + dist * 0.1;
            const frond = new THREE.Mesh(
              frondGeo,
              f % 2 === 0 ? leafMatBright : leafMatLush
            );
            frond.position.z = 1.3;
            frondPivot.add(frond);
            treeGroup.add(frondPivot);
          }
        } else {
          // Sunlit Flowering Rainforest Canopy Tree (Golden Ipê / Hibiscus)
          const c1 = new THREE.Mesh(canopyGeo, leafMatBright);
          c1.position.set(0, 5.8, 0);
          const c2 = new THREE.Mesh(canopyGeo, leafMatLush);
          c2.position.set(side * 1.1, 5.1, 0.7);
          c2.scale.set(0.8, 0.8, 0.8);
          treeGroup.add(c1, c2);

          // Add bright tropical tree blossoms
          const bMat = dist % 64 === 0 ? yellowBloomMat : coralBloomMat;
          for (let b = 0; b < 3; b++) {
            const bloom = new THREE.Mesh(bloomGeo, bMat);
            bloom.position.set(
              (b - 1) * 0.9,
              6.3 + (b % 2) * 0.3,
              (b % 2 === 0 ? 1 : -1) * 0.7
            );
            treeGroup.add(bloom);
          }
        }

        const bankDist = width * 0.58 + 3.8 + (dist % 5);
        treeGroup.position.set(
          position.x + normal.x * (side * bankDist),
          1.2,
          position.z + normal.z * (side * bankDist)
        );
        const s = 0.95 + (dist % 7) * 0.08;
        treeGroup.scale.set(s, s, s);
        this.treesGroup.add(treeGroup);
      });
    }
  }

  private createLilyPadsAndFrogs() {
    const padMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#43a047'),
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2e7d32'),
      roughness: 0.5,
    });
    const flowerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff80ab'),
      roughness: 0.25,
    });
    const frogMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#32cd32'),
      roughness: 0.3,
    });
    const frogEyeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffd700'),
      roughness: 0.15,
    });

    for (let dist = 90; dist < 2350; dist += 68) {
      const { position, normal, width } = getRiverPath(dist);
      const side = (Math.floor(dist / 68) % 2 === 0 ? 1 : -1);
      const padGroup = new THREE.Group();

      const padRadius = 2.3 + (dist % 3) * 0.4;
      const padGeo = new THREE.CylinderGeometry(padRadius, padRadius, 0.06, 24);
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padGroup.add(padMesh);

      const rimGeo = new THREE.TorusGeometry(padRadius, 0.12, 8, 24);
      rimGeo.rotateX(Math.PI / 2);
      rimGeo.scale(1, 1, 1.8);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.y = 0.1;
      padGroup.add(rimMesh);

      // Lotus Blossom
      if (dist % 136 === 0) {
        const flowerGroup = new THREE.Group();
        for (let pet = 0; pet < 8; pet++) {
          const petalGeo = new THREE.ConeGeometry(0.2, 0.6, 6);
          petalGeo.rotateZ(0.5);
          const petalMesh = new THREE.Mesh(petalGeo, flowerMat);
          petalMesh.rotation.y = (pet / 8) * Math.PI * 2;
          flowerGroup.add(petalMesh);
        }
        flowerGroup.position.set(0.5, 0.15, 0.3);
        padGroup.add(flowerGroup);
      }

      // Friendly Green Tree Frog sitting on the lily pad!
      const frogGroup = new THREE.Group();
      const fBodyGeo = new THREE.SphereGeometry(0.32, 10, 10);
      fBodyGeo.scale(1.0, 0.75, 1.25);
      const fBody = new THREE.Mesh(fBodyGeo, frogMat);
      fBody.position.y = 0.22;
      frogGroup.add(fBody);

      const fHeadGeo = new THREE.SphereGeometry(0.24, 10, 10);
      fHeadGeo.scale(1.15, 0.8, 1.0);
      const fHead = new THREE.Mesh(fHeadGeo, frogMat);
      fHead.position.set(0, 0.34, 0.28);
      frogGroup.add(fHead);

      const fEyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const fEyeL = new THREE.Mesh(fEyeGeo, frogEyeMat);
      fEyeL.position.set(0.14, 0.48, 0.32);
      const fEyeR = new THREE.Mesh(fEyeGeo, frogEyeMat);
      fEyeR.position.set(-0.14, 0.48, 0.32);
      frogGroup.add(fEyeL, fEyeR);

      frogGroup.position.set(-0.3, 0.08, -0.2);
      frogGroup.rotation.y = side * -1.2;
      padGroup.add(frogGroup);

      this.frogs.push({
        group: frogGroup,
        baseY: 0.08,
        phase: dist * 0.1,
      });

      padGroup.position.set(
        position.x + normal.x * (side * (width * 0.32)),
        0.02,
        position.z
      );
      this.lilyPadsGroup.add(padGroup);
    }
  }

  /**
   * Creates hollow logs to swim through AND sunken driftwood logs to weave around
   */
  private createLogsAndDriftwood() {
    const logMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5c4228'),
      roughness: 0.88,
    });
    const logInnerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2918'),
      roughness: 0.92,
      side: THREE.BackSide,
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4caf50'),
      roughness: 0.7,
    });

    // Place logs every ~140m down the river for engaging variety
    for (let dist = 160; dist < 2320; dist += 135) {
      const { position, normal, tangent, width } = getRiverPath(dist);
      const isHollow = dist % 270 === 160;
      const lateral = ((dist % 3) - 1) * (width * 0.18);
      const logGroup = new THREE.Group();

      if (isHollow) {
        // Swim-through Hollow Log Tunnel
        const outerGeo = new THREE.CylinderGeometry(1.75, 1.85, 7.8, 16, 1, true);
        outerGeo.rotateX(Math.PI / 2);
        const outerMesh = new THREE.Mesh(outerGeo, logMat);
        outerMesh.castShadow = true;
        outerMesh.receiveShadow = true;

        const innerGeo = new THREE.CylinderGeometry(1.55, 1.65, 7.8, 16, 1, true);
        innerGeo.rotateX(Math.PI / 2);
        const innerMesh = new THREE.Mesh(innerGeo, logInnerMat);

        // Cozy moss strip on top of the hollow log
        const mossGeo = new THREE.BoxGeometry(1.4, 0.25, 7.2);
        const mossMesh = new THREE.Mesh(mossGeo, mossMat);
        mossMesh.position.y = 1.75;

        logGroup.add(outerMesh, innerMesh, mossMesh);

        const worldPos = new THREE.Vector3(
          position.x + normal.x * lateral,
          -2.45,
          position.z + normal.z * lateral
        );
        logGroup.position.copy(worldPos);
        logGroup.rotation.y = Math.atan2(tangent.x, tangent.z);
        this.hollowLogsGroup.add(logGroup);

        this.logObstacles.push({
          distance: dist,
          lateralOffset: lateral,
          y: -2.45,
          radius: 1.75,
          length: 7.8,
          isHollow: true,
          position: worldPos,
        });
      } else {
        // Sunken Driftwood Branch lying angled across part of the channel to steer over/around
        const branchGeo = new THREE.CylinderGeometry(0.65, 0.85, 8.5, 12);
        branchGeo.rotateZ(Math.PI / 2);
        const branchMesh = new THREE.Mesh(branchGeo, logMat);
        branchMesh.castShadow = true;
        branchMesh.receiveShadow = true;
        logGroup.add(branchMesh);

        const logY = dist % 2 === 0 ? -3.1 : -1.5;
        const worldPos = new THREE.Vector3(
          position.x + normal.x * lateral,
          logY,
          position.z + normal.z * lateral
        );
        logGroup.position.copy(worldPos);
        logGroup.rotation.y = Math.atan2(tangent.x, tangent.z) + 0.35;
        this.hollowLogsGroup.add(logGroup);

        this.logObstacles.push({
          distance: dist,
          lateralOffset: lateral,
          y: logY,
          radius: 0.85,
          length: 8.5,
          isHollow: false,
          position: worldPos,
        });
      }
    }
  }

  /**
   * Creates sparkling swirling aqua river current streams that gently push & boost Whiskers
   */
  private createRiverCurrents() {
    const ringGeo = new THREE.TorusGeometry(1.65, 0.08, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7fffe8,
      transparent: true,
      opacity: 0.55,
    });
    const ribbonGeo = new THREE.CylinderGeometry(0.06, 0.06, 9.0, 6);
    ribbonGeo.rotateX(Math.PI / 2);

    for (let dist = 110; dist < 2300; dist += 125) {
      const { position, normal, tangent, width } = getRiverPath(dist);
      const lateral = Math.sin(dist * 0.05) * (width * 0.24);
      const currentGroup = new THREE.Group();

      // 3 glowing aqua rings + stream lines
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = (r - 1) * 3.2;
        ring.scale.setScalar(1.0 - r * 0.12);
        currentGroup.add(ring);
      }

      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        const stream = new THREE.Mesh(ribbonGeo, ringMat);
        stream.position.set(Math.cos(ang) * 1.2, Math.sin(ang) * 1.2, 0);
        currentGroup.add(stream);
      }

      const worldPos = new THREE.Vector3(
        position.x + normal.x * lateral,
        -1.85,
        position.z + normal.z * lateral
      );
      currentGroup.position.copy(worldPos);
      currentGroup.rotation.y = Math.atan2(tangent.x, tangent.z);
      this.currentsGroup.add(currentGroup);

      this.currentZones.push({
        distance: dist,
        lateralOffset: lateral,
        radius: 2.8,
        length: 10.0,
        boostSpeed: 2.4,
        swirlPush: (dist % 2 === 0 ? 1 : -1) * 1.8,
        group: currentGroup,
        position: worldPos,
      });
    }
  }

  /**
   * Creates lively schools of small Neon Tetras and Silver Hatchetfish
   */
  private createFishSchools() {
    const tetraBodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00e5ff'),
      emissive: new THREE.Color('#0077be'),
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.5,
    });
    const tetraTailMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff2a55'),
      roughness: 0.3,
    });

    const tinyBodyGeo = new THREE.ConeGeometry(0.12, 0.42, 8);
    tinyBodyGeo.rotateX(Math.PI / 2);
    const tinyTailGeo = new THREE.ConeGeometry(0.1, 0.18, 4);
    tinyTailGeo.rotateX(-Math.PI / 2);

    for (let dist = 55; dist < 2400; dist += 80) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.55);
      const schoolGroup = new THREE.Group();

      // 7 small fish swimming together in a school
      for (let f = 0; f < 7; f++) {
        const fish = new THREE.Group();
        const body = new THREE.Mesh(tinyBodyGeo, tetraBodyMat);
        const tail = new THREE.Mesh(tinyTailGeo, tetraTailMat);
        tail.position.z = -0.25;
        fish.add(body, tail);

        const angle = (f / 7) * Math.PI * 2;
        const r = 0.5 + (f % 3) * 0.35;
        fish.position.set(
          Math.cos(angle) * r,
          ((f % 3) - 1) * 0.25,
          Math.sin(angle) * r
        );
        schoolGroup.add(fish);
      }

      const centerPos = new THREE.Vector3(
        position.x + normal.x * lateral,
        -1.6 - (dist % 2) * 0.9,
        position.z + normal.z * lateral
      );
      schoolGroup.position.copy(centerPos);
      this.animalsGroup.add(schoolGroup);

      this.fishSchools.push({
        group: schoolGroup,
        centerPos,
        radius: 2.2,
        speed: 1.6 + (dist % 3) * 0.4,
        phase: dist * 0.05,
      });
    }
  }

  /**
   * Creates friendly Yellow-Spotted Amazon River Turtles paddling gently in the river
   */
  private createFriendlyTurtles() {
    const shellMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a6b3b'),
      roughness: 0.45,
    });
    const spotMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffd54f'),
      roughness: 0.4,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#688f4e'),
      roughness: 0.6,
    });

    const shellGeo = new THREE.SphereGeometry(0.65, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    shellGeo.scale(1.0, 0.65, 1.25);
    const headGeo = new THREE.SphereGeometry(0.22, 10, 10);
    headGeo.scale(0.9, 0.85, 1.25);
    const flipperGeo = new THREE.BoxGeometry(0.52, 0.06, 0.22);

    for (let dist = 140; dist < 2380; dist += 145) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.5);
      const turtle = new THREE.Group();

      const shell = new THREE.Mesh(shellGeo, shellMat);
      turtle.add(shell);

      // Cute yellow spots on carapace
      for (let s = 0; s < 3; s++) {
        const spot = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 8, 8),
          spotMat
        );
        spot.position.set((s - 1) * 0.25, 0.36, (s - 1) * 0.22);
        turtle.add(spot);
      }

      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 0.14, 0.88);
      turtle.add(head);

      const flippers: THREE.Mesh[] = [];
      const fPositions = [
        { x: 0.65, z: 0.42 },
        { x: -0.65, z: 0.42 },
        { x: 0.55, z: -0.45 },
        { x: -0.55, z: -0.45 },
      ];
      fPositions.forEach((fp) => {
        const flip = new THREE.Mesh(flipperGeo, skinMat);
        flip.position.set(fp.x, 0.05, fp.z);
        turtle.add(flip);
        flippers.push(flip);
      });

      const basePos = new THREE.Vector3(
        position.x + normal.x * lateral,
        -1.3 - (dist % 2) * 0.8,
        position.z + normal.z * lateral
      );
      turtle.position.copy(basePos);
      this.animalsGroup.add(turtle);

      this.turtles.push({
        group: turtle,
        basePos,
        flippers,
        phase: dist * 0.1,
        speed: 0.9,
      });
    }
  }

  /**
   * Creates iridescent Blue & Ruby Dragonflies hovering and darting above the water surface
   */
  private createDartingDragonflies() {
    const blueBodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00d4ff'),
      emissive: new THREE.Color('#0088cc'),
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const rubyBodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff3366'),
      emissive: new THREE.Color('#b3003b'),
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xe0ffff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    const dBodyGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.65, 6);
    dBodyGeo.rotateX(Math.PI / 2);
    const wingGeo = new THREE.PlaneGeometry(0.75, 0.14);
    wingGeo.rotateX(Math.PI / 2);

    for (let dist = 75; dist < 2400; dist += 95) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.6);
      const dfGroup = new THREE.Group();

      const body = new THREE.Mesh(
        dBodyGeo,
        dist % 190 === 75 ? blueBodyMat : rubyBodyMat
      );
      const wing1 = new THREE.Mesh(wingGeo, wingMat);
      wing1.position.set(0, 0.04, 0.12);
      const wing2 = new THREE.Mesh(wingGeo, wingMat);
      wing2.position.set(0, 0.04, -0.04);

      dfGroup.add(body, wing1, wing2);

      const basePos = new THREE.Vector3(
        position.x + normal.x * lateral,
        0.55,
        position.z + normal.z * lateral
      );
      dfGroup.position.copy(basePos);
      this.animalsGroup.add(dfGroup);

      this.dragonflies.push({
        group: dfGroup,
        basePos,
        wings: [wing1, wing2],
        phase: dist * 0.12,
      });
    }
  }

  private createFriendlyCapybaras() {
    const capyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9c6f44'),
      roughness: 0.78,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#42301f'),
      roughness: 0.7,
    });

    const capyDistances = [200, 580, 850, 1300, 1950, 2450];
    capyDistances.forEach((dist) => {
      const { position, normal, width } = getRiverPath(dist);
      const capy = new THREE.Group();

      const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.4, 8, 12);
      bodyGeo.rotateZ(Math.PI / 2);
      const bodyMesh = new THREE.Mesh(bodyGeo, capyMat);
      bodyMesh.position.y = 0.8;
      bodyMesh.castShadow = true;
      capy.add(bodyMesh);

      const headGeo = new THREE.BoxGeometry(0.7, 0.75, 1.0);
      const headMesh = new THREE.Mesh(headGeo, capyMat);
      headMesh.position.set(0, 1.3, 0.85);
      headMesh.castShadow = true;
      capy.add(headMesh);

      const snoutGeo = new THREE.BoxGeometry(0.55, 0.45, 0.4);
      const snoutMesh = new THREE.Mesh(snoutGeo, noseMat);
      snoutMesh.position.set(0, 1.15, 1.45);
      capy.add(snoutMesh);

      const earGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const earL = new THREE.Mesh(earGeo, capyMat);
      earL.position.set(0.35, 1.7, 0.65);
      const earR = new THREE.Mesh(earGeo, capyMat);
      earR.position.set(-0.35, 1.7, 0.65);
      capy.add(earL, earR);

      const side = dist % 400 === 200 ? 1 : -1;
      capy.position.set(
        position.x + normal.x * (side * (width * 0.52 + 1.5)),
        0.5,
        position.z
      );
      capy.rotation.y = side === 1 ? -Math.PI / 2 - 0.4 : Math.PI / 2 + 0.4;
      capy.scale.set(0.95, 0.95, 0.95);

      this.animalsGroup.add(capy);
    });
  }

  private createPinkRiverDolphins() {
    const dolphinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffafcc'),
      roughness: 0.25,
      metalness: 0.1,
    });

    const dSpots = [1720, 1980, 2220];
    dSpots.forEach((dist, idx) => {
      const { position, normal } = getRiverPath(dist);
      const dolph = new THREE.Group();

      const bodyGeo = new THREE.CylinderGeometry(0.2, 0.55, 2.8, 12);
      bodyGeo.rotateX(Math.PI / 2);
      const bodyMesh = new THREE.Mesh(bodyGeo, dolphinMat);
      dolph.add(bodyMesh);

      const beakGeo = new THREE.ConeGeometry(0.15, 0.85, 10);
      beakGeo.rotateX(Math.PI / 2);
      const beakMesh = new THREE.Mesh(beakGeo, dolphinMat);
      beakMesh.position.set(0, -0.05, 1.6);
      dolph.add(beakMesh);

      const melonGeo = new THREE.SphereGeometry(0.42, 12, 12);
      melonGeo.scale(0.9, 1.1, 1.0);
      const melonMesh = new THREE.Mesh(melonGeo, dolphinMat);
      melonMesh.position.set(0, 0.2, 1.1);
      dolph.add(melonMesh);

      const flipperGeo = new THREE.BoxGeometry(0.7, 0.06, 0.35);
      const flipL = new THREE.Mesh(flipperGeo, dolphinMat);
      flipL.position.set(0.65, -0.15, 0.5);
      flipL.rotation.z = -0.4;
      const flipR = new THREE.Mesh(flipperGeo, dolphinMat);
      flipR.position.set(-0.65, -0.15, 0.5);
      flipR.rotation.z = 0.4;
      dolph.add(flipL, flipR);

      const flukeGeo = new THREE.BoxGeometry(1.1, 0.05, 0.4);
      const flukeMesh = new THREE.Mesh(flukeGeo, dolphinMat);
      flukeMesh.position.set(0, 0, -1.5);
      dolph.add(flukeMesh);

      const side = idx % 2 === 0 ? 1 : -1;
      dolph.position.set(
        position.x + normal.x * (side * 6.5),
        -1.2,
        position.z
      );
      dolph.rotation.y = Math.PI;

      this.animalsGroup.add(dolph);
      this.dolphins.push({
        group: dolph,
        startZ: position.z,
        speed: 4.2,
        phase: idx * 1.5,
      });
    });
  }

  private createGrandLakeParadise() {
    const lakeCenterZ = -2750;
    const lakeCenterX = 0;

    const fallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4f7ff'),
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const fallGeo = new THREE.PlaneGeometry(35, 18, 12, 12);
    const fallMesh = new THREE.Mesh(fallGeo, fallMat);
    fallMesh.position.set(lakeCenterX, 6, lakeCenterZ - 90);
    this.grandLakeCelebrationGroup.add(fallMesh);

    const gFlowerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffe169'),
      emissive: new THREE.Color('#ffc107'),
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    for (let f = 0; f < 8; f++) {
      const ang = (f / 8) * Math.PI * 2;
      const r = 42;
      const fGroup = new THREE.Group();
      const flowerCore = new THREE.SphereGeometry(1.2, 12, 12);
      const mCore = new THREE.Mesh(flowerCore, gFlowerMat);
      fGroup.add(mCore);

      fGroup.position.set(
        lakeCenterX + Math.cos(ang) * r,
        -0.2,
        lakeCenterZ + Math.sin(ang) * r
      );
      this.grandLakeCelebrationGroup.add(fGroup);
    }

    const familyData = [
      { name: 'Mother Catfish (Mariana)', color: 0, r: 18, s: 0.6, phase: 0 },
      { name: 'Papa Catfish (Breno)', color: 1, r: 26, s: 0.45, phase: 1.8 },
      { name: 'Pip the Little Brother', color: 2, r: 12, s: 0.85, phase: 3.2 },
      { name: 'Cleo the Cousin', color: 0, r: 22, s: 0.55, phase: 4.5 },
      { name: 'Bruno the Grandfather', color: 1, r: 32, s: 0.38, phase: 5.7 },
    ];

    familyData.forEach((fam, idx) => {
      const npcCatfish = this.createNPCCatfishMesh(
        fam.color,
        idx === 2 ? 0.65 : idx === 1 ? 1.25 : 1.0
      );
      this.grandLakeCelebrationGroup.add(npcCatfish);

      this.grandLakeCatfish.push({
        group: npcCatfish,
        basePos: new THREE.Vector3(lakeCenterX, -1.8, lakeCenterZ),
        orbitRadius: fam.r,
        phase: fam.phase,
        speed: fam.s,
        name: fam.name,
      });
    });
  }

  private createNPCCatfishMesh(colorVar: number, scaleMultiplier: number): THREE.Group {
    const npc = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      color: colorVar === 1 ? '#2c353b' : '#374149',
      roughness: 0.4,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#fbf7e8',
      roughness: 0.35,
    });
    const finMat = new THREE.MeshStandardMaterial({
      color: colorVar === 1 ? '#ff7733' : colorVar === 2 ? '#ff3b30' : '#ff4f1f',
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    const bGeo = new THREE.CylinderGeometry(0.45, 0.24, 2.0, 12);
    bGeo.rotateX(Math.PI / 2);
    bGeo.scale(1.2, 0.8, 1.0);
    const bMesh = new THREE.Mesh(bGeo, skinMat);
    npc.add(bMesh);

    // White lateral stripe
    const stGeo = new THREE.BoxGeometry(1.12, 0.14, 1.85);
    const stMesh = new THREE.Mesh(stGeo, stripeMat);
    stMesh.position.set(0, -0.06, 0);
    npc.add(stMesh);

    const sGeo = new THREE.SphereGeometry(0.42, 12, 10);
    sGeo.scale(1.3, 0.65, 1.0);
    const sMesh = new THREE.Mesh(sGeo, skinMat);
    sMesh.position.set(0, -0.05, 1.0);
    npc.add(sMesh);

    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(0.25, 0.48, 0.68, 0.65);
    tailShape.quadraticCurveTo(0.45, 0.2, 0.25, 0);
    tailShape.quadraticCurveTo(0.45, -0.2, 0.68, -0.65);
    tailShape.quadraticCurveTo(0.25, -0.48, 0, 0);
    const tGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.04, bevelEnabled: false });
    const tMesh = new THREE.Mesh(tGeo, finMat);
    tMesh.rotation.y = Math.PI / 2;
    tMesh.position.set(0, 0, -1.05);
    npc.add(tMesh);

    npc.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
    return npc;
  }

  /**
   * Update active river animations: bubbles, currents, schools of fish, turtles, frogs, dragonflies, dolphins, and catfish family
   */
  public update(dt: number, playerDist: number) {
    const { position } = getRiverPath(playerDist);
    this.waterMesh.position.set(position.x, 0, position.z);

    // 1. Bubble drift
    const pos = this.bubbleParticles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.9;
      if (y > 0.1) y = -4.5;
      pos.setY(i, y);

      const z = pos.getZ(i);
      if (Math.abs(z - position.z) > 100) {
        pos.setZ(i, position.z - (Math.random() - 0.5) * 80);
        pos.setX(i, position.x + (Math.random() - 0.5) * 24);
      }
    }
    pos.needsUpdate = true;

    // 2. Swirling Current Rings
    for (let i = 0; i < this.currentZones.length; i++) {
      const cz = this.currentZones[i];
      if (Math.abs(cz.position.z - position.z) < 90) {
        cz.group.rotation.z += dt * 2.2;
      }
    }

    // 3. Schools of Small Fish (Synchronized schooling circles)
    for (let i = 0; i < this.fishSchools.length; i++) {
      const sc = this.fishSchools[i];
      if (Math.abs(sc.centerPos.z - position.z) > 95) continue;
      sc.phase += dt * sc.speed;
      const ox = Math.cos(sc.phase) * sc.radius;
      const oz = Math.sin(sc.phase) * sc.radius;
      sc.group.position.set(
        sc.centerPos.x + ox,
        sc.centerPos.y + Math.sin(sc.phase * 2) * 0.25,
        sc.centerPos.z + oz
      );
      // Tangent of circle (-sin, cos)
      sc.group.rotation.y = Math.atan2(-Math.sin(sc.phase), Math.cos(sc.phase));
    }

    // 4. Friendly Paddling Turtles
    for (let i = 0; i < this.turtles.length; i++) {
      const tr = this.turtles[i];
      if (Math.abs(tr.basePos.z - position.z) > 95) continue;
      tr.phase += dt * tr.speed;
      tr.group.position.x = tr.basePos.x + Math.sin(tr.phase) * 2.6;
      tr.group.position.y = tr.basePos.y + Math.cos(tr.phase * 1.5) * 0.2;
      tr.group.rotation.y = Math.cos(tr.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
      tr.flippers.forEach((f, idx) => {
        f.rotation.z = Math.sin(tr.phase * 4 + idx) * 0.35;
      });
    }

    // 5. Hopping Lily-Pad Frogs
    for (let i = 0; i < this.frogs.length; i++) {
      const fr = this.frogs[i];
      fr.phase += dt * 2.6;
      const hopWave = Math.max(0, Math.sin(fr.phase));
      fr.group.position.y = fr.baseY + Math.pow(hopWave, 2) * 0.65;
      fr.group.rotation.x = hopWave > 0.1 ? -Math.cos(fr.phase) * 0.35 : 0;
    }

    // 6. Darting Dragonflies
    for (let i = 0; i < this.dragonflies.length; i++) {
      const df = this.dragonflies[i];
      if (Math.abs(df.basePos.z - position.z) > 90) continue;
      df.phase += dt * 3.4;
      const dx = Math.sin(df.phase) * 2.4;
      const dz = Math.sin(df.phase * 2) * 1.4;
      df.group.position.set(
        df.basePos.x + dx,
        df.basePos.y + Math.sin(df.phase * 3) * 0.15,
        df.basePos.z + dz
      );
      df.group.rotation.y = Math.atan2(Math.cos(df.phase) * 2.4, Math.cos(df.phase * 2) * 2.8);
      df.wings.forEach((w, idx) => {
        w.rotation.z = Math.sin(df.phase * 15 + idx) * 0.45;
      });
    }

    // 7. Pink Dolphins Leaping
    this.dolphins.forEach((d) => {
      d.phase += dt * d.speed;
      const jumpHeight = Math.sin(d.phase) * 1.8 - 0.4;
      d.group.position.y = jumpHeight;
      d.group.rotation.x = Math.cos(d.phase) * 0.4;
    });

    // 8. Grand Lake Catfish Family Swimming
    this.grandLakeCatfish.forEach((cat) => {
      cat.phase += dt * cat.speed;
      const cx = cat.basePos.x + Math.cos(cat.phase) * cat.orbitRadius;
      const cz = cat.basePos.z + Math.sin(cat.phase) * cat.orbitRadius;
      const cy = cat.basePos.y + Math.sin(cat.phase * 2) * 0.4;

      cat.group.position.set(cx, cy, cz);
      // Tangent of orbit is (-sin(phase), 0, cos(phase)); orient local +Z along tangent
      cat.group.rotation.y = Math.atan2(-Math.sin(cat.phase), Math.cos(cat.phase));
      cat.group.rotation.z = Math.sin(cat.phase * 3) * 0.15;
    });
  }

  public dispose() {
    this.waterMesh.geometry.dispose();
    (this.waterMesh.material as THREE.Material).dispose();
    this.plantInstancedMesh.geometry.dispose();
    (this.plantInstancedMesh.material as THREE.Material).dispose();
    this.stoneInstancedMesh.geometry.dispose();
    (this.stoneInstancedMesh.material as THREE.Material).dispose();
    this.bubbleParticles.geometry.dispose();
    (this.bubbleParticles.material as THREE.Material).dispose();
  }
}
