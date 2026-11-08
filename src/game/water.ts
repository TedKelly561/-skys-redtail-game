import * as THREE from 'three';
import { getRiverPath, getRiverBedElevationAt } from './worldGen';

/**
 * Water look: a custom surface shader (clear when looking down, sky-reflecting toward the
 * horizon, rippling, with sun sparkles), dancing caustic light on the riverbed, and soft foam
 * along both shorelines. All cheap enough for phones.
 */

export interface WaterLook {
  material: THREE.ShaderMaterial;
  uniforms: {
    uTime: { value: number };
    uWaterColor: { value: THREE.Color };
    uDeepColor: { value: THREE.Color };
    uSkyHorizon: { value: THREE.Color };
    uSkyZenith: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
  };
}

/** Tileable ripple height map (sum of soft sine "blobs"), used for surface normals. */
function makeRippleTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const waves: { kx: number; ky: number; ph: number; a: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const kx = Math.round((Math.random() - 0.5) * 8);
    const ky = Math.round((Math.random() - 0.5) * 8) || 1;
    waves.push({ kx, ky, ph: Math.random() * 6.28, a: 0.5 + Math.random() * 0.5 });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin(((x * w.kx + y * w.ky) / size) * Math.PI * 2 + w.ph) * w.a;
      const v = Math.floor(THREE.MathUtils.clamp(0.5 + h * 0.09, 0, 1) * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createWaterLook(): WaterLook {
  const uniforms = {
    uTime: { value: 0 },
    uWaterColor: { value: new THREE.Color('#14a3b4') },
    uDeepColor: { value: new THREE.Color('#0b5f78') },
    uSkyHorizon: { value: new THREE.Color('#bfe9f7') },
    uSkyZenith: { value: new THREE.Color('#5fb8ec') },
    uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.3).normalize() },
    uRipples: { value: makeRippleTexture() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uWaterColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSkyZenith;
      uniform vec3 uSunDir;
      uniform sampler2D uRipples;
      varying vec3 vWorldPos;

      vec2 slope(vec2 uv) {
        float e = 1.0 / 128.0;
        float h0 = texture2D(uRipples, uv).r;
        float hx = texture2D(uRipples, uv + vec2(e, 0.0)).r;
        float hy = texture2D(uRipples, uv + vec2(0.0, e)).r;
        return vec2(hx - h0, hy - h0);
      }

      void main() {
        vec2 p = vWorldPos.xz;
        // Two ripple layers drifting in different directions, like a flowing river.
        vec2 s = slope(p * 0.045 + vec2(0.0, -uTime * 0.035)) * 1.0
               + slope(p * 0.09 + vec2(uTime * 0.02, -uTime * 0.05)) * 0.7;
        vec3 N = normalize(vec3(-s.x * 6.5, 1.0, -s.y * 6.5));
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Fresnel: see through the water when looking down, see the sky near the horizon.
        float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
        fres = clamp(0.03 + fres * 0.85, 0.0, 1.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, clamp(R.y * 1.6, 0.0, 1.0));

        float viewDown = clamp(V.y, 0.0, 1.0);
        vec3 body = mix(uDeepColor, uWaterColor, 0.35 + viewDown * 0.65);
        vec3 col = mix(body, sky, fres);

        // Sun glints: a tight highlight plus tiny sparkles on the ripple crests.
        float spec = pow(max(dot(R, uSunDir), 0.0), 220.0) * 3.0;
        float sparkle = pow(max(dot(R, uSunDir), 0.0), 40.0) * smoothstep(0.012, 0.02, length(s)) * 0.8;
        col += vec3(1.0, 0.97, 0.88) * (spec + sparkle);

        float alpha = mix(0.38, 0.93, fres) + spec * 0.3;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  // Share our uniform objects with the material so updates apply directly.
  Object.assign(material.uniforms, uniforms);
  return { material, uniforms };
}

/** Tileable caustic pattern baked once on the CPU (classic "tileable water caustic"). */
function makeCausticTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const TAU = Math.PI * 2;
  const time = 1.7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = ((x / size) * TAU) % TAU - 250;
      const py = ((y / size) * TAU) % TAU - 250;
      let ix = px;
      let iy = py;
      let c = 1;
      const inten = 0.005;
      for (let n = 0; n < 5; n++) {
        const t = time * (1 - 3.5 / (n + 1));
        const nx = px + Math.cos(t - ix) + Math.sin(t + iy);
        const ny = py + Math.sin(t - iy) + Math.cos(t + ix);
        ix = nx;
        iy = ny;
        c += 1 / Math.hypot(px / (Math.sin(ix + t) / inten), py / (Math.cos(iy + t) / inten));
      }
      c /= 5;
      c = 1.17 - Math.pow(c, 1.4);
      const v = Math.pow(Math.abs(c), 8);
      const b = Math.floor(THREE.MathUtils.clamp(v, 0, 1) * 255);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Adds moving caustic light to a riverbed material, only below the water surface.
 * Uses the shared `timeUniform` so it animates with the water.
 */
export function addCaustics(material: THREE.MeshStandardMaterial, timeUniform: { value: number }) {
  const caustics = makeCausticTexture();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uCaustics = { value: caustics };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCausticPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vCausticPos;\nuniform float uTime;\nuniform sampler2D uCaustics;'
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float under = smoothstep(0.05, -0.6, vCausticPos.y);
          vec2 cp = vCausticPos.xz * 0.11;
          float c1 = texture2D(uCaustics, cp + vec2(uTime * 0.025, uTime * 0.018)).r;
          float c2 = texture2D(uCaustics, cp * 1.31 + vec2(-uTime * 0.02, uTime * 0.027)).r;
          float caustic = min(c1, c2);
          // Fade on steep banks, where the pattern would smear into streaks.
          vec3 fn = normalize(cross(dFdx(vCausticPos), dFdy(vCausticPos)));
          float flatness = smoothstep(0.55, 0.9, abs(fn.y));
          outgoingLight += vec3(0.85, 1.0, 0.95) * caustic * under * flatness * 0.5;
        }
        #include <opaque_fragment>`
      );
  };
  material.needsUpdate = true;
}

/** Soft foam strips along both waterlines of the whole river. */
export function createShorelineFoam(timeUniform: { value: number }): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // u: 0 at the water side, 1 at the land side. v: meters along the river.
        float wave = sin(vUv.y * 0.9 + uTime * 1.6) * 0.5 + sin(vUv.y * 2.3 - uTime * 1.1) * 0.25;
        float edge = 0.55 + wave * 0.18;
        float band = smoothstep(edge - 0.35, edge, vUv.x) * (1.0 - smoothstep(edge, edge + 0.12, vUv.x));
        float bubbles = step(0.72, fract(sin(dot(floor(vec2(vUv.x * 18.0, vUv.y * 3.0)), vec2(12.9898, 78.233))) * 43758.5453));
        float a = band * (0.75 + bubbles * 0.25);
        gl_FragColor = vec4(vec3(1.0), a * 0.8);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  Object.assign(mat.uniforms, { uTime: timeUniform });

  for (const side of [-1, 1]) {
    const verts: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    let row = 0;
    for (let dist = 0; dist <= 3150; dist += 3) {
      const { position, normal, width } = getRiverPath(dist);
      const halfW = width * 0.5;
      // Find where the bank rises out of the water on this side.
      let lat = halfW;
      for (let l = halfW * 0.6; l < halfW * 1.7; l += 0.2) {
        if (getRiverBedElevationAt(dist, side * l) > 0) {
          lat = l;
          break;
        }
      }
      const inner = (lat - 1.1) * side;
      const outer = (lat + 0.35) * side;
      verts.push(position.x + normal.x * inner, 0.03, position.z + normal.z * inner);
      verts.push(position.x + normal.x * outer, 0.03, position.z + normal.z * outer);
      uvs.push(0, dist, 1, dist);
      if (row > 0) {
        const a = (row - 1) * 2;
        const b = row * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
      row++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
