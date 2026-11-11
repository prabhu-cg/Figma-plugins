import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GeneratedFile } from '@shared/messages';

/**
 * The files as a ZIP. Compressed with DEFLATE: JSZip stores files as they are unless told otherwise,
 * and a 35 MB components.json export came out as a 37 MB zip. Text like this shrinks about tenfold.
 */
export async function buildZip(files: GeneratedFile[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  let sinceYield = 0;
  for (const file of files) {
    zip.file(file.path, file.bytes ?? file.content);
    // Hundreds of files: give the UI a turn now and then so it stays responsive.
    if (++sinceYield >= 50) {
      sinceYield = 0;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function downloadAsZip(files: GeneratedFile[], zipFileName: string): Promise<void> {
  const buffer = await buildZip(files);
  saveAs(new Blob([buffer], { type: 'application/zip' }), zipFileName);
}

function mimeTypeFor(path: string): string {
  if (path.endsWith('.json')) return 'application/json;charset=utf-8';
  if (path.endsWith('.md')) return 'text/markdown;charset=utf-8';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'text/plain;charset=utf-8';
}

/** Downloads each generated file individually (used when "Export all as ZIP" is unchecked). */
export function downloadIndividually(files: GeneratedFile[]): void {
  files.forEach((file, index) => {
    // Stagger slightly — firing many saveAs calls in the same tick causes
    // browsers to silently drop all but the first download.
    setTimeout(() => {
      const blob = new Blob([(file.bytes as BlobPart | undefined) ?? file.content], {
        type: mimeTypeFor(file.path),
      });
      saveAs(blob, file.path.replace(/\//g, '__'));
    }, index * 150);
  });
}
