import { describe, expect, it } from 'vitest';
import { getStyleValue, mergeCellStyle, setStyleValue, toCellStyle } from '@/lib/drawio/style';

const raw = 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;customThing=keep me;image=data:image/png,abc==;';

describe('style strings', () => {
  it('reads values, including ones containing "="', () => {
    expect(getStyleValue(raw, 'fillColor')).toBe('#dae8fc');
    expect(getStyleValue(raw, 'image')).toBe('data:image/png,abc==');
    expect(getStyleValue(raw, 'missing')).toBeUndefined();
  });

  it('sets a key in place without disturbing others', () => {
    expect(setStyleValue(raw, 'fillColor', '#ff0000')).toBe(
      'ellipse;whiteSpace=wrap;html=1;fillColor=#ff0000;customThing=keep me;image=data:image/png,abc==;',
    );
  });

  it('appends new keys and removes keys', () => {
    expect(setStyleValue('rounded=1', 'dashed', 1)).toBe('rounded=1;dashed=1');
    expect(setStyleValue(raw, 'html', null)).toBe('ellipse;whiteSpace=wrap;fillColor=#dae8fc;customThing=keep me;image=data:image/png,abc==;');
    expect(setStyleValue(undefined, 'a', 'b')).toBe('a=b;');
  });

  it('converts to a maxGraph CellStyle', () => {
    const s = toCellStyle('ellipse;fontSize=14;autosize=1;customThing=x;') as Record<string, unknown>;
    expect(s).toMatchObject({ baseStyleNames: ['ellipse'], fontSize: 14, autoSize: 1, customThing: 'x' });
  });

  it('merging an unchanged CellStyle returns the original string', () => {
    expect(mergeCellStyle(raw, toCellStyle(raw))).toBe(raw);
  });

  it('merging an edited CellStyle keeps order and unknown keys', () => {
    const s = { ...toCellStyle(raw), fillColor: '#000000', strokeWidth: 2 } as Record<string, unknown>;
    delete s.html;
    expect(mergeCellStyle(raw, s)).toBe(
      'ellipse;whiteSpace=wrap;fillColor=#000000;customThing=keep me;image=data:image/png,abc==;strokeWidth=2;',
    );
  });
});
