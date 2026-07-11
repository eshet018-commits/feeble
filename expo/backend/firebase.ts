import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

/**
 * Backend Firebase initialization using the client SDK.
 *
 * Tries to authenticate with a custom token minted from the service account
 * key (bypasses security rules). Falls back to anonymous auth. The backend
 * ALWAYS starts — auth is non-blocking and all failures are swallowed.
 */

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let database: any = null;
let auth: any = null;
let isConfigured = false;
let authReadyPromise: Promise<void> = Promise.resolve();

try {
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    database = getDatabase(app);
    auth = getAuth(app);
    isConfigured = true;
    console.log('[Backend Firebase] Initialized successfully');

    // Non-blocking auth. Try custom token first (bypasses security rules),
    // fall back to anonymous. Either way, the backend starts immediately.
    authReadyPromise = new Promise<void>((resolve) => {
      let resolved = false;
      const finish = () => { if (!resolved) { resolved = true; resolve(); } };

      const unsub = onAuthStateChanged(auth, (user: any) => {
        if (user) {
          console.log('[Backend Auth] Signed in:', user.uid);
          unsub();
          finish();
        }
      });

      // Parse service account key for custom token minting.
      let sa: any = null;
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (raw) sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}

      const doAuth = async () => {
        // Try custom token auth (bypasses security rules).
        if (sa?.private_key && sa?.client_email) {
          try {
            console.log('[Backend Firebase] Minting custom token...');
            const token = await mintCustomToken(sa);
            console.log('[Backend Firebase] Signing in with custom token...');
            await signInWithCustomToken(auth, token);
            return;
          } catch (err: any) {
            console.warn('[Backend Auth] Custom token failed:', err?.code || err?.message || err);
          }
        }

        // Fall back to anonymous auth.
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          console.warn('[Backend Auth] Anonymous failed:', err?.code || err?.message || err);
          unsub();
          finish();
        }
      };

      doAuth().catch(() => { unsub(); finish(); });
    });
  } else {
    console.warn('[Backend Firebase] Configuration incomplete');
  }
} catch (e) {
  console.warn('[Backend Firebase] Init failed:', e);
}

/**
 * Mint a Firebase custom token JWT using Web Crypto API for RS256 signing.
 * The JWT is signed with the service account's private key and can be
 * passed to signInWithCustomToken() for admin-level access.
 */
async function mintCustomToken(sa: {
  private_key: string;
  client_email: string;
  private_key_id: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/',
    iat: now,
    exp: now + 3600,
    uid: 'backend-push-service',
    claims: { admin: true },
  };

  const b64urlStr = (str: string) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64url');
    const bytes = new TextEncoder().encode(str);
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const b64urlBuf = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64url');
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const encHeader = b64urlStr(JSON.stringify(header));
  const encPayload = b64urlStr(JSON.stringify(payload));
  const signInput = `${encHeader}.${encPayload}`;

  // Parse PEM private key to DER bytes.
  const b64Key = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  let derBytes: ArrayBuffer;
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64Key, 'base64');
    derBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } else {
    const bin = atob(b64Key);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    derBytes = arr.buffer;
  }

  // Import key and sign using Web Crypto API.
  const key = await crypto.subtle.importKey(
    'pkcs8', derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(signInput),
  );

  return `${signInput}.${b64urlBuf(sig)}`;
}

export { database, isConfigured, auth, authReadyPromise };
