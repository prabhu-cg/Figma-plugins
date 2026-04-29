import { parseTokenName } from '@/plugin/inference/naming-parser';

describe('parseTokenName — separator detection', () => {
  it('detects slash separator', () => {
    const result = parseTokenName('color/primary/500');
    expect(result.separator).toBe('slash');
    expect(result.segments).toEqual(['color', 'primary', '500']);
  });

  it('detects dot separator', () => {
    const result = parseTokenName('color.primary.500');
    expect(result.separator).toBe('dot');
    expect(result.segments).toEqual(['color', 'primary', '500']);
  });

  it('detects space separator', () => {
    const result = parseTokenName('Color Primary 500');
    expect(result.separator).toBe('space');
    expect(result.segments).toEqual(['Color', 'Primary', '500']);
  });

  it('detects camelCase', () => {
    const result = parseTokenName('colorPrimary');
    expect(result.separator).toBe('camelCase');
    expect(result.segments).toHaveLength(2);
  });

  it('detects PascalCase', () => {
    const result = parseTokenName('ColorPrimary');
    expect(result.separator).toBe('PascalCase');
    expect(result.segments).toHaveLength(2);
  });

  it('falls back to unknown for single word', () => {
    const result = parseTokenName('primary');
    expect(result.separator).toBe('unknown');
    expect(result.segments).toEqual(['primary']);
  });
});

describe('parseTokenName — segment mapping', () => {
  it('maps domain, category, and scale from slash token', () => {
    const result = parseTokenName('color/primary/500');
    expect(result.domain).toBe('color');
    expect(result.category).toBe('primary');
    expect(result.scale).toBe('500');
  });

  it('maps domain only for two-segment token', () => {
    const result = parseTokenName('spacing/4');
    expect(result.domain).toBe('spacing');
    expect(result.category).toBe('4');
    expect(result.scale).toBe('');
  });
});

describe('parseTokenName — label humanization', () => {
  it('humanizes multi-segment labels by dropping domain', () => {
    expect(parseTokenName('color/primary/500').label).toBe('Primary 500');
  });

  it('humanizes single-segment label', () => {
    expect(parseTokenName('primary').label).toBe('Primary');
  });

  it('humanizes spacing token', () => {
    expect(parseTokenName('spacing/4').label).toBe('4');
  });

  it('humanizes text/heading/h1', () => {
    expect(parseTokenName('text/heading/h1').label).toBe('Heading H1');
  });
});

describe('parseTokenName — raw passthrough', () => {
  it('preserves the raw token name', () => {
    expect(parseTokenName('color/primary/500').raw).toBe('color/primary/500');
  });
});
