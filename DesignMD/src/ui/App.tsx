import { useCallback, useState } from 'react';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions, type GeneratedFile } from '@shared/messages';
import type { DesignSystem } from '@shared/types';
import { Header } from './components/Header';
import { SummaryPanel } from './components/SummaryPanel';
import { ExportSettings } from './components/ExportSettings';
import { OutputSelection } from './components/OutputSelection';
import { GenerateButton } from './components/GenerateButton';
import { DownloadButton } from './components/DownloadButton';
import { ProgressBar } from './components/ProgressBar';
import { ErrorBanner } from './components/ErrorBanner';
import { WarningsList } from './components/WarningsList';
import { postToPlugin, usePluginMessages } from './hooks/usePluginBridge';
import { downloadAsZip, downloadIndividually } from './zip';

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done';

const SELECTABLE_KEYS: Array<keyof Omit<ExportOptions, 'zip'>> = [
  'designMd',
  'componentDocs',
  'tokensJson',
  'cssTokensJson',
];

function countSelectedOutputs(options: ExportOptions): number {
  return SELECTABLE_KEYS.filter((key) => options[key]).length;
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [baseName, setBaseName] = useState('designmd-export');
  const [error, setError] = useState<string | null>(null);

  usePluginMessages((message) => {
    switch (message.type) {
      case 'progress':
        setProgress({ stage: message.stage, percent: message.percent });
        break;
      case 'extraction-complete':
        setDesignSystem(message.designSystem);
        setStatus('ready');
        setProgress(null);
        if (!baseNameWasCustomized(baseName)) {
          setBaseName(slugify(message.designSystem.metadata.fileName) || 'designmd-export');
        }
        break;
      case 'generation-complete':
        setFiles(message.files);
        setStatus('done');
        break;
      case 'error':
        setError(message.message);
        setStatus(designSystem ? 'ready' : 'idle');
        setProgress(null);
        break;
    }
  });

  const handleScan = useCallback(() => {
    setError(null);
    setStatus('extracting');
    setProgress({ stage: 'variables', percent: 0 });
    postToPlugin({ type: 'extract' });
  }, []);

  const handleGenerate = useCallback(() => {
    setError(null);
    setStatus('generating');
    postToPlugin({ type: 'generate', options });
  }, [options]);

  const handleDownload = useCallback(async () => {
    if (!files) return;
    if (options.zip) {
      await downloadAsZip(files, `${baseName || 'designmd-export'}.zip`);
    } else {
      downloadIndividually(files);
    }
  }, [files, options.zip, baseName]);

  const selectedCount = countSelectedOutputs(options);

  return (
    <div className="dmd-app">
      <Header
        onRescan={handleScan}
        rescanDisabled={status === 'extracting' || status === 'generating'}
        showRescan={status !== 'idle' && status !== 'extracting'}
      />

      <div className="dmd-content">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {status === 'idle' && (
          <div className="dmd-empty-state">
            <p>
              Scan this file&apos;s variables, styles, and components to generate developer-ready
              documentation.
            </p>
          </div>
        )}

        {status === 'extracting' && progress && (
          <ProgressBar stage={progress.stage} percent={progress.percent} />
        )}

        {designSystem && status !== 'extracting' && (
          <>
            <SummaryPanel summary={designSystem.summary} />
            <WarningsList warnings={designSystem.warnings} />
            <ExportSettings baseName={baseName} onBaseNameChange={setBaseName} />
            <OutputSelection options={options} onChange={setOptions} />
          </>
        )}
      </div>

      <footer className="dmd-footer">
        {status === 'idle' && (
          <button className="dmd-btn dmd-btn-primary dmd-btn-full" onClick={handleScan}>
            Scan Design System
          </button>
        )}

        {status === 'extracting' && (
          <button className="dmd-btn dmd-btn-primary dmd-btn-full" disabled>
            Scanning…
          </button>
        )}

        {(status === 'ready' || status === 'generating') && (
          <>
            <div className="dmd-footer-status">
              {selectedCount} output{selectedCount === 1 ? '' : 's'} selected
            </div>
            <GenerateButton
              onClick={handleGenerate}
              disabled={status === 'generating' || selectedCount === 0}
              busy={status === 'generating'}
            />
          </>
        )}

        {status === 'done' && files && (
          <>
            <div className="dmd-footer-status">
              {files.length} file{files.length === 1 ? '' : 's'} ready
            </div>
            <DownloadButton onClick={handleDownload} fileCount={files.length} />
          </>
        )}
      </footer>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function baseNameWasCustomized(current: string): boolean {
  return current !== '' && current !== 'designmd-export';
}
