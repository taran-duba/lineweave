import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_HINT_COOKIE, SESSION_HINT_MAX_AGE } from '@/lib/sessionHint';

/**
 * Google OAuth on the server. The browser gets an authorization code from
 * Google Identity Services; we exchange it here (the client secret never
 * reaches the browser) and keep the refresh token in an encrypted, httpOnly
 * cookie. The browser asks /api/auth/token for short-lived access tokens, so
 * autosave keeps working for hours without new consent popups.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const COOKIE = 'gd_session';
const COOKIE_PATH = '/api/auth';
const MAX_AGE = 60 * 60 * 24 * 180;

export interface TokenResponse {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function key(): Promise<CryptoKey> {
  const secret = env('SESSION_SECRET');
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(plain));
  return `${Buffer.from(iv).toString('base64url')}.${Buffer.from(data).toString('base64url')}`;
}

async function unseal(sealed: string): Promise<string | null> {
  const [iv, data] = sealed.split('.');
  if (!iv || !data) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64url') },
      await key(),
      Buffer.from(data, 'base64url'),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('NEXT_PUBLIC_GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...params,
    }),
    cache: 'no-store',
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) throw new Error(body.error ?? `token endpoint returned ${res.status}`);
  return body;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
  }
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: 'postmessage' });
  if (!t.scope?.split(' ').includes(DRIVE_SCOPE)) {
    throw new AuthError('Google Drive access was not granted. Please allow it so diagrams can be saved.', 403);
  }
  const jar = await cookies();
  if (t.refresh_token) {
    jar.set(COOKIE, await seal(t.refresh_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: MAX_AGE,
    });
  }
  jar.set(SESSION_HINT_COOKIE, '1', {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_HINT_MAX_AGE,
  });
  return { accessToken: t.access_token!, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000, idToken: t.id_token };
}

export async function refreshAccessToken(): Promise<TokenResponse> {
  const jar = await cookies();
  const sealed = jar.get(COOKIE)?.value;
  const refreshToken = sealed ? await unseal(sealed) : null;
  if (!refreshToken) {
    jar.delete({ name: SESSION_HINT_COOKIE, path: '/' });
    throw new AuthError('Not signed in');
  }
  try {
    const t = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
    return { accessToken: t.access_token!, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000, idToken: t.id_token };
  } catch (e) {
    // invalid_grant: revoked or expired; force a fresh sign-in.
    jar.delete({ name: COOKIE, path: COOKIE_PATH });
    jar.delete({ name: SESSION_HINT_COOKIE, path: '/' });
    throw new AuthError(e instanceof Error ? e.message : 'Session expired');
  }
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const sealed = jar.get(COOKIE)?.value;
  const refreshToken = sealed ? await unseal(sealed) : null;
  jar.delete({ name: COOKIE, path: COOKIE_PATH });
  jar.delete({ name: SESSION_HINT_COOKIE, path: '/' });
  if (refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(
      () => undefined,
    );
  }
}
