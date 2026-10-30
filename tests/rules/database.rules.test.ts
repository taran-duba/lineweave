import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const ROOM = 'rooms/file123';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-upgraded-drawio',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: readFileSync(path.join(import.meta.dirname, '../../database.rules.json'), 'utf8'),
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `${ROOM}/members`), { alice: 'editor', victor: 'viewer' });
    await set(ref(ctx.database(), `${ROOM}/updates/existing`), { u: 'AAA=', by: 'alice' });
  });
});

const db = (uid: string | null) => (uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database());
const update0 = (by: string) => ({ u: 'AQID', by, t: serverTimestamp() });

describe('room access', () => {
  it('lets members read and keeps everyone else out', async () => {
    await assertSucceeds(get(ref(db('alice'), ROOM)));
    await assertSucceeds(get(ref(db('victor'), ROOM)));
    await assertFails(get(ref(db('mallory'), ROOM)));
    await assertFails(get(ref(db(null), ROOM)));
  });

  it('never lets clients grant themselves membership', async () => {
    await assertFails(set(ref(db('mallory'), `${ROOM}/members/mallory`), 'editor'));
    await assertFails(set(ref(db('victor'), `${ROOM}/members/victor`), 'editor'));
  });
});

describe('document updates', () => {
  it('lets editors append updates attributed to themselves', async () => {
    await assertSucceeds(set(ref(db('alice'), `${ROOM}/updates/k1`), update0('alice')));
    await assertFails(set(ref(db('alice'), `${ROOM}/updates/k2`), update0('bob')));
  });

  it('blocks viewers and outsiders from writing', async () => {
    await assertFails(set(ref(db('victor'), `${ROOM}/updates/k1`), update0('victor')));
    await assertFails(set(ref(db('mallory'), `${ROOM}/updates/k1`), update0('mallory')));
    await assertFails(set(ref(db('victor'), `${ROOM}/meta/title`), 'hijacked'));
  });

  it('does not allow rewriting an existing update, only deleting it', async () => {
    await assertFails(set(ref(db('alice'), `${ROOM}/updates/existing`), update0('alice')));
    await assertSucceeds(remove(ref(db('alice'), `${ROOM}/updates/existing`)));
  });

  it('lets editors compact (snapshot + delete merged keys) atomically', async () => {
    await assertSucceeds(
      update(ref(db('alice'), ROOM), {
        snapshot: { state: 'AQID', at: serverTimestamp(), by: 'alice' },
        'updates/existing': null,
      }),
    );
    await assertFails(
      update(ref(db('victor'), ROOM), { snapshot: { state: 'AQID', at: serverTimestamp(), by: 'victor' } }),
    );
  });

  it('rejects unexpected fields', async () => {
    await assertFails(set(ref(db('alice'), `${ROOM}/updates/k1`), { ...update0('alice'), extra: 1 }));
    await assertFails(set(ref(db('alice'), `${ROOM}/junk`), 1));
  });
});

describe('presence and cursors', () => {
  it('lets members write only their own session entries', async () => {
    const me = { name: 'Victor', color: '#000', role: 'viewer', joinedAt: serverTimestamp() };
    await assertSucceeds(set(ref(db('victor'), `${ROOM}/presence/victor_abc`), me));
    await assertSucceeds(set(ref(db('victor'), `${ROOM}/cursors/victor_abc`), { p: 'page', x: 1, y: 2 }));
    await assertFails(set(ref(db('victor'), `${ROOM}/cursors/alice_abc`), { p: 'page', x: 1, y: 2 }));
    await assertFails(set(ref(db('mallory'), `${ROOM}/cursors/mallory_abc`), { p: 'page', x: 1, y: 2 }));
  });

  it('does not let a viewer claim the editor role in presence', async () => {
    await assertFails(
      set(ref(db('victor'), `${ROOM}/presence/victor_abc`), { name: 'V', role: 'editor', joinedAt: serverTimestamp() }),
    );
  });
});
