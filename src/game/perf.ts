import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Performance helpers. Phones and tablets slow down mostly from the number of separate
 * objects drawn each frame, so these tools merge pieces, cheapen materials, and keep only
 * the nearby part of the 3 km river in the scene.
 */

const _rootInv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();

/** Make a geometry mergeable with others: non-indexed, with exactly position/normal/uv. */
function normalizeForMerge(src: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  let g = src.index ? src.toNonIndexed() : src.clone();
  g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/**
 * Merges every mesh under `root` that shares a material into a single mesh, leaving the
 * `keep` objects (and everything inside them) untouched so their animations still work.
 * Returns how many meshes were removed.
 */
export function mergeStaticMeshes(root: THREE.Object3D, keep: THREE.Object3D[] = []): number {
  const keepSet = new Set(keep);
  root.updateMatrixWorld(true);
  _rootInv.copy(root.matrixWorld).invert();

  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  const visit = (obj: THREE.Object3D) => {
    if (keepSet.has(obj)) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
      const mat = mesh.material as THREE.Material;
      let b = buckets.get(mat);
      if (!b) {
        b = { geos: [], meshes: [] };
        buckets.set(mat, b);
      }
      _rel.multiplyMatrices(_rootInv, mesh.matrixWorld);
      b.geos.push(normalizeForMerge(mesh.geometry, _rel));
      b.meshes.push(mesh);
    }
    for (const child of obj.children) visit(child);
  };
  for (const child of root.children) visit(child);

  let removed = 0;
  buckets.forEach((b, mat) => {
    if (b.meshes.length < 2) {
      b.geos.forEach((g) => g.dispose());
      return;
    }
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) return;
    for (const m of b.meshes) {
      m.parent?.remove(m);
      removed++;
    }
    const mesh = new THREE.Mesh(merged, mat);
    root.add(mesh);
    removed--;
  });
  return removed;
}

/**
 * Swaps MeshPhysicalMaterial (clearcoat, iridescence: costly per pixel) for the cheaper
 * MeshStandardMaterial with the same colors and maps. Shared materials stay shared.
 */
export function downgradePhysicalMaterials(root: THREE.Object3D, skip: Set<THREE.Material> = new Set()) {
  const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const convert = (m: THREE.Material): THREE.Material => {
    const p = m as THREE.MeshPhysicalMaterial;
    if (!p.isMeshPhysicalMaterial || skip.has(m)) return m;
    let s = cache.get(m);
    if (!s) {
      s = new THREE.MeshStandardMaterial({
        color: p.color,
        map: p.map,
        roughness: Math.max(0.2, p.roughness),
        metalness: p.metalness,
        emissive: p.emissive,
        emissiveIntensity: p.emissiveIntensity,
        emissiveMap: p.emissiveMap,
        bumpMap: p.bumpMap,
        bumpScale: p.bumpScale,
        normalMap: p.normalMap,
        transparent: p.transparent,
        opacity: p.opacity,
        side: p.side,
        vertexColors: p.vertexColors,
        alphaTest: p.alphaTest,
        depthWrite: p.depthWrite,
      });
      s.name = p.name;
      cache.set(m, s);
    }
    return s;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
  });
}

interface StreamEntry {
  obj: THREE.Object3D;
  parent: THREE.Object3D;
  radiusSq: number;
  hideSq: number;
  attached: boolean;
}

/**
 * Keeps only objects near the camera attached to the scene. Detached objects cost nothing
 * per frame (no matrix updates, no culling tests, no draw calls). Objects are expected to be
 * direct children of groups sitting at the world origin, so their position is world space.
 */
export class DistanceStreamer {
  private entries: StreamEntry[] = [];
  private timer = 0;

  /** Register every current child of `parent`. */
  public addChildrenOf(parent: THREE.Object3D, radius: number) {
    for (const obj of [...parent.children]) this.add(obj, parent, radius);
  }

  public add(obj: THREE.Object3D, parent: THREE.Object3D, radius: number) {
    const hide = radius + 15;
    this.entries.push({ obj, parent, radiusSq: radius * radius, hideSq: hide * hide, attached: obj.parent === parent });
  }

  /** Call every frame; it only does work a few times a second (or immediately when forced). */
  public update(dt: number, focus: THREE.Vector3, force = false) {
    this.timer -= dt;
    if (this.timer > 0 && !force) return;
    this.timer = 0.25;
    for (const e of this.entries) {
      const dx = e.obj.position.x - focus.x;
      const dz = e.obj.position.z - focus.z;
      const d = dx * dx + dz * dz;
      if (!e.attached && d < e.radiusSq) {
        e.parent.add(e.obj);
        e.attached = true;
      } else if (e.attached && d > e.hideSq) {
        e.parent.remove(e.obj);
        e.attached = false;
      }
    }
  }
}

/**
 * Lowers the render resolution a little when frames are slow and raises it back when there is
 * headroom, so phones stay smooth instead of stuttering.
 */
export class AdaptiveResolution {
  private samples = 0;
  private total = 0;
  private current: number;
  private cooldown = 2;

  constructor(private renderer: THREE.WebGLRenderer, private max: number, private min = 0.75) {
    this.current = max;
    renderer.setPixelRatio(max);
  }

  /** Frame time before the last step down, to check the step actually helped. */
  private beforeDropMs = 0;

  /** Back to full sharpness and start judging again (e.g. after shadows are turned off). */
  public reset() {
    this.current = this.max;
    this.renderer.setPixelRatio(this.max);
    this.beforeDropMs = 0;
    this.total = 0;
    this.samples = 0;
    this.cooldown = 3;
  }

  public update(rawDt: number) {
    if (rawDt <= 0 || rawDt > 0.25) return; // ignore tab switches and hitches
    this.cooldown -= rawDt;
    this.total += rawDt;
    this.samples++;
    if (this.total < 1.5) return;
    const avgMs = (this.total / this.samples) * 1000;
    this.total = 0;
    this.samples = 0;
    if (this.cooldown > 0) return;

    // If the last step down didn't speed things up (a 30-frames-a-second cap, or a slow moment
    // that wasn't about pixels), a blurrier picture won't help: undo it and try again later.
    if (this.beforeDropMs > 0) {
      const helped = avgMs < this.beforeDropMs * 0.85;
      this.beforeDropMs = 0;
      if (!helped) {
        this.current = Math.min(this.max, this.current + 0.25);
        this.renderer.setPixelRatio(this.current);
        this.cooldown = 20;
        return;
      }
    }

    let next = this.current;
    if (avgMs > 22) next = Math.max(this.min, this.current - 0.25);
    else if (avgMs < 15) next = Math.min(this.max, this.current + 0.25);
    if (next !== this.current) {
      if (next < this.current) this.beforeDropMs = avgMs;
      this.current = next;
      this.renderer.setPixelRatio(next); // also resizes the drawing buffer
      this.cooldown = 3;
    }
  }
}
