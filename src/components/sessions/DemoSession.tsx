'use client';

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { EditorShell } from '@/components/editor/EditorShell';
import type { EditorSession } from '@/lib/collab/session';
import { parseDrawio, serializeDrawio } from '@/lib/drawio/codec';
import { docToFile, loadFileIntoDoc } from '@/lib/drawio/ydoc';
import { createStore } from '@/lib/store';
import { STARTER_DIAGRAM } from './starter';

const STORAGE_KEY = 'upgraded-drawio:demo';

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** A single-user session stored in this browser; no sign-in needed. */
export default function DemoSession() {
  const [session] = useState<EditorSession>(() => {
    const doc = new Y.Doc();
    let file;
    try {
      file = parseDrawio(readSaved() ?? STARTER_DIAGRAM);
    } catch {
      file = parseDrawio(STARTER_DIAGRAM);
    }
    loadFileIntoDoc(doc, file);
    return { doc, readOnly: false, title: createStore('Demo diagram') };
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, serializeDrawio(docToFile(session.doc)));
        } catch {
          // Storage full or blocked; the demo keeps working in memory.
        }
      }, 500);
    };
    session.doc.on('update', onUpdate);
    return () => {
      clearTimeout(timer);
      session.doc.off('update', onUpdate);
    };
  }, [session]);

  return <EditorShell session={session} />;
}
