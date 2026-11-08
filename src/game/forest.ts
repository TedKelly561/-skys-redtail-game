import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';

/**
 * Riverbank forest: friendly rounded trees, palms, flowering trees and tall kapoks, plus
 * bushes, flowers and reeds. Every 60 m stretch is merged into two meshes (solid parts and
 * double-sided leaves), so the whole forest costs only a handful of draw calls. Wind sway is
 * done in the vertex shader.
 */

const CHUNK_LENGTH = 60;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/** Simple deterministic random so the forest looks the same every visit. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, z: number, k: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k) * 43758.5453;
  return v - Math.floor(v);
}

class PartList {
  public solid: THREE.BufferGeometry[] = [];
  public leaves: THREE.BufferGeometry[] = [];
}

/**
 * Adds one piece: geometry placed with the given transform, painted one color (with a little
 * per-vertex variation) and given a sway weight that grows with height above `baseY`.
 */
function addPart(
  list: THREE.BufferGeometry[],
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  color: THREE.ColorRepresentation,
  baseY: number,
  height: number,
  swayScale: number,
  rand: () => number,
  jitter = 0
) {
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.applyMatrix4(matrix);
  const pos = g.attributes.position as THREE.BufferAttribute;
  if (jitter > 0) {
    // Wobble vertices so blobs look organic. The offset is a hash of the position, so the
    // duplicated corners of neighboring triangles move together and no cracks open up.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const hx = Math.round(x * 1000) * 0.001;
      const hy = Math.round(y * 1000) * 0.001;
      const hz = Math.round(z * 1000) * 0.001;
      pos.setXYZ(
        i,
        x + (hash(hx, hy, hz, 1.7) - 0.5) * jitter,
        y + (hash(hx, hy, hz, 5.3) - 0.5) * jitter,
        z + (hash(hx, hy, hz, 9.1) - 0.5) * jitter
      );
    }
  }
  // Keep the source's smooth normals (already transformed); only flat shapes need new ones.
  if (!g.attributes.normal) g.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const sway = new Float32Array(pos.count);
  _c.set(color);
  for (let i = 0; i < pos.count; i++) {
    const shade = 0.92 + rand() * 0.16;
    colors[i * 3] = _c.r * shade;
    colors[i * 3 + 1] = _c.g * shade;
    colors[i * 3 + 2] = _c.b * shade;
    const h = THREE.MathUtils.clamp((pos.getY(i) - baseY) / height, 0, 1);
    sway[i] = h * h * swayScale;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  g.deleteAttribute('uv');
  list.push(g);
}

function compose(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _p.set(x, y, z);
  return _m.compose(_p, _q, _s);
}

/** A tapered trunk that bends gently toward `lean`. */
function trunkGeometry(height: number, rBottom: number, rTop: number, leanX: number, leanZ: number) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, height, 9, 6, false);
  g.translate(0, height / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / height;
    pos.setX(i, pos.getX(i) + leanX * t * t);
    pos.setZ(i, pos.getZ(i) + leanZ * t * t);
  }
  return g;
}

/** A drooping palm frond: a creased, tapered ribbon that arches outward and down. */
function frondGeometry(length: number, width: number) {
  const segs = 7;
  const verts: number[] = [];
  const pt = (t: number, side: number) => {
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.55) * length * 0.35 - t * t * length * 0.55;
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * (1 - t * 0.6);
    return [x, y + (side === 0 ? 0.08 : -0.02) * (1 - t), side * w];
  };
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    for (const side of [-1, 1]) {
      const a = pt(t0, 0);
      const b = pt(t1, 0);
      const c = pt(t0, side);
      const d = pt(t1, side);
      verts.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

const BLOB = new THREE.IcosahedronGeometry(1, 1);
const SMALL_BLOB = new THREE.IcosahedronGeometry(1, 0);
const FROND = frondGeometry(3.2, 0.55);
const PETAL = new THREE.CircleGeometry(0.11, 5);
const REED = new THREE.ConeGeometry(0.035, 1, 4, 1, true);
const CATTAIL = new THREE.CylinderGeometry(0.06, 0.06, 0.32, 6);

const LEAF_GREENS = ['#46c35a', '#3aae4f', '#5ad46a', '#2f9e47', '#63d672'];
const BARK = ['#8a5a36', '#7a4f2f', '#946541'];
const BLOSSOMS = ['#ff7eb6', '#ffd23f', '#ff9a5a', '#f4a9ff'];
const FLOWERS = ['#ff6fa8', '#ffffff', '#ffd23f', '#b98cff', '#ff8a4c'];

function roundTree(parts: PartList, x: number, y: number, z: number, r: () => number, blossom: boolean) {
  const h = 4.2 + r() * 2.2;
  const lean = (r() - 0.5) * 0.8;
  const leanZ = (r() - 0.5) * 0.8;
  const bark = BARK[Math.floor(r() * BARK.length)];
  const top = h + 0.6;
  addPart(parts.solid, trunkGeometry(h, 0.42, 0.24, lean, leanZ), compose(x, y, z), bark, y, top + 2, 0.6, r);
  // Soft root flares (rounded, half-buried) instead of long spiky roots.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r() * 0.6;
    addPart(
      parts.solid,
      BLOB,
      compose(x + Math.cos(a) * 0.38, y + 0.05, z + Math.sin(a) * 0.38, 0, -a, 0.35, 0.55, 0.32, 0.22),
      bark,
      y,
      top + 2,
      0,
      r
    );
  }
  const cx = x + lean;
  const cz = z + leanZ;
  const blobs = 5 + Math.floor(r() * 3);
  const crownR = 1.6 + r() * 0.6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r();
    const rr = i === 0 ? 0 : crownR * (0.55 + r() * 0.35);
    const size = (i === 0 ? 1.6 : 1.1 + r() * 0.5) * (crownR / 1.8);
    addPart(
      parts.solid,
      BLOB,
      compose(cx + Math.cos(a) * rr, y + top + (i === 0 ? 0.5 : (r() - 0.3) * 1.0), cz + Math.sin(a) * rr, 0, r() * 3, 0, size, size * 0.85, size),
      LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)],
      y,
      top + 2,
      1,
      r,
      0.12
    );
  }
  if (blossom) {
    const color = BLOSSOMS[Math.floor(r() * BLOSSOMS.length)];
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const el = r() * 1.1;
      const rad = crownR * 1.15;
      addPart(
        parts.solid,
        SMALL_BLOB,
        compose(cx + Math.cos(a) * Math.cos(el) * rad, y + top + 0.4 + Math.sin(el) * rad * 0.8, cz + Math.sin(a) * Math.cos(el) * rad, 0, 0, 0, 0.2, 0.2, 0.2),
        color,
        y,
        top + 2,
        1,
        r
      );
    }
  }
}

function palmTree(parts: PartList, x: number, y: number, z: number, r: () => number, towardRiverX: number, towardRiverZ: number) {
  const h = 5 + r() * 2;
  const lean = 1.2 + r() * 1.0;
  const lx = towardRiverX * lean;
  const lz = towardRiverZ * lean;
  const trunk = trunkGeometry(h, 0.3, 0.2, lx, lz);
  // Ring bands on the trunk.
  addPart(parts.solid, trunk, compose(x, y, z), '#a07850', y, h, 0.5, r);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    addPart(
      parts.solid,
      BLOB,
      compose(x + lx * t * t, y + h * t, z + lz * t * t, 0, 0, 0, 0.3 - t * 0.08, 0.07, 0.3 - t * 0.08),
      '#7e5a38',
      y,
      h,
      0.5 * t * t,
      r
    );
  }
  const tx = x + lx;
  const tz = z + lz;
  const ty = y + h;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    addPart(
      parts.leaves,
      FROND,
      compose(tx, ty, tz, 0, -a, (r() - 0.5) * 0.3, 1, 1, 1),
      LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)],
      ty - 1,
      2.5,
      1,
      r
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    addPart(parts.solid, BLOB, compose(tx + Math.cos(a) * 0.22, ty - 0.25, tz + Math.sin(a) * 0.22, 0, 0, 0, 0.18, 0.2, 0.18), '#6b4a2a', y, h, 0.8, r);
  }
}

function kapokTree(parts: PartList, x: number, y: number, z: number, r: () => number) {
  const h = 8.5 + r() * 2.5;
  addPart(parts.solid, trunkGeometry(h, 0.7, 0.38, 0, 0), compose(x, y, z), '#9a7b5c', y, h + 2, 0.3, r);
  // Big friendly buttress roots.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.5;
    addPart(parts.solid, BLOB, compose(x + Math.cos(a) * 0.7, y + 0.6, z + Math.sin(a) * 0.7, 0, -a, 0, 0.9, 0.9, 0.18), '#8c6d4f', y, h + 2, 0, r);
  }
  // Wide umbrella crown.
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r();
    const rr = i === 0 ? 0 : 2.6 + r() * 0.8;
    const size = i === 0 ? 2.6 : 1.8 + r() * 0.6;
    addPart(
      parts.solid,
      BLOB,
      compose(x + Math.cos(a) * rr, y + h + 0.4 + r() * 0.5, z + Math.sin(a) * rr, 0, r() * 3, 0, size, size * 0.5, size),
      LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)],
      y,
      h + 2,
      0.7,
      r,
      0.15
    );
  }
}

function bush(parts: PartList, x: number, y: number, z: number, r: () => number) {
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const s = 0.55 + r() * 0.4;
    addPart(parts.solid, BLOB, compose(x + (r() - 0.5) * 1.2, y + s * 0.5, z + (r() - 0.5) * 1.2, 0, r() * 3, 0, s, s * 0.8, s), LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)], y, 1.5, 0.5, r, 0.08);
  }
  if (r() < 0.6) {
    const color = FLOWERS[Math.floor(r() * FLOWERS.length)];
    for (let i = 0; i < 6; i++) {
      addPart(parts.solid, SMALL_BLOB, compose(x + (r() - 0.5) * 1.3, y + 0.7 + r() * 0.4, z + (r() - 0.5) * 1.3, 0, 0, 0, 0.12, 0.12, 0.12), color, y, 1.5, 0.5, r);
    }
  }
}

function flower(parts: PartList, x: number, y: number, z: number, r: () => number) {
  const color = FLOWERS[Math.floor(r() * FLOWERS.length)];
  const h = 0.35 + r() * 0.25;
  addPart(parts.solid, REED, compose(x, y + h / 2, z, 0, 0, 0, 0.6, h, 0.6), '#3c9a3f', y, h, 0.6, r);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    addPart(parts.leaves, PETAL, compose(x + Math.cos(a) * 0.1, y + h, z + Math.sin(a) * 0.1, -Math.PI / 2), color, y, h, 0.6, r);
  }
  addPart(parts.solid, SMALL_BLOB, compose(x, y + h + 0.02, z, 0, 0, 0, 0.07, 0.05, 0.07), '#ffcf3a', y, h, 0.6, r);
}

function reedClump(parts: PartList, x: number, y: number, z: number, r: () => number) {
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const ox = (r() - 0.5) * 0.6;
    const oz = (r() - 0.5) * 0.6;
    const h = 1.0 + r() * 0.8;
    addPart(parts.leaves, REED, compose(x + ox, y + h / 2, z + oz, (r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25, 1, h, 1), '#5e9e3c', y, h, 0.8, r);
    if (r() < 0.45) {
      addPart(parts.solid, CATTAIL, compose(x + ox, y + h * 0.92, z + oz), '#7b4a26', y, h, 0.8, r);
    }
  }
}

/** Lateral offset of the waterline on one side, found by stepping out until the bank is dry. */
function waterlineLateral(dist: number, side: number, halfW: number) {
  for (let lat = halfW * 0.7; lat < halfW * 1.6; lat += 0.25) {
    if (getRiverBedElevationAt(dist, side * lat) > -0.05) return side * lat;
  }
  return side * halfW;
}

export class Forest {
  public group = new THREE.Group();
  private timeUniform = { value: 0 };
  private materials: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const solidMat = this.makeMaterial(THREE.FrontSide);
    const leafMat = this.makeMaterial(THREE.DoubleSide);

    const chunks = new Map<number, PartList>();
    const partsAt = (dist: number) => {
      const k = Math.floor(dist / CHUNK_LENGTH);
      let p = chunks.get(k);
      if (!p) {
        p = new PartList();
        chunks.set(k, p);
      }
      return p;
    };

    for (let dist = 12; dist < 3060; dist += 15) {
      const { position, normal, width } = getRiverPath(dist);
      const halfW = width * 0.5;

      for (const side of [-1, 1]) {
        const r = rng(Math.floor(dist * 7919 + (side + 1) * 104729));
        const parts = partsAt(dist);
        const place = (lateral: number, zShift = 0) => {
          const groundY = getRiverBedElevationAt(dist, lateral);
          return {
            x: position.x + normal.x * lateral,
            y: groundY,
            z: position.z + normal.z * lateral + zShift,
          };
        };

        // Front row near the water.
        const front = place(side * (halfW + 1.6 + r() * 1.4));
        if (front.y > 0.15) {
          const kind = r();
          if (kind < 0.3) {
            palmTree(parts, front.x, front.y, front.z, r, -normal.x * side, -normal.z * side);
          } else {
            roundTree(parts, front.x, front.y, front.z, r, kind > 0.75);
          }
        }

        // Back row: taller trees every other spot.
        if (dist % 30 === 12) {
          const back = place(side * (halfW + 7 + r() * 5), 3.5);
          if (r() < 0.45) kapokTree(parts, back.x, back.y, back.z, r);
          else roundTree(parts, back.x, back.y, back.z, r, r() < 0.3);
        }

        // Bushes and flowers on the bank between trees.
        const b = place(side * (halfW + 3.5 + r() * 3), 7);
        if (b.y > 0.2) bush(parts, b.x, b.y, b.z, r);
        for (let i = 0; i < 5; i++) {
          const f = place(side * (halfW + 1.2 + r() * 8), (r() - 0.5) * 14);
          if (f.y > 0.25) flower(parts, f.x, f.y, f.z, r);
        }

        // Reeds and cattails right at the waterline.
        if (r() < 0.75) {
          const lat = waterlineLateral(dist + 5, side, halfW);
          const p2 = getRiverPath(dist + 5);
          const y = Math.max(-0.2, getRiverBedElevationAt(dist + 5, lat));
          reedClump(parts, p2.position.x + p2.normal.x * lat, y, p2.position.z + p2.normal.z * lat, r);
        }
      }
    }

    // Grand Lake: a little palm island and lily pads with lotus flowers.
    const lake = new PartList();
    this.buildLakeDecor(lake);
    chunks.forEach((parts) => {
      this.addChunkMesh(parts.solid, solidMat);
      this.addChunkMesh(parts.leaves, leafMat);
    });
    this.addChunkMesh(lake.solid, solidMat);
    this.addChunkMesh(lake.leaves, leafMat);
  }

  private buildLakeDecor(parts: PartList) {
    const r = rng(424242);
    // Island just off the swimming line, ahead of where Whiskers reaches the lake.
    const isle = getRiverPath(2520);
    const ix = isle.position.x + isle.normal.x * 22;
    const iz = isle.position.z + isle.normal.z * 22;
    addPart(parts.solid, BLOB, compose(ix, -0.9, iz, 0, 0, 0, 8.5, 1.6, 7.5), '#e8d29a', -1, 3, 0, r, 0.3);
    addPart(parts.solid, BLOB, compose(ix, -0.35, iz, 0, 0, 0, 6.6, 1.25, 5.8), '#56c25a', -1, 3, 0, r, 0.25);
    palmTree(parts, ix - 2.2, 0.6, iz + 1.0, r, -0.6, 0.4);
    palmTree(parts, ix + 2.0, 0.6, iz - 1.4, r, 0.5, -0.3);
    roundTree(parts, ix + 0.4, 0.7, iz + 2.4, r, true);
    bush(parts, ix - 3.6, 0.5, iz - 1.8, r);
    bush(parts, ix + 3.8, 0.5, iz + 1.2, r);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = 1.5 + r() * 3.5;
      flower(parts, ix + Math.cos(a) * d, 0.75, iz + Math.sin(a) * d * 0.85, r);
    }

    // Lily pads and pink lotus flowers floating on the lake.
    const pad = new THREE.CircleGeometry(1, 14, 0.25, Math.PI * 2 - 0.5);
    pad.rotateX(-Math.PI / 2);
    for (let dist = 2380; dist < 2980; dist += 6) {
      const { position, normal, width } = getRiverPath(dist);
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const lat = (r() - 0.5) * width * 0.85;
        if (Math.abs(lat) < 3) continue; // keep Whiskers' path clear
        const x = position.x + normal.x * lat;
        const z = position.z + normal.z * lat;
        if (Math.hypot(x - ix, z - iz) < 10) continue;
        if (getRiverBedElevationAt(dist, lat) > -0.4) continue;
        const sz = 0.7 + r() * 0.7;
        addPart(parts.leaves, pad, compose(x, 0.04, z, 0, r() * 6.28, 0, sz, 1, sz), r() < 0.5 ? '#3fae4a' : '#55c25c', 0, 1, 0, r);
        if (r() < 0.35) {
          const color = r() < 0.7 ? '#ff8fc0' : '#ffffff';
          for (let p2 = 0; p2 < 6; p2++) {
            const a = (p2 / 6) * Math.PI * 2;
            addPart(parts.solid, SMALL_BLOB, compose(x + Math.cos(a) * 0.16, 0.2, z + Math.sin(a) * 0.16, 0, -a, 0.6, 0.1, 0.22, 0.12), color, 0, 1, 0, r);
          }
          addPart(parts.solid, SMALL_BLOB, compose(x, 0.22, z, 0, 0, 0, 0.09, 0.07, 0.09), '#ffd23f', 0, 1, 0, r);
        }
      }
    }
  }

  private makeMaterial(side: THREE.Side) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', 'attribute float sway;\nuniform float uTime;\n#include <common>')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
          float ph = wp.x * 0.13 + wp.z * 0.09;
          transformed.x += sin(uTime * 1.2 + ph) * 0.18 * sway;
          transformed.z += cos(uTime * 0.9 + ph * 1.3) * 0.12 * sway;`
        );
    };
    this.materials.push(mat);
    return mat;
  }

  private addChunkMesh(geos: THREE.BufferGeometry[], mat: THREE.Material) {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    merged.computeBoundingBox();
    const center = new THREE.Vector3();
    merged.boundingBox!.getCenter(center);
    merged.translate(-center.x, 0, -center.z);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.position.set(center.x, 0, center.z);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
  }

  public update(dt: number) {
    this.timeUniform.value += dt;
  }

  public dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.materials.forEach((m) => m.dispose());
    this.group.parent?.remove(this.group);
  }
}
