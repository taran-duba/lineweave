'use client';

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  FlipHorizontal2,
  FlipVertical2,
  Lock,
  LockOpen,
  RotateCw,
} from 'lucide-react';
import type { Cell, Graph } from '@maxgraph/core';
import { IconButton, NumberInput, Section, Stepper, Field } from '@/components/ui';
import type { EditorActions } from '@/lib/graph/actions';
import { isLocked } from '@/lib/graph/arrange';
import { setStyle, type StyleRecord } from './setStyle';

export function ArrangeSection({
  graph,
  cells,
  style,
  actions,
  readOnly,
}: {
  graph: Graph;
  cells: Cell[];
  style: StyleRecord;
  actions: EditorActions;
  readOnly: boolean;
}) {
  const first = cells[0];
  const vertices = cells.filter((c) => c.isVertex());
  const geo = cells.length === 1 && first.isVertex() ? first.geometry : null;
  const setGeo = (key: 'x' | 'y' | 'width' | 'height', v: number) => {
    if (!geo || readOnly || !Number.isFinite(v)) return;
    const g = geo.clone();
    g[key] = key === 'width' || key === 'height' ? Math.max(1, v) : v;
    graph.getDataModel().setGeometry(first, g);
  };
  const locked = cells.every(isLocked);
  const many = vertices.length > 1;

  return (
    <Section title="Arrange">
      {many && (
        <div className="flex flex-wrap items-center gap-0.5" aria-label="Align and distribute">
          <IconButton label="Align left" onClick={() => actions.align('left')}>
            <AlignStartVertical size={15} />
          </IconButton>
          <IconButton label="Align centers" onClick={() => actions.align('center')}>
            <AlignCenterVertical size={15} />
          </IconButton>
          <IconButton label="Align right" onClick={() => actions.align('right')}>
            <AlignEndVertical size={15} />
          </IconButton>
          <IconButton label="Align top" onClick={() => actions.align('top')}>
            <AlignStartHorizontal size={15} />
          </IconButton>
          <IconButton label="Align middles" onClick={() => actions.align('middle')}>
            <AlignCenterHorizontal size={15} />
          </IconButton>
          <IconButton label="Align bottom" onClick={() => actions.align('bottom')}>
            <AlignEndHorizontal size={15} />
          </IconButton>
          <IconButton label="Distribute horizontally" disabled={vertices.length < 3} onClick={() => actions.distribute('horizontal')}>
            <AlignHorizontalDistributeCenter size={15} />
          </IconButton>
          <IconButton label="Distribute vertically" disabled={vertices.length < 3} onClick={() => actions.distribute('vertical')}>
            <AlignVerticalDistributeCenter size={15} />
          </IconButton>
        </div>
      )}
      {vertices.length > 0 && (
        <>
          <Field label="Rotation">
            <Stepper
              label="Rotation"
              min={0}
              max={359}
              step={15}
              value={Number(style.rotation ?? 0)}
              onChange={(v) => !readOnly && setStyle(graph, vertices, 'rotation', v % 360 || null)}
            />
          </Field>
          <div className="flex items-center gap-0.5">
            <IconButton label="Rotate 90°" onClick={actions.rotate90}>
              <RotateCw size={15} />
            </IconButton>
            <IconButton label="Flip horizontally" active={!!style.flipH} onClick={() => actions.flip('flipH')}>
              <FlipHorizontal2 size={15} />
            </IconButton>
            <IconButton label="Flip vertically" active={!!style.flipV} onClick={() => actions.flip('flipV')}>
              <FlipVertical2 size={15} />
            </IconButton>
            <div className="flex-1" />
            <IconButton label={locked ? 'Unlock' : 'Lock'} active={locked} onClick={actions.toggleLock}>
              {locked ? <Lock size={15} /> : <LockOpen size={15} />}
            </IconButton>
          </div>
        </>
      )}
      {geo && (
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="w-3 uppercase">{k[0]}</span>
              <NumberInput className="w-full" value={Math.round(geo[k])} onChange={(e) => setGeo(k, Number(e.target.value))} />
            </label>
          ))}
        </div>
      )}
    </Section>
  );
}
