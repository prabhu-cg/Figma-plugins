/**
 * Exports the pictures behind image fills. Each picture is read from Figma once, named after its
 * hash (the same picture in many layers is one file), and handed to `send`. Limits keep a file full
 * of photographs from filling memory: a picture over the per-image limit, or one that would pass
 * the total, is left out and the layer says why (IMAGE_OMITTED).
 */
import type { ImageResolution } from './layers';

/** Largest single picture that is exported. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Total picture bytes exported in one run. */
export const MAX_TOTAL_IMAGE_BYTES = 96 * 1024 * 1024;

export const IMAGE_DIR = 'assets/images';

/** File extension from the first bytes, or "bin" when the format is not recognised. */
export function sniffImageExtension(bytes: Uint8Array): string {
  const at = (i: number) => bytes[i] ?? 0;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';
  if (at(0) === 0xff && at(1) === 0xd8) return 'jpg';
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) return 'gif';
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return 'webp';
  }
  return 'bin';
}

interface FigmaImages {
  getImageByHash(hash: string): {
    getBytesAsync(): Promise<Uint8Array>;
    getSizeAsync(): Promise<{ width: number; height: number }>;
  } | null;
}

export function createImageResolver(
  send: (path: string, bytes: Uint8Array) => void,
  api: FigmaImages = figma,
  limits: { perImage?: number; total?: number } = {},
): (hash: string) => Promise<ImageResolution> {
  const perImage = limits.perImage ?? MAX_IMAGE_BYTES;
  const total = limits.total ?? MAX_TOTAL_IMAGE_BYTES;
  const done = new Map<string, Promise<ImageResolution>>();
  let used = 0;

  const load = async (hash: string): Promise<ImageResolution> => {
    try {
      const image = api.getImageByHash(hash);
      if (!image)
        return { omitted: 'Figma has no picture for this fill (it may come from a library).' };
      const bytes = await image.getBytesAsync();
      if (bytes.length > perImage) {
        return {
          omitted: `it is ${(bytes.length / 1048576).toFixed(1)} MB (limit ${(perImage / 1048576).toFixed(0)} MB per picture).`,
        };
      }
      if (used + bytes.length > total) {
        return {
          omitted: `the pictures already exported reached the total limit of ${(total / 1048576).toFixed(0)} MB.`,
        };
      }
      used += bytes.length;
      const file = `${IMAGE_DIR}/${hash}.${sniffImageExtension(bytes)}`;
      send(file, bytes);
      let size: { width: number; height: number } | undefined;
      try {
        size = await image.getSizeAsync();
      } catch {
        size = undefined;
      }
      return size ? { file, width: size.width, height: size.height } : { file };
    } catch (err) {
      return {
        omitted: `it could not be read (${err instanceof Error ? err.message : String(err)}).`,
      };
    }
  };

  return (hash) => {
    let pending = done.get(hash);
    if (!pending) {
      pending = load(hash);
      done.set(hash, pending);
    }
    return pending;
  };
}
