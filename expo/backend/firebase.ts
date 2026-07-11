import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('Backend Firebase config check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasDatabaseURL: !!firebaseConfig.databaseURL,
  hasProjectId: !!firebaseConfig.projectId,
  apiKeySource: process.env.FIREBASE_API_KEY ? 'backend' : (process.env.EXPO_PUBLIC_FIREBASE_API_KEY ? 'frontend' : 'none'),
  databaseURLSource: process.env.FIREBASE_DATABASE_URL ? 'backend' : (process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ? 'frontend' : 'none'),
});

let app: FirebaseApp | null = null;
let database: Database | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;
let isConfigured = false;
let authReadyPromise: Promise<void> | null = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    database = getDatabase(app);
    firestore = getFirestore(app);
    auth = getAuth(app);
    isConfigured = true;
    console.log('Backend Firebase initialized successfully');

    // Sign in anonymously so the push service can read data protected by
    // security rules that require `auth != null`. Without this, every
    // listener gets PERMISSION_DENIED and no pushes are ever sent.
    authReadyPromise = new Promise<void>((resolve) => {
      if (!auth) { resolve(); return; }
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('[Backend Auth] Signed in anonymously:', user.uid);
          unsub();
          resolve();
        }
      });
      signInAnonymously(auth).catch((err) => {
        console.warn('[Backend Auth] Anonymous sign-in failed:', err?.code || err?.message || err);
        console.warn('[Backend Auth] Enable Anonymous Auth in Firebase Console → Authentication → Sign-in method');
        unsub();
        resolve(); // Resolve anyway so the push service can attempt to start
      });
    });
  } else {
    console.error('Backend Firebase configuration is incomplete:', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasDatabaseURL: !!firebaseConfig.databaseURL,
      hasProjectId: !!firebaseConfig.projectId,
    });
    console.error('Missing required Firebase environment variables on backend');
  }
} catch (error) {
  console.error('Failed to initialize Backend Firebase:', error);
}

export { database, firestore, isConfigured, auth, authReadyPromise };
