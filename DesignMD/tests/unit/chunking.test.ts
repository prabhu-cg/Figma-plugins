import { describe, expect, it } from 'vitest';
import {
  CHUNK_TOTAL_THRESHOLD,
  ChunkAssembler,
  chunkFile,
  needsChunking,
} from '../../src/shared/chunking';

describe('chunkFile', () => {
  it('splits a file into numbered pieces that join back to the original', () => {
    const content = 'abcdefghij'.repeat(25);
    const chunks = chunkFile({ path: 'a.json', content }, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => [c.part, c.parts])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
    expect(chunks.map((c) => c.data).join('')).toBe(content);
    expect(chunks.every((c) => c.type === 'file-chunk' && c.path === 'a.json')).toBe(true);
  });

  it('sends an empty file as one empty piece', () => {
    expect(chunkFile({ path: 'e.md', content: '' }, 10)).toEqual([
      { type: 'file-chunk', path: 'e.md', part: 0, parts: 1, data: '' },
    ]);
  });

  it('never cuts a surrogate pair in half', () => {
    const content = 'a' + '😀'.repeat(10);
    const chunks = chunkFile({ path: 'e.md', content }, 4);
    for (const c of chunks) {
      const last = c.data.charCodeAt(c.data.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false); // not a lone high surrogate
    }
    expect(chunks.map((c) => c.data).join('')).toBe(content);
  });
});

describe('needsChunking', () => {
  it('only chunks results above the total threshold', () => {
    expect(needsChunking([{ path: 'a', content: 'x' }])).toBe(false);
    const big = 'x'.repeat(CHUNK_TOTAL_THRESHOLD + 1);
    expect(needsChunking([{ path: 'a', content: big }])).toBe(true);
    const half = 'x'.repeat(CHUNK_TOTAL_THRESHOLD / 2 + 1);
    expect(
      needsChunking([
        { path: 'a', content: half },
        { path: 'b', content: half },
      ]),
    ).toBe(true);
  });
});

describe('ChunkAssembler', () => {
  const files = [
    { path: 'one.md', content: 'x'.repeat(250) },
    { path: 'two.json', content: 'héllo 😀 '.repeat(40) },
  ];

  it('rebuilds files in the requested order, even when pieces arrive shuffled', () => {
    const assembler = new ChunkAssembler();
    const chunks = files.flatMap((f) => chunkFile(f, 64)).reverse();
    chunks.forEach((c) => assembler.add(c));
    expect(assembler.take(['two.json', 'one.md'])).toEqual([files[1], files[0]]);
  });

  it('throws for a file that is missing or incomplete', () => {
    const assembler = new ChunkAssembler();
    const chunks = chunkFile(files[0], 64);
    chunks.slice(0, -1).forEach((c) => assembler.add(c));
    expect(() => assembler.take(['one.md'])).toThrow(/one\.md arrived incomplete/);
    expect(() => assembler.take(['nope.md'])).toThrow(/nope\.md arrived incomplete/);
  });

  it('forgets what it returned, and can be reset', () => {
    const assembler = new ChunkAssembler();
    chunkFile(files[0], 64).forEach((c) => assembler.add(c));
    assembler.take(['one.md']);
    expect(() => assembler.take(['one.md'])).toThrow();
    chunkFile(files[0], 64).forEach((c) => assembler.add(c));
    assembler.reset();
    expect(() => assembler.take(['one.md'])).toThrow();
  });
});
