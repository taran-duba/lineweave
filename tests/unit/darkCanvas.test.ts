import { describe, expect, it } from 'vitest';
import { Cell, type CellStateStyle } from '@maxgraph/core';
import { adaptStyleForDark } from '@/lib/graph/darkCanvas';

const edge = () => Object.assign(new Cell(), { edge: true });
const vertex = () => Object.assign(new Cell(), { vertex: true });
const adapt = (cell: Cell, style: Record<string, unknown>) =>
  adaptStyleForDark(style as CellStateStyle, cell) as Record<string, unknown>;

describe('adaptStyleForDark', () => {
  it('lightens default black edges, labels and white label backgrounds', () => {
    expect(adapt(edge(), { strokeColor: '#000000', fontColor: '#000000', labelBackgroundColor: '#ffffff' })).toMatchObject({
      strokeColor: '#dedede',
      fontColor: '#dedede',
      labelBackgroundColor: '#000000',
    });
  });

  it('keeps colored edges as they are', () => {
    expect(adapt(edge(), { strokeColor: '#b85450', fontColor: '#6c8ebf' })).toMatchObject({
      strokeColor: '#b85450',
      fontColor: '#6c8ebf',
    });
  });

  it('keeps filled shapes unchanged, including black text on their fill', () => {
    const style = { fillColor: '#fff2cc', strokeColor: '#000000', fontColor: '#000000' };
    expect(adapt(vertex(), style)).toEqual(style);
  });

  it('lightens unfilled shapes and labels drawn outside a shape', () => {
    expect(adapt(vertex(), { fillColor: 'none', strokeColor: '#000000', fontColor: '#000000' })).toMatchObject({
      strokeColor: '#dedede',
      fontColor: '#dedede',
    });
    expect(adapt(vertex(), { fillColor: '#ffffff', fontColor: '#000000', verticalLabelPosition: 'bottom' })).toMatchObject({
      fontColor: '#dedede',
    });
  });

  it('never mutates the stored style', () => {
    const style = { strokeColor: '#000000' };
    adapt(edge(), style);
    expect(style.strokeColor).toBe('#000000');
  });
});
