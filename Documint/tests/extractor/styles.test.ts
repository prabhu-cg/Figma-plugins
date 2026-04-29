import { extractColorStyles, extractTextStyles, extractEffectStyles, extractGridStyles } from '@/plugin/extractor/styles';

describe('extractColorStyles', () => {
  it('returns empty array when figma has no paint styles', () => {
    (global as any).figma.getLocalPaintStyles.mockReturnValue([]);
    expect(extractColorStyles()).toEqual([]);
  });

  it('maps each paint style to a RawColorStyle with id, name, and paints', () => {
    (global as any).figma.getLocalPaintStyles.mockReturnValue([
      {
        id: 'style-1',
        name: 'color/primary/500',
        paints: [{ type: 'SOLID', color: { r: 0.23, g: 0.51, b: 0.96 } }],
      },
    ]);
    const result = extractColorStyles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('style-1');
    expect(result[0].name).toBe('color/primary/500');
    expect((result[0].paints as any)[0].type).toBe('SOLID');
  });
});

describe('extractTextStyles', () => {
  it('returns empty array when figma has no text styles', () => {
    (global as any).figma.getLocalTextStyles.mockReturnValue([]);
    expect(extractTextStyles()).toEqual([]);
  });

  it('maps each text style preserving all properties', () => {
    (global as any).figma.getLocalTextStyles.mockReturnValue([
      {
        id: 'text-1',
        name: 'text/heading/h1',
        fontName: { family: 'Inter', style: 'Bold' },
        fontSize: 32,
        lineHeight: { value: 40, unit: 'PIXELS' },
        letterSpacing: { value: -0.5, unit: 'PIXELS' },
        textCase: 'NONE',
        textDecoration: 'NONE',
      },
    ]);
    const result = extractTextStyles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('text-1');
    expect(result[0].fontSize).toBe(32);
    expect((result[0].fontName as any).family).toBe('Inter');
    expect((result[0].lineHeight as any).unit).toBe('PIXELS');
  });
});

describe('extractEffectStyles', () => {
  it('returns empty array when figma has no effect styles', () => {
    (global as any).figma.getLocalEffectStyles.mockReturnValue([]);
    expect(extractEffectStyles()).toEqual([]);
  });

  it('maps effect style id and name', () => {
    (global as any).figma.getLocalEffectStyles.mockReturnValue([
      { id: 'eff-1', name: 'shadow/sm', effects: [] },
    ]);
    const result = extractEffectStyles();
    expect(result[0].id).toBe('eff-1');
  });
});

describe('extractGridStyles', () => {
  it('returns empty array when figma has no grid styles', () => {
    (global as any).figma.getLocalGridStyles.mockReturnValue([]);
    expect(extractGridStyles()).toEqual([]);
  });

  it('maps grid style id and grids array', () => {
    (global as any).figma.getLocalGridStyles.mockReturnValue([
      { id: 'grid-1', name: 'grid/desktop', grids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16 }] },
    ]);
    const result = extractGridStyles();
    expect(result[0].id).toBe('grid-1');
    expect((result[0].grids as any)[0].count).toBe(12);
  });
});
