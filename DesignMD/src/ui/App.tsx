import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions, type GeneratedFile } from '@shared/messages';
import type { ContrastPairSpec, DesignSystem, ExtractionScope } from '@shared/types';
import { Header } from './components/Header';
import { SummaryPanel } from './components/SummaryPanel';
import { PageFilter } from './components/PageFilter';
import { FilePreview } from './components/FilePreview';
import { ScopeToggle } from './components/ScopeToggle';
import { ContrastPairs } from './components/ContrastPairs';
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
  'cssFile',
  'scssFile',
  'tailwindPreset',
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
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set());
  const [baseName, setBaseName] = useState('designmd-export');
  const [error, setError] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [scope, setScope] = useState<ExtractionScope>('file');
  const [selectionCount, setSelectionCount] = useState(0);
  const [contrastPairs, setContrastPairs] = useState<ContrastPairSpec[]>([]);
  // Excluded pages remembered for this file, including pages not in the current scan.
  const savedExcludedPages = useRef<string[]>([]);

  // Tell the plugin the UI is listening so it can send the selection and saved settings.
  useEffect(() => {
    postToPlugin({ type: 'ready' });
  }, []);

  usePluginMessages((message) => {
    switch (message.type) {
      case 'selection':
        setSelectionCount(message.count);
        // An emptied selection can no longer be scanned; fall back to the whole file.
        if (message.count === 0) setScope('file');
        break;
      case 'settings':
        if (message.settings) setOptions(message.settings.options);
        savedExcludedPages.current = message.fileSettings.excludedPages;
        setContrastPairs(message.fileSettings.contrastPairs);
        break;
      case 'progress':
        setProgress({ stage: message.stage, percent: message.percent });
        break;
      case 'extraction-complete':
        setDesignSystem(message.designSystem);
        // Restore this file's excluded pages, keeping only pages that exist in this scan.
        setExcludedPages(
          new Set(
            savedExcludedPages.current.filter((name) =>
              message.designSystem.components.some((c) => c.pageName === name),
            ),
          ),
        );
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
    setOutdated(false);
    setProgress({ stage: 'variables', percent: 0 });
    postToPlugin({ type: 'extract', scope });
  }, [scope]);

  // Outputs were generated from the previous settings; changing them invalidates the result.
  const invalidateGenerated = useCallback(() => {
    if (!files) return;
    setStatus((current) => (current === 'done' ? 'ready' : current));
    setFiles(null);
    setOutdated(true);
  }, [files]);

  const handleOptionsChange = useCallback(
    (next: ExportOptions) => {
      setOptions(next);
      postToPlugin({ type: 'save-settings', settings: { options: next } });
      // `zip` only affects how files are downloaded, not what is generated.
      if (SELECTABLE_KEYS.some((key) => next[key] !== options[key])) invalidateGenerated();
    },
    [invalidateGenerated, options],
  );

  const saveFileSettings = useCallback(
    (excluded: Set<string>, pairs: ContrastPairSpec[]) => {
      // Keep remembered exclusions for pages that aren't part of the current scan.
      const scanned = new Set(designSystem?.components.map((c) => c.pageName));
      const excludedPages = [
        ...savedExcludedPages.current.filter((name) => !scanned.has(name)),
        ...excluded,
      ];
      savedExcludedPages.current = excludedPages;
      postToPlugin({
        type: 'save-file-settings',
        fileSettings: { excludedPages, contrastPairs: pairs },
      });
    },
    [designSystem],
  );

  const handleExcludedPagesChange = useCallback(
    (next: Set<string>) => {
      setExcludedPages(next);
      saveFileSettings(next, contrastPairs);
      invalidateGenerated();
    },
    [invalidateGenerated, saveFileSettings, contrastPairs],
  );

  const handleContrastPairsChange = useCallback(
    (next: ContrastPairSpec[]) => {
      setContrastPairs(next);
      saveFileSettings(excludedPages, next);
      invalidateGenerated();
    },
    [invalidateGenerated, saveFileSettings, excludedPages],
  );

  const handleGenerate = useCallback(() => {
    setError(null);
    setStatus('generating');
    setOutdated(false);
    postToPlugin({
      type: 'generate',
      options,
      excludedPages: Array.from(excludedPages),
      contrastPairs,
    });
  }, [options, excludedPages, contrastPairs]);

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

        {status !== 'extracting' && (
          <ScopeToggle
            scope={scope}
            onChange={setScope}
            selectionCount={selectionCount}
            disabled={status === 'generating'}
            scannedScope={designSystem?.metadata.scope ?? null}
          />
        )}

        {status === 'extracting' && progress && (
          <ProgressBar stage={progress.stage} percent={progress.percent} />
        )}

        {status === 'done' && files && <FilePreview files={files} />}

        {designSystem && status !== 'extracting' && (
          <>
            <SummaryPanel summary={designSystem.summary} />
            <WarningsList warnings={designSystem.warnings} />
            <PageFilter
              components={designSystem.components}
              excludedPages={excludedPages}
              onChange={handleExcludedPagesChange}
            />
            <ContrastPairs
              designSystem={designSystem}
              pairs={contrastPairs}
              onChange={handleContrastPairsChange}
            />
            <ExportSettings baseName={baseName} onBaseNameChange={setBaseName} />
            <OutputSelection options={options} onChange={handleOptionsChange} />
          </>
        )}
      </div>

      <footer className="dmd-footer">
        {status === 'idle' && (
          <button className="dmd-btn dmd-btn-primary dmd-btn-full" onClick={handleScan}>
            {scope === 'selection' ? 'Scan Selection' : 'Scan Design System'}
          </button>
        )}

        {status === 'extracting' && (
          <button className="dmd-btn dmd-btn-primary dmd-btn-full" disabled>
            Scanning…
          </button>
        )}

        {(status === 'ready' || status === 'generating') && (
          <>
            <div className={`dmd-footer-status${outdated ? ' is-outdated' : ''}`} role="status">
              {outdated
                ? 'Settings changed — generate again to refresh your files'
                : `${selectedCount} output${selectedCount === 1 ? '' : 's'} selected`}
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
