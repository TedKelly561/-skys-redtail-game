import * as THREE from 'three';

/**
 * River friends: sniff near an animal to say hi and add it to the sticker book.
 * Which friends were met is remembered on this device.
 */
export type FriendKind =
  | 'tetras'
  | 'turtle'
  | 'frog'
  | 'dragonfly'
  | 'capybara'
  | 'dolphin'
  | 'family'
  | 'rainbow';

export interface FriendInfo {
  kind: FriendKind;
  name: string;
  /** Where to look, shown under an unmet friend's silhouette. */
  hint: string;
  /** A special treasure card rather than an animal friend. */
  special?: boolean;
}

export const FRIENDS: FriendInfo[] = [
  { kind: 'tetras', name: 'Neon Fish', hint: 'Swimming in a group' },
  { kind: 'turtle', name: 'Turtle', hint: 'Paddling in the water' },
  { kind: 'frog', name: 'Frog', hint: 'On a lily pad' },
  { kind: 'dragonfly', name: 'Dragonfly', hint: 'Flying above the water' },
  { kind: 'capybara', name: 'Capybara', hint: 'Resting on the riverbank' },
  { kind: 'dolphin', name: 'Pink Dolphin', hint: 'Jumping near the end' },
  { kind: 'family', name: 'Catfish Family', hint: 'Waiting at the Grand Lake' },
  { kind: 'rainbow', name: 'Rainbow Pearl', hint: 'Under the rainbow at the Grand Lake', special: true },
];

/** Animal friends only (not special treasures). */
export const ANIMAL_FRIEND_COUNT = FRIENDS.filter((f) => !f.special).length;
export function countAnimalFriends(met: FriendKind[]): number {
  return met.filter((k) => !FRIENDS.find((f) => f.kind === k)?.special).length;
}

export interface FriendSpot {
  kind: FriendKind;
  object: THREE.Object3D;
}

const STORAGE_KEY = 'whiskers_friends_v1';
/** How close (side to side and along the river, ignoring height) Sniff can reach. */
export const FRIEND_SNIFF_RADIUS = 14;

export function loadMetFriends(): Set<FriendKind> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const valid = new Set(FRIENDS.map((f) => f.kind));
    return new Set((Array.isArray(raw) ? raw : []).filter((k): k is FriendKind => valid.has(k)));
  } catch {
    return new Set();
  }
}

export function saveMetFriends(met: Set<FriendKind>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...met]));
  } catch {
    // ignore
  }
}

export function friendName(kind: FriendKind): string {
  return FRIENDS.find((f) => f.kind === kind)?.name || 'Friend';
}

const _spotPos = new THREE.Vector3();

/** The closest friend not met yet within Sniff range of the player, if any. */
export function findNearbyNewFriend(
  spots: FriendSpot[],
  met: Set<FriendKind>,
  playerPos: THREE.Vector3
): FriendKind | null {
  let best: FriendKind | null = null;
  let bestD = FRIEND_SNIFF_RADIUS * FRIEND_SNIFF_RADIUS;
  for (const spot of spots) {
    if (met.has(spot.kind)) continue;
    spot.object.getWorldPosition(_spotPos);
    const dx = _spotPos.x - playerPos.x;
    const dz = _spotPos.z - playerPos.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = spot.kind;
    }
  }
  return best;
}

/**
 * Renders a small picture of each friend from its real in-game model, so the sticker book
 * matches what the child saw in the river. Uses a short-lived second WebGL canvas.
 */
export function renderFriendStickers(spots: FriendSpot[], size = 256): Partial<Record<FriendKind, string>> {
  const out: Partial<Record<FriendKind, string>> = {};
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa99, 2.2));
    const sun = new THREE.DirectionalLight(0xfff6e0, 2.6);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
    const viewDir = new THREE.Vector3(0.75, 0.5, 1).normalize();
    const box = new THREE.Box3();
    const sphere = new THREE.Sphere();

    for (const info of FRIENDS) {
      const spot = spots.find((s) => s.kind === info.kind);
      if (!spot) continue;
      const model = spot.object.clone(true);
      model.visible = true; // e.g. the Rainbow Pearl hides itself once collected
      model.position.set(0, 0, 0);
      model.rotation.set(0, info.kind === 'tetras' ? Math.PI / 2 : 0, 0);
      model.updateMatrixWorld(true);
      scene.add(model);

      box.setFromObject(model);
      box.getBoundingSphere(sphere);
      const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
      camera.position.copy(sphere.center).addScaledVector(viewDir, distance);
      camera.near = Math.max(0.01, distance - sphere.radius * 2);
      camera.far = distance + sphere.radius * 2;
      camera.updateProjectionMatrix();
      camera.lookAt(sphere.center);

      renderer.render(scene, camera);
      out[info.kind] = renderer.domElement.toDataURL('image/png');
      scene.remove(model);
    }
  } catch (err) {
    console.warn('Could not draw friend stickers:', err);
  } finally {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return out;
}
