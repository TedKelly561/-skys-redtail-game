import * as THREE from 'three';
import { getGameTextures } from './textures';
import { CatfishCharacter } from './catfishModel';
import type { FriendSpot } from './friends';
import { mergeStaticMeshes } from './perf';

export interface RiverChapterInfo {
  id: number;
  name: string;
  /** Picture shown to young players who can't read the name yet. */
  icon: string;
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
    icon: '🐠',
    subtitle: 'Sunlit gravel riffles, grassy banks & neon tetras',
    startDist: 0,
    endDist: 480,
    waterColor: '#14a3b4',
    fogColor: '#a3e2f0',
    ambientLightColor: '#dff8fc',
    description:
      'Glide over sunlit gravel riffles, explore sandy point bars, and dive into your first deep scour pools!',
  },
  {
    id: 2,
    name: 'Sunlit Lotus Groves',
    icon: '🐸',
    subtitle: 'Swaying forest boughs, lily pads & hopping frogs',
    startDist: 480,
    endDist: 1050,
    waterColor: '#139a8c',
    fogColor: '#a8e8d8',
    ambientLightColor: '#d8faea',
    description:
      'Follow the meandering channel past shoreline tree roots, hopping frogs, and paddling turtles!',
  },
  {
    id: 3,
    name: 'Emerald Canyon Rapids',
    icon: '🌊',
    subtitle: 'Deep plunge pools, boulder riffles & currents',
    startDist: 1050,
    endDist: 1680,
    waterColor: '#0f8ea6',
    fogColor: '#98dcec',
    ambientLightColor: '#cff6fa',
    description:
      'Ride sparkling riffle currents and dive into 6-meter canyon scour pools for lost trinkets!',
  },
  {
    id: 4,
    name: 'Golden Canopy Mangroves',
    icon: '🐬',
    subtitle: 'Submerged root arches, dragonflies & pink dolphins',
    startDist: 1680,
    endDist: 2350,
    waterColor: '#1a7fb0',
    fogColor: '#a2d0f2',
    ambientLightColor: '#d9ecfc',
    description:
      'Boto the pink river dolphin leaps beside you while blue dragonflies dance above the meandering stream!',
  },
  {
    id: 5,
    name: 'The Great Grand Lake',
    icon: '🏝️',
    subtitle: 'Sunlit Paradise of the Redtail Catfish',
    startDist: 2350,
    endDist: 3200,
    waterColor: '#1aa5cf',
    fogColor: '#aee6fa',
    ambientLightColor: '#ebfcff',
    description:
      'You made it! A breathtaking sunlit lake surrounded by lush forest and your Redtail Catfish family!',
  },
];

export type StreamFeatureType = 'riffle' | 'run' | 'pool' | 'lake';

export interface RiverPathSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  curvature: number; // + bends right, - bends left
  thalwegDepth: number; // deepest channel depth (negative meters)
  featureType: StreamFeatureType;
  featureLabel: string;
}

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
  /** Yaw of the log group (solid logs lie across the river along their local X axis). */
  rotationY: number;
}

/**
 * Computes organic meandering stream path, curvature, width, and Pool-Riffle-Run depth profile
 */
export function getRiverPath(distance: number): RiverPathSample {
  const z = -distance;

  const x =
    Math.sin(distance * 0.0085) * 28 +
    Math.sin(distance * 0.023) * 12.5 +
    Math.cos(distance * 0.014) * 7.5 +
    Math.sin(distance * 0.041) * 3.2;
  const y = 0;

  const d2x =
    -0.0085 * 0.0085 * 28 * Math.sin(distance * 0.0085) -
    0.023 * 0.023 * 12.5 * Math.sin(distance * 0.023) -
    0.014 * 0.014 * 7.5 * Math.cos(distance * 0.014);
  const curvature = THREE.MathUtils.clamp(d2x * 140, -1.0, 1.0);

  let width = 30 + Math.sin(distance * 0.019) * 4.5;
  if (distance > 2300) {
    const lakeProgress = Math.min(1.0, (distance - 2300) / 300);
    width = 32 + lakeProgress * 96;
  } else if (distance > 1050 && distance < 1680) {
    width = 25 + Math.sin(distance * 0.025) * 3.5;
  }

  const poolRiffleWave =
    Math.sin(distance * 0.032) * 1.15 + Math.cos(distance * 0.017) * 0.65;
  const bendScour = Math.abs(curvature) * 0.85;

  let thalwegDepth = -3.9 + poolRiffleWave - bendScour;
  let featureType: StreamFeatureType = 'run';
  let featureLabel = 'Flowing River Run';

  if (distance >= 2350) {
    thalwegDepth = -5.4;
    featureType = 'lake';
    featureLabel = 'Great Grand Lake Basin';
  } else if (thalwegDepth > -3.15) {
    thalwegDepth = Math.min(-2.35, thalwegDepth);
    featureType = 'riffle';
    featureLabel = 'Sunlit Gravel Riffle & Shallows';
  } else if (thalwegDepth < -4.65) {
    thalwegDepth = Math.max(-6.3, thalwegDepth);
    featureType = 'pool';
    featureLabel =
      Math.abs(curvature) > 0.45 ? 'Deep Cut-Bank Scour Pool' : 'Deep Emerald Plunge Pool';
  }

  const aheadDist = distance + 1.0;
  const aheadZ = -aheadDist;
  const aheadX =
    Math.sin(aheadDist * 0.0085) * 28 +
    Math.sin(aheadDist * 0.023) * 12.5 +
    Math.cos(aheadDist * 0.014) * 7.5 +
    Math.sin(aheadDist * 0.041) * 3.2;
  const tangent = new THREE.Vector3(aheadX - x, 0, aheadZ - z).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

  return {
    position: new THREE.Vector3(x, y, z),
    tangent,
    normal,
    width,
    curvature,
    thalwegDepth,
    featureType,
    featureLabel,
  };
}

/**
 * Converts a world position back to river coordinates. The river runs down -Z (z = -distance)
 * with gentle side-to-side bends, so two refinement steps along the tangent are plenty.
 */
export function worldToRiver(x: number, z: number): { distance: number; lateral: number } {
  let d = -z;
  for (let i = 0; i < 2; i++) {
    const { position, tangent } = getRiverPath(d);
    d += (x - position.x) * tangent.x + (z - position.z) * tangent.z;
  }
  const { position, normal } = getRiverPath(d);
  return { distance: d, lateral: (x - position.x) * normal.x + (z - position.z) * normal.z };
}

/**
 * Exact riverbed & riverbank elevation at any (distance, lateralOffset) coordinate.
 */
export function getRiverBedElevationAt(distance: number, lateralOffset: number): number {
  const { width, curvature, thalwegDepth } = getRiverPath(distance);
  const halfWidth = width * 0.5;
  const s = lateralOffset / halfWidth;
  const absS = Math.abs(s);

  const thalwegShift = THREE.MathUtils.clamp(-curvature * 0.38, -0.42, 0.42);
  const shiftedS = s - thalwegShift;

  let profile = Math.pow(Math.abs(shiftedS) / (1.0 + Math.abs(thalwegShift)), 1.85);
  profile = THREE.MathUtils.clamp(profile, 0, 1.3);

  const isInnerBend = s * curvature > 0.12;
  const pointBarLift = isInnerBend ? Math.min(1.1, Math.abs(s * curvature) * 1.45) : 0;

  const microRelief =
    Math.sin(distance * 0.14 + lateralOffset * 0.45) * 0.18 +
    Math.cos(distance * 0.06 - lateralOffset * 0.3) * 0.14;

  let bedY = thalwegDepth * (1.0 - profile * 0.82) + pointBarLift + microRelief;

  // Transition smoothly up onto lush rolling grassy banks on both sides of the river
  if (absS > 0.86) {
    const bankT = (absS - 0.86) / 0.95;
    const clampedT = Math.min(1.0, bankT);
    const smoothSlope = clampedT * clampedT * (3 - 2 * clampedT);
    const bankHillock =
      Math.sin(distance * 0.08 + lateralOffset * 0.25) * 0.28 +
      Math.cos(distance * 0.04 - lateralOffset * 0.18) * 0.22;
    const targetBankY = 0.75 + smoothSlope * 2.85 + bankHillock;
    bedY = THREE.MathUtils.lerp(bedY, targetBankY, Math.min(1, (absS - 0.86) / 0.22));
  }

  return bedY;
}

/**
 * Creates a high-polygon C2-smooth sculpted 3D fusiform fish geometry for Minnows and Neon Tetras
 */
export function createDetailedSmallFishGeometry(length: number = 0.52): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.14, 32, 24);
  geo.scale(0.46, 0.84, length / 0.28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const x = pos.getX(i);
    const normZ = z / (length * 0.5); // -1 (tail) to +1 (snout)
    if (normZ < 0) {
      // Smooth S-curve taper into the caudal peduncle
      const t = Math.min(1, -normZ);
      const smoothT = t * t * (3 - 2 * t);
      const taperY = THREE.MathUtils.lerp(1.0, 0.32, smoothT);
      const taperX = THREE.MathUtils.lerp(1.0, 0.25, smoothT);
      pos.setXYZ(i, x * taperX, y * taperY, z);
    } else {
      // Sleek streamlined head & snout curve
      const t = Math.min(1, normZ);
      const headCurve = 1.0 - 0.12 * t * t;
      pos.setXYZ(i, x * headCurve, y * headCurve, z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates smooth, rounded bezier-curved fin geometries for small fish (Minnows & Neon Tetras)
 */
export function createSmoothSmallFinGeometries(scale: number = 1.0): {
  tailGeo: THREE.BufferGeometry;
  dorsalGeo: THREE.BufferGeometry;
  pecGeo: THREE.BufferGeometry;
} {
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.02 * scale);
  tailShape.bezierCurveTo(
    0.07 * scale,
    0.12 * scale,
    0.16 * scale,
    0.18 * scale,
    0.21 * scale,
    0.14 * scale
  );
  tailShape.bezierCurveTo(
    0.23 * scale,
    0.1 * scale,
    0.16 * scale,
    0.04 * scale,
    0.12 * scale,
    0.015 * scale
  );
  tailShape.quadraticCurveTo(0.09 * scale, 0, 0.12 * scale, -0.015 * scale);
  tailShape.bezierCurveTo(
    0.16 * scale,
    -0.04 * scale,
    0.23 * scale,
    -0.1 * scale,
    0.21 * scale,
    -0.14 * scale
  );
  tailShape.bezierCurveTo(
    0.16 * scale,
    -0.18 * scale,
    0.07 * scale,
    -0.12 * scale,
    0,
    -0.02 * scale
  );
  tailShape.closePath();

  const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
    depth: 0.01 * scale,
    curveSegments: 20,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.004 * scale,
    bevelThickness: 0.004 * scale,
  });
  tailGeo.rotateY(Math.PI / 2);

  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(0, 0);
  dorsalShape.bezierCurveTo(
    0.02 * scale,
    0.09 * scale,
    0.08 * scale,
    0.15 * scale,
    0.14 * scale,
    0.13 * scale
  );
  dorsalShape.bezierCurveTo(
    0.17 * scale,
    0.09 * scale,
    0.15 * scale,
    0.03 * scale,
    0.11 * scale,
    0
  );
  dorsalShape.closePath();

  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
    depth: 0.008 * scale,
    curveSegments: 16,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.003 * scale,
    bevelThickness: 0.003 * scale,
  });
  dorsalGeo.rotateY(Math.PI / 2);

  const pecShape = new THREE.Shape();
  pecShape.moveTo(0, 0);
  pecShape.bezierCurveTo(
    0.06 * scale,
    0.01 * scale,
    0.13 * scale,
    -0.02 * scale,
    0.15 * scale,
    -0.07 * scale
  );
  pecShape.bezierCurveTo(
    0.11 * scale,
    -0.11 * scale,
    0.04 * scale,
    -0.08 * scale,
    0,
    -0.03 * scale
  );
  pecShape.closePath();

  const pecGeo = new THREE.ExtrudeGeometry(pecShape, {
    depth: 0.006 * scale,
    curveSegments: 16,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.002 * scale,
    bevelThickness: 0.002 * scale,
  });

  return { tailGeo, dorsalGeo, pecGeo };
}

/**
 * Creates a tapered 3D tube along a CatmullRomCurve3 for smooth organic tree limbs, trunks, and submerged water roots
 */
function createTaperedTubeGeometry(
  points: THREE.Vector3[],
  startRadius: number,
  endRadius: number,
  tubularSegments: number = 16,
  radialSegments: number = 12
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1.0, radialSegments, false);
  const pos = geo.attributes.position;

  const ringStride = radialSegments + 1;
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(t, 0.85));

    for (let j = 0; j < ringStride; j++) {
      const idx = i * ringStride + j;
      const vx = pos.getX(idx) - center.x;
      const vy = pos.getY(idx) - center.y;
      const vz = pos.getZ(idx) - center.z;
      pos.setXYZ(idx, center.x + vx * radius, center.y + vy * radius, center.z + vz * radius);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const _famPrev = new THREE.Vector3();

/**
 * River World Manager: lush multi-tiered gallery forest with wind-swaying branches and water roots,
 * abundant short riverbank grass, geomorphological riverbed, and high-polygon smooth river animals.
 */
export class RiverWorld {
  public scene: THREE.Scene;
  public riverBedGroup: THREE.Group;
  public riverBedMaterial!: THREE.MeshStandardMaterial;
  public treesGroup: THREE.Group;
  public sunbeamsGroup: THREE.Group;
  public waterMesh: THREE.Mesh;
  public plantInstancedMesh: THREE.InstancedMesh;
  public bankGrassInstancedMesh: THREE.InstancedMesh;
  public stoneInstancedMesh: THREE.InstancedMesh;
  public lilyPadsGroup: THREE.Group;
  public hollowLogsGroup: THREE.Group;
  public currentsGroup: THREE.Group;
  public animalsGroup: THREE.Group;
  public grandLakeCelebrationGroup: THREE.Group;

  public currentZones: RiverCurrentZone[] = [];
  /** Every animal Whiskers can sniff to say hi (see friends.ts). */
  public friendSpots: FriendSpot[] = [];
  private familyFollow: THREE.Vector3 | null = null;
  /** Family members told to stay put somewhere (e.g. Pip hiding), by index. */
  private familyHiding = new Map<number, THREE.Vector3>();
  private familyParty = 0;
  private partyTime = 0;
  public logObstacles: LogObstacle[] = [];


  private grassTimeUniform = { value: 0 };

  public dolphins: {
    group: THREE.Group;
    tailFluke: THREE.Mesh;
    startZ: number;
    speed: number;
    phase: number;
  }[] = [];
  public fishSchools: {
    group: THREE.Group;
    tails: THREE.Mesh[];
    centerPos: THREE.Vector3;
    radius: number;
    speed: number;
    phase: number;
  }[] = [];
  public turtles: {
    group: THREE.Group;
    basePos: THREE.Vector3;
    flippers: THREE.Mesh[];
    headGroup: THREE.Group;
    phase: number;
    speed: number;
  }[] = [];
  public frogs: {
    group: THREE.Group;
    throatSac: THREE.Mesh;
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
    character: CatfishCharacter;
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
    this.sunbeamsGroup = new THREE.Group();
    this.lilyPadsGroup = new THREE.Group();
    this.hollowLogsGroup = new THREE.Group();
    this.currentsGroup = new THREE.Group();
    this.animalsGroup = new THREE.Group();
    this.grandLakeCelebrationGroup = new THREE.Group();

    this.scene.add(this.riverBedGroup);
    this.scene.add(this.treesGroup);
    this.scene.add(this.sunbeamsGroup);
    this.scene.add(this.lilyPadsGroup);
    this.scene.add(this.hollowLogsGroup);
    this.scene.add(this.currentsGroup);
    this.scene.add(this.animalsGroup);
    this.scene.add(this.grandLakeCelebrationGroup);

    const textures = getGameTextures();

    // 1. Realistic Rippling Water Surface with Bump Map & Clearcoat Specular Glints
    const waterGeo = new THREE.PlaneGeometry(210, 620, 40, 80);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(CHAPTERS[0].waterColor),
      bumpMap: textures.waterNormal,
      bumpScale: 0.06,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.45,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(0, 0, 0);
    this.scene.add(this.waterMesh);

    // 2. Instanced Multi-Blade Underwater Aquatic Plants
    const plantGeo = this.createAquaticPlantGeometry();
    const plantMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#34a853'),
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const maxPlants = 560;
    this.plantInstancedMesh = new THREE.InstancedMesh(plantGeo, plantMat, maxPlants);
    this.plantInstancedMesh.receiveShadow = true;
    this.scene.add(this.plantInstancedMesh);

    // 3. Instanced Short Riverbank Grass Above Ground Level on Both Sides of the River
    const bankGrassGeo = this.createShortBankGrassTuftGeometry();
    const bankGrassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5cd65c'),
      roughness: 0.58,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    bankGrassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.grassTimeUniform;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float tipFactor = clamp(position.y / 0.85, 0.0, 1.0);
          float worldPhase = (instanceMatrix[3][0] * 0.25) + (instanceMatrix[3][2] * 0.18);
          transformed.x += sin(uTime * 1.8 + worldPhase) * 0.11 * tipFactor * tipFactor;
          transformed.z += cos(uTime * 1.4 + worldPhase) * 0.07 * tipFactor * tipFactor;
          `
        );
    };
    const maxGrassTufts = 3800;
    this.bankGrassInstancedMesh = new THREE.InstancedMesh(
      bankGrassGeo,
      bankGrassMat,
      maxGrassTufts
    );
    this.bankGrassInstancedMesh.receiveShadow = true;
    this.scene.add(this.bankGrassInstancedMesh);

    // 4. Instanced Textured River Cobbles & Smooth Boulders
    // Detail 1 (80 faces) instead of 3 (1,280): 440 stones were over half a million triangles.
    const stoneGeo = new THREE.IcosahedronGeometry(0.8, 1);
    stoneGeo.scale(1.3, 0.62, 1.08);
    const stoneMat = new THREE.MeshStandardMaterial({
      map: textures.rockAlbedo,
      bumpMap: textures.rockBump,
      bumpScale: 0.04,
      roughness: 0.72,
    });
    const maxStones = 440;
    this.stoneInstancedMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, maxStones);
    this.stoneInstancedMesh.receiveShadow = true;
    this.stoneInstancedMesh.castShadow = false;
    this.scene.add(this.stoneInstancedMesh);

    // 5. Bubble Particle System
    const bubbleCount = 650;
    const bubbleGeo = new THREE.BufferGeometry();
    this.bubblePosArray = new Float32Array(bubbleCount * 3);
    for (let i = 0; i < bubbleCount; i++) {
      this.bubblePosArray[i * 3 + 0] = (Math.random() - 0.5) * 32;
      this.bubblePosArray[i * 3 + 1] = -Math.random() * 5.0;
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
      size: 0.42,
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

    const bladeAngles = [0, 1.5, 3.1, 4.7];
    bladeAngles.forEach((ang, idx) => {
      const vOffset = vertices.length / 3;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const height = 1.6 + (idx % 2) * 0.9;
      const sway = 0.48;

      for (let s = 0; s <= 7; s++) {
        const t = s / 7;
        const y = t * height;
        const xOffset = cosA * 0.16 * (1 - t) + Math.sin(t * Math.PI) * sway * cosA;
        const zOffset = sinA * 0.16 * (1 - t) + Math.sin(t * Math.PI) * sway * sinA;
        const w = Math.sin((1 - t * 0.85) * Math.PI * 0.5) * 0.2;

        vertices.push(xOffset - sinA * w, y, zOffset + cosA * w);
        vertices.push(xOffset + sinA * w, y, zOffset - cosA * w);
      }

      for (let s = 0; s < 7; s++) {
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

  /**
   * Builds a rich 7-blade short meadow/riverbank grass tuft geometry for the banks above water level
   */
  private createShortBankGrassTuftGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    const bladeConfigs = [
      { ang: 0.0, r: 0.05, h: 0.72, arch: 0.22 },
      { ang: 1.25, r: 0.14, h: 0.66, arch: 0.26 },
      { ang: 2.5, r: 0.13, h: 0.78, arch: 0.24 },
      { ang: 3.75, r: 0.12, h: 0.6, arch: 0.27 },
      { ang: 5.0, r: 0.13, h: 0.74, arch: 0.23 },
    ];

    bladeConfigs.forEach((cfg) => {
      const vOffset = vertices.length / 3;
      const cosA = Math.cos(cfg.ang);
      const sinA = Math.sin(cfg.ang);
      const steps = 3;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const y = t * cfg.h;
        const bend = t * t * cfg.arch;
        const cx = cosA * (cfg.r + bend);
        const cz = sinA * (cfg.r + bend);
        const halfWidth = (1.0 - Math.pow(t, 1.35)) * 0.068;

        vertices.push(cx - sinA * halfWidth, y, cz + cosA * halfWidth);
        vertices.push(cx + sinA * halfWidth, y, cz - cosA * halfWidth);
      }

      for (let s = 0; s < steps; s++) {
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

  /**
   * Generates high-resolution geomorphological riverbed & wide grassy riverbank terrain
   */
  public generateRiverbedTerrain() {
    const textures = getGameTextures();
    const totalDist = 3300;
    const step = 4;
    const segments = Math.floor(totalDist / step);
    const crossPoints = 32;

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const pointBarSandColor = new THREE.Color('#f2e2be');
    const riffleGravelColor = new THREE.Color('#d4c29e');
    const deepPoolSiltColor = new THREE.Color('#4d7c73');
    const cutBankRockColor = new THREE.Color('#5f6e5c');
    const shoreMossColor = new THREE.Color('#58b352');
    const bankGrassColor = new THREE.Color('#4ea845');
    const wetSandColor = new THREE.Color('#a48a62');
    const underwaterTint = new THREE.Color('#2aa6b8');
    const _bedTint = new THREE.Color();

    for (let i = 0; i <= segments; i++) {
      const dist = i * step;
      const { position, normal, width, curvature, featureType } = getRiverPath(dist);

      for (let j = 0; j < crossPoints; j++) {
        const u = j / (crossPoints - 1);
        const lateral = (u - 0.5) * width * 1.92;
        const vy = getRiverBedElevationAt(dist, lateral);

        const vx = position.x + normal.x * lateral;
        const vz = position.z + normal.z * lateral;

        vertices.push(vx, vy, vz);
        uvs.push(u * 1.3, dist / 3300);

        let c = riffleGravelColor;
        if (vy > 0.65) {
          c = bankGrassColor;
        } else if (vy > 0.12) {
          c = shoreMossColor;
        } else if (vy > -0.35) {
          // Darker wet sand right where the water laps the bank.
          c = wetSandColor;
        } else if (vy < -4.4) {
          c = deepPoolSiltColor;
        } else if (lateral * curvature > 1.5 && vy > -3.1) {
          c = pointBarSandColor;
        } else if (featureType === 'pool') {
          c = cutBankRockColor;
        }

        // Tint everything under the surface toward clear river blue, more as it gets deeper,
        // so shallow sand stays golden and deep pools glow turquoise.
        if (vy < 0) {
          _bedTint.copy(c).lerp(underwaterTint, Math.min(0.6, 0.2 + -vy * 0.09));
          colors.push(_bedTint.r, _bedTint.g, _bedTint.b);
        } else {
          colors.push(c.r, c.g, c.b);
        }
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
    bedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bedGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    bedGeo.setIndex(indices);
    bedGeo.computeVertexNormals();

    const bedMat = new THREE.MeshStandardMaterial({
      map: textures.riverbedAlbedo,
      bumpMap: textures.riverbedBump,
      bumpScale: 0.085,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.04,
    });

    this.riverBedMaterial = bedMat;
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.receiveShadow = true;
    this.riverBedGroup.add(bedMesh);
  }

  public populateRiverElements() {
    this.generateRiverbedTerrain();

    const dummy = new THREE.Object3D();
    const tintColor = new THREE.Color();
    let plantIdx = 0;
    let stoneIdx = 0;
    let grassIdx = 0;

    // 1. Scatter underwater plants & river cobbles
    for (let dist = 18; dist < 3050; dist += 12) {
      const { position, normal, width, featureType } = getRiverPath(dist);

      for (let p = 0; p < 2; p++) {
        if (plantIdx < 560) {
          const lateral = (Math.random() - 0.5) * (width * 0.72);
          const bedY = getRiverBedElevationAt(dist, lateral);
          if (bedY < -0.8) {
            dummy.position.set(
              position.x + normal.x * lateral,
              bedY - 0.05,
              position.z + normal.z * lateral
            );
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            const s = 0.8 + Math.random() * 0.55;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            this.plantInstancedMesh.setMatrixAt(plantIdx, dummy.matrix);
            tintColor.setHSL(0.33 + (Math.random() - 0.5) * 0.06, 0.65, 0.38 + Math.random() * 0.12);
            this.plantInstancedMesh.setColorAt(plantIdx, tintColor);
            plantIdx++;
          }
        }
      }

      const stonesHere = featureType === 'riffle' ? 2 : 1;
      for (let st = 0; st < stonesHere; st++) {
        if (stoneIdx < 440) {
          const lateral = (Math.random() - 0.5) * (width * 0.76);
          const bedY = getRiverBedElevationAt(dist, lateral);
          dummy.position.set(
            position.x + normal.x * lateral,
            bedY + 0.12,
            position.z + normal.z * lateral
          );
          dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
          const s = (featureType === 'riffle' ? 0.95 : 0.75) + Math.random() * 0.85;
          dummy.scale.set(s * 1.2, s * 0.65, s);
          dummy.updateMatrix();
          this.stoneInstancedMesh.setMatrixAt(stoneIdx, dummy.matrix);
          tintColor.setHSL(0.09 + (Math.random() - 0.5) * 0.04, 0.22, 0.45 + Math.random() * 0.18);
          this.stoneInstancedMesh.setColorAt(stoneIdx, tintColor);
          stoneIdx++;
        }
      }
    }

    // 2. Scatter plenty of lush short grass tufts above ground level along BOTH sides of the river across all 5 chapters!
    for (let dist = 6; dist < 3120; dist += 5) {
      const { position, normal, width } = getRiverPath(dist);
      const halfW = width * 0.5;

      [-1, 1].forEach((side) => {
        for (let g = 0; g < 3; g++) {
          if (grassIdx >= 3800) return;
          const bankFraction = 0.91 + (g / 3) * 0.78 + Math.random() * 0.24;
          const lateral = side * halfW * bankFraction;
          const groundY = getRiverBedElevationAt(dist, lateral);

          if (groundY > 0.12) {
            const jitterDist = (Math.random() - 0.5) * 4.2;
            const wx = position.x + normal.x * lateral;
            const wz = position.z + normal.z * lateral + jitterDist;

            dummy.position.set(wx, groundY - 0.06, wz);
            dummy.rotation.set(
              (Math.random() - 0.5) * 0.15,
              Math.random() * Math.PI * 2,
              side * -0.12
            );
            const scaleXZ = 0.85 + Math.random() * 0.65;
            const scaleY = 0.75 + Math.random() * 0.75;
            dummy.scale.set(scaleXZ, scaleY, scaleXZ);
            dummy.updateMatrix();

            this.bankGrassInstancedMesh.setMatrixAt(grassIdx, dummy.matrix);
            // Rich sunlit meadow & tropical emerald grass shades
            tintColor.setHSL(
              0.28 + (Math.random() - 0.5) * 0.08,
              0.68 + Math.random() * 0.18,
              0.42 + Math.random() * 0.16
            );
            this.bankGrassInstancedMesh.setColorAt(grassIdx, tintColor);
            grassIdx++;
          }
        }
      });
    }

    this.plantInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.plantInstancedMesh.instanceColor)
      this.plantInstancedMesh.instanceColor.needsUpdate = true;

    this.bankGrassInstancedMesh.count = grassIdx;
    this.bankGrassInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.bankGrassInstancedMesh.instanceColor)
      this.bankGrassInstancedMesh.instanceColor.needsUpdate = true;

    this.stoneInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.stoneInstancedMesh.instanceColor)
      this.stoneInstancedMesh.instanceColor.needsUpdate = true;

    // Trees, bushes, flowers and reeds are built by forest.ts (merged for speed).
    this.createLilyPadsAndFrogs();
    this.createLogsAndDriftwood();
    this.createRiverCurrents();

    this.createFishSchools();
    this.createFriendlyTurtles();
    this.createDartingDragonflies();
    this.createFriendlyCapybaras();
    this.createPinkRiverDolphins();
    this.createGrandLakeParadise();
  }

  /**
   * Creates botanically textured Victoria amazonica lily pads & high-polygon smooth Tree Frogs
   */
  private createLilyPadsAndFrogs() {
    const textures = getGameTextures();
    const padMat = new THREE.MeshPhysicalMaterial({
      map: textures.lilyPadAlbedo,
      roughness: 0.35,
      clearcoat: 0.6,
      side: THREE.DoubleSide,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b6934'),
      roughness: 0.5,
    });
    const flowerMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ff80ab'),
      roughness: 0.2,
      clearcoat: 0.5,
    });
    const frogMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#32cd32'),
      roughness: 0.22,
      clearcoat: 0.95,
    });
    const frogBellyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffeb3b'),
      roughness: 0.3,
      clearcoat: 0.8,
    });
    const frogToeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ff9800'),
      roughness: 0.25,
      clearcoat: 0.85,
    });
    const frogEyeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffb300'),
      roughness: 0.1,
      clearcoat: 1.0,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // Shared high-poly frog geometries
    const fBodyGeo = new THREE.SphereGeometry(0.32, 24, 20);
    fBodyGeo.scale(0.95, 0.72, 1.28);
    const fHeadGeo = new THREE.SphereGeometry(0.25, 22, 18);
    fHeadGeo.scale(1.15, 0.78, 1.08);
    const sacGeo = new THREE.SphereGeometry(0.16, 18, 16);
    const fEyeGeo = new THREE.SphereGeometry(0.085, 16, 16);
    const fPupilGeo = new THREE.SphereGeometry(0.045, 14, 14);
    const thighGeo = new THREE.CapsuleGeometry(0.085, 0.24, 10, 14);
    const calfGeo = new THREE.CapsuleGeometry(0.068, 0.24, 10, 14);
    const footGeo = new THREE.SphereGeometry(0.09, 14, 12);
    footGeo.scale(0.9, 0.32, 1.65);
    const armGeo = new THREE.CapsuleGeometry(0.058, 0.22, 10, 14);
    const toePadGeo = new THREE.SphereGeometry(0.036, 10, 10);
    toePadGeo.scale(1.1, 0.45, 1.1);

    const petalGeo = new THREE.SphereGeometry(0.16, 14, 12);
    petalGeo.scale(0.65, 1.8, 0.35);
    petalGeo.rotateZ(0.55);

    for (let dist = 90; dist < 2350; dist += 68) {
      const { position, normal, width } = getRiverPath(dist);
      const side = Math.floor(dist / 68) % 2 === 0 ? 1 : -1;
      const padGroup = new THREE.Group();

      const padRadius = 2.35 + (dist % 3) * 0.38;
      const padGeo = new THREE.CylinderGeometry(padRadius, padRadius, 0.06, 44);
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padGroup.add(padMesh);

      const rimGeo = new THREE.TorusGeometry(padRadius, 0.13, 16, 44);
      rimGeo.rotateX(Math.PI / 2);
      rimGeo.scale(1, 1, 1.85);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.y = 0.11;
      padGroup.add(rimMesh);

      if (dist % 136 === 0) {
        const flowerGroup = new THREE.Group();
        for (let pet = 0; pet < 12; pet++) {
          const petalMesh = new THREE.Mesh(petalGeo, flowerMat);
          petalMesh.rotation.y = (pet / 12) * Math.PI * 2;
          flowerGroup.add(petalMesh);
        }
        flowerGroup.position.set(0.55, 0.16, 0.32);
        padGroup.add(flowerGroup);
      }

      // Smooth High-Poly Amazonian Tree Frog
      const frogGroup = new THREE.Group();
      const fBody = new THREE.Mesh(fBodyGeo, frogMat);
      fBody.position.y = 0.22;
      frogGroup.add(fBody);

      const fHead = new THREE.Mesh(fHeadGeo, frogMat);
      fHead.position.set(0, 0.34, 0.28);
      frogGroup.add(fHead);

      const throatSac = new THREE.Mesh(sacGeo, frogBellyMat);
      throatSac.position.set(0, 0.22, 0.38);
      frogGroup.add(throatSac);

      const fEyeL = new THREE.Mesh(fEyeGeo, frogEyeMat);
      fEyeL.position.set(0.15, 0.48, 0.32);
      const fPupilL = new THREE.Mesh(fPupilGeo, pupilMat);
      fPupilL.position.set(0.17, 0.49, 0.38);

      const fEyeR = new THREE.Mesh(fEyeGeo, frogEyeMat);
      fEyeR.position.set(-0.15, 0.48, 0.32);
      const fPupilR = new THREE.Mesh(fPupilGeo, pupilMat);
      fPupilR.position.set(-0.17, 0.49, 0.38);
      frogGroup.add(fEyeL, fPupilL, fEyeR, fPupilR);

      // 3-segment crouched hind legs (Thigh, Calf, Webbed Foot) + Forelegs with orange toe pads
      [-1, 1].forEach((legSide) => {
        const thigh = new THREE.Mesh(thighGeo, frogMat);
        thigh.position.set(legSide * 0.28, 0.2, -0.16);
        thigh.rotation.set(0.65, legSide * 0.32, legSide * -0.45);

        const calf = new THREE.Mesh(calfGeo, frogMat);
        calf.position.set(legSide * 0.32, 0.11, -0.24);
        calf.rotation.set(-0.55, legSide * 0.2, legSide * 0.25);

        const foot = new THREE.Mesh(footGeo, frogToeMat);
        foot.position.set(legSide * 0.32, 0.03, -0.12);

        const arm = new THREE.Mesh(armGeo, frogMat);
        arm.position.set(legSide * 0.2, 0.14, 0.22);
        arm.rotation.set(0.25, 0, legSide * -0.18);

        const handPad = new THREE.Mesh(toePadGeo, frogToeMat);
        handPad.position.set(legSide * 0.22, 0.02, 0.28);

        frogGroup.add(thigh, calf, foot, arm, handPad);
      });

      frogGroup.position.set(-0.3, 0.08, -0.2);
      frogGroup.rotation.y = side * -1.2;
      padGroup.add(frogGroup);

      mergeStaticMeshes(frogGroup, [throatSac]);
      mergeStaticMeshes(padGroup, [frogGroup]);
      this.friendSpots.push({ kind: 'frog', object: frogGroup });
      this.frogs.push({
        group: frogGroup,
        throatSac,
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
   * Creates textured hollow logs & sunken driftwood anchored to the organic riverbed
   */
  private createLogsAndDriftwood() {
    const textures = getGameTextures();
    const logMat = new THREE.MeshStandardMaterial({
      map: textures.barkAlbedo,
      bumpMap: textures.barkBump,
      bumpScale: 0.06,
      roughness: 0.84,
    });
    const logInnerMat = new THREE.MeshStandardMaterial({
      map: textures.barkAlbedo,
      color: new THREE.Color('#47311d'),
      roughness: 0.9,
      side: THREE.BackSide,
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4caf50'),
      roughness: 0.65,
    });

    const mossGeo = new THREE.CapsuleGeometry(0.65, 6.0, 8, 16);
    mossGeo.rotateX(Math.PI / 2);
    mossGeo.scale(1.1, 0.22, 1.0);

    for (let dist = 160; dist < 2320; dist += 135) {
      const { position, normal, tangent, width } = getRiverPath(dist);
      const isHollow = dist % 270 === 160;
      const lateral = ((dist % 3) - 1) * (width * 0.18);
      const bedY = getRiverBedElevationAt(dist, lateral);
      const logGroup = new THREE.Group();

      if (isHollow) {
        const outerGeo = new THREE.CylinderGeometry(1.75, 1.85, 7.8, 28, 1, true);
        outerGeo.rotateX(Math.PI / 2);
        const outerMesh = new THREE.Mesh(outerGeo, logMat);
        outerMesh.castShadow = true;
        outerMesh.receiveShadow = true;

        const innerGeo = new THREE.CylinderGeometry(1.55, 1.65, 7.8, 28, 1, true);
        innerGeo.rotateX(Math.PI / 2);
        const innerMesh = new THREE.Mesh(innerGeo, logInnerMat);

        const mossMesh = new THREE.Mesh(mossGeo, mossMat);
        mossMesh.position.y = 1.75;

        logGroup.add(outerMesh, innerMesh, mossMesh);

        const logCenterY = Math.min(-2.1, bedY + 1.55);
        const worldPos = new THREE.Vector3(
          position.x + normal.x * lateral,
          logCenterY,
          position.z + normal.z * lateral
        );
        logGroup.position.copy(worldPos);
        logGroup.rotation.y = Math.atan2(tangent.x, tangent.z);
        this.hollowLogsGroup.add(logGroup);

        this.logObstacles.push({
          distance: dist,
          lateralOffset: lateral,
          y: logCenterY,
          radius: 1.75,
          length: 7.8,
          isHollow: true,
          position: worldPos,
          rotationY: logGroup.rotation.y,
        });
      } else {
        const branchGeo = new THREE.CylinderGeometry(0.58, 0.82, 8.8, 20);
        branchGeo.rotateZ(Math.PI / 2);
        const branchMesh = new THREE.Mesh(branchGeo, logMat);
        branchMesh.castShadow = true;
        branchMesh.receiveShadow = true;

        const stubGeo = new THREE.CylinderGeometry(0.18, 0.34, 2.4, 14);
        const stubMesh = new THREE.Mesh(stubGeo, logMat);
        stubMesh.position.set(1.2, 0.8, 0);
        stubMesh.rotation.z = -0.6;
        logGroup.add(branchMesh, stubMesh);

        const logY = Math.min(-1.5, bedY + 1.15);
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
          radius: 0.82,
          length: 8.8,
          isHollow: false,
          position: worldPos,
          rotationY: logGroup.rotation.y,
        });
      }
    }
  }

  private createRiverCurrents() {
    const ringGeo = new THREE.TorusGeometry(1.65, 0.075, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7fffe8,
      transparent: true,
      opacity: 0.55,
    });
    const ribbonGeo = new THREE.CylinderGeometry(0.055, 0.055, 9.0, 10);
    ribbonGeo.rotateX(Math.PI / 2);

    for (let dist = 110; dist < 2300; dist += 125) {
      const { position, normal, tangent, width } = getRiverPath(dist);
      const lateral = Math.sin(dist * 0.05) * (width * 0.24);
      const currentGroup = new THREE.Group();

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
   * Creates high-polygon schools of Neon Tetras with iridescent scale textures,
   * 3D eyes, smooth curved dorsal/pectoral fins, and wagging rounded forked tails
   */
  private createFishSchools() {
    const textures = getGameTextures();
    const tetraBodyMat = new THREE.MeshPhysicalMaterial({
      map: textures.minnowScaleAlbedo,
      roughness: 0.16,
      metalness: 0.55,
      clearcoat: 0.9,
      iridescence: 0.8,
      iridescenceIOR: 1.35,
    });
    const tetraFinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ff2a55'),
      roughness: 0.25,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const bodyGeo = createDetailedSmallFishGeometry(0.48);
    const { tailGeo, dorsalGeo, pecGeo } = createSmoothSmallFinGeometries(0.95);
    const eyeGeo = new THREE.SphereGeometry(0.024, 12, 12);

    for (let dist = 55; dist < 2400; dist += 78) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.55);
      const schoolGroup = new THREE.Group();
      const tails: THREE.Mesh[] = [];

      for (let f = 0; f < 8; f++) {
        const fish = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, tetraBodyMat);
        const tail = new THREE.Mesh(tailGeo, tetraFinMat);
        tail.position.z = -0.22;

        const dorsal = new THREE.Mesh(dorsalGeo, tetraFinMat);
        dorsal.position.set(0, 0.1, 0.03);

        const pecL = new THREE.Mesh(pecGeo, tetraFinMat);
        pecL.position.set(0.055, -0.03, 0.08);
        pecL.rotation.set(0.25, -0.4, -0.35);
        const pecR = new THREE.Mesh(pecGeo, tetraFinMat);
        pecR.position.set(-0.055, -0.03, 0.08);
        pecR.rotation.set(0.25, 0.4, 0.35);
        pecR.scale.set(-1, 1, 1);

        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.052, 0.02, 0.15);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(-0.052, 0.02, 0.15);

        fish.add(body, tail, dorsal, pecL, pecR, eyeL, eyeR);
        tails.push(tail);

        const angle = (f / 8) * Math.PI * 2;
        const r = 0.55 + (f % 3) * 0.38;
        fish.position.set(Math.cos(angle) * r, ((f % 3) - 1) * 0.24, Math.sin(angle) * r);
        schoolGroup.add(fish);
      }

      const bedY = getRiverBedElevationAt(dist, lateral);
      const centerPos = new THREE.Vector3(
        position.x + normal.x * lateral,
        Math.max(bedY + 1.1, -1.8 - (dist % 2) * 0.8),
        position.z + normal.z * lateral
      );
      schoolGroup.position.copy(centerPos);
      mergeStaticMeshes(schoolGroup, tails);
      this.animalsGroup.add(schoolGroup);
      this.friendSpots.push({ kind: 'tetras', object: schoolGroup });

      this.fishSchools.push({
        group: schoolGroup,
        tails,
        centerPos,
        radius: 2.2,
        speed: 1.65 + (dist % 3) * 0.35,
        phase: dist * 0.05,
      });
    }
  }

  /**
   * Creates high-polygon Yellow-Spotted Amazon River Turtles with smooth domed carapace,
   * curved S-neck, rounded head, and curved hydrofoil paddle flippers (no boxy shapes!)
   */
  private createFriendlyTurtles() {
    const textures = getGameTextures();
    const shellMat = new THREE.MeshPhysicalMaterial({
      map: textures.turtleShellAlbedo,
      roughness: 0.35,
      clearcoat: 0.75,
    });
    const plastronMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4b475'),
      roughness: 0.55,
    });
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#557a46'),
      roughness: 0.45,
      clearcoat: 0.6,
    });
    const spotMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffd54f'),
      roughness: 0.35,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const shellGeo = new THREE.SphereGeometry(0.68, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    shellGeo.scale(1.0, 0.62, 1.28);
    const rimGeo = new THREE.TorusGeometry(0.66, 0.072, 18, 44);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1.0, 1.28, 0.8);
    const plastronGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.08, 32);
    plastronGeo.scale(1.0, 1.0, 1.25);

    // Smooth curved turtle neck
    const neckGeo = createTaperedTubeGeometry(
      [
        new THREE.Vector3(0, 0.06, 0.62),
        new THREE.Vector3(0, 0.1, 0.8),
        new THREE.Vector3(0, 0.18, 0.96),
      ],
      0.15,
      0.11,
      12,
      14
    );
    const headGeo = new THREE.SphereGeometry(0.18, 24, 20);
    headGeo.scale(0.92, 0.85, 1.32);

    // Smooth hydrofoil paddle flipper shape (replaces old BoxGeometry)
    const flipperShape = new THREE.Shape();
    flipperShape.moveTo(0, 0.08);
    flipperShape.bezierCurveTo(0.22, 0.14, 0.48, 0.08, 0.58, -0.04);
    flipperShape.bezierCurveTo(0.46, -0.16, 0.2, -0.14, 0, -0.08);
    flipperShape.closePath();
    const flipperGeo = new THREE.ExtrudeGeometry(flipperShape, {
      depth: 0.032,
      curveSegments: 24,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    flipperGeo.rotateX(Math.PI / 2);

    const tailGeo = new THREE.ConeGeometry(0.06, 0.24, 12);
    tailGeo.rotateX(-Math.PI / 2.2);

    const spotGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const eyeGeo = new THREE.SphereGeometry(0.036, 12, 12);

    for (let dist = 140; dist < 2380; dist += 145) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.5);
      const turtle = new THREE.Group();

      const shell = new THREE.Mesh(shellGeo, shellMat);
      const rim = new THREE.Mesh(rimGeo, shellMat);
      rim.position.y = 0.05;
      const plastron = new THREE.Mesh(plastronGeo, plastronMat);
      plastron.position.y = 0.02;
      const tail = new THREE.Mesh(tailGeo, skinMat);
      tail.position.set(0, 0.04, -0.88);
      turtle.add(shell, rim, plastron, tail);

      const headGroup = new THREE.Group();
      const neck = new THREE.Mesh(neckGeo, skinMat);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 0.19, 1.0);

      const spotL = new THREE.Mesh(spotGeo, spotMat);
      spotL.position.set(0.11, 0.24, 0.98);
      const spotR = new THREE.Mesh(spotGeo, spotMat);
      spotR.position.set(-0.11, 0.24, 0.98);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(0.12, 0.22, 1.1);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(-0.12, 0.22, 1.1);

      headGroup.add(neck, head, spotL, spotR, eyeL, eyeR);
      turtle.add(headGroup);

      const flippers: THREE.Mesh[] = [];
      const fConfigs = [
        { x: 0.52, z: 0.44, side: 1, scale: 1.0 },
        { x: -0.52, z: 0.44, side: -1, scale: 1.0 },
        { x: 0.44, z: -0.46, side: 1, scale: 0.78 },
        { x: -0.44, z: -0.46, side: -1, scale: 0.78 },
      ];
      fConfigs.forEach((fc) => {
        const flip = new THREE.Mesh(flipperGeo, skinMat);
        flip.position.set(fc.x, 0.05, fc.z);
        flip.scale.set(fc.side * fc.scale, fc.scale, fc.scale);
        turtle.add(flip);
        flippers.push(flip);
      });

      const basePos = new THREE.Vector3(
        position.x + normal.x * lateral,
        -1.3 - (dist % 2) * 0.8,
        position.z + normal.z * lateral
      );
      turtle.position.copy(basePos);
      mergeStaticMeshes(turtle, [...flippers, headGroup]);
      this.animalsGroup.add(turtle);
      this.friendSpots.push({ kind: 'turtle', object: turtle });

      this.turtles.push({
        group: turtle,
        basePos,
        flippers,
        headGroup,
        phase: dist * 0.1,
        speed: 0.9,
      });
    }
  }

  /**
   * Creates detailed Iridescent Dragonflies with compound eyes, sculpted thorax,
   * 7-segment tapering abdomen, and 4 independent elliptical curved wings
   */
  private createDartingDragonflies() {
    const textures = getGameTextures();
    const blueBodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#00d4ff'),
      roughness: 0.15,
      metalness: 0.7,
      clearcoat: 1.0,
    });
    const rubyBodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ff2a66'),
      roughness: 0.15,
      metalness: 0.7,
      clearcoat: 1.0,
    });
    const wingMat = new THREE.MeshBasicMaterial({
      map: textures.dragonflyWingAlbedo,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const thoraxGeo = new THREE.SphereGeometry(0.082, 18, 16);
    thoraxGeo.scale(0.85, 0.88, 1.38);
    const eyeGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const segGeo = new THREE.CapsuleGeometry(0.024, 0.055, 8, 12);
    segGeo.rotateX(Math.PI / 2);

    // Smooth elliptical dragonfly wing shape (replaces rectangular PlaneGeometry)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.14, 0.08, 0.36, 0.09, 0.44, 0.02);
    wingShape.bezierCurveTo(0.46, -0.04, 0.24, -0.08, 0, -0.01);
    wingShape.closePath();
    const singleWingGeo = new THREE.ShapeGeometry(wingShape, 20);
    singleWingGeo.rotateX(-Math.PI / 2);

    for (let dist = 75; dist < 2400; dist += 95) {
      const { position, normal, width } = getRiverPath(dist);
      const lateral = (Math.random() - 0.5) * (width * 0.6);
      const dfGroup = new THREE.Group();
      const bMat = dist % 190 === 75 ? blueBodyMat : rubyBodyMat;

      const thorax = new THREE.Mesh(thoraxGeo, bMat);
      thorax.position.set(0, 0, 0.12);
      dfGroup.add(thorax);

      // 7 articulated abdominal segments
      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Mesh(segGeo, bMat);
        const sc = 1.0 - s * 0.08;
        seg.scale.set(sc, sc, 1.0);
        seg.position.set(0, -s * 0.004, -0.02 - s * 0.078);
        dfGroup.add(seg);
      }

      const eyeL = new THREE.Mesh(eyeGeo, bMat);
      eyeL.position.set(0.042, 0.025, 0.24);
      const eyeR = new THREE.Mesh(eyeGeo, bMat);
      eyeR.position.set(-0.042, 0.025, 0.24);
      dfGroup.add(eyeL, eyeR);

      // 4 independent curved wings
      const wingFL = new THREE.Mesh(singleWingGeo, wingMat);
      wingFL.position.set(0.04, 0.05, 0.16);
      const wingFR = new THREE.Mesh(singleWingGeo, wingMat);
      wingFR.position.set(-0.04, 0.05, 0.16);
      wingFR.scale.x = -1;

      const wingBL = new THREE.Mesh(singleWingGeo, wingMat);
      wingBL.position.set(0.04, 0.045, 0.06);
      wingBL.scale.set(0.92, 1, 1.08);
      const wingBR = new THREE.Mesh(singleWingGeo, wingMat);
      wingBR.position.set(-0.04, 0.045, 0.06);
      wingBR.scale.set(-0.92, 1, 1.08);

      dfGroup.add(wingFL, wingFR, wingBL, wingBR);

      const basePos = new THREE.Vector3(
        position.x + normal.x * lateral,
        0.55,
        position.z + normal.z * lateral
      );
      dfGroup.position.copy(basePos);
      mergeStaticMeshes(dfGroup, [wingFL, wingFR, wingBL, wingBR]);
      this.animalsGroup.add(dfGroup);
      this.friendSpots.push({ kind: 'dragonfly', object: dfGroup });

      this.dragonflies.push({
        group: dfGroup,
        basePos,
        wings: [wingFL, wingFR, wingBL, wingBR],
        phase: dist * 0.12,
      });
    }
  }

  /**
   * Creates high-polygon Friendly Capybaras with smooth body, neck, rounded muzzle, cupped ears, and jointed legs with paws
   */
  private createFriendlyCapybaras() {
    const capyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9c6f44'),
      roughness: 0.74,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#42301f'),
      roughness: 0.62,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const bodyGeo = new THREE.CapsuleGeometry(0.76, 1.32, 18, 28);
    bodyGeo.rotateX(Math.PI / 2);
    const rumpGeo = new THREE.SphereGeometry(0.77, 24, 20);
    rumpGeo.scale(1.02, 0.96, 1.05);
    const neckGeo = new THREE.CapsuleGeometry(0.5, 0.45, 14, 20);
    neckGeo.rotateX(Math.PI / 3.2);
    const headGeo = new THREE.SphereGeometry(0.52, 24, 22);
    headGeo.scale(0.84, 0.9, 1.25);
    const snoutGeo = new THREE.SphereGeometry(0.38, 22, 20);
    snoutGeo.scale(0.88, 0.82, 0.95);
    const nostrilGeo = new THREE.SphereGeometry(0.045, 10, 10);
    const eyeGeo = new THREE.SphereGeometry(0.065, 14, 14);
    const earGeo = new THREE.SphereGeometry(0.13, 16, 14);
    earGeo.scale(0.75, 1.15, 0.9);
    const upperLegGeo = new THREE.CapsuleGeometry(0.17, 0.35, 10, 16);
    const lowerLegGeo = new THREE.CapsuleGeometry(0.12, 0.32, 10, 16);
    const pawGeo = new THREE.SphereGeometry(0.15, 14, 12);
    pawGeo.scale(0.95, 0.55, 1.35);

    const capyDistances = [200, 580, 850, 1300, 1950, 2450];
    capyDistances.forEach((dist) => {
      const { position, normal, width } = getRiverPath(dist);
      const capy = new THREE.Group();

      const bodyMesh = new THREE.Mesh(bodyGeo, capyMat);
      bodyMesh.position.y = 0.86;
      bodyMesh.castShadow = true;
      const rumpMesh = new THREE.Mesh(rumpGeo, capyMat);
      rumpMesh.position.set(0, 0.84, -0.58);
      const neckMesh = new THREE.Mesh(neckGeo, capyMat);
      neckMesh.position.set(0, 1.1, 0.65);
      capy.add(bodyMesh, rumpMesh, neckMesh);

      const headMesh = new THREE.Mesh(headGeo, capyMat);
      headMesh.position.set(0, 1.34, 0.94);
      headMesh.castShadow = true;
      capy.add(headMesh);

      const snoutMesh = new THREE.Mesh(snoutGeo, noseMat);
      snoutMesh.position.set(0, 1.26, 1.44);
      const nL = new THREE.Mesh(nostrilGeo, eyeMat);
      nL.position.set(0.12, 1.32, 1.76);
      const nR = new THREE.Mesh(nostrilGeo, eyeMat);
      nR.position.set(-0.12, 1.32, 1.76);
      capy.add(snoutMesh, nL, nR);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(0.35, 1.46, 1.06);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(-0.35, 1.46, 1.06);
      capy.add(eyeL, eyeR);

      const earL = new THREE.Mesh(earGeo, noseMat);
      earL.position.set(0.32, 1.74, 0.68);
      earL.rotation.z = -0.25;
      const earR = new THREE.Mesh(earGeo, noseMat);
      earR.position.set(-0.32, 1.74, 0.68);
      earR.rotation.z = 0.25;
      capy.add(earL, earR);

      [
        [-0.38, 0.55],
        [0.38, 0.55],
        [-0.38, -0.55],
        [0.38, -0.55],
      ].forEach(([lx, lz]) => {
        const uLeg = new THREE.Mesh(upperLegGeo, capyMat);
        uLeg.position.set(lx, 0.48, lz);
        const lLeg = new THREE.Mesh(lowerLegGeo, noseMat);
        lLeg.position.set(lx, 0.22, lz + 0.03);
        const paw = new THREE.Mesh(pawGeo, noseMat);
        paw.position.set(lx, 0.06, lz + 0.09);
        capy.add(uLeg, lLeg, paw);
      });

      const side = dist % 400 === 200 ? 1 : -1;
      const bankX = side * (width * 0.51 + 1.4);
      const groundY = getRiverBedElevationAt(dist, bankX);
      capy.position.set(
        position.x + normal.x * bankX,
        Math.max(0.45, groundY - 0.05),
        position.z + normal.z * bankX
      );
      capy.rotation.y = side === 1 ? -Math.PI / 2 - 0.4 : Math.PI / 2 + 0.4;
      capy.scale.set(0.95, 0.95, 0.95);

      mergeStaticMeshes(capy);
      this.animalsGroup.add(capy);
      this.friendSpots.push({ kind: 'capybara', object: capy });
    });
  }

  /**
   * Sculpts a continuous high-polygon C2-smooth body for the Amazon Pink River Dolphin (Boto)
   * with curved swept-back flippers and crescent tail flukes (replacing old cylinders/cones/boxes)
   */
  private createSculptedDolphinBodyGeometry(): THREE.BufferGeometry {
    const lengthSegs = 48;
    const radialSegs = 32;
    const totalLen = 3.6;
    const geo = new THREE.CylinderGeometry(0.4, 0.4, totalLen, radialSegs, lengthSegs, false);
    geo.rotateX(Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);

      // t = 0 at tail tip (-1.8), t = 1 at beak tip (+1.8)
      const t = THREE.MathUtils.clamp((vz + totalLen / 2) / totalLen, 0, 1);
      const lenR = Math.hypot(vx, vy);
      const nx = lenR > 1e-5 ? vx / lenR : 0;
      const ny = lenR > 1e-5 ? vy / lenR : 0;

      let rx = 0.3;
      let ryTop = 0.3;
      let ryBot = 0.3;
      let centerY = 0;

      if (t < 0.55) {
        // Smooth fusiform tail stock to mid-body
        const k = t / 0.55;
        const arch = Math.sin(k * Math.PI * 0.5);
        rx = THREE.MathUtils.lerp(0.08, 0.48, arch);
        ryTop = THREE.MathUtils.lerp(0.09, 0.52, arch);
        ryBot = THREE.MathUtils.lerp(0.08, 0.44, arch);
        // Characteristic low dorsal ridge of the Amazon Boto around t = 0.38..0.52
        if (ny > 0.5 && t > 0.32 && t < 0.55) {
          const ridgeK = Math.sin(((t - 0.32) / 0.23) * Math.PI);
          ryTop += ridgeK * Math.pow((ny - 0.5) * 2, 2) * 0.22;
        }
      } else if (t < 0.8) {
        // Mid-body to rounded bulbous melon forehead
        const k = (t - 0.55) / 0.25;
        const melonBump = Math.sin(k * Math.PI) * 0.12;
        rx = THREE.MathUtils.lerp(0.48, 0.16, k * k);
        ryTop = THREE.MathUtils.lerp(0.52, 0.15, Math.pow(k, 1.4)) + (ny > 0 ? melonBump : 0);
        ryBot = THREE.MathUtils.lerp(0.44, 0.12, k);
        centerY = -k * 0.04;
      } else {
        // Long slender curved Boto beak (rostrum)
        const k = (t - 0.8) / 0.2;
        const roundTip = Math.cos(k * Math.PI * 0.48);
        rx = THREE.MathUtils.lerp(0.16, 0.05, k) * roundTip;
        ryTop = THREE.MathUtils.lerp(0.15, 0.045, k) * roundTip;
        ryBot = THREE.MathUtils.lerp(0.12, 0.045, k) * roundTip;
        centerY = -0.04 - k * 0.03;
      }

      const sy = (ny >= 0 ? ny * ryTop : ny * ryBot) + centerY;
      const sx = nx * rx;
      pos.setXYZ(i, sx, sy, vz);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private createPinkRiverDolphins() {
    const dolphinMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffafcc'),
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.95,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const bodyGeo = this.createSculptedDolphinBodyGeometry();

    // Smooth curved pectoral flipper shape
    const flipShape = new THREE.Shape();
    flipShape.moveTo(0, 0.12);
    flipShape.bezierCurveTo(0.28, 0.18, 0.62, 0.08, 0.76, -0.12);
    flipShape.bezierCurveTo(0.58, -0.24, 0.24, -0.18, 0, -0.12);
    flipShape.closePath();
    const flipperGeo = new THREE.ExtrudeGeometry(flipShape, {
      depth: 0.035,
      curveSegments: 24,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    flipperGeo.rotateX(Math.PI / 2);

    // Smooth crescent cetacean tail fluke shape
    const flukeShape = new THREE.Shape();
    flukeShape.moveTo(0, 0.14);
    flukeShape.bezierCurveTo(0.28, 0.12, 0.56, -0.02, 0.66, -0.22);
    flukeShape.bezierCurveTo(0.42, -0.18, 0.15, -0.06, 0, -0.12);
    flukeShape.bezierCurveTo(-0.15, -0.06, -0.42, -0.18, -0.66, -0.22);
    flukeShape.bezierCurveTo(-0.56, -0.02, -0.28, 0.12, 0, 0.14);
    flukeShape.closePath();
    const flukeGeo = new THREE.ExtrudeGeometry(flukeShape, {
      depth: 0.032,
      curveSegments: 28,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.014,
      bevelThickness: 0.014,
    });
    flukeGeo.rotateX(Math.PI / 2);

    const eyeGeo = new THREE.SphereGeometry(0.048, 14, 14);

    const dSpots = [1720, 1980, 2220];
    dSpots.forEach((dist, idx) => {
      const { position, normal } = getRiverPath(dist);
      const dolph = new THREE.Group();

      const bodyMesh = new THREE.Mesh(bodyGeo, dolphinMat);
      dolph.add(bodyMesh);

      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(0.31, 0.08, 0.68);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(-0.31, 0.08, 0.68);
      dolph.add(eyeL, eyeR);

      const flipL = new THREE.Mesh(flipperGeo, dolphinMat);
      flipL.position.set(0.38, -0.18, 0.25);
      flipL.rotation.z = -0.35;
      const flipR = new THREE.Mesh(flipperGeo, dolphinMat);
      flipR.position.set(-0.38, -0.18, 0.25);
      flipR.scale.x = -1;
      flipR.rotation.z = 0.35;
      dolph.add(flipL, flipR);

      const flukeMesh = new THREE.Mesh(flukeGeo, dolphinMat);
      flukeMesh.position.set(0, 0, -1.72);
      dolph.add(flukeMesh);

      const side = idx % 2 === 0 ? 1 : -1;
      dolph.position.set(
        position.x + normal.x * (side * 6.5),
        -1.2,
        position.z
      );
      dolph.rotation.y = Math.PI;

      mergeStaticMeshes(dolph, [flukeMesh]);
      this.animalsGroup.add(dolph);
      this.friendSpots.push({ kind: 'dolphin', object: dolph });
      this.dolphins.push({
        group: dolph,
        tailFluke: flukeMesh,
        startZ: position.z,
        speed: 4.2,
        phase: idx * 1.5,
      });
    });
  }

  private createGrandLakeParadise() {
    const lakeCenterZ = -2750;
    const lakeCenterX = 0;

    // The island, lily pads and lotus flowers live in forest.ts; the rainbow is in sky.ts.

    const familyData = [
      { name: 'Mother Catfish (Mariana)', color: 0, r: 18, s: 0.6, phase: 0, scale: 1.05 },
      { name: 'Papa Catfish (Breno)', color: 1, r: 26, s: 0.45, phase: 1.8, scale: 1.25 },
      { name: 'Pip the Little Brother', color: 2, r: 12, s: 0.85, phase: 3.2, scale: 0.68 },
      { name: 'Cleo the Cousin', color: 0, r: 22, s: 0.55, phase: 4.5, scale: 0.92 },
      { name: 'Bruno the Grandfather', color: 1, r: 32, s: 0.38, phase: 5.7, scale: 1.32 },
    ];

    familyData.forEach((fam) => {
      const npcCharacter = new CatfishCharacter(true, fam.color);
      npcCharacter.group.scale.setScalar(fam.scale);
      this.grandLakeCelebrationGroup.add(npcCharacter.group);
      this.friendSpots.push({ kind: 'family', object: npcCharacter.group });

      this.grandLakeCatfish.push({
        character: npcCharacter,
        basePos: new THREE.Vector3(lakeCenterX, -1.8, lakeCenterZ),
        orbitRadius: fam.r,
        phase: fam.phase,
        speed: fam.s,
        name: fam.name,
      });
    });
  }

  /**
   * Have the catfish family gather around and follow `target` (Whiskers' position), or go
   * back to circling the lake with null.
   */
  public setFamilyFollow(target: THREE.Vector3 | null) {
    if (target && !this.familyFollow) {
      const n = this.grandLakeCatfish.length;
      this.grandLakeCatfish.forEach((cat, i) => {
        const a = (i / n) * Math.PI * 2;
        cat.character.group.position.set(target.x + Math.cos(a) * 14, target.y - 0.6, target.z + Math.sin(a) * 14);
      });
    }
    this.familyFollow = target;
  }

  /** Index of Pip, the little brother (the smallest family member). */
  public get pipIndex(): number {
    return this.grandLakeCatfish.findIndex((c) => c.name.startsWith('Pip'));
  }

  public pipPosition(): THREE.Vector3 | null {
    const i = this.pipIndex;
    return i >= 0 ? this.grandLakeCatfish[i].character.group.position : null;
  }

  /** Send a family member to hide at `spot`, or call them back with null. */
  public setFamilyHiding(index: number, spot: THREE.Vector3 | null) {
    if (spot) {
      this.familyHiding.set(index, spot.clone());
      this.grandLakeCatfish[index]?.character.group.position.copy(spot);
    } else {
      this.familyHiding.delete(index);
    }
  }

  /** The family hops and spins around Whiskers for a few seconds (rainbow party). */
  public startFamilyParty(seconds: number) {
    this.familyParty = seconds;
  }

  public setWaterColor(hex: string) {
    (this.waterMesh.material as THREE.MeshPhysicalMaterial).color.set(hex);
  }

  public update(dt: number, playerDist: number) {
    const { position } = getRiverPath(playerDist);
    this.waterMesh.position.set(position.x, 0, position.z);

    // Advance grass wind shader uniform
    this.grassTimeUniform.value += dt;

    // (Water ripples are animated in water.ts; tree sway in forest.ts.)

    // 2. Bubble drift
    const pos = this.bubbleParticles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.9;
      if (y > 0.1) y = -4.8;
      pos.setY(i, y);

      const z = pos.getZ(i);
      if (Math.abs(z - position.z) > 100) {
        pos.setZ(i, position.z - (Math.random() - 0.5) * 80);
        pos.setX(i, position.x + (Math.random() - 0.5) * 24);
      }
    }
    pos.needsUpdate = true;

    // 3. Swirling Current Rings
    for (let i = 0; i < this.currentZones.length; i++) {
      const cz = this.currentZones[i];
      if (Math.abs(cz.position.z - position.z) < 90) {
        cz.group.rotation.z += dt * 2.2;
      }
    }

    // 4. Schools of Small Fish with Rapidly Wagging Tail Fins
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
      sc.group.rotation.y = Math.atan2(-Math.sin(sc.phase), Math.cos(sc.phase));

      for (let t = 0; t < sc.tails.length; t++) {
        sc.tails[t].rotation.y = Math.PI / 2 + Math.sin(sc.phase * 12 + t) * 0.4;
      }
    }

    // 5. Friendly Paddling Turtles
    for (let i = 0; i < this.turtles.length; i++) {
      const tr = this.turtles[i];
      if (Math.abs(tr.basePos.z - position.z) > 95) continue;
      tr.phase += dt * tr.speed;
      tr.group.position.x = tr.basePos.x + Math.sin(tr.phase) * 2.6;
      tr.group.position.y = tr.basePos.y + Math.cos(tr.phase * 1.5) * 0.2;
      tr.group.rotation.y = Math.cos(tr.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
      tr.headGroup.rotation.y = Math.sin(tr.phase * 2) * 0.18;
      tr.flippers.forEach((f, idx) => {
        f.rotation.z = Math.sin(tr.phase * 4 + idx) * 0.35;
      });
    }

    // 6. Hopping Lily-Pad Frogs with Inflating Vocal Sacs
    for (let i = 0; i < this.frogs.length; i++) {
      const fr = this.frogs[i];
      fr.phase += dt * 2.6;
      const hopWave = Math.max(0, Math.sin(fr.phase));
      fr.group.position.y = fr.baseY + Math.pow(hopWave, 2) * 0.65;
      fr.group.rotation.x = hopWave > 0.1 ? -Math.cos(fr.phase) * 0.35 : 0;
      const sacScale = 1.0 + Math.max(0, Math.sin(fr.phase * 2)) * 0.45;
      fr.throatSac.scale.setScalar(sacScale);
    }

    // 7. Darting Dragonflies with 4 Independent Flapping Wings
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
        const sideSign = idx % 2 === 0 ? 1 : -1;
        const pairPhase = idx < 2 ? 0 : 0.7;
        w.rotation.z = sideSign * Math.sin(df.phase * 18 + pairPhase) * 0.46;
      });
    }

    // 8. Pink Dolphins Leaping
    this.dolphins.forEach((d) => {
      d.phase += dt * d.speed;
      const jumpHeight = Math.sin(d.phase) * 1.8 - 0.4;
      d.group.position.y = jumpHeight;
      d.group.rotation.x = Math.cos(d.phase) * 0.4;
      d.tailFluke.rotation.x = Math.sin(d.phase * 4) * 0.35;
    });

    // 9. Grand Lake High-Poly Catfish Family Swimming
    if (this.familyParty > 0) {
      this.familyParty = Math.max(0, this.familyParty - dt);
      this.partyTime += dt;
    }
    this.grandLakeCatfish.forEach((cat, idx) => {
      const g = cat.character.group;
      const hideAt = this.familyHiding.get(idx);
      if (hideAt) {
        // Hiding: wiggle in place, slowly turning, with only small movements.
        cat.phase += dt;
        g.position.set(hideAt.x + Math.sin(cat.phase * 0.7) * 0.4, hideAt.y + Math.sin(cat.phase * 1.3) * 0.1, hideAt.z);
        g.rotation.y += dt * 0.25;
        cat.character.update(dt, 0.8, 0.2, 0);
        return;
      }
      if (this.familyFollow) {
        // Swim in close, playful circles around Whiskers.
        const t = this.familyFollow;
        cat.phase += dt * (0.85 + idx * 0.07);
        const r = 2.8 + idx * 1.15;
        const tx = t.x + Math.cos(cat.phase) * r;
        const hop = this.familyParty > 0 ? Math.abs(Math.sin(this.partyTime * 5 + idx * 1.3)) * 1.3 : 0;
        const ty = t.y - 0.15 + Math.sin(cat.phase * 2 + idx) * 0.3 + hop;
        const tz = t.z + Math.sin(cat.phase) * r;
        _famPrev.copy(g.position);
        g.position.x = THREE.MathUtils.damp(g.position.x, tx, 2.2, dt);
        g.position.y = THREE.MathUtils.damp(g.position.y, ty, 2.2, dt);
        g.position.z = THREE.MathUtils.damp(g.position.z, tz, 2.2, dt);
        const vx = g.position.x - _famPrev.x;
        const vz = g.position.z - _famPrev.z;
        if (this.familyParty > 0) {
          g.rotation.y += dt * (idx % 2 === 0 ? 5 : -5); // happy spins
        } else if (vx * vx + vz * vz > 1e-8) {
          const want = Math.atan2(vx, vz);
          let diff = want - g.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 6);
        }
        cat.character.update(dt, 1.6, 0.3, 0);
        return;
      }
      cat.phase += dt * cat.speed;
      const cx = cat.basePos.x + Math.cos(cat.phase) * cat.orbitRadius;
      const cz = cat.basePos.z + Math.sin(cat.phase) * cat.orbitRadius;
      const cy = cat.basePos.y + Math.sin(cat.phase * 2) * 0.4;

      g.position.set(cx, cy, cz);
      g.rotation.y = Math.atan2(-Math.sin(cat.phase), Math.cos(cat.phase));
      cat.character.update(dt, 1.4, 0.25, Math.cos(cat.phase * 2) * 0.15);
    });
  }

  public dispose() {
    this.waterMesh.geometry.dispose();
    (this.waterMesh.material as THREE.Material).dispose();
    this.plantInstancedMesh.geometry.dispose();
    (this.plantInstancedMesh.material as THREE.Material).dispose();
    this.bankGrassInstancedMesh.geometry.dispose();
    (this.bankGrassInstancedMesh.material as THREE.Material).dispose();
    this.stoneInstancedMesh.geometry.dispose();
    (this.stoneInstancedMesh.material as THREE.Material).dispose();
    this.bubbleParticles.geometry.dispose();
    (this.bubbleParticles.material as THREE.Material).dispose();
    this.grandLakeCatfish.forEach((cat) => cat.character.dispose());
  }
}
