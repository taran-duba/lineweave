'use client';

import type { Cell, Graph } from '@maxgraph/core';
import { Button, Field, Section, Select, Stepper } from '@/components/ui';
import type { EditorActions } from '@/lib/graph/actions';
import { setStyles, type StyleRecord } from './setStyle';

const ARROWS = ['none', 'classic', 'classicThin', 'block', 'blockThin', 'open', 'openThin', 'oval', 'diamond', 'diamondThin'];

/** Connector routing styles, as the style keys draw.io writes for each. */
const ROUTES = {
  straight: { label: 'Straight', style: { edgeStyle: null, curved: null, elbow: null } },
  orthogonal: { label: 'Orthogonal', style: { edgeStyle: 'orthogonalEdgeStyle', curved: null, elbow: null } },
  curved: { label: 'Curved', style: { edgeStyle: 'orthogonalEdgeStyle', curved: 1, elbow: null } },
  elbowH: { label: 'Elbow (horizontal)', style: { edgeStyle: 'elbowEdgeStyle', curved: null, elbow: null } },
  elbowV: { label: 'Elbow (vertical)', style: { edgeStyle: 'elbowEdgeStyle', curved: null, elbow: 'vertical' } },
  entityRelation: { label: 'Entity relation', style: { edgeStyle: 'entityRelationEdgeStyle', curved: null, elbow: null } },
} as const;

type Route = keyof typeof ROUTES;

function routeOf(style: StyleRecord): Route {
  switch (style.edgeStyle) {
    case 'orthogonalEdgeStyle':
      return style.curved ? 'curved' : 'orthogonal';
    case 'elbowEdgeStyle':
      return style.elbow === 'vertical' ? 'elbowV' : 'elbowH';
    case 'entityRelationEdgeStyle':
      return 'entityRelation';
    default:
      return style.curved ? 'curved' : 'straight';
  }
}

export function ConnectorSection({
  graph,
  edges,
  style,
  actions,
}: {
  graph: Graph;
  edges: Cell[];
  style: StyleRecord;
  actions: EditorActions;
}) {
  const set = (values: StyleRecord) => setStyles(graph, edges, values);
  const hasWaypoints = edges.some((e) => e.geometry?.points?.length);

  return (
    <Section title="Connector">
      <Field label="Route">
        <Select value={routeOf(style)} onChange={(e) => set(ROUTES[e.target.value as Route].style)}>
          {Object.entries(ROUTES).map(([id, r]) => (
            <option key={id} value={id}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rounded corners">
        <input
          type="checkbox"
          checked={!!style.rounded}
          onChange={(e) => set({ rounded: e.target.checked ? 1 : 0 })}
          className="accent-[var(--accent)]"
        />
      </Field>
      <Field label="Line jumps">
        <Select value={String(style.jumpStyle ?? 'none')} onChange={(e) => set({ jumpStyle: e.target.value === 'none' ? null : e.target.value })}>
          <option value="none">None</option>
          <option value="arc">Arc</option>
          <option value="gap">Gap</option>
          <option value="sharp">Sharp</option>
        </Select>
      </Field>
      <Field label="Start">
        <Select value={String(style.startArrow ?? 'none')} onChange={(e) => set({ startArrow: e.target.value })}>
          {ARROWS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </Field>
      <Field label="End">
        <Select value={String(style.endArrow ?? 'none')} onChange={(e) => set({ endArrow: e.target.value })}>
          {ARROWS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </Field>
      <Field label="Arrow size">
        <Stepper
          label="Arrow size"
          min={1}
          max={40}
          value={Number(style.endSize ?? 6)}
          onChange={(v) => set({ startSize: v, endSize: v })}
        />
      </Field>
      {hasWaypoints && (
        <Button className="mt-1 w-full" onClick={actions.clearWaypoints}>
          Clear waypoints
        </Button>
      )}
      <p className="text-[12px] leading-relaxed text-muted">Drag the faint midpoint of a straight connector to bend it.</p>
    </Section>
  );
}
