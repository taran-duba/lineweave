'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { EditorShell } from '@/components/editor/EditorShell';
import { Button } from '@/components/ui';
import { openRoom, type OpenRoom } from '@/lib/collab/openRoom';
import { NotSignedInError } from '@/lib/google/auth';

type State =
  | { phase: 'loading'; step: string }
  | { phase: 'error'; message: string; signIn: boolean }
  | { phase: 'ready'; room: OpenRoom };

export default function DriveSession() {
  const { fileId } = useParams<{ fileId: string }>();
  const [state, setState] = useState<State>({ phase: 'loading', step: 'Starting…' });

  useEffect(() => {
    const ctrl = new AbortController();
    let room: OpenRoom | null = null;
    openRoom(fileId, (step) => !ctrl.signal.aborted && setState({ phase: 'loading', step }), ctrl.signal)
      .then((r) => {
        room = r;
        if (ctrl.signal.aborted) r.destroy();
        else setState({ phase: 'ready', room: r });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          phase: 'error',
          message: e instanceof Error ? e.message : String(e),
          signIn: e instanceof NotSignedInError,
        });
      });
    return () => {
      ctrl.abort();
      room?.destroy();
    };
  }, [fileId]);

  if (state.phase === 'ready') return <EditorShell session={state.room.session} />;

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {state.phase === 'loading' ? (
        <>
          <Loader2 className="animate-spin text-accent" />
          <p className="text-sm text-muted">{state.step}</p>
        </>
      ) : (
        <>
          <AlertTriangle className="text-danger" />
          <p className="max-w-md text-sm">{state.message}</p>
          <div className="flex gap-2">
            {state.signIn ? (
              <Link href={`/?next=${encodeURIComponent(`/d/${fileId}`)}`}>
                <Button variant="primary">Sign in with Google</Button>
              </Link>
            ) : (
              <Button onClick={() => location.reload()}>Try again</Button>
            )}
            <Link href="/files">
              <Button variant="ghost">All diagrams</Button>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
