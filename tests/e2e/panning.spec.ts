import { test, expect, type Page } from '@playwright/test';
import { newDiagram, signIn } from './helpers';

type PanWin = Window & { __canvas?: { graph: { view: { translate: { x: number; y: number }; scale: number } } } };

const translate = (page: Page) =>
  page.evaluate(() => {
    const t = (window as PanWin).__canvas!.graph.view.translate;
    return { x: t.x, y: t.y };
  });

async function canvasBox(page: Page) {
  const box = await page.getByTestId('graph-canvas').boundingBox();
  if (!box) throw new Error('canvas not visible');
  return box;
}

test('right-drag pans live, including purely horizontal drags', async ({ browser }) => {
  const page = await signIn(browser, 'Panner');
  await newDiagram(page, 'Pan right-drag');
  const box = await canvasBox(page);
  const start = await translate(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 60, y, { steps: 5 });
  // The view itself moves during the drag, so the grid and overlays follow.
  const mid = await translate(page);
  expect(mid.x).toBeCloseTo(start.x + 60, 0);
  await page.mouse.move(x + 120, y, { steps: 5 });
  await page.mouse.up({ button: 'right' });

  const end = await translate(page);
  expect(end.x).toBeCloseTo(start.x + 120, 0);
  expect(end.y).toBeCloseTo(start.y, 0);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('space-drag pans over shapes and stops after the window loses focus', async ({ browser }) => {
  const page = await signIn(browser, 'Panner');
  await newDiagram(page, 'Pan space-drag', 'Flowchart');
  const box = await canvasBox(page);
  const start = await translate(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.getByTestId('graph-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.down('Space');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 80, { steps: 8 });
  // Releasing outside the canvas must keep the panned position.
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');

  const end = await translate(page);
  expect(end.x - start.x).toBeCloseTo(5 - x, 0);
  expect(end.y - start.y).toBeCloseTo(5 - y, 0);

  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('graph-canvas')).not.toHaveClass(/space-panning/);
});
