import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App, Firestore, and Auth
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Plain Google sign-in: Firebase only receives the player's basic profile
// (name, email, photo). No Gmail or other Google account access is requested.
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user);
    } else if (onAuthFailure) {
      onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<User> => {
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async () => {
  await auth.signOut();
};

// Standardized Firestore Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface PlayerProgressData {
  uid: string;
  displayName: string;
  totalPoints: number;
  starsCollected: number;
  treasuresCollected: number;
  foodEaten: number;
  furthestDistance: number;
  highestChapter: number;
  smoothStones: number;
  lostTrinkets: number;
  shimmeringScales: number;
  riverPearls: number;
}

const clampCounter = (val: number) =>
  Math.max(0, Math.min(10000000, Math.floor(Number(val) || 0)));

export async function loadUserProgress(uid: string): Promise<PlayerProgressData | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid || uid),
      displayName: String(data.displayName || 'River Explorer').slice(0, 100),
      totalPoints: clampCounter(data.totalPoints),
      starsCollected: clampCounter(data.starsCollected),
      treasuresCollected: clampCounter(data.treasuresCollected),
      foodEaten: clampCounter(data.foodEaten),
      furthestDistance: clampCounter(data.furthestDistance),
      highestChapter: Math.max(1, Math.min(5, Math.floor(Number(data.highestChapter) || 1))),
      smoothStones: clampCounter(data.smoothStones),
      lostTrinkets: clampCounter(data.lostTrinkets),
      shimmeringScales: clampCounter(data.shimmeringScales),
      riverPearls: clampCounter(data.riverPearls),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function saveUserProgress(progress: PlayerProgressData): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== progress.uid) return;
  const path = `users/${progress.uid}`;
  const cleanName = (progress.displayName || auth.currentUser.displayName || 'River Explorer')
    .trim()
    .slice(0, 100) || 'River Explorer';

  const payload = {
    uid: progress.uid,
    displayName: cleanName,
    totalPoints: clampCounter(progress.totalPoints),
    starsCollected: clampCounter(progress.starsCollected),
    treasuresCollected: clampCounter(progress.treasuresCollected),
    foodEaten: clampCounter(progress.foodEaten),
    furthestDistance: clampCounter(progress.furthestDistance),
    highestChapter: Math.max(1, Math.min(5, Math.floor(Number(progress.highestChapter) || 1))),
    smoothStones: clampCounter(progress.smoothStones),
    lostTrinkets: clampCounter(progress.lostTrinkets),
    shimmeringScales: clampCounter(progress.shimmeringScales),
    riverPearls: clampCounter(progress.riverPearls),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', progress.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Extras (friends, outfits, fish house, lake shortcut, buddy) live in their own document,
 * userExtras/{uid}, so the main progress save above can never be affected by them. Both
 * functions are quiet on failure (e.g. before the Firestore rules for it are published) and
 * simply report null / false.
 */
let extrasWarned = false;
const warnExtras = (err: unknown) => {
  if (extrasWarned) return;
  extrasWarned = true;
  console.warn('Cloud extras not available yet (check the userExtras Firestore rules):', err);
};

export async function loadUserExtras(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(doc(db, 'userExtras', uid));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch (err) {
    warnExtras(err);
    return null;
  }
}

export async function saveUserExtras(
  uid: string,
  extras: {
    friends: string[];
    closetOwned: string[];
    closetSpent: number;
    outfitHat: string;
    outfitGlasses: string;
    outfitColor: string;
    houseOwned: string[];
    houseSpent: number;
    lakeUnlocked: boolean;
    buddyName: string;
    buddyColor: string;
  }
): Promise<boolean> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  try {
    await setDoc(doc(db, 'userExtras', uid), {
      uid,
      friends: extras.friends.slice(0, 20),
      closetOwned: extras.closetOwned.slice(0, 60),
      closetSpent: clampCounter(extras.closetSpent),
      outfitHat: extras.outfitHat.slice(0, 40),
      outfitGlasses: extras.outfitGlasses.slice(0, 40),
      outfitColor: extras.outfitColor.slice(0, 40),
      houseOwned: extras.houseOwned.slice(0, 20),
      houseSpent: clampCounter(extras.houseSpent),
      lakeUnlocked: !!extras.lakeUnlocked,
      buddyName: extras.buddyName.slice(0, 20),
      buddyColor: extras.buddyColor.slice(0, 9),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    warnExtras(err);
    return false;
  }
}

/**
 * Backups of the other players on this device (a cousin, a friend). The first player has full cloud
 * save above; the others are kept as a snapshot so they come back if the device is reset. Needs
 * the playerBackups block in firestore.rules.
 */
const BACKUP_SLOTS = ['p1', 'p2', 'p3'] as const;
export const MAX_BACKUP_CHARS = 100000;

export async function loadPlayerBackups(uid: string): Promise<string[] | null> {
  try {
    const snap = await getDoc(doc(db, 'playerBackups', uid));
    if (!snap.exists()) return [];
    const data = snap.data() as Record<string, unknown>;
    return BACKUP_SLOTS.map((k) => (typeof data[k] === 'string' ? (data[k] as string) : '')).filter(Boolean);
  } catch (err) {
    warnExtras(err);
    return null;
  }
}

export async function savePlayerBackups(uid: string, players: string[]): Promise<boolean> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  try {
    const slots = BACKUP_SLOTS.map((_, i) => (players[i] || '').slice(0, MAX_BACKUP_CHARS));
    await setDoc(doc(db, 'playerBackups', uid), {
      uid,
      p1: slots[0],
      p2: slots[1],
      p3: slots[2],
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    warnExtras(err);
    return false;
  }
}
