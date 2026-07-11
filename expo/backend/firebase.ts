import * as admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Backend Firebase initialization using the Admin SDK.
 *
 * The Admin SDK bypasses all Firebase security rules — no anonymous auth or
 * custom token minting needed. The service account key gives full admin access
 * to the Realtime Database and Cloud Messaging.
 */

let database: ReturnType<typeof getDatabase> | null = null;
let messaging: ReturnType<typeof getMessaging> | null = null;
let isConfigured = false;

try {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const databaseURL =
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
    process.env.FIREBASE_DATABASE_URL;

  if (rawKey && databaseURL) {
    const sa =
      typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;

    if (admin.getApps().length === 0) {
      admin.initializeApp({
        credential: admin.cert(sa),
        databaseURL,
      });
    }

    database = getDatabase();
    messaging = getMessaging();
    isConfigured = true;
    console.log('[Backend Firebase] Admin SDK initialized — full database + messaging access');
  } else {
    console.warn(
      '[Backend Firebase] Missing FIREBASE_SERVICE_ACCOUNT_KEY or database URL — push service disabled',
    );
  }
} catch (e) {
  console.warn('[Backend Firebase] Init failed:', e);
}

export { database, messaging, isConfigured };
