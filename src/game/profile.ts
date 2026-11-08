/**
 * The player's first name, typed in on the title screen. Stored only on this device so
 * every child who opens the shared link gets cheered on by their own name.
 */
const NAME_KEY = 'whiskers_player_name';
const NAME_ASKED_KEY = 'whiskers_player_name_asked';
export const MAX_NAME_LENGTH = 16;

/** Keeps letters (any language), spaces, hyphens and apostrophes; trims to a short name. */
export function cleanPlayerName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{M} '\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

export function getPlayerName(): string {
  try {
    return cleanPlayerName(localStorage.getItem(NAME_KEY) || '');
  } catch {
    return '';
  }
}

export function setPlayerName(name: string): string {
  const clean = cleanPlayerName(name);
  try {
    if (clean) {
      localStorage.setItem(NAME_KEY, clean);
    } else {
      localStorage.removeItem(NAME_KEY);
    }
    localStorage.setItem(NAME_ASKED_KEY, 'true');
  } catch {
    // Storage blocked (private mode): the name just won't be remembered.
  }
  return clean;
}

/** True once the player has typed a name or chosen to skip. */
export function hasBeenAskedForName(): boolean {
  try {
    return localStorage.getItem(NAME_ASKED_KEY) === 'true' || !!localStorage.getItem(NAME_KEY);
  } catch {
    return true;
  }
}

/** "Great job, Sky!" when we know the name, otherwise "Great job!". */
export function cheer(phrase: string): string {
  const name = getPlayerName();
  return name ? `${phrase}, ${name}!` : `${phrase}!`;
}
