'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const Loading = () => (
  <div className="flex h-dvh items-center justify-center text-muted">
    <Loader2 className="animate-spin" />
  </div>
);

// maxGraph and Firebase touch `window` on import, so editor sessions never render on the server.
const DemoSession = dynamic(() => import('./DemoSession'), { ssr: false, loading: Loading });
const DriveSession = dynamic(() => import('./DriveSession'), { ssr: false, loading: Loading });

export function ClientOnlyEditor({ kind }: { kind: 'demo' | 'drive' }) {
  return kind === 'demo' ? <DemoSession /> : <DriveSession />;
}
