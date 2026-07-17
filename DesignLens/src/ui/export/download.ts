export function downloadFile(content: string | Blob, fileName: string, mimeType?: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType ?? "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileBase(fileName: string): string {
  return fileName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "designlens-report";
}
