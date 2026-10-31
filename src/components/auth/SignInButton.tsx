'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Only same-site relative paths are accepted as a post-sign-in destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/files';
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// useSearchParams needs a Suspense boundary so the rest of the page can prerender.
export function SignInButton() {
  return (
    <Suspense fallback={<div className="h-10 w-44 rounded-md bg-panel-2" />}>
      <SignInButtonInner />
    </Suspense>
  );
}

function SignInButtonInner() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand so the landing page doesn't ship Firebase up front.
      const { signInWithGoogle, devSignIn, driveStub } = await import('@/lib/google/auth');
      if (driveStub) await devSignIn(prompt('Test user name', 'Test User') ?? 'Test User');
      else await signInWithGoogle();
      // Full navigation: the server (proxy, cookies) sees the fresh session, and it can't stall like a client-side transition.
      window.location.assign(safeNext(params.get('next')));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2.5 rounded-md bg-accent px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-70"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <span className="rounded-sm bg-white p-0.5"><GoogleMark /></span>}
        Sign in with Google
      </button>
      {error && <p className="max-w-sm text-sm text-danger">{error}</p>}
    </div>
  );
}
