import { describe, expect, it } from 'vitest';
import { createImageResolver, sniffImageExtension } from '../../src/plugin/extraction/images';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function fakeApi(images: Record<string, Uint8Array>) {
  const reads: string[] = [];
  return {
    reads,
    api: {
      getImageByHash(hash: string) {
        const bytes = images[hash];
        if (!bytes) return null;
        return {
          getBytesAsync: async () => {
            reads.push(hash);
            return bytes;
          },
          getSizeAsync: async () => ({ width: 10, height: 20 }),
        };
      },
    },
  };
}

describe('sniffImageExtension', () => {
  it('names the format from the first bytes', () => {
    expect(sniffImageExtension(PNG)).toBe('png');
    expect(sniffImageExtension(JPG)).toBe('jpg');
    expect(sniffImageExtension(WEBP)).toBe('webp');
    expect(sniffImageExtension(Uint8Array.from([0x47, 0x49, 0x46, 0x38]))).toBe('gif');
    expect(sniffImageExtension(Uint8Array.from([1, 2, 3]))).toBe('bin');
    expect(sniffImageExtension(new Uint8Array())).toBe('bin');
  });
});

describe('createImageResolver', () => {
  it('sends each picture once, named after its hash, however often it is asked for', async () => {
    const sent: string[] = [];
    const { api, reads } = fakeApi({ a: PNG });
    const resolve = createImageResolver((path) => sent.push(path), api);
    const [one, two] = await Promise.all([resolve('a'), resolve('a')]);
    expect(one).toEqual({ file: 'assets/images/a.png', width: 10, height: 20 });
    expect(two).toBe(one);
    expect(sent).toEqual(['assets/images/a.png']);
    expect(reads).toEqual(['a']);
  });

  it('leaves out a picture Figma does not have', async () => {
    const resolve = createImageResolver(() => {}, fakeApi({}).api);
    expect(await resolve('missing')).toMatchObject({ omitted: expect.stringContaining('library') });
  });

  it('leaves out a picture over the per-image limit, and stops at the total limit', async () => {
    const sent: string[] = [];
    const { api } = fakeApi({ big: new Uint8Array(100), p1: PNG, p2: PNG });
    const resolve = createImageResolver((p) => sent.push(p), api, { perImage: 50, total: 10 });
    expect(await resolve('big')).toHaveProperty('omitted');
    expect(await resolve('p1')).toHaveProperty('file');
    expect(await resolve('p2')).toHaveProperty('omitted');
    expect(sent).toEqual(['assets/images/p1.png']);
  });

  it('reports a read that throws instead of failing the run', async () => {
    const resolve = createImageResolver(() => {}, {
      getImageByHash: () => ({
        getBytesAsync: async () => {
          throw new Error('boom');
        },
        getSizeAsync: async () => ({ width: 1, height: 1 }),
      }),
    });
    expect(await resolve('x')).toMatchObject({ omitted: expect.stringContaining('boom') });
  });
});
