import { describe, expect, it } from 'vitest';
import { customBackground, paperSizeId, readPageSettings } from '@/lib/graph/pageView';

describe('page settings', () => {
  it('defaults to a visible US Letter page with no custom background', () => {
    expect(readPageSettings({})).toEqual({ visible: true, width: 850, height: 1100, background: null });
    expect(readPageSettings(undefined).visible).toBe(true);
  });

  it('reads page="0", size, scale and background', () => {
    expect(readPageSettings({ page: '0', pageWidth: '827', pageHeight: '1169', pageScale: '2', background: '#ffeecc' })).toEqual({
      visible: false,
      width: 1654,
      height: 2338,
      background: '#ffeecc',
    });
  });

  it('treats white and none as the default background so dark mode stays dark', () => {
    for (const v of ['#FFFFFF', '#fff', 'white', 'none', undefined]) expect(customBackground(v)).toBeNull();
    expect(customBackground('#1e1e1e')).toBe('#1e1e1e');
  });

  it('recognizes paper sizes in either orientation', () => {
    expect(paperSizeId(readPageSettings({ pageWidth: '1169', pageHeight: '827' }))).toBe('a4');
    expect(paperSizeId(readPageSettings({ pageWidth: '850', pageHeight: '1100' }))).toBe('letter');
    expect(paperSizeId(readPageSettings({ pageWidth: '1000', pageHeight: '700' }))).toBe('custom');
  });
});
