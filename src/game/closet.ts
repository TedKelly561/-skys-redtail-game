import * as THREE from 'three';

/**
 * Whiskers' closet: hats, glasses and fin colors bought with stars. Saved on this device.
 * The star "wallet" is lifetime stars minus stars spent, so the lifetime count (and cloud save)
 * never changes when buying.
 */
export type ClosetSlot = 'hat' | 'glasses' | 'color';

export interface ClosetItem {
  id: string;
  slot: ClosetSlot;
  name: string;
  icon: string;
  price: number;
}

export const CLOSET_ITEMS: ClosetItem[] = [
  { id: 'party-hat', slot: 'hat', name: 'Party Hat', icon: '🥳', price: 5 },
  { id: 'flower-crown', slot: 'hat', name: 'Flower Crown', icon: '🌸', price: 10 },
  { id: 'pirate-hat', slot: 'hat', name: 'Pirate Hat', icon: '🏴‍☠️', price: 15 },
  { id: 'top-hat', slot: 'hat', name: 'Top Hat', icon: '🎩', price: 20 },
  { id: 'cowboy-hat', slot: 'hat', name: 'Cowboy Hat', icon: '🤠', price: 20 },
  { id: 'crown', slot: 'hat', name: 'Royal Crown', icon: '👑', price: 30 },
  { id: 'sunglasses', slot: 'glasses', name: 'Cool Shades', icon: '🕶️', price: 8 },
  { id: 'star-glasses', slot: 'glasses', name: 'Star Glasses', icon: '🤩', price: 12 },
  { id: 'blue-fins', slot: 'color', name: 'Ocean Blue', icon: '💙', price: 6 },
  { id: 'purple-fins', slot: 'color', name: 'Purple', icon: '💜', price: 6 },
  { id: 'gold-fins', slot: 'color', name: 'Gold', icon: '💛', price: 18 },
  { id: 'rainbow-fins', slot: 'color', name: 'Rainbow', icon: '🌈', price: 40 },
];

export const FIN_COLORS: Record<string, string> = {
  'blue-fins': '#2f8fff',
  'purple-fins': '#a24dff',
  'gold-fins': '#ffc21a',
};

export interface Outfit {
  hat: string | null;
  glasses: string | null;
  color: string | null;
}

export interface ClosetState {
  owned: string[];
  outfit: Outfit;
  spent: number;
}

const KEY = 'whiskers_closet_v1';

export function loadCloset(): ClosetState {
  const empty: ClosetState = { owned: [], outfit: { hat: null, glasses: null, color: null }, spent: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return empty;
    const valid = new Set(CLOSET_ITEMS.map((i) => i.id));
    const owned = (Array.isArray(raw.owned) ? raw.owned : []).filter((id: unknown) => valid.has(id as string));
    const pick = (id: unknown) => (typeof id === 'string' && owned.includes(id) ? id : null);
    return {
      owned,
      outfit: { hat: pick(raw.outfit?.hat), glasses: pick(raw.outfit?.glasses), color: pick(raw.outfit?.color) },
      spent: Math.max(0, Math.floor(Number(raw.spent) || 0)),
    };
  } catch {
    return empty;
  }
}

export function saveCloset(state: ClosetState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ 3D accessories

function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, p: number[], r: number[] = [0, 0, 0], s: number[] = [1, 1, 1]) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(p[0], p[1], p[2]);
  o.rotation.set(r[0], r[1], r[2]);
  o.scale.set(s[0], s[1], s[2]);
  return o;
}

/** Builds a hat or glasses model in Whiskers' local space (head top is about y 0.36, z 0.6). */
export function buildAccessory(id: string): THREE.Group | null {
  const g = new THREE.Group();
  switch (id) {
    case 'party-hat': {
      const cone = new THREE.ConeGeometry(0.2, 0.5, 24, 6);
      // Stripes via vertex colors.
      const colors: number[] = [];
      const pos = cone.attributes.position;
      const a = new THREE.Color('#ff4fa3');
      const b = new THREE.Color('#ffe14d');
      for (let i = 0; i < pos.count; i++) {
        const c = Math.floor((pos.getY(i) + 0.25) * 10) % 2 === 0 ? a : b;
        colors.push(c.r, c.g, c.b);
      }
      cone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.add(mesh(cone, mat('#ffffff', { vertexColors: true }), [0, 0.25, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), mat('#4de3ff'), [0, 0.52, 0]));
      g.position.set(0, 0.36, 0.55);
      g.rotation.set(-0.25, 0, 0.15);
      break;
    }
    case 'flower-crown': {
      g.add(mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 32), mat('#4caf50'), [0, 0, 0], [Math.PI / 2, 0, 0]));
      const petal = new THREE.SphereGeometry(0.075, 10, 8);
      const colors = ['#ff7eb6', '#ffffff', '#ffd23f', '#c58bff'];
      for (let i = 0; i < 9; i++) {
        const t = (i / 9) * Math.PI * 2;
        g.add(mesh(petal, mat(colors[i % colors.length]), [Math.cos(t) * 0.28, 0.04, Math.sin(t) * 0.28], [0, 0, 0], [1, 0.6, 1]));
        g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#ffb300'), [Math.cos(t) * 0.28, 0.08, Math.sin(t) * 0.28]));
      }
      g.position.set(0, 0.36, 0.5);
      g.rotation.set(-0.15, 0, 0);
      break;
    }
    case 'pirate-hat': {
      const black = mat('#1d1d24');
      g.add(mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), black, [0, 0, 0], [0, 0, 0], [1.25, 0.75, 0.75]));
      g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), black, [0, 0.01, 0], [0, 0, 0], [1, 1, 0.55]));
      g.add(mesh(new THREE.CircleGeometry(0.07, 16), mat('#ffffff'), [0, 0.12, 0.23]));
      g.add(mesh(new THREE.TorusGeometry(0.34, 0.015, 6, 32, Math.PI), mat('#ffcc33', { metalness: 0.7, roughness: 0.3 }), [0, 0.02, 0], [Math.PI / 2, 0, 0], [1.2, 0.55, 1]));
      g.position.set(0, 0.38, 0.5);
      g.rotation.set(-0.1, 0, 0);
      break;
    }
    case 'top-hat': {
      const black = mat('#202028', { roughness: 0.35 });
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 24), black, [0, 0.21, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), black, [0, 0.01, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 24), mat('#e0263a'), [0, 0.07, 0]));
      g.position.set(0, 0.38, 0.5);
      g.rotation.set(-0.2, 0, -0.1);
      break;
    }
    case 'cowboy-hat': {
      const brown = mat('#a8692e');
      g.add(mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), brown, [0, 0.02, 0], [0, 0, 0], [1, 1.2, 1.1]));
      const brim = new THREE.TorusGeometry(0.3, 0.07, 10, 32);
      g.add(mesh(brim, brown, [0, 0.03, 0], [Math.PI / 2, 0, 0], [1, 1.15, 0.5]));
      g.add(mesh(new THREE.CircleGeometry(0.3, 28), brown, [0, 0.02, 0], [-Math.PI / 2, 0, 0], [1, 1.15, 1]));
      g.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 24), mat('#5a3517'), [0, 0.06, 0]));
      g.position.set(0, 0.37, 0.52);
      g.rotation.set(-0.15, 0, 0.12);
      break;
    }
    case 'crown': {
      const gold = mat('#ffcc33', { metalness: 0.85, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.3 });
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 24, 1, true), gold, [0, 0.06, 0]));
      const spike = new THREE.ConeGeometry(0.05, 0.14, 8);
      const gem = new THREE.OctahedronGeometry(0.04, 0);
      const gemColors = ['#ff4d8d', '#4de3ff', '#7dff6b'];
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2;
        g.add(mesh(spike, gold, [Math.cos(t) * 0.22, 0.19, Math.sin(t) * 0.22]));
        g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), gold, [Math.cos(t) * 0.22, 0.27, Math.sin(t) * 0.22]));
        g.add(
          mesh(gem, mat(gemColors[i % 3], { emissive: gemColors[i % 3], emissiveIntensity: 0.5 }), [Math.cos(t) * 0.235, 0.06, Math.sin(t) * 0.235])
        );
      }
      g.position.set(0, 0.36, 0.52);
      g.rotation.set(-0.15, 0, 0);
      break;
    }
    case 'sunglasses':
    case 'star-glasses': {
      const star = id === 'star-glasses';
      const frame = mat(star ? '#ff4fa3' : '#111111', { roughness: 0.3 });
      const lensMat = mat(star ? '#ffd1e8' : '#1a1a24', { roughness: 0.1, metalness: 0.3, transparent: star, opacity: star ? 0.85 : 1 });
      let lensGeo: THREE.BufferGeometry;
      if (star) {
        const s = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 0.16 : 0.075;
          const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
          if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        s.closePath();
        lensGeo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
      } else {
        lensGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24);
        lensGeo.rotateX(Math.PI / 2);
      }
      for (const side of [1, -1]) {
        // Eyes sit on the sides of the head at about (±0.45, 0.14, 0.78) looking forward-out.
        const lens = mesh(lensGeo, star ? frame : lensMat, [side * 0.47, 0.17, 0.88], [0, side * 0.55, 0]);
        g.add(lens);
        if (!star) g.add(mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 24), frame, [side * 0.47, 0.17, 0.885], [0, side * 0.55, 0]));
      }
      // Nose bridge arching over the snout between the two lenses.
      g.add(mesh(new THREE.TorusGeometry(0.47, 0.016, 6, 24, Math.PI), frame, [0, 0.17, 0.9], [0, 0, 0], [1, 0.35, 1]));
      break;
    }
    default:
      return null;
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}
