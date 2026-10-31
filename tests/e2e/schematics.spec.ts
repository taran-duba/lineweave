import { expect, test, type Page } from '@playwright/test';
import { newDiagram, openDiagram, signIn, stubFile } from './helpers';

/** FRC wiring: blocks with terminals, wires snapped to them, edited by two people at once. */

type SchematicWin = Window & {
  __canvas?: {
    graph: {
      getDefaultParent(): unknown;
      getChildCells(parent: unknown): Cell[];
      view: { getState(cell: Cell): unknown };
      getAllConnectionConstraints(state: unknown): unknown[];
      getConnectionPoint(state: unknown, c: unknown): { x: number; y: number };
      container: HTMLElement;
      getSelectionCell(): Cell;
      setSelectionCell(cell: Cell): void;
      moveCells(cells: Cell[], dx: number, dy: number): void;
    };
  };
};
type Cell = { id: string; value: unknown; style: Record<string, unknown>; isEdge(): boolean; geometry: { x: number; y: number } };

const edgeStyles = (page: Page) =>
  page.evaluate(() => {
    const g = (window as SchematicWin).__canvas!.graph;
    return g.getChildCells(g.getDefaultParent()).filter((c) => c.isEdge()).map((c) => c.style);
  });

/** Page coordinates of a block's terminals, in the order of its `points` style. */
const terminals = (page: Page, title: string) =>
  page.evaluate((t) => {
    const g = (window as SchematicWin).__canvas!.graph;
    const cell = g.getChildCells(g.getDefaultParent()).find((c) => String(c.value).includes(`>${t}</b>`))!;
    const state = g.view.getState(cell);
    const rect = g.container.getBoundingClientRect();
    return g.getAllConnectionConstraints(state).map((k) => {
      const p = g.getConnectionPoint(state, k);
      return { x: rect.left + p.x, y: rect.top + p.y };
    });
  }, title);

test('a team wires an FRC robot together', async ({ browser }) => {
  const alice = await signIn(browser, 'Alice Adams');
  const { url, fileId } = await newDiagram(alice, 'Robot wiring', 'FRC robot wiring');
  await expect.poll(async () => (await edgeStyles(alice)).length).toBeGreaterThan(20);

  const bob = await signIn(browser, 'Bob Brown');
  await openDiagram(bob, url);
  await expect.poll(async () => (await edgeStyles(bob)).length).toBeGreaterThan(20);
  const before = (await edgeStyles(bob)).length;

  // Bob adds a CANcoder from the library, then drags a wire from its V+ terminal to a free PDH channel.
  await bob.getByPlaceholder('Search shapes').fill('cancoder');
  await bob.getByRole('button', { name: 'Insert CANcoder', exact: true }).click();
  await bob.evaluate(() => {
    const g = (window as SchematicWin).__canvas!.graph;
    const c = g.getSelectionCell();
    g.moveCells([c], 1100 - c.geometry.x, 720 - c.geometry.y);
  });
  await bob.getByPlaceholder('Search shapes').fill('');
  // Deselect first: a selected block's resize handles sit over its edge terminals.
  await bob.keyboard.press('Escape');
  await bob.evaluate(() => (window as SchematicWin).__canvas!.graph.setSelectionCell(null as unknown as Cell));
  // CANcoder leads leave one end: GND, CAN L x2, CAN H x2, V+ (last). PDH channel 10+ is second down the left side.
  const vPlus = (await terminals(bob, 'CANcoder')).at(-1)!;
  const ch10 = (await terminals(bob, 'Power Distribution Hub'))[1];
  await bob.mouse.move(vPlus.x, vPlus.y + 20);
  await bob.mouse.move(vPlus.x, vPlus.y, { steps: 4 });
  await bob.mouse.down();
  await bob.mouse.move(ch10.x, ch10.y, { steps: 12 });
  await bob.mouse.up();

  // A plain wire, snapped to both terminals, shows up for Alice.
  await expect.poll(async () => (await edgeStyles(alice)).length).toBe(before + 1);
  const wire = (await edgeStyles(alice)).find((s) => s.exitY === 1 && s.entryX === 0)!;
  expect(wire).toMatchObject({ endArrow: 'none', exitPerimeter: 0, entryPerimeter: 0 });

  // Alice marks it as +12V power; Bob sees the color.
  await alice.evaluate(() => {
    const g = (window as SchematicWin).__canvas!.graph;
    const edges = g.getChildCells(g.getDefaultParent()).filter((c) => c.isEdge());
    g.setSelectionCell(edges[edges.length - 1]);
  });
  await alice.getByRole('button', { name: '+12V power wire', exact: true }).click();
  await expect.poll(async () => (await edgeStyles(bob)).at(-1)?.strokeColor).toBe('#e51400');

  // Saved to Drive as standard draw.io styles diagrams.net understands.
  await expect.poll(() => stubFile(alice, fileId), { timeout: 20_000 }).toContain('strokeColor=#e51400');
  const saved = await stubFile(alice, fileId);
  expect(saved).toContain('exitPerimeter=0');
  expect(saved).toMatch(/points=\[\[0,/);
});
