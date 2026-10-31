/**
 * A non-secret "this browser has signed in" marker, scoped to `/` so the
 * landing page can redirect returning users to /files on the server. The real
 * credential (the encrypted refresh token) stays in a separate cookie scoped
 * to /api/auth; this one only controls routing and is cleared whenever we
 * learn the session is gone.
 */
export const SESSION_HINT_COOKIE = 'lw_signed_in';
export const SESSION_HINT_MAX_AGE = 60 * 60 * 24 * 180;

/** Browser side: used in stub mode (no server exchange) and to drop a stale hint. */
export function setSessionHint(): void {
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; max-age=${SESSION_HINT_MAX_AGE}; samesite=lax`;
}

export function clearSessionHint(): void {
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
