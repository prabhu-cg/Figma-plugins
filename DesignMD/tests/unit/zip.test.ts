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

  it('stores a binary file by its bytes, unchanged', async () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 128, 7]);
    const zip = await JSZip.loadAsync(
      await buildZip([{ path: 'assets/images/a.png', content: '', bytes }]),
    );
    expect(Array.from(await zip.file('assets/images/a.png')!.async('uint8array'))).toEqual(
      Array.from(bytes),
    );
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
