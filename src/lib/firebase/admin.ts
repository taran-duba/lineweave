import 'server-only';
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

/**
 * Server-side Firebase. With the emulators running, firebase-admin picks up
 * FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_DATABASE_EMULATOR_HOST automatically
 * and needs no credentials.
 */
function app(): App {
  if (getApps().length) return getApp();
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return initializeApp({ credential: cert(JSON.parse(raw)), databaseURL, projectId });
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return initializeApp({ databaseURL, projectId });
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getDatabase(app());
