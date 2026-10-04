import { useEffect, useRef, useState } from 'react';
import type { GeneratedFile } from '@shared/messages';
import { copyText } from '../clipboard';
import { buildPreview, byteLength, formatBytes } from '../preview';

interface FilePreviewProps {
  files: GeneratedFile[];
}

type CopyState = 'idle' | 'copied' | 'failed';

export function FilePreview({ files }: FilePreviewProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const selected = files.find((f) => f.path === selectedPath) ?? files[0];
  if (!selected) return null;

  const preview = buildPreview(selected.content);
  const totalBytes = files.reduce((sum, f) => sum + byteLength(f.content), 0);

  const select = (path: string) => {
    setSelectedPath(path);
    setCopyState('idle');
  };

  const handleCopy = async () => {
    const ok = await copyText(selected.content);
    setCopyState(ok ? 'copied' : 'failed');
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Generated files</h2>
      <p className="dmd-section-subtitle">
        {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalBytes)} — pick one to
        preview or copy.
      </p>

      <div className="dmd-file-list">
        {files.map((file) => (
          <button
            type="button"
            key={file.path}
            className={`dmd-file-row${file.path === selected.path ? ' is-selected' : ''}`}
            aria-current={file.path === selected.path ? 'true' : undefined}
            onClick={() => select(file.path)}
          >
            <span className="dmd-file-name">{file.path}</span>
            <span className="dmd-file-size">{formatBytes(byteLength(file.content))}</span>
          </button>
        ))}
      </div>

      <div className="dmd-preview-header">
        <span className="dmd-preview-title">{selected.path}</span>
        <button type="button" className="dmd-text-btn" onClick={handleCopy}>
          Copy
        </button>
        <span className="dmd-copy-status" role="status">
          {copyState === 'copied' && 'Copied'}
          {copyState === 'failed' && 'Copy blocked — select the text instead'}
        </span>
      </div>
      <pre className="dmd-preview" tabIndex={0} aria-label={`Preview of ${selected.path}`}>
        <code>{preview.text}</code>
      </pre>
      {preview.truncated && (
        <p className="dmd-section-subtitle">
          Showing the first {preview.text.split('\n').length} of {preview.totalLines} lines. Copy or
          download for the full file.
        </p>
      )}
    </section>
  );
}
