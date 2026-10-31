import { edge, file, stack, vertex } from '@/lib/graph/palettes/snippet';

/** Starting points for a new diagram, as real draw.io files (so they open in diagrams.net too). */

export interface Template {
  id: string;
  name: string;
  description: string;
  build(): string;
}

const W = 'whiteSpace=wrap;html=1;';
const box = (fill: string, stroke: string, extra = '') => `rounded=1;${W}fillColor=${fill};strokeColor=${stroke};${extra}`;
const FLOW = 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;';
const BLUE: [string, string] = ['#dae8fc', '#6c8ebf'];
const GREEN: [string, string] = ['#d5e8d4', '#82b366'];
const YELLOW: [string, string] = ['#fff2cc', '#d6b656'];
const RED: [string, string] = ['#f8cecc', '#b85450'];
const PURPLE: [string, string] = ['#e1d5e7', '#9673a6'];

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank diagram', description: 'Start with an empty page.', build: () => file('Page-1') },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Start, steps and a decision.',
    build: () =>
      file(
        'Flowchart',
        vertex('s', 'Start', box(...GREEN, 'arcSize=50;'), { x: 300, y: 40, w: 120, h: 50 }),
        vertex('a', 'Do the work', box(...BLUE), { x: 290, y: 150, w: 140, h: 60 }),
        vertex('d', 'Done?', `rhombus;${W}fillColor=${YELLOW[0]};strokeColor=${YELLOW[1]};`, { x: 300, y: 270, w: 120, h: 90 }),
        vertex('e', 'Finish', box(...RED, 'arcSize=50;'), { x: 300, y: 440, w: 120, h: 50 }),
        edge('e1', 's', 'a', FLOW),
        edge('e2', 'a', 'd', FLOW),
        edge('e3', 'd', 'e', FLOW, 'Yes'),
        edge('e4', 'd', 'a', `${FLOW}exitX=1;exitY=0.5;entryX=1;entryY=0.5;`, 'No'),
      ),
  },
  {
    id: 'org',
    name: 'Org chart',
    description: 'A team hierarchy.',
    build: () => {
      const person = (id: string, title: string, role: string, x: number, y: number, c: [string, string]) =>
        vertex(id, `<b>${title}</b><br>${role}`, box(c[0], c[1]), { x, y, w: 150, h: 60 });
      return file(
        'Org chart',
        person('ceo', 'Ada', 'CEO', 345, 40, BLUE),
        person('cto', 'Grace', 'CTO', 165, 170, GREEN),
        person('cfo', 'Linus', 'CFO', 525, 170, GREEN),
        person('e1', 'Margaret', 'Engineer', 75, 300, YELLOW),
        person('e2', 'Dennis', 'Engineer', 255, 300, YELLOW),
        person('a1', 'Barbara', 'Accountant', 525, 300, YELLOW),
        ...[['ceo', 'cto'], ['ceo', 'cfo'], ['cto', 'e1'], ['cto', 'e2'], ['cfo', 'a1']].map(([a, b], i) => edge(`o${i}`, a, b, 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=none;')),
      );
    },
  },
  {
    id: 'mindmap',
    name: 'Mind map',
    description: 'A central idea with branches.',
    build: () => {
      const topics: [string, number, number, [string, string]][] = [
        ['Research', 80, 60, BLUE], ['Design', 520, 60, GREEN], ['Build', 80, 300, YELLOW], ['Launch', 520, 300, PURPLE],
      ];
      return file(
        'Mind map',
        vertex('c', 'Project', `ellipse;${W}fillColor=${RED[0]};strokeColor=${RED[1]};fontStyle=1;fontSize=16;`, { x: 300, y: 170, w: 140, h: 80 }),
        ...topics.map(([t, x, y, c], i) => vertex(`t${i}`, t, box(c[0], c[1], 'arcSize=40;'), { x, y, w: 130, h: 50 })),
        ...topics.map((_, i) => edge(`m${i}`, 'c', `t${i}`, 'curved=1;endArrow=none;html=1;strokeWidth=2;')),
      );
    },
  },
  {
    id: 'swimlane',
    name: 'Swimlane process',
    description: 'Who does what, step by step.',
    build: () =>
      file(
        'Swimlane',
        vertex('l1', 'Customer', `swimlane;horizontal=0;startSize=30;${W}`, { x: 40, y: 40, w: 620, h: 140 }),
        vertex('l2', 'Support', `swimlane;horizontal=0;startSize=30;${W}`, { x: 40, y: 180, w: 620, h: 140 }),
        vertex('a', 'Submit request', box(...BLUE), { x: 100, y: 70, w: 120, h: 60 }),
        vertex('b', 'Review request', box(...YELLOW), { x: 280, y: 210, w: 120, h: 60 }),
        vertex('c', 'Send answer', box(...GREEN), { x: 460, y: 210, w: 120, h: 60 }),
        edge('f1', 'a', 'b', FLOW),
        edge('f2', 'b', 'c', FLOW),
      ),
  },
  {
    id: 'uml',
    name: 'UML class diagram',
    description: 'Classes with fields and methods.',
    build: () =>
      file(
        'Classes',
        stack('animal', 'Animal', [{ text: '+ name: string' }, 'divider', { text: '+ speak(): void' }], { w: 170, at: { x: 240, y: 40 } }),
        stack('dog', 'Dog', [{ text: '+ breed: string' }, 'divider', { text: '+ fetch(): void' }], { w: 170, at: { x: 100, y: 240 } }),
        stack('cat', 'Cat', [{ text: '+ indoor: boolean' }, 'divider', { text: '+ purr(): void' }], { w: 170, at: { x: 380, y: 240 } }),
        edge('i1', 'dog', 'animal', 'endArrow=block;endSize=16;endFill=0;html=1;rounded=0;'),
        edge('i2', 'cat', 'animal', 'endArrow=block;endSize=16;endFill=0;html=1;rounded=0;'),
      ),
  },
  {
    id: 'er',
    name: 'Entity relationship',
    description: 'Tables and their relationships.',
    build: () =>
      file(
        'ER',
        stack('users', 'users', [{ text: 'PK  id' }, 'divider', { text: 'email: text' }, { text: 'name: text' }], { w: 180, at: { x: 60, y: 60 } }),
        stack('orders', 'orders', [{ text: 'PK  id' }, 'divider', { text: 'FK  user_id' }, { text: 'total: money' }], { w: 180, at: { x: 380, y: 60 } }),
        edge('r1', 'users', 'orders', 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERmany;startArrow=ERmandOne;endFill=0;startFill=0;'),
      ),
  },
];
