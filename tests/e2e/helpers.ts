import { expect, type Browser, type Page } from '@playwright/test';

/** Shared helpers: separate browser contexts act as separate signed-in users. */

export type Win = Window & {
  __canvas?: { graph: { getDataModel(): { getCell(id: string): unknown; cells: Record<string, { value?: unknown; isVertex(): boolean }> } } };
  __firebase?: { auth: { currentUser: { uid: string } | null } };
};

/** Answers for the next "Name your diagram" prompt, per page. */
export const diagramNames = new WeakMap<Page, string>();

export async function signIn(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('dialog', (d) => {
    if (d.message().includes('Test user')) return d.accept(name);
    if (d.message().includes('Name your diagram')) return d.accept(diagramNames.get(page) ?? 'Untitled');
    return d.accept();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await page.waitForURL('**/files');
  return page;
}

export async function openDiagram(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as Win).__canvas);
}

export const vertexLabels = (page: Page) =>
  page.evaluate(() => {
    const cells = (window as Win).__canvas!.graph.getDataModel().cells;
    return Object.values(cells)
      .filter((c) => c.isVertex())
      .map((c) => String(c.value ?? ''))
      .sort();
  });

export const uidOf = (page: Page) => page.evaluate(() => (window as Win).__firebase!.auth.currentUser!.uid);

export async function stubFile(page: Page, fileId: string): Promise<string> {
  const uid = await uidOf(page);
  const res = await page.request.get(`/api/dev/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer stub:${uid}` },
  });
  return res.text();
}


/** Signs in, creates a diagram named `name` and opens it; returns its URL and Drive file id. */
export async function newDiagram(page: Page, name: string): Promise<{ url: string; fileId: string }> {
  diagramNames.set(page, name);
  await page.getByRole('button', { name: 'New diagram' }).click();
  await page.waitForURL(/\/d\/\w+/);
  const url = page.url();
  await openDiagram(page, url);
  return { url, fileId: url.split('/d/')[1] };
}
