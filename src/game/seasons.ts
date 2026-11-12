import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';

/**
 * Seasons: autumn turns the trees orange, red and gold with leaves drifting down; winter puts
 * snow on treetops, grass and riverbanks with gentle snowflakes, and in December holiday lights
 * line the river. By default the season follows the calendar; grown-ups can pick one.
 */
export type Season = 'summer' | 'autumn' | 'winter';
export type SeasonSetting = 'auto' | Season;

const KEY = 'whiskers_season';

export function loadSeasonSetting(): SeasonSetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'summer' || v === 'autumn' || v === 'winter') return v;
  } catch {
    // ignore
  }
  return 'auto';
}

export function saveSeasonSetting(v: SeasonSetting) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // ignore
  }
}

export function seasonForDate(d = new Date()): Season {
  const m = d.getMonth(); // 0 = January
  if (m === 11 || m <= 1) return 'winter';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'summer';
}

/** Holiday lights from December 1 to January 6. */
export function isHolidayTime(d = new Date()) {
  return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 6);
}

export function resolveSeason(setting: SeasonSetting): Season {
  return setting === 'auto' ? seasonForDate() : setting;
}

/** Shared by every patched material: 0 summer, 1 autumn, 2 winter. */
export const seasonUniform = { value: 0 };

type SurfaceKind = 'leaf' | 'solid' | 'grass' | 'ground';

const SEASON_COMMON = `
uniform float uSeason;
varying vec3 vSeasonPos;
varying vec3 vSeasonNormal;
float seasonHash(vec3 p) { return fract(sin(dot(floor(p * 0.2), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;

function fragmentFor(kind: SurfaceKind) {
  const green = `float greenness = smoothstep(0.02, 0.14, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
  float bright = 0.8 + 0.5 * dot(diffuseColor.rgb, vec3(0.33));`;
  const autumn =
    kind === 'leaf'
      ? `float h = seasonHash(vSeasonPos);
         vec3 fall = h < 0.34 ? vec3(0.97, 0.47, 0.12) : (h < 0.67 ? vec3(0.86, 0.22, 0.12) : vec3(0.99, 0.76, 0.22));
         diffuseColor.rgb = mix(diffuseColor.rgb, fall * bright, greenness * 0.92);`
      : kind === 'grass' || kind === 'ground'
        ? `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.62, 0.30) * bright, greenness * 0.7);`
        : '';
  const snowUp = kind === 'grass' ? '0.0' : kind === 'leaf' ? '0.2' : '0.45';
  // Lily pads float right at the water (y about 0.04), so low leaves stay green.
  const lowLeaf = kind === 'leaf' ? 'step(vSeasonPos.y, 0.3)' : '0.0';
  return `
  // The mangrove stretch of the river (z from -2350 to -1680) and lily pads stay green in autumn.
  float evergreen = max(step(-2350.0, vSeasonPos.z) * step(vSeasonPos.z, -1680.0), ${lowLeaf});
  if (uSeason > 0.5 && uSeason < 1.5 && evergreen < 0.5) {
    ${green}
    ${autumn}
  } else if (uSeason > 1.5) {
    float up = smoothstep(${snowUp}, ${snowUp} + 0.4, normalize(vSeasonNormal).y);
    float above = smoothstep(0.15, 0.6, vSeasonPos.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), up * above * ${kind === 'grass' ? '0.8' : '0.88'});
  }`;
}

/** Adds the seasonal look to a material, keeping any shader changes it already has. */
export function patchSeasonal(material: THREE.Material, kind: SurfaceKind) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uSeason = seasonUniform;
    shader.vertexShader = SEASON_COMMON + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      #ifdef USE_INSTANCING
        vSeasonPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vSeasonNormal = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
      #else
        vSeasonPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSeasonNormal = mat3(modelMatrix) * objectNormal;
      #endif`
    );
    shader.fragmentShader = SEASON_COMMON + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      ${fragmentFor(kind)}`
    );
  };
  material.customProgramCacheKey = () => `${prevKey}|season-${kind}`;
  material.needsUpdate = true;
}

function softDotTexture(draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FLAKES = 280;
const BOX = { x: 20, y: 12, z: 20 };

/** Falling leaves or snowflakes around the camera, and December's holiday lights. */
export class SeasonEffects {
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private drift: Float32Array;
  private material: THREE.PointsMaterial;
  private leafTex: THREE.Texture;
  private snowTex: THREE.Texture;
  private lights: THREE.InstancedMesh | null = null;
  private scene: THREE.Scene;
  private season: Season = 'summer';
  private time = 0;
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.positions = new Float32Array(FLAKES * 3);
    this.colors = new Float32Array(FLAKES * 3);
    this.drift = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * BOX.x * 2;
      this.positions[i * 3 + 1] = Math.random() * BOX.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * BOX.z * 2;
      this.drift[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.leafTex = softDotTexture((ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(32, 32, 26, 13, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    });
    this.snowTex = softDotTexture((ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    this.material = new THREE.PointsMaterial({
      size: 0.35,
      map: this.leafTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.disposables.push(geo, this.material, this.leafTex, this.snowTex);
  }

  public setSeason(season: Season, holiday: boolean) {
    this.season = season;
    this.points.visible = season !== 'summer';
    seasonUniform.value = season === 'autumn' ? 1 : season === 'winter' ? 2 : 0;
    const leafColors = [
      [0.97, 0.47, 0.12],
      [0.86, 0.22, 0.12],
      [0.99, 0.76, 0.22],
    ];
    for (let i = 0; i < FLAKES; i++) {
      const c = season === 'autumn' ? leafColors[i % 3] : [1, 1, 1];
      this.colors.set(c, i * 3);
    }
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.material.map = season === 'autumn' ? this.leafTex : this.snowTex;
    this.material.size = season === 'autumn' ? 0.42 : 0.22;
    this.material.needsUpdate = true;

    const wantLights = season === 'winter' && holiday;
    if (wantLights && !this.lights) this.buildLights();
    if (this.lights) this.lights.visible = wantLights;
  }

  /** Strings of colored bulbs on little posts along both banks. */
  private buildLights() {
    const geo = new THREE.IcosahedronGeometry(0.17, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const SPACING = 3;
    const SPAN = 12;
    const dists: number[] = [];
    for (let d = 20; d < 2340; d += SPACING) dists.push(d);
    const mesh = new THREE.InstancedMesh(geo, mat, dists.length * 2);
    const palette = ['#ff4d4d', '#4dff88', '#4da6ff', '#ffd23f', '#ff8cf0'].map((c) => new THREE.Color(c));
    const m = new THREE.Matrix4();
    let k = 0;
    for (const side of [1, -1]) {
      dists.forEach((d, i) => {
        const { position, normal, width } = getRiverPath(d);
        let lat = width * 0.5;
        for (let l = width * 0.35; l < width; l += 0.5) {
          if (getRiverBedElevationAt(d, side * l) > 0.1) {
            lat = l + 0.8;
            break;
          }
        }
        const ground = getRiverBedElevationAt(d, side * lat);
        const t = (d % SPAN) / SPAN;
        const y = ground + 1.5 - Math.sin(t * Math.PI) * 0.45;
        m.makeTranslation(position.x + normal.x * side * lat, y, position.z + normal.z * side * lat);
        mesh.setMatrixAt(k, m);
        mesh.setColorAt(k, palette[(i + (side > 0 ? 0 : 2)) % palette.length]);
        k++;
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.lights = mesh;
    this.scene.add(mesh);
    this.disposables.push(geo, mat);
  }

  public update(dt: number, camera: THREE.Vector3) {
    if (this.season === 'summer') return;
    this.time += dt;
    const p = this.positions;
    const fall = this.season === 'autumn' ? 1.1 : 0.8;
    const sway = this.season === 'autumn' ? 1.4 : 0.5;
    for (let i = 0; i < FLAKES; i++) {
      const ix = i * 3;
      p[ix] += Math.sin(this.time * 1.3 + this.drift[i]) * sway * dt;
      p[ix + 1] -= fall * dt * (0.7 + (i % 5) * 0.12);
      p[ix + 2] += Math.cos(this.time * 1.1 + this.drift[i]) * sway * 0.6 * dt;
      // Keep the flakes in a box that travels with the camera; they never fall into the water.
      const wx = p[ix] - camera.x;
      const wz = p[ix + 2] - camera.z;
      if (p[ix + 1] < 0.05 || Math.abs(wx) > BOX.x || Math.abs(wz) > BOX.z) {
        p[ix] = camera.x + (Math.random() - 0.5) * BOX.x * 2;
        p[ix + 1] = Math.max(1, camera.y) + Math.random() * BOX.y * 0.6 + 2;
        p[ix + 2] = camera.z + (Math.random() - 0.5) * BOX.z * 2;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.points.parent?.remove(this.points);
    this.lights?.parent?.remove(this.lights);
  }
}
