import { describe, expect, it } from 'vitest';
import { isRoomIdle, lastActivity } from '@/lib/server/roomRetention';

const cutoff = 1_000_000;
const old = cutoff - 1;
const recent = cutoff + 1;

describe('lastActivity', () => {
  it('is the newest of the save, snapshot and update times', () => {
    expect(lastActivity({ savedAt: 5, snapshotAt: 9, lastUpdateAt: 7, live: false })).toBe(9);
  });

  it('is undefined when the room has no timestamps', () => {
    expect(lastActivity({ live: false })).toBeUndefined();
  });
});

describe('isRoomIdle', () => {
  it('prunes a room whose newest activity is before the cutoff', () => {
    expect(isRoomIdle({ savedAt: old, snapshotAt: old, lastUpdateAt: old, live: false }, cutoff)).toBe(true);
  });

  it('keeps a room that was saved recently even if its snapshot is old', () => {
    expect(isRoomIdle({ savedAt: recent, snapshotAt: old, live: false }, cutoff)).toBe(false);
  });

  it('keeps a room with recent unfolded updates even if it was saved long ago', () => {
    // Drive saves failed, so these edits exist only in the room.
    expect(isRoomIdle({ savedAt: old, lastUpdateAt: recent, live: false }, cutoff)).toBe(false);
  });

  it('keeps a room with someone connected', () => {
    expect(isRoomIdle({ savedAt: old, live: true }, cutoff)).toBe(false);
  });

  it('keeps a room with no timestamps', () => {
    expect(isRoomIdle({ live: false }, cutoff)).toBe(false);
  });

  it('treats a room exactly at the cutoff as active', () => {
    expect(isRoomIdle({ savedAt: cutoff, live: false }, cutoff)).toBe(false);
  });
});
