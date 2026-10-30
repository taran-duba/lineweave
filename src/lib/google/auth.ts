'use client';

import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut, type User } from 'firebase/auth';
import { firebase } from '@/lib/firebase/client';
import { loadScript } from './loadScript';

/**
 * Sign-in = Google Identity Services authorization code (with Drive access)
 * exchanged by our server, then Firebase Auth via the returned ID token.
 *
 * With NEXT_PUBLIC_DRIVE_STUB=1 (local tests only) we skip Google entirely:
 * the Firebase Auth emulator accepts unsigned credentials and Drive calls go
 * to an in-memory stub.
 */

export const driveStub = process.env.NEXT_PUBLIC_DRIVE_STUB === '1';
const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'];

export class NotSignedInError extends Error {
  constructor() {
    super('Please sign in with Google to continue.');
  }
}

interface TokenResponse {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
  error?: string;
}

let cached: TokenResponse | null = null;
let inflight: Promise<string> | null = null;

interface CodeClient {
  requestCode(): void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            prompt?: string;
            callback: (r: { code?: string; error?: string; error_description?: string }) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): CodeClient;
        };
      };
    };
  }
}

async function requestCode(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: SCOPES.join(' '),
      ux_mode: 'popup',
      // "consent" guarantees Google returns a refresh token for long editing sessions.
      prompt: 'consent',
      callback: (r) => (r.code ? resolve(r.code) : reject(new Error(r.error_description ?? r.error ?? 'Sign-in failed'))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled' : (e.message ?? e.type))),
    });
    client.requestCode();
  });
}

export async function signInWithGoogle(): Promise<User> {
  const { auth } = firebase();
  if (driveStub) throw new Error('Use devSignIn() in stub mode');
  const code = await requestCode();
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const t = (await res.json()) as TokenResponse;
  if (!res.ok || !t.idToken) throw new Error(t.error ?? 'Sign-in failed');
  cached = t;
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(t.idToken));
  return cred.user;
}

/** Test-only sign-in against the Firebase Auth emulator. */
export async function devSignIn(name: string): Promise<User> {
  if (!driveStub) throw new Error('devSignIn is only available with NEXT_PUBLIC_DRIVE_STUB=1');
  const { auth } = firebase();
  const sub = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const idToken = JSON.stringify({ sub, email: `${sub}@example.test`, name, email_verified: true });
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return cred.user;
}

/** A valid Google access token with drive.file scope, refreshed through our server as needed. */
export async function getDriveToken(): Promise<string> {
  if (driveStub) {
    const user = firebase().auth.currentUser;
    if (!user) throw new NotSignedInError();
    return `stub:${user.uid}`;
  }
  if (cached && cached.expiresAt - Date.now() > 90_000) return cached.accessToken;
  inflight ??= (async () => {
    try {
      const res = await fetch('/api/auth/token', { method: 'POST' });
      const t = (await res.json()) as TokenResponse;
      if (res.status === 401) throw new NotSignedInError();
      if (!res.ok) throw new Error(t.error ?? 'Could not refresh Google access');
      cached = t;
      return t.accessToken;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function signOut(): Promise<void> {
  cached = null;
  if (!driveStub) await fetch('/api/auth/signout', { method: 'POST' }).catch(() => undefined);
  await fbSignOut(firebase().auth);
}

/** Resolves with the current Firebase user once auth state is known. */
export function currentUser(): Promise<User | null> {
  const { auth } = firebase();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });
}
