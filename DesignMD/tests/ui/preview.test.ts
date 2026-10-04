import { describe, expect, it } from 'vitest';
import { MAX_PREVIEW_LINES, buildPreview, byteLength, formatBytes } from '../../src/ui/preview';

describe('buildPreview', () => {
  it('returns short content untouched', () => {
    expect(buildPreview('a\nb\n')).toEqual({ text: 'a\nb\n', totalLines: 2, truncated: false });
  });

  it('does not count a trailing newline as a line', () => {
    expect(buildPreview('a\n').totalLines).toBe(1);
    expect(buildPreview('a').totalLines).toBe(1);
    expect(buildPreview('').totalLines).toBe(0);
  });

  it('keeps exactly the limit untruncated', () => {
    const content = Array.from({ length: MAX_PREVIEW_LINES }, (_, i) => `l${i}`).join('\n');
    expect(buildPreview(content).truncated).toBe(false);
  });

  it('truncates past the limit and reports the full line count', () => {
    const content = Array.from({ length: 1000 }, (_, i) => `l${i}`).join('\n');
    const preview = buildPreview(content, 10);
    expect(preview.truncated).toBe(true);
    expect(preview.totalLines).toBe(1000);
    expect(preview.text.split('\n')).toHaveLength(10);
    expect(preview.text.endsWith('l9')).toBe(true);
  });
});

describe('formatBytes / byteLength', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('measures UTF-8 bytes, not characters', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('—')).toBe(3);
  });
});
