/** Preview helpers kept free of React so they are trivially testable. */

export const MAX_PREVIEW_LINES = 300;

export interface Preview {
  text: string;
  totalLines: number;
  truncated: boolean;
}

/** The first `maxLines` lines of a file, with enough info to tell the user the rest is hidden. */
export function buildPreview(content: string, maxLines = MAX_PREVIEW_LINES): Preview {
  const lines = content.split('\n');
  // A trailing newline is not a line of its own.
  const totalLines = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
  if (totalLines <= maxLines) return { text: content, totalLines, truncated: false };
  return { text: lines.slice(0, maxLines).join('\n'), totalLines, truncated: true };
}

/** UTF-8 size in a short human form: "812 B", "4.2 KB", "1.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
