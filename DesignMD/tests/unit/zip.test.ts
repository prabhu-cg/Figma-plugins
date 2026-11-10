import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildZip } from '../../src/ui/zip';

describe('buildZip', () => {
  const json = JSON.stringify(
    Array.from({ length: 2000 }, (_, i) => ({
      id: `1:${i}`,
      name: 'Label',
      type: 'TEXT',
      visible: true,
    })),
    null,
    2,
  );

  it('compresses the files instead of just storing them', async () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `components/C${i}.json`,
      content: json,
    }));
    const raw = files.reduce((n, f) => n + f.content.length, 0);
    const buffer = await buildZip(files);
    expect(buffer.byteLength).toBeLessThan(raw / 5);
  });

  it('round-trips every file exactly, including non-ASCII text', async () => {
    const files = [
      { path: 'design.md', content: '# Titel ✓ héllo 😀\n' },
      { path: 'components/A.json', content: json },
      { path: 'empty.md', content: '' },
    ];
    const zip = await JSZip.loadAsync(await buildZip(files));
    for (const f of files) expect(await zip.file(f.path)!.async('string')).toBe(f.content);
  });
});
