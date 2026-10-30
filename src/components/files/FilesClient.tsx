'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Firebase/Google clients are browser-only.
export const FilesClient = dynamic(() => import('./FileBrowser'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-muted">
      <Loader2 className="animate-spin" />
    </div>
  ),
});
