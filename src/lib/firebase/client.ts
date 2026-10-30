import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const usingEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1';

let cached: { app: FirebaseApp; auth: Auth; db: Database } | null = null;

export function firebase() {
  if (cached) return cached;
  if (!config.apiKey || !config.databaseURL) {
    throw new Error('Firebase is not configured. Copy .env.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.');
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (usingEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  cached = { app, auth, db };
  // Lets E2E tests read the signed-in user; never exposed in production builds.
  if (process.env.NODE_ENV !== 'production') (globalThis as { __firebase?: typeof cached }).__firebase = cached;
  return cached;
}
