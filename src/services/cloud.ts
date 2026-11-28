/**
 * Sign-in and cloud save, loaded in the background.
 *
 * Firebase is a big part of the game's code, and nothing needs it before the river appears.
 * App imports these wrappers instead of firebaseAuthAndPoints, so the Firebase code downloads
 * as its own file right after the game starts. Sign-in state is checked on startup, so
 * Firebase is always loaded long before anyone taps "Sign in" (iPad popups need the tap to
 * lead straight to the popup).
 */
import type { User } from 'firebase/auth';
import type { PlayerProgressData } from './firebaseAuthAndPoints';
import { MAX_BACKUP_CHARS } from './cloudLimits';

export type { PlayerProgressData };
export { MAX_BACKUP_CHARS };

type Firebase = typeof import('./firebaseAuthAndPoints');
let loading: Promise<Firebase> | null = null;
const firebase = () => (loading ??= import('./firebaseAuthAndPoints'));

/** Watches sign-in; returns a function that stops watching (even if Firebase is still loading). */
export function initAuth(onSignedIn?: (user: User) => void, onSignedOut?: () => void): () => void {
  let stop: (() => void) | null = null;
  let stopped = false;
  firebase()
    .then((fb) => {
      if (!stopped) stop = fb.initAuth(onSignedIn, onSignedOut);
    })
    .catch((err) => {
      // Offline on first visit, for example: the game still works, just without cloud save.
      console.warn('Cloud save is unavailable right now:', err);
      onSignedOut?.();
    });
  return () => {
    stopped = true;
    stop?.();
  };
}

export const googleSignIn = async () => (await firebase()).googleSignIn();
export const logout = async () => (await firebase()).logout();
export const loadUserProgress = async (uid: string) => (await firebase()).loadUserProgress(uid);
export const saveUserProgress = async (progress: PlayerProgressData) => (await firebase()).saveUserProgress(progress);
export const loadUserExtras = async (uid: string) => (await firebase()).loadUserExtras(uid);
export const saveUserExtras = async (...args: Parameters<Firebase['saveUserExtras']>) =>
  (await firebase()).saveUserExtras(...args);
export const loadPlayerBackups = async (uid: string) => (await firebase()).loadPlayerBackups(uid);
export const savePlayerBackups = async (uid: string, players: string[]) =>
  (await firebase()).savePlayerBackups(uid, players);
