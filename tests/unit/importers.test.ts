import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import type { CellData } from '@/lib/drawio/types';

// Layout runs in a real browser (covered by the browser checks); here we only test parsing.
vi.mock('@/lib/drawio/importers/layout', () => ({
  layoutCells: async (cells: CellData[]) => ({ attrs: {}, pages: [{ id: 'p', name: 'Page-1', order: 'a0', attrs: {}, modelAttrs: {}, cells }] }),
  textSize: () => ({ width: 100, height: 40 }),
}));

const { mermaidToDrawio, isMermaid } = await import('@/lib/drawio/importers/mermaid');
const { csvToDrawio, parseCsv } = await import('@/lib/drawio/importers/csv');
const { vsdxToDrawio } = await import('@/lib/drawio/importers/vsdx');
const { embedXmlInPng, xmlFromPng, xmlFromSvg } = await import('@/lib/drawio/embed');

const byLabel = (cells: CellData[], v: string) => cells.find((c) => c.value === v)!;

describe('Mermaid flowcharts', () => {
  it('converts nodes, shapes, chains, labels and & groups', async () => {
    const file = await mermaidToDrawio(`flowchart LR
      A([Start]) --> B{"Ready?"}
      B -->|yes| C[Ship it] & D[(Logs)]
      B -- no --> E((Wait)) -.-> A
      %% a comment
      classDef x fill:#f00`);
    const cells = file.pages[0].cells;
    const vertices = cells.filter((c) => c.vertex);
    expect(vertices.map((c) => c.value).sort()).toEqual(['Logs', 'Ready?', 'Ship it', 'Start', 'Wait']);
    expect(byLabel(cells, 'Ready?').style).toContain('rhombus');
    expect(byLabel(cells, 'Logs').style).toContain('cylinder3');
    expect(byLabel(cells, 'Start').style).toContain('arcSize=50');
    const edges = cells.filter((c) => c.edge);
    expect(edges).toHaveLength(5);
    expect(edges.filter((e) => e.value === 'yes')).toHaveLength(2);
    const dashed = edges.find((e) => e.style!.includes('dashed=1'))!;
    expect(dashed.source).toBe(byLabel(cells, 'Wait').id);
    expect(dashed.target).toBe(byLabel(cells, 'Start').id);
  });

  it('detects Mermaid and rejects other diagram types', async () => {
    expect(isMermaid('graph TD\nA-->B')).toBe(true);
    expect(isMermaid('sequenceDiagram\nA->>B: hi')).toBe(false);
    await expect(mermaidToDrawio('sequenceDiagram')).rejects.toThrow(/flowcharts/);
  });
});

describe('CSV', () => {
  it('parses quoted fields', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('applies label/style templates, identity, connections and custom data', async () => {
    const file = await csvToDrawio(`# label: %name%<br>%role%
# style: rounded=1;fillColor=%fill%;
# identity: id
# connect: {"from": "manager", "to": "id", "invert": true}
# ignore: fill
id,name,role,manager,fill
a,Ada,CEO,,#dae8fc
g,Grace <CTO>,CTO,a,#d5e8d4`);
    const cells = file.pages[0].cells;
    const ada = cells.find((c) => c.id.endsWith('-a'))!;
    expect(ada.value).toBe('Ada<br>CEO');
    expect(ada.style).toBe('rounded=1;fillColor=#dae8fc;');
    expect(ada.objAttrs).toEqual({ name: 'Ada', role: 'CEO' });
    // Labels are HTML, so values are escaped.
    expect(cells.find((c) => c.id.endsWith('-g'))!.value).toBe('Grace &lt;CTO&gt;<br>CTO');
    const edge = cells.find((c) => c.edge)!;
    expect(edge.source).toBe(ada.id);
    expect(edge.target).toMatch(/-g$/);
  });
});

describe('editable exports', () => {
  // A 1x1 PNG.
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const xml = '<mxfile><diagram name="Ünïcode & <stuff>">x</diagram></mxfile>';

  it('round-trips the diagram through a PNG tEXt chunk', () => {
    const out = embedXmlInPng(png, xml);
    expect(out.length).toBeGreaterThan(png.length);
    expect(xmlFromPng(out)).toBe(xml);
    expect(xmlFromPng(png)).toBeNull();
  });

  it('reads the diagram from an SVG content attribute', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"></svg>`;
    expect(xmlFromSvg(svg)).toBe(xml);
    expect(xmlFromSvg('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeNull();
  });
});

describe('Visio (.vsdx)', () => {
  const NS = 'xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const rel = (id: string, target: string) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Target="${target}"/></Relationships>`;
  const shape = (id: number, master: number, cells: Record<string, string | number>, text = '') =>
    `<Shape ID="${id}" Type="Shape" Master="${master}">${Object.entries(cells).map(([k, v]) => `<Cell N="${k}" V="${v}"/>`).join('')}${text ? `<Text>${text}</Text>` : ''}</Shape>`;
  const vsdx = zipSync({
    'visio/pages/pages.xml': strToU8(`<Pages ${NS}><Page ID="0" NameU="Flow"><PageSheet><Cell N="PageWidth" V="8.5"/><Cell N="PageHeight" V="11"/></PageSheet><Rel r:id="rId1"/></Page></Pages>`),
    'visio/pages/_rels/pages.xml.rels': strToU8(rel('rId1', 'page1.xml')),
    'visio/masters/masters.xml': strToU8(
      `<Masters ${NS}><Master ID="1" NameU="Rectangle"><Rel r:id="m1"/></Master><Master ID="2" NameU="Ellipse"><Rel r:id="m2"/></Master><Master ID="3" NameU="Dynamic connector"><Rel r:id="m3"/></Master></Masters>`,
    ),
    'visio/masters/_rels/masters.xml.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="m1" Target="master1.xml"/><Relationship Id="m2" Target="master2.xml"/><Relationship Id="m3" Target="master3.xml"/></Relationships>`,
    ),
    'visio/masters/master1.xml': strToU8(`<MasterContents ${NS}><Shapes>${shape(5, 0, { Width: 1, Height: 0.5 })}</Shapes></MasterContents>`),
    'visio/masters/master2.xml': strToU8(`<MasterContents ${NS}><Shapes>${shape(5, 0, { Width: 1, Height: 1 })}</Shapes></MasterContents>`),
    'visio/masters/master3.xml': strToU8(`<MasterContents ${NS}><Shapes>${shape(5, 0, { EndArrow: 4 })}</Shapes></MasterContents>`),
    'visio/pages/page1.xml': strToU8(
      `<PageContents ${NS}><Shapes>` +
        shape(1, 1, { PinX: 2, PinY: 10, Width: 2, Height: 1, LocPinX: 1, LocPinY: 0.5, FillForegnd: '#ffcc00' }, 'Box') +
        shape(2, 2, { PinX: 6, PinY: 10, LocPinX: 0.5, LocPinY: 0.5 }, 'Round') +
        shape(3, 3, { BeginX: 3, BeginY: 10, EndX: 5.5, EndY: 10 }) +
        `</Shapes><Connects><Connect FromSheet="3" FromCell="BeginX" ToSheet="1"/><Connect FromSheet="3" FromCell="EndX" ToSheet="2"/></Connects></PageContents>`,
    ),
  });

  it('converts shapes, master sizes, colors, text and glued connectors', () => {
    const page = vsdxToDrawio(vsdx).pages[0];
    expect(page.name).toBe('Flow');
    expect(page.modelAttrs).toMatchObject({ pageWidth: '850', pageHeight: '1100' });
    const box = byLabel(page.cells, 'Box');
    // Pin (2in, 10in) on an 11in page, 2x1in, centered pin: top-left = (100, 50).
    expect(box.geometry).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    expect(box.style).toContain('fillColor=#ffcc00');
    const round = byLabel(page.cells, 'Round');
    expect(round.style).toMatch(/^ellipse;/);
    expect(round.geometry).toMatchObject({ width: 100, height: 100 }); // size from the master
    const edge = page.cells.find((c) => c.edge)!;
    expect(edge).toMatchObject({ source: box.id, target: round.id });
    expect(edge.style).toContain('edgeStyle=orthogonalEdgeStyle');
    expect(edge.style).toContain('endArrow=classic');
  });

  it('rejects files that are not Visio', () => {
    expect(() => vsdxToDrawio(strToU8('nope'))).toThrow(/vsdx/);
  });
});
