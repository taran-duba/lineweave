import type { PaletteItem, PaletteSection } from '../palette';
import { ICON_LABELS, iconStyle } from './icons';
import { model, stack } from './snippet';

const W = 'whiteSpace=wrap;html=1;';

/** A multi-cell item. `style`/size describe the outer shape (used for its preview). */
function multi(id: string, title: string, style: string, width: number, height: number, xml: string, value = title): PaletteItem {
  return { id, title, style, width, height, value, xml };
}

const arrows: PaletteSection = {
  id: 'arrows',
  title: 'Arrows & Shapes',
  items: [
    { id: 'ar-right', title: 'Arrow', style: `shape=singleArrow;${W}arrowWidth=0.4;arrowSize=0.3;`, width: 120, height: 60 },
    { id: 'ar-double', title: 'Double Arrow', style: `shape=doubleArrow;${W}arrowWidth=0.4;arrowSize=0.2;`, width: 120, height: 60 },
    { id: 'ar-callout', title: 'Callout', style: `shape=callout;${W}size=24;position=0.3;base=20;`, width: 120, height: 80 },
    { id: 'ar-cross', title: 'Cross', style: `shape=cross;${W}size=0.3;`, width: 80, height: 80 },
    { id: 'ar-cube', title: 'Cube', style: `shape=cube;${W}size=16;`, width: 100, height: 80 },
    { id: 'ar-folder', title: 'Folder', style: `shape=folder;${W}tabWidth=40;tabHeight=14;`, width: 100, height: 70 },
    { id: 'ar-note', title: 'Note', style: `shape=note;${W}backgroundOutline=1;darkOpacity=0.05;size=18;`, width: 90, height: 100 },
    { id: 'ar-cloud', title: 'Cloud', style: `ellipse;shape=cloud;${W}`, width: 120, height: 80 },
    { id: 'ar-triangle', title: 'Triangle', style: `triangle;${W}`, width: 70, height: 80 },
    { id: 'ar-hexagon', title: 'Hexagon', style: `shape=hexagon;perimeter=hexagonPerimeter2;${W}fixedSize=1;`, width: 120, height: 80 },
    { id: 'ar-flex', title: 'Wide arrow connector', style: 'shape=flexArrow;endArrow=classic;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;width=20;endWidth=40;', width: 120, height: 0, edge: true },
    { id: 'ar-dashed', title: 'Dashed connector', style: 'endArrow=classic;html=1;dashed=1;edgeStyle=orthogonalEdgeStyle;rounded=0;', width: 120, height: 0, edge: true },
    { id: 'ar-bidirectional', title: 'Two-way connector', style: 'endArrow=classic;startArrow=classic;html=1;rounded=0;', width: 120, height: 0, edge: true },
  ],
};

const uml: PaletteSection = {
  id: 'uml',
  title: 'UML',
  items: [
    multi(
      'uml-class',
      'Class',
      'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=26;',
      160,
      86,
      model(stack('c', 'ClassName', [{ text: '+ field: type' }, 'divider', { text: '+ method(type): type' }])),
    ),
    multi(
      'uml-interface',
      'Interface',
      'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=40;',
      160,
      86,
      model(stack('i', '«interface»<br>Name', [{ text: '+ method(type): type' }], { header: 'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=40;' })),
    ),
    { id: 'uml-actor', title: 'Actor', style: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;', width: 30, height: 60, value: 'Actor' },
    { id: 'uml-usecase', title: 'Use Case', style: `ellipse;${W}`, width: 120, height: 60, value: 'Use case' },
    { id: 'uml-lifeline', title: 'Lifeline', style: 'shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=40;', width: 100, height: 240, value: ':Object' },
    { id: 'uml-component', title: 'Component', style: `shape=component;${W}`, width: 120, height: 60, value: 'Component' },
    { id: 'uml-package', title: 'Package', style: `shape=folder;${W}tabWidth=60;tabHeight=18;`, width: 140, height: 90, value: 'Package' },
    { id: 'uml-frame', title: 'Frame', style: `shape=umlFrame;${W}width=60;height=20;`, width: 200, height: 140, value: 'frame' },
    { id: 'uml-note', title: 'Note', style: `shape=note;${W}size=14;`, width: 120, height: 70, value: 'Note' },
    { id: 'uml-state', title: 'State', style: `rounded=1;arcSize=30;${W}`, width: 120, height: 60, value: 'State' },
    { id: 'uml-initial', title: 'Initial State', style: 'ellipse;html=1;fillColor=#000000;strokeColor=#000000;', width: 30, height: 30, value: '' },
    { id: 'uml-final', title: 'Final State', style: 'ellipse;html=1;shape=doubleEllipse;fillColor=#000000;strokeColor=#000000;', width: 36, height: 36, value: '' },
    { id: 'uml-decision', title: 'Decision', style: `rhombus;${W}`, width: 60, height: 60, value: '' },
    { id: 'uml-inherit', title: 'Inheritance', style: 'endArrow=block;endSize=16;endFill=0;html=1;rounded=0;', width: 120, height: 0, edge: true },
    { id: 'uml-compose', title: 'Composition', style: 'endArrow=diamondThin;endSize=16;endFill=1;html=1;rounded=0;', width: 120, height: 0, edge: true },
    { id: 'uml-aggregate', title: 'Aggregation', style: 'endArrow=diamondThin;endSize=16;endFill=0;html=1;rounded=0;', width: 120, height: 0, edge: true },
    { id: 'uml-depend', title: 'Dependency', style: 'endArrow=open;endSize=12;dashed=1;html=1;rounded=0;', width: 120, height: 0, edge: true },
  ],
};

const er: PaletteSection = {
  id: 'er',
  title: 'Entity Relation',
  items: [
    multi(
      'er-entity',
      'Entity',
      'swimlane;fontStyle=1;align=center;verticalAlign=top;startSize=26;',
      180,
      112,
      model(stack('t', 'Table', [{ text: 'PK  id' }, 'divider', { text: 'name: text' }, { text: 'created_at: timestamp' }], { w: 180 })),
    ),
    { id: 'er-one-many', title: 'One to many', style: 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERmany;startArrow=ERmandOne;endFill=0;startFill=0;', width: 120, height: 0, edge: true },
    { id: 'er-one-one', title: 'One to one', style: 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERmandOne;startArrow=ERmandOne;endFill=0;startFill=0;', width: 120, height: 0, edge: true },
    { id: 'er-zero-many', title: 'Zero or many', style: 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERzeroToMany;startArrow=ERmandOne;endFill=0;startFill=0;', width: 120, height: 0, edge: true },
    { id: 'er-zero-one', title: 'Zero or one', style: 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERzeroToOne;startArrow=ERmandOne;endFill=0;startFill=0;', width: 120, height: 0, edge: true },
    { id: 'er-many-many', title: 'Many to many', style: 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=ERmany;startArrow=ERmany;endFill=0;startFill=0;', width: 120, height: 0, edge: true },
  ],
};

const bpmn: PaletteSection = {
  id: 'bpmn',
  title: 'BPMN',
  items: [
    { id: 'bp-task', title: 'Task', style: `rounded=1;arcSize=10;${W}`, width: 120, height: 70, value: 'Task' },
    { id: 'bp-start', title: 'Start Event', style: 'ellipse;html=1;aspect=fixed;strokeWidth=1;', width: 40, height: 40, value: '' },
    { id: 'bp-intermediate', title: 'Intermediate Event', style: 'ellipse;html=1;shape=doubleEllipse;aspect=fixed;', width: 44, height: 44, value: '' },
    { id: 'bp-end', title: 'End Event', style: 'ellipse;html=1;aspect=fixed;strokeWidth=4;', width: 40, height: 40, value: '' },
    { id: 'bp-gateway', title: 'Gateway', style: 'rhombus;html=1;aspect=fixed;', width: 50, height: 50, value: '' },
    { id: 'bp-subprocess', title: 'Sub-process', style: `rounded=1;arcSize=10;${W}strokeWidth=2;`, width: 160, height: 90, value: 'Sub-process' },
    { id: 'bp-data', title: 'Data Object', style: `shape=note;${W}size=14;backgroundOutline=1;`, width: 40, height: 56, value: '' },
    { id: 'bp-store', title: 'Data Store', style: `shape=cylinder3;${W}boundedLbl=1;backgroundOutline=1;size=10;`, width: 50, height: 56, value: '' },
    { id: 'bp-pool', title: 'Pool / Lane', style: `swimlane;horizontal=0;startSize=26;${W}`, width: 400, height: 140, value: 'Pool' },
    { id: 'bp-flow', title: 'Sequence Flow', style: 'endArrow=classic;html=1;rounded=0;edgeStyle=orthogonalEdgeStyle;', width: 120, height: 0, edge: true },
    { id: 'bp-message', title: 'Message Flow', style: 'endArrow=open;dashed=1;html=1;rounded=0;startArrow=oval;startFill=0;', width: 120, height: 0, edge: true },
  ],
};

const network: PaletteSection = {
  id: 'network',
  title: 'Network & Cloud',
  items: Object.keys(ICON_LABELS).map((name) => ({
    id: `net-${name}`,
    title: ICON_LABELS[name],
    style: iconStyle(name),
    width: 56,
    height: 56,
    value: ICON_LABELS[name],
  })),
};

const sticky: PaletteSection = {
  id: 'sticky',
  title: 'Sticky Notes',
  items: [
    ['#fff2cc', '#d6b656', 'Yellow'],
    ['#d5e8d4', '#82b366', 'Green'],
    ['#dae8fc', '#6c8ebf', 'Blue'],
    ['#f8cecc', '#b85450', 'Red'],
    ['#e1d5e7', '#9673a6', 'Purple'],
    ['#ffe6cc', '#d79b00', 'Orange'],
  ].map(([fill, stroke, name]) => ({
    id: `sticky-${name.toLowerCase()}`,
    title: `${name} note`,
    style: `shape=note;${W}size=14;backgroundOutline=1;fillColor=${fill};strokeColor=${stroke};align=left;verticalAlign=top;spacingLeft=6;spacingTop=4;`,
    width: 140,
    height: 110,
    value: 'Note',
  })),
};

export const EXTRA_PALETTES: PaletteSection[] = [arrows, uml, er, bpmn, network, sticky];
