import type { PaletteSection } from '../palette';

const W = 'whiteSpace=wrap;html=1;';

export const CORE_PALETTES: PaletteSection[] = [
  {
    id: 'general',
    title: 'General',
    items: [
      { id: 'rect', title: 'Rectangle', style: `rounded=0;${W}`, width: 120, height: 60 },
      { id: 'rounded', title: 'Rounded Rectangle', style: `rounded=1;${W}`, width: 120, height: 60 },
      { id: 'text', title: 'Text', style: 'text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;strokeColor=none;fillColor=none;', width: 60, height: 30, value: 'Text' },
      { id: 'ellipse', title: 'Ellipse', style: `ellipse;${W}`, width: 120, height: 80 },
      { id: 'square', title: 'Square', style: `${W}aspect=fixed;`, width: 80, height: 80 },
      { id: 'circle', title: 'Circle', style: `ellipse;${W}aspect=fixed;`, width: 80, height: 80 },
      { id: 'diamond', title: 'Diamond', style: `rhombus;${W}`, width: 80, height: 80 },
      { id: 'triangle', title: 'Triangle', style: `triangle;${W}`, width: 60, height: 80 },
      { id: 'hexagon', title: 'Hexagon', style: `shape=hexagon;perimeter=hexagonPerimeter2;${W}fixedSize=1;`, width: 120, height: 80 },
      { id: 'cylinder', title: 'Cylinder', style: `shape=cylinder3;${W}boundedLbl=1;backgroundOutline=1;size=15;`, width: 60, height: 80 },
      { id: 'cloud', title: 'Cloud', style: `ellipse;shape=cloud;${W}`, width: 120, height: 80 },
      { id: 'note', title: 'Note', style: `shape=note;${W}backgroundOutline=1;darkOpacity=0.05;`, width: 80, height: 100 },
      { id: 'actor', title: 'Actor', style: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;', width: 30, height: 60, value: 'Actor' },
      { id: 'container', title: 'Container', style: `swimlane;${W}`, width: 200, height: 200, value: 'Container' },
      { id: 'arrow', title: 'Arrow', style: 'endArrow=classic;html=1;rounded=0;', width: 100, height: 0, edge: true },
      { id: 'line', title: 'Line', style: 'endArrow=none;html=1;rounded=0;', width: 100, height: 0, edge: true },
    ],
  },
  {
    id: 'flowchart',
    title: 'Flowchart',
    items: [
      { id: 'fc-process', title: 'Process', style: `rounded=0;${W}`, width: 120, height: 60 },
      { id: 'fc-terminator', title: 'Terminator', style: `rounded=1;${W}arcSize=50;`, width: 120, height: 50 },
      { id: 'fc-decision', title: 'Decision', style: `rhombus;${W}`, width: 100, height: 80 },
      { id: 'fc-data', title: 'Data', style: `shape=parallelogram;perimeter=parallelogramPerimeter;${W}fixedSize=1;`, width: 120, height: 60 },
      { id: 'fc-predefined', title: 'Predefined Process', style: `shape=process;${W}backgroundOutline=1;`, width: 120, height: 60 },
      { id: 'fc-document', title: 'Document', style: `shape=document;${W}boundedLbl=1;`, width: 120, height: 80 },
      { id: 'fc-database', title: 'Database', style: `shape=cylinder3;${W}boundedLbl=1;backgroundOutline=1;size=15;`, width: 60, height: 80 },
      { id: 'fc-manual', title: 'Manual Input', style: `shape=manualInput;${W}`, width: 120, height: 60 },
      { id: 'fc-delay', title: 'Delay', style: `shape=delay;${W}`, width: 100, height: 60 },
      { id: 'fc-offpage', title: 'Off-page Reference', style: `shape=offPageConnector;${W}`, width: 60, height: 60 },
      { id: 'fc-card', title: 'Card', style: `shape=card;${W}`, width: 80, height: 100 },
      { id: 'fc-trapezoid', title: 'Trapezoid', style: `shape=trapezoid;perimeter=trapezoidPerimeter;${W}fixedSize=1;`, width: 120, height: 60 },
      { id: 'fc-step', title: 'Step', style: `shape=step;perimeter=stepPerimeter;${W}fixedSize=1;`, width: 120, height: 80 },
      { id: 'fc-tape', title: 'Tape', style: `shape=tape;${W}`, width: 120, height: 100 },
      { id: 'fc-connector', title: 'Connector', style: `ellipse;${W}aspect=fixed;`, width: 60, height: 60 },
    ],
  },
];
