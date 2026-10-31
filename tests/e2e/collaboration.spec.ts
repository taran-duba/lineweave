import { expect, test } from '@playwright/test';
import { newDiagram, openDiagram, signIn, stubFile, uidOf, vertexLabels } from './helpers';

/**
 * Two (or three) separate browser contexts = separate signed-in users, all
 * editing the same Drive file through the Firebase emulators and Drive stub.
 */

test('two people edit the same diagram in real time', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  const { url, fileId } = await newDiagram(alice, 'Team plan');

  const bob = await signIn(browser, 'Bob Brown');
  await openDiagram(bob, url);

  // Presence: each sees the other.
  await expect(alice.getByTestId('presence').getByTitle('Bob Brown')).toBeVisible();
  await expect(bob.getByTestId('presence').getByTitle('Alice Adams')).toBeVisible();

  // Alice adds a shape; Bob sees it.
  await alice.getByRole('button', { name: 'Insert Text' }).click();
  await expect.poll(() => vertexLabels(bob)).toEqual(['Text']);

  // Alice's cursor shows up on Bob's screen with her name.
  const box = (await alice.getByTestId('graph-canvas').boundingBox())!;
  await alice.mouse.move(box.x + 200, box.y + 200);
  await alice.mouse.move(box.x + 260, box.y + 240, { steps: 5 });
  await expect(bob.getByTestId('remote-cursor').filter({ hasText: 'Alice Adams' })).toBeVisible();
  // Alice selects her shape; Bob sees it outlined in her color.
  await alice.keyboard.press('ControlOrMeta+a');
  await bob.waitForTimeout(400);
  await bob.screenshot({ path: test.info().outputPath('bob-sees-alice.png') });

  // Undo is per person: Bob's shape survives Alice's undo.
  await bob.getByRole('button', { name: 'Insert Ellipse' }).click();
  await expect.poll(() => vertexLabels(alice)).toHaveLength(2);
  await alice.getByTestId('graph-canvas').click({ position: { x: 600, y: 500 } });
  await alice.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => vertexLabels(alice)).toEqual(['']);
  await expect.poll(() => vertexLabels(bob)).toEqual(['']);

  // The save leader (Alice, who joined first) writes the result to Drive.
  await expect(alice.getByTestId('save-status')).toContainText('Saved to Drive');
  await expect.poll(() => stubFile(alice, fileId), { timeout: 20_000 }).toContain('ellipse;whiteSpace=wrap;html=1;');
  const saved = await stubFile(alice, fileId);
  expect(saved).not.toContain('value="Text"');
  await expect(bob.getByTestId('save-status')).toContainText('Saved to Drive');

  // A viewer (per Drive permissions) can watch but not edit.
  const carol = await signIn(browser, 'Carol Chen');
  await carol.request.post('/api/dev/drive/share', {
    headers: { Authorization: `Bearer stub:${await uidOf(alice)}` },
    data: { fileId, uid: await uidOf(carol), role: 'viewer' },
  });
  await openDiagram(carol, url);
  await expect(carol.getByText('View only')).toBeVisible();
  await expect(carol.getByRole('button', { name: 'Insert Text' })).toHaveCount(0);
  await expect(alice.getByTestId('presence').getByTitle('Carol Chen (viewing)')).toBeVisible();
  await alice.getByRole('button', { name: 'Insert Diamond' }).click();
  await expect.poll(() => vertexLabels(carol)).toHaveLength(2);

  // Renames propagate to everyone and to Drive.
  const title = alice.getByLabel('Diagram name');
  await title.fill('Team plan v2');
  await title.press('Enter');
  await expect(bob.getByLabel('Diagram name')).toHaveValue('Team plan v2');
});

test('a late joiner loads the latest state after the leader leaves', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  const { url, fileId } = await newDiagram(alice, 'Handoff');

  const bob = await signIn(browser, 'Bob Brown');
  await openDiagram(bob, url);
  await alice.getByRole('button', { name: 'Insert Cloud' }).click();
  await expect.poll(() => vertexLabels(bob)).toHaveLength(1);

  // Alice (leader) leaves; Bob becomes leader and keeps saving.
  await alice.context().close();
  await bob.getByRole('button', { name: 'Insert Triangle' }).click();
  await expect.poll(() => stubFile(bob, fileId), { timeout: 30_000 }).toContain('triangle;whiteSpace=wrap;html=1;');

  const dave = await signIn(browser, 'Dave Diaz');
  await openDiagram(dave, url);
  await expect.poll(() => vertexLabels(dave)).toHaveLength(2);
});
