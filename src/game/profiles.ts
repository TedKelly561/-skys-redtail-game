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
  const next = { ...state, list: state.list.filter((p) => p.id !== id) };
  saveProfiles(next);
  return next;
}
