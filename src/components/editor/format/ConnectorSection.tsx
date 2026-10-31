'use client';

import type { Cell, Graph } from '@maxgraph/core';
import { Button, Field, Section, Select, Stepper } from '@/components/ui';
import type { EditorActions } from '@/lib/graph/actions';
import { WIRE_TYPES, wireStyleValues, type WireType } from '@/lib/graph/wires';
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

function isWireType(style: StyleRecord, w: WireType): boolean {
  return (
    String(style.strokeColor ?? '').toLowerCase() === w.stroke &&
    Number(style.strokeWidth ?? 1) === w.width &&
    (style.dashPattern ?? undefined) === w.dash
  );
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
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-muted" id="wire-type-label">
          Wire
        </span>
        <div className="flex flex-wrap justify-end gap-1" role="group" aria-labelledby="wire-type-label">
          {WIRE_TYPES.map((w) => (
            <button
              key={w.id}
              type="button"
              title={w.title}
              aria-label={`${w.title} wire`}
              aria-pressed={isWireType(style, w)}
              onClick={() => set(wireStyleValues(w))}
              className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-panel-2 aria-pressed:border-accent"
            >
              <svg width="16" height="8" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="15"
                  y2="4"
                  stroke={w.stroke === '#000000' ? 'currentColor' : w.stroke}
                  strokeWidth={Math.max(w.width, 1.5)}
                  strokeDasharray={w.dash ? '3 2' : undefined}
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
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
