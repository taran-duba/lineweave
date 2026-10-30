import * as Y from 'yjs';
import { child, get, serverTimestamp, update } from 'firebase/database';
import { parseDrawio, serializeDrawio } from '@/lib/drawio/codec';
import { loadFileIntoDoc } from '@/lib/drawio/ydoc';
import { firebase } from '@/lib/firebase/client';
import { currentUser, getDriveToken, NotSignedInError } from '@/lib/google/auth';
import { downloadFile, getFileMeta, renameFile } from '@/lib/google/drive';
import { createStore } from '@/lib/store';
import { DriveSaver, hashXml, type RoomMeta } from './driveSaver';
import { FirebasePresence } from './firebasePresence';
import { FirebaseYProvider } from './firebaseYProvider';
import type { EditorSession, Notice } from './session';

export const displayTitle = (name: string) => name.replace(/\.drawio$/i, '');
const fileName = (title: string) => (/\.drawio$/i.test(title) ? title : `${title}.drawio`);

export interface OpenRoom {
  session: EditorSession;
  destroy(): void;
}

/**
 * Opens a Drive file for realtime editing:
 *  1. checks sign-in and Drive access, joins the room (server grants a role),
 *  2. (re)seeds the room from Drive when it is new or Drive has a newer
 *     revision and nobody is editing,
 *  3. connects document sync, presence and autosave.
 */
export async function openRoom(fileId: string, onStep: (step: string) => void, signal: AbortSignal): Promise<OpenRoom> {
  const cleanups: (() => void)[] = [];
  const destroy = () => cleanups.splice(0).reverse().forEach((fn) => fn());
  const check = () => {
    if (signal.aborted) {
      destroy();
      throw new DOMException('Aborted', 'AbortError');
    }
  };

  try {
    onStep('Signing in…');
    const user = await currentUser();
    if (!user) throw new NotSignedInError();
    const { db } = firebase();

    onStep('Opening from Google Drive…');
    const [driveToken, file] = await Promise.all([getDriveToken(), getFileMeta(fileId)]);
    check();

    const res = await fetch(`/api/rooms/${encodeURIComponent(fileId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ driveToken }),
    });
    const joined = (await res.json()) as { role?: 'editor' | 'viewer'; error?: string };
    if (!res.ok || !joined.role) throw new Error(joined.error ?? 'Could not join this diagram');
    const canWrite = joined.role === 'editor';
    check();

    onStep('Connecting collaborators…');
    const doc = new Y.Doc();
    cleanups.push(() => doc.destroy());
    const provider = new FirebaseYProvider(db, fileId, doc, user.uid, canWrite);
    const [metaSnap, presenceSnap] = await Promise.all([get(child(provider.room, 'meta')), get(child(provider.room, 'presence'))]);
    const roomMeta = (metaSnap.val() ?? {}) as RoomMeta;
    const roomIsEmpty = !roomMeta.driveHeadRevisionId;
    const driveIsNewer = !presenceSnap.exists() && roomMeta.driveHeadRevisionId !== file.headRevisionId;

    if (roomIsEmpty || driveIsNewer) {
      onStep('Loading diagram…');
      const parsed = parseDrawio(await downloadFile(fileId));
      check();
      loadFileIntoDoc(doc, parsed, provider);
      if (canWrite) {
        await provider.replaceRoom({
          driveHeadRevisionId: file.headRevisionId ?? null,
          hash: await hashXml(serializeDrawio(parsed)),
          title: displayTitle(file.name),
          savedAt: serverTimestamp(),
          savedBy: roomMeta.savedBy ?? null,
          external: null,
        });
      }
    }
    await provider.connect();
    cleanups.push(() => provider.destroy());
    check();

    const presence = new FirebasePresence(db, provider.room, {
      uid: user.uid,
      name: user.displayName ?? user.email ?? 'Anonymous',
      photo: user.photoURL ?? undefined,
      role: joined.role,
    });
    presence.connect();
    cleanups.push(() => presence.destroy());
    provider.isLeader = () => presence.isLeader();

    const saver = new DriveSaver(doc, provider.room, fileId, {
      canWrite,
      isLeader: () => presence.isLeader(),
      userName: user.displayName ?? 'someone',
    });
    saver.start();
    cleanups.push(() => saver.destroy());

    const title = createStore(displayTitle(file.name));
    const notice = createStore<Notice | null>(null);
    cleanups.push(
      saver.meta.subscribe(() => {
        const m = saver.meta.get();
        if (m.title) title.set(m.title);
        notice.set(
          m.external
            ? {
                text: 'This file was changed outside the app (for example in diagrams.net).',
                action: canWrite
                  ? {
                      label: 'Load the Drive version',
                      run: () => void reloadFromDrive(),
                    }
                  : undefined,
              }
            : null,
        );
      }),
      provider.online.subscribe(() => {
        if (!provider.online.get()) saver.state.set({ ...saver.state.get(), status: 'offline' });
      }),
    );

    // Replaces everyone's document with the current Drive content.
    const reloadFromDrive = async () => {
      const [meta, xml] = await Promise.all([getFileMeta(fileId), downloadFile(fileId)]);
      const parsed = parseDrawio(xml);
      loadFileIntoDoc(doc, parsed);
      await update(child(provider.room, 'meta'), {
        driveHeadRevisionId: meta.headRevisionId ?? null,
        hash: await hashXml(serializeDrawio(parsed)),
        external: null,
      });
    };

    const session: EditorSession = {
      doc,
      readOnly: !canWrite,
      title,
      presence,
      save: saver.state,
      saveNow: () => saver.saveNow(),
      notice,
      driveUrl: file.webViewLink,
      rename: canWrite
        ? async (next: string) => {
            const updated = await renameFile(fileId, fileName(next));
            const t = displayTitle(updated.name);
            title.set(t);
            await update(child(provider.room, 'meta'), { title: t });
          }
        : undefined,
    };
    return { session, destroy };
  } catch (e) {
    destroy();
    throw e;
  }
}
