import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

/** The landing page sends returning (signed-in) users straight to /files. */

test('signed-in users are redirected from / to /files; sign-out restores the landing page', async ({ browser }) => {
  const page = await signIn(browser, 'Lana Landing');

  await page.goto('/');
  await expect(page).toHaveURL(/\/files$/);

  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('draw at once');
});

test('a bounce back to / with ?next= does not loop even with a stale session cookie', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: 'lw_signed_in', value: '1', url: 'http://localhost:3100' }]);
  const page = await ctx.newPage();

  // Signed out in Firebase but cookie present: /files bounces to /?next=/files, which must stay put and clear the hint.
  await page.goto('/files');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('draw at once');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('draw at once');
});
