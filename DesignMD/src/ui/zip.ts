import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GeneratedFile } from '@shared/messages';

export async function downloadAsZip(files: GeneratedFile[], zipFileName: string): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, zipFileName);
}

function mimeTypeFor(path: string): string {
  if (path.endsWith('.json')) return 'application/json;charset=utf-8';
  if (path.endsWith('.md')) return 'text/markdown;charset=utf-8';
  return 'text/plain;charset=utf-8';
}

/** Downloads each generated file individually (used when "Export all as ZIP" is unchecked). */
export function downloadIndividually(files: GeneratedFile[]): void {
  files.forEach((file, index) => {
    // Stagger slightly — firing many saveAs calls in the same tick causes
    // browsers to silently drop all but the first download.
    setTimeout(() => {
      const blob = new Blob([file.content], { type: mimeTypeFor(file.path) });
      saveAs(blob, file.path.replace(/\//g, '__'));
    }, index * 150);
  });
}
