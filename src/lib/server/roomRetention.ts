import type { Database } from 'firebase-admin/database';

/**
 * Deletes realtime rooms nobody has touched for a while, so the 1 GB Spark
 * limit is never reached. A deleted room loses nothing that Drive doesn't
 * have: the next open reseeds it from Drive (rooms with no meta are "empty").
 */

export const ROOM_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

export interface RoomActivity {
  /** rooms/{id}/meta/savedAt: the last time the document was written to Drive. */
  savedAt?: number;
  /** rooms/{id}/snapshot/at: the last compaction. */
  snapshotAt?: number;
  /** Newest rooms/{id}/updates/*.t: edits not yet folded into the snapshot. */
  lastUpdateAt?: number;
  /** Someone has a connected presence entry in this room. */
  live: boolean;
}

/** The newest sign of activity, or undefined if the room has none. */
export function lastActivity(a: RoomActivity): number | undefined {
  const times = [a.savedAt, a.snapshotAt, a.lastUpdateAt].filter((t): t is number => typeof t === 'number');
  return times.length ? Math.max(...times) : undefined;
}

/** Idle: nobody connected and nothing recorded since the cutoff. Rooms without any timestamp are kept. */
export function isRoomIdle(a: RoomActivity, cutoff: number): boolean {
  const last = lastActivity(a);
  return !a.live && last !== undefined && last < cutoff;
}

export interface PruneResult {
  candidates: number;
  removed: string[];
  kept: number;
}

export async function pruneIdleRooms(db: Database, now = Date.now(), idleMs = ROOM_IDLE_MS): Promise<PruneResult> {
  const cutoff = now - idleMs;
  // A room saved after the cutoff can't be idle, so filter on the save time
  // server-side instead of downloading every room.
  const old = await db.ref('rooms').orderByChild('meta/savedAt').endAt(cutoff).get();
  const candidates: { id: string; savedAt: number }[] = [];
  old.forEach((room) => {
    const savedAt = room.child('meta/savedAt').val();
    if (room.key && typeof savedAt === 'number') candidates.push({ id: room.key, savedAt });
  });

  const result: PruneResult = { candidates: candidates.length, removed: [], kept: 0 };
  for (const { id, savedAt } of candidates) {
    const room = db.ref(`rooms/${id}`);
    const [snapshot, presence, latestUpdate] = await Promise.all([
      room.child('snapshot/at').get(),
      room.child('presence').get(),
      room.child('updates').orderByChild('t').limitToLast(1).get(),
    ]);
    let lastUpdateAt: number | undefined;
    latestUpdate.forEach((u) => {
      const t = u.child('t').val();
      if (typeof t === 'number') lastUpdateAt = t;
    });
    const activity: RoomActivity = {
      savedAt,
      snapshotAt: typeof snapshot.val() === 'number' ? snapshot.val() : undefined,
      lastUpdateAt,
      live: presence.hasChildren(),
    };
    if (isRoomIdle(activity, cutoff)) {
      await room.remove();
      result.removed.push(id);
    } else {
      result.kept++;
    }
  }
  return result;
}
