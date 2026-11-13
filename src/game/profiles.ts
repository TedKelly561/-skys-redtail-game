/**
 * Player profiles: each child on this device gets their own name, stars, friends, buddy,
 * outfits, fish house, photos and daily games. Settings (sound, music, bad guy level, season,
 * day/night) stay shared.
 *
 * The playing profile's data lives in the normal storage keys, so the rest of the game doesn't
 * need to know about profiles. Switching tucks the current player's data away under their
 * profile id, brings the other player's data out, and reloads the game.
 */
const PROFILES_KEY = 'whiskers_profiles_v1';

/** Everything that belongs to one player. */
const PLAYER_KEYS = [
  'whiskers_player_name',
  'whiskers_player_name_asked',
  'whiskers_treasure_counts',
  'whiskers_friends_v1',
  'whiskers_closet_v1',
  'whiskers_house_v1',
  'whiskers_buddy_v1',
  'whiskers_buddy_later',
  'whiskers_photos_v1',
  'whiskers_last_place',
  'whiskers_lake_unlocked',
  'whiskers_dive_v1',
  'whiskers_lake_daily_v1',
  'whiskers_daily_missions_v1',
  'whiskers_ghost_v1',
  'whiskers_trip_v1',
];

export const MAX_PROFILES = 4;
export const PROFILE_COLORS = ['#22c55e', '#f472b6', '#38bdf8', '#f59e0b'];

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export interface ProfilesState {
  active: string;
  list: Profile[];
}

const stashKey = (id: string, key: string) => `whiskers_p_${id}__${key}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: keep going so the game still works.
  }
}

function currentName() {
  return (read('whiskers_player_name') || '').trim();
}

export function loadProfiles(): ProfilesState {
  try {
    const raw = JSON.parse(read(PROFILES_KEY) || 'null');
    if (raw && Array.isArray(raw.list) && raw.list.length > 0 && typeof raw.active === 'string') {
      const list: Profile[] = raw.list
        .filter((p: Profile) => p && typeof p.id === 'string')
        .map((p: Profile, i: number) => ({
          id: p.id,
          name: typeof p.name === 'string' ? p.name : '',
          color: typeof p.color === 'string' ? p.color : PROFILE_COLORS[i % PROFILE_COLORS.length],
        }));
      if (list.some((p) => p.id === raw.active)) return { active: raw.active, list };
    }
  } catch {
    // fall through to a fresh list
  }
  // First time: whoever has been playing so far becomes the first profile.
  return { active: 'p1', list: [{ id: 'p1', name: currentName(), color: PROFILE_COLORS[0] }] };
}

function saveProfiles(state: ProfilesState) {
  write(PROFILES_KEY, JSON.stringify(state));
}

/** The player who is playing now. */
export function activeProfile(state = loadProfiles()): Profile {
  return state.list.find((p) => p.id === state.active) || state.list[0];
}

/** One saved value for each of the other players on this device (those that have it). */
export function otherPlayersValue(key: string): { profile: Profile; value: string }[] {
  const state = loadProfiles();
  const out: { profile: Profile; value: string }[] = [];
  for (const p of state.list) {
    if (p.id === state.active) continue;
    const value = read(stashKey(p.id, key));
    if (value !== null) out.push({ profile: p, value });
  }
  return out;
}

/** The first profile is the one that uses the grown-up's cloud save. */
export function isPrimaryProfile(state = loadProfiles()) {
  return state.active === state.list[0].id;
}

/** Keep the profile list's name in step with the player's name. */
export function syncActiveProfileName(): ProfilesState {
  const state = loadProfiles();
  const name = currentName();
  state.list = state.list.map((p) => (p.id === state.active ? { ...p, name } : p));
  saveProfiles(state);
  return state;
}

/** Tuck the current player away, bring `id` out, and restart the game. */
export function switchProfile(id: string) {
  const state = syncActiveProfileName();
  if (id === state.active || !state.list.some((p) => p.id === id)) return;
  for (const key of PLAYER_KEYS) {
    write(stashKey(state.active, key), read(key));
    write(key, read(stashKey(id, key)));
    write(stashKey(id, key), null);
  }
  saveProfiles({ ...state, active: id });
  window.location.reload();
}

/** A new, empty player (they'll be asked their name), then switch to them. */
export function addProfile() {
  const state = syncActiveProfileName();
  if (state.list.length >= MAX_PROFILES) return;
  const used = new Set(state.list.map((p) => p.color));
  const color = PROFILE_COLORS.find((c) => !used.has(c)) || PROFILE_COLORS[state.list.length % PROFILE_COLORS.length];
  const id = `p${Date.now().toString(36)}`;
  // Start from nothing: make sure no leftovers are waiting under the new id.
  for (const key of PLAYER_KEYS) write(stashKey(id, key), null);
  saveProfiles({ active: state.active, list: [...state.list, { id, name: '', color }] });
  switchProfile(id);
}

/** Grown-ups: remove a player who isn't playing right now (never the first one). */
export function removeProfile(id: string): ProfilesState {
  const state = loadProfiles();
  if (id === state.active || id === state.list[0].id) return state;
  for (const key of PLAYER_KEYS) write(stashKey(id, key), null);
  // Remember the removal so the cloud backup doesn't bring this player back.
  write(REMOVED_KEY, JSON.stringify([...removedIds().filter((x) => x !== id), id].slice(-20)));
  const next = { ...state, list: state.list.filter((p) => p.id !== id) };
  saveProfiles(next);
  return next;
}

// ------------------------------------------------------------------ Cloud backup of other players
const REMOVED_KEY = 'whiskers_removed_players';
/** Photos are big and stay on the device. */
const NOT_BACKED_UP = new Set(['whiskers_photos_v1']);

export interface PlayerBackup {
  id: string;
  name: string;
  color: string;
  data: Record<string, string>;
}

function removedIds(): string[] {
  try {
    const v = JSON.parse(read(REMOVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Every player except the first, with their saved data (for the cloud backup). */
export function collectOtherPlayers(): PlayerBackup[] {
  const state = loadProfiles();
  return state.list.slice(1).map((p) => {
    const data: Record<string, string> = {};
    for (const key of PLAYER_KEYS) {
      if (NOT_BACKED_UP.has(key)) continue;
      const v = p.id === state.active ? read(key) : read(stashKey(p.id, key));
      if (v !== null) data[key] = v;
    }
    const name = p.id === state.active ? currentName() || p.name : p.name;
    return { id: p.id, name, color: p.color, data };
  });
}

/** One player as text for the cloud, trimmed to fit if it ever grows too big. */
export function packPlayer(b: PlayerBackup, maxChars: number): string {
  const data = { ...b.data };
  let text = JSON.stringify({ ...b, data });
  while (text.length > maxChars) {
    const biggest = Object.keys(data).sort((a, c) => data[c].length - data[a].length)[0];
    if (!biggest) break;
    delete data[biggest];
    text = JSON.stringify({ ...b, data });
  }
  return text;
}

/**
 * Bring back players from the cloud backup who aren't on this device (a new or reset device).
 * Players already here keep what they have; players a grown-up removed stay removed.
 * Returns the new profile list, or null if nothing changed.
 */
export function restoreMissingPlayers(packed: string[]): ProfilesState | null {
  const state = loadProfiles();
  const removed = removedIds();
  let changed = false;
  for (const text of packed) {
    if (state.list.length >= MAX_PROFILES) break;
    let b: PlayerBackup;
    try {
      b = JSON.parse(text);
    } catch {
      continue;
    }
    if (!b || typeof b.id !== 'string' || !/^p[a-z0-9]{1,20}$/i.test(b.id)) continue;
    if (state.list.some((p) => p.id === b.id) || removed.includes(b.id)) continue;
    const data = b.data && typeof b.data === 'object' ? b.data : {};
    for (const key of PLAYER_KEYS) {
      const v = typeof data[key] === 'string' ? data[key] : null;
      write(stashKey(b.id, key), v);
    }
    const used = new Set(state.list.map((p) => p.color));
    const color = PROFILE_COLORS.includes(b.color) && !used.has(b.color)
      ? b.color
      : PROFILE_COLORS.find((c) => !used.has(c)) || PROFILE_COLORS[0];
    state.list.push({ id: b.id, name: typeof b.name === 'string' ? b.name.slice(0, 40) : '', color });
    changed = true;
  }
  if (changed) saveProfiles(state);
  return changed ? state : null;
}
