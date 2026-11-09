/**
 * Large generated outputs are sent from the plugin to the UI in pieces: one huge postMessage can
 * fail or freeze the UI. Small results keep using a single message (see needsChunking).
 */
import type { GeneratedFile } from './messages';

/** Characters per message. Well under the sizes at which structured-clone starts to stall. */
export const CHUNK_CHARS = 512 * 1024;
/** Total characters above which results are chunked instead of sent in one message. */
export const CHUNK_TOTAL_THRESHOLD = 2 * 1024 * 1024;

export interface FileChunk {
  type: 'file-chunk';
  path: string;
  /** 0-based index of this piece. */
  part: number;
  /** How many pieces the file has. */
  parts: number;
  data: string;
}

export function needsChunking(files: readonly GeneratedFile[]): boolean {
  let total = 0;
  for (const f of files) {
    total += f.content.length;
    if (total > CHUNK_TOTAL_THRESHOLD) return true;
  }
  return false;
}

/** Splits one file into pieces, never cutting a surrogate pair in half. */
export function chunkFile(file: GeneratedFile, size = CHUNK_CHARS): FileChunk[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < file.content.length) {
    let end = Math.min(start + size, file.content.length);
    const last = file.content.charCodeAt(end - 1);
    if (end < file.content.length && last >= 0xd800 && last <= 0xdbff) end--;
    pieces.push(file.content.slice(start, end));
    start = end;
  }
  if (pieces.length === 0) pieces.push('');
  return pieces.map((data, part) => ({
    type: 'file-chunk',
    path: file.path,
    part,
    parts: pieces.length,
    data,
  }));
}

/** Puts the pieces back together on the receiving side. */
export class ChunkAssembler {
  private pieces = new Map<string, { parts: number; data: Map<number, string> }>();

  add(chunk: FileChunk): void {
    let entry = this.pieces.get(chunk.path);
    if (!entry || entry.parts !== chunk.parts) {
      entry = { parts: chunk.parts, data: new Map() };
      this.pieces.set(chunk.path, entry);
    }
    entry.data.set(chunk.part, chunk.data);
  }

  /** The files in `order`. Throws when a file is missing or incomplete. Clears what it returns. */
  take(order: readonly string[]): GeneratedFile[] {
    const files = order.map((path) => {
      const entry = this.pieces.get(path);
      if (!entry || entry.data.size !== entry.parts) {
        throw new Error(`The file ${path} arrived incomplete.`);
      }
      let content = '';
      for (let part = 0; part < entry.parts; part++) content += entry.data.get(part) ?? '';
      return { path, content };
    });
    this.pieces.clear();
    return files;
  }

  reset(): void {
    this.pieces.clear();
  }
}
