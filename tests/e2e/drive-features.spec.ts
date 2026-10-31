import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { newDiagram, openDiagram, signIn, vertexLabels } from './helpers';

/** Drive-backed features: version history, comments, and importing a file as a new diagram. */

test('version history: browse and restore an earlier version for everyone', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  const { url } = await newDiagram(alice, 'Versions');
  const bob = await signIn(browser, 'Bob Brown');
  await openDiagram(bob, url);

  // Two saved versions after the empty one: [Rectangle] and [Rectangle, Ellipse].
  await alice.getByRole('button', { name: 'Insert Rectangle' }).first().click();
  await expect(alice.getByTestId('save-status')).toContainText('Saved to Drive', { timeout: 20_000 });
  await alice.waitForTimeout(500);
  await alice.getByRole('button', { name: 'Insert Ellipse' }).click();
  await expect.poll(() => vertexLabels(bob)).toHaveLength(2);
  await expect(alice.getByTestId('save-status')).toContainText('Saved to Drive', { timeout: 20_000 });

  await alice.getByRole('button', { name: 'File' }).click();
  await alice.getByRole('menuitem', { name: 'Version history…' }).click();
  const versions = alice.getByRole('list', { name: 'Versions' }).getByRole('button');
  await expect(versions).toHaveCount(3, { timeout: 20_000 });
  await expect(versions.first()).toContainText('Current version');
  await versions.nth(1).click();
  await expect(alice.getByRole('img', { name: 'Preview of this version' })).toBeVisible();
  await alice.getByRole('button', { name: 'Restore this version' }).click();

  // Restored for both people, and saved back to Drive as a new version.
  await expect.poll(() => vertexLabels(alice)).toHaveLength(1);
  await expect.poll(() => vertexLabels(bob)).toHaveLength(1);
  await expect(alice.getByTestId('save-status')).toContainText('Saved to Drive', { timeout: 20_000 });
});

test('comments: add, reply and resolve across two people', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  const { url } = await newDiagram(alice, 'Review');
  const bob = await signIn(browser, 'Bob Brown');
  await openDiagram(bob, url);

  await alice.getByRole('button', { name: 'Comments' }).click();
  const box = alice.getByPlaceholder(/Add a comment/);
  await box.fill('Should the start be green?');
  await alice.getByTestId('comments-panel').getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(alice.getByTestId('comments-panel')).toContainText('Should the start be green?');

  await bob.getByRole('button', { name: 'Comments' }).click();
  await expect(bob.getByTestId('comments-panel')).toContainText('Should the start be green?');
  await bob.getByPlaceholder('Reply…').fill('Yes, please');
  await bob.getByTestId('comments-panel').getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(bob.getByTestId('comments-panel')).toContainText('Yes, please');

  // Re-open to refresh rather than waiting for the poll.
  await alice.getByRole('button', { name: 'Close comments' }).click();
  await alice.getByRole('button', { name: 'Comments' }).click();
  await expect(alice.getByTestId('comments-panel')).toContainText('Yes, please');
  await alice.getByRole('button', { name: 'Resolve' }).click();
  await expect(alice.getByTestId('comments-panel')).toContainText('No open comments.');
  await alice.getByRole('button', { name: /Show 1 resolved/ }).click();
  await expect(alice.getByTestId('comments-panel')).toContainText('Resolved');
});

test('import a file from the files page as a new Drive diagram', async ({ browser }, testInfo) => {
  const alice = await signIn(browser, 'Alice Adams');
  const path = testInfo.outputPath('flow.mmd');
  writeFileSync(path, 'flowchart LR\n  A[Plan] --> B[Build] --> C[Ship]\n');
  await alice.locator('input[type=file]').setInputFiles(path);
  await alice.waitForURL(/\/d\/\w+/);
  await openDiagram(alice, alice.url());
  await expect.poll(() => vertexLabels(alice)).toEqual(['Build', 'Plan', 'Ship']);
  await expect(alice.getByLabel('Diagram name')).toHaveValue('flow');
});

test('create a diagram from a template', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  await newDiagram(alice, 'Team chart', 'Org chart');
  await expect.poll(() => vertexLabels(alice)).toHaveLength(6);
  await expect(alice.getByLabel('Diagram name')).toHaveValue('Team chart');
});
