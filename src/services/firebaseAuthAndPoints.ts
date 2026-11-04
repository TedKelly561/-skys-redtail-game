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

// Configured Gmail OAuth Scopes
export const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory access token cache (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
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

export interface GmailReportSummary {
  id: string;
  subject: string;
  date: string;
  snippet: string;
}

/**
 * Fetches past Whiskers' River Journey Point Report emails from the user's Gmail
 */
export async function fetchPastGmailPointReports(): Promise<GmailReportSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const query = encodeURIComponent('subject:"Whiskers\' River Journey Point Report"');
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!listRes.ok) return [];
  const listData = await listRes.json();
  if (!listData.messages || !Array.isArray(listData.messages)) return [];

  const summaries: GmailReportSummary[] = [];
  for (const msg of listData.messages.slice(0, 5)) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (detailRes.ok) {
      const detail = await detailRes.json();
      const headers: { name: string; value: string }[] = detail.payload?.headers || [];
      const subject =
        headers.find((h) => h.name.toLowerCase() === 'subject')?.value ||
        "Whiskers' River Journey Point Report";
      const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || '';
      summaries.push({
        id: msg.id,
        subject,
        date,
        snippet: detail.snippet || '',
      });
    }
  }
  return summaries;
}

/**
 * Sends a rich Point & Treasure Progress Report to the user's own Gmail inbox.
 * Must only be called after explicit user confirmation in the UI!
 */
export async function sendGmailPointReport(
  recipientEmail: string,
  progress: PlayerProgressData
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Needs Gmail authentication token');

  const subject = `Whiskers' River Journey Point Report - ${progress.totalPoints} Points!`;
  const htmlBody = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; border: 2px solid #14b8a6;">
      <h1 style="color: #fbbf24; margin-top: 0;">🐟 Whiskers' River Journey — Explorer Report</h1>
      <p style="color: #cbd5e1; font-size: 15px;">
        Great job swimming down the Amazon river, <strong>${progress.displayName}</strong>! Here is your official Redtail Catfish Point & Treasure summary:
      </p>
      <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0;">
        <p style="font-size: 20px; font-weight: bold; color: #34d399; margin: 0 0 8px 0;">
          🏆 Total Score: ${progress.totalPoints} Points
        </p>
        <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.8; color: #e2e8f0;">
          <li>⭐ <strong>Golden River Stars:</strong> ${progress.starsCollected}</li>
          <li>💎 <strong>Total Shiny Treasures:</strong> ${progress.treasuresCollected}
            <ul style="padding-left: 20px; color: #94a3b8; font-size: 13px;">
              <li>🪨 Smooth Jade & Agate Stones: ${progress.smoothStones}</li>
              <li>✨ Shimmering Arapaima Scales: ${progress.shimmeringScales}</li>
              <li>🧭 Lost River Trinkets: ${progress.lostTrinkets}</li>
              <li>🦪 Glowing River Pearls: ${progress.riverPearls}</li>
            </ul>
          </li>
          <li>🐛 <strong>Tasty River Snacks Eaten:</strong> ${progress.foodEaten}</li>
          <li>🌊 <strong>Furthest River Distance:</strong> ${progress.furthestDistance}m (Chapter ${progress.highestChapter})</li>
        </ul>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
        Saved via Whiskers' River Journey Gmail Point Tracker.
      </p>
    </div>
  `;

  const rawLines = [
    `To: ${recipientEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
  ];
  const rawMessage = rawLines.join('\r\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  return res.ok;
}
