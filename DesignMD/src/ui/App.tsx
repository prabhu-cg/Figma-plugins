import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type GeneratedFile,
  type OutputFailure,
} from '@shared/messages';
import type { ContrastPairSpec, DesignSystem, ExtractionScope } from '@shared/types';
import { Header } from './components/Header';
import { SummaryPanel } from './components/SummaryPanel';
import { PageFilter } from './components/PageFilter';
import { FilePreview } from './components/FilePreview';
import { ScopeToggle } from './components/ScopeToggle';
import { ContrastPairs } from './components/ContrastPairs';
import { Tabs, panelId, tabId, type TabItem } from './components/Tabs';
import { listColorTokenNames } from '../plugin/generators/contrast';
import { ExportSettings } from './components/ExportSettings';
import { OutputSelection } from './components/OutputSelection';
import { GenerateButton } from './components/GenerateButton';
import { DownloadButton } from './components/DownloadButton';
import { ProgressBar } from './components/ProgressBar';
import { ErrorBanner } from './components/ErrorBanner';
import { WarningsList } from './components/WarningsList';
import { postToPlugin, usePluginMessages } from './hooks/usePluginBridge';
import { ChunkAssembler } from '@shared/chunking';
import { GenerationRun, planRun } from './generationRun';
import { downloadAsZip, downloadIndividually } from './zip';

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done';
type TabId = 'summary' | 'contrast' | 'export' | 'files';

const TAB_PREFIX = 'dmd';

/** The options that each produce a file; the footer counts how many are on. */
const OUTPUT_KEYS: Array<keyof Omit<ExportOptions, 'zip'>> = [
  'designMd',
  'componentDocs',
  'tokensJson',
  'cssFile',
  'componentsJson',
];

/** Every option that changes what gets generated (the outputs plus components.json's sub-options). */
const GENERATION_KEYS: Array<keyof Omit<ExportOptions, 'zip'>> = [
  ...OUTPUT_KEYS,
  'includeText',
  'includeVariantDiffs',
];

function countSelectedOutputs(options: ExportOptions): number {
  return OUTPUT_KEYS.filter((key) => options[key]).length;
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<{
    stage: string;
    percent: number;
    done?: number;
    total?: number;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Pieces of a large result, put back together when generation-complete arrives.
  const assembler = useRef(new ChunkAssembler());
  // The Generate press in progress: waits for the plugin's files and the component layers.
  const run = useRef<GenerationRun | null>(null);
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [failures, setFailures] = useState<OutputFailure[]>([]);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set());
  const [baseName, setBaseName] = useState('designmd-export');
  const [error, setError] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [scope, setScope] = useState<ExtractionScope>('file');
  const [selectionCount, setSelectionCount] = useState(0);
  const [contrastPairs, setContrastPairs] = useState<ContrastPairSpec[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  // Excluded pages remembered for this file, including pages not in the current scan.
  const savedExcludedPages = useRef<string[]>([]);

  // Tell the plugin the UI is listening so it can send the selection and saved settings.
  useEffect(() => {
    postToPlugin({ type: 'ready' });
  }, []);

  const finishRun = useCallback(() => {
    const current = run.current;
    run.current = null;
    if (!current) return;
    try {
      const result = current.finish();
      setFiles(result.files);
      setFailures(result.failures);
      setStatus('done');
      setActiveTab('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('ready');
    }
    setProgress(null);
    setCancelling(false);
  }, []);

  const completeIfReady = () => {
    const current = run.current;
    if (!current || !current.isReady()) return;
    if (!current.buildsComponentsJson) {
      finishRun();
      return;
    }
    // Building components.json takes a moment; show that before the work starts.
    setProgress({ stage: 'assemble', percent: 100 });
    setTimeout(finishRun, 0);
  };

  const abortRun = (message: string) => {
    run.current = null;
    assembler.current.reset();
    setError(message);
    setStatus(designSystem ? 'ready' : 'idle');
    setProgress(null);
    setCancelling(false);
  };

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
        setProgress({
          stage: message.stage,
          percent: message.percent,
          done: message.done,
          total: message.total,
        });
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
        setActiveTab('summary');
        setProgress(null);
        setCancelling(false);
        if (!baseNameWasCustomized(baseName)) {
          setBaseName(slugify(message.designSystem.metadata.fileName) || 'designmd-export');
        }
        break;
      case 'file-chunk':
        assembler.current.add(message);
        break;
      case 'generation-complete': {
        let received = message.files;
        try {
          if (message.chunked) received = assembler.current.take(message.chunked);
        } catch (err) {
          abortRun(err instanceof Error ? err.message : String(err));
          break;
        }
        // A result nobody asked for (no Generate pressed here) is treated as a plugin-only run.
        run.current ??= new GenerationRun(
          { needPlugin: true, needStructures: false },
          designSystem ?? ({ components: [] } as unknown as DesignSystem),
          [],
          options,
        );
        run.current.addPluginResult(received, message.failures ?? []);
        completeIfReady();
        break;
      }
      case 'structures':
        run.current?.addStructures(message.items);
        break;
      case 'structures-complete':
        run.current?.structuresDone(message.cancelled);
        completeIfReady();
        break;
      case 'error':
        abortRun(message.message);
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
    setFailures([]);
    setOutdated(true);
    setActiveTab((current) => (current === 'files' ? 'export' : current));
  }, [files]);

  const handleOptionsChange = useCallback(
    (next: ExportOptions) => {
      setOptions(next);
      postToPlugin({ type: 'save-settings', settings: { options: next } });
      // `zip` only affects how files are downloaded, not what is generated.
      if (GENERATION_KEYS.some((key) => next[key] !== options[key])) invalidateGenerated();
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

  const handleCancel = useCallback(() => {
    setCancelling(true);
    postToPlugin({ type: 'cancel' });
  }, []);

  const handleGenerate = useCallback(() => {
    setError(null);
    assembler.current.reset();
    setStatus('generating');
    setOutdated(false);
    const pages = Array.from(excludedPages);
    const plan = planRun(options);
    if (!designSystem) return;
    run.current = new GenerationRun(plan, designSystem, pages, options);
    if (plan.needPlugin) {
      postToPlugin({ type: 'generate', options, excludedPages: pages, contrastPairs });
    }
    if (plan.needStructures) {
      postToPlugin({
        type: 'read-structures',
        excludedPages: pages,
        includeText: options.includeText,
        includeVariantDiffs: options.includeVariantDiffs,
      });
    }
  }, [options, excludedPages, contrastPairs, designSystem]);

  const handleDownload = useCallback(async () => {
    if (!files) return;
    if (options.zip) {
      await downloadAsZip(files, `${baseName || 'designmd-export'}.zip`);
    } else {
      downloadIndividually(files);
    }
  }, [files, options.zip, baseName]);

  const selectedCount = countSelectedOutputs(options);

  const showTabs = designSystem !== null && status !== 'extracting';
  const hasContrastTab = designSystem !== null && listColorTokenNames(designSystem).length >= 2;
  const tabs: TabItem[] = [
    { id: 'summary', label: 'Summary' },
    ...(hasContrastTab ? [{ id: 'contrast', label: 'Contrast', badge: contrastPairs.length }] : []),
    { id: 'export', label: 'Export' },
    ...(files ? [{ id: 'files', label: 'Files', badge: files.length }] : []),
  ];
  // A tab can disappear (no files yet, too few colors); fall back to one that exists.
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : 'summary';

  const scopeToggle = (
    <ScopeToggle
      scope={scope}
      onChange={setScope}
      selectionCount={selectionCount}
      disabled={status === 'generating'}
      scannedScope={designSystem?.metadata.scope ?? null}
    />
  );

  return (
    <div className="dmd-app">
      <Header
        onRescan={handleScan}
        rescanDisabled={status === 'extracting' || status === 'generating'}
        showRescan={status !== 'idle' && status !== 'extracting'}
      />

      {designSystem && status !== 'extracting' && (
        <Tabs
          tabs={tabs}
          activeId={currentTab}
          onChange={(id) => setActiveTab(id as TabId)}
          idPrefix={TAB_PREFIX}
          label="Sections"
        />
      )}

      <div
        className="dmd-content"
        role={showTabs ? 'tabpanel' : undefined}
        id={showTabs ? panelId(TAB_PREFIX, currentTab) : undefined}
        aria-labelledby={showTabs ? tabId(TAB_PREFIX, currentTab) : undefined}
      >
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {status === 'idle' && (
          <div className="dmd-empty-state">
            <p>
              Scan this file&apos;s variables, styles, and components to generate developer-ready
              documentation.
            </p>
          </div>
        )}

        {status === 'idle' && scopeToggle}

        {(status === 'extracting' || status === 'generating') && progress && (
          <ProgressBar
            stage={progress.stage}
            percent={progress.percent}
            done={progress.done}
            total={progress.total}
          />
        )}

        {showTabs && designSystem && currentTab === 'summary' && (
          <>
            {scopeToggle}
            <SummaryPanel summary={designSystem.summary} />
            <WarningsList warnings={designSystem.warnings} />
            <PageFilter
              components={designSystem.components}
              excludedPages={excludedPages}
              onChange={handleExcludedPagesChange}
            />
          </>
        )}

        {showTabs && designSystem && currentTab === 'contrast' && (
          <ContrastPairs
            designSystem={designSystem}
            pairs={contrastPairs}
            onChange={handleContrastPairsChange}
          />
        )}

        {showTabs && currentTab === 'export' && (
          <>
            <ExportSettings baseName={baseName} onBaseNameChange={setBaseName} />
            <OutputSelection options={options} onChange={handleOptionsChange} />
          </>
        )}

        {showTabs && currentTab === 'files' && files && (
          <>
            {failures.length > 0 && (
              <div className="dmd-failures" role="alert">
                <strong>
                  {failures.length} output{failures.length === 1 ? '' : 's'} could not be generated
                </strong>
                <ul>
                  {failures.map((f) => (
                    <li key={f.output}>
                      {f.output}: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <FilePreview files={files} />
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
          <>
            <button
              className="dmd-btn dmd-btn-secondary dmd-btn-full"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
            <button className="dmd-btn dmd-btn-primary dmd-btn-full" disabled>
              Scanning…
            </button>
          </>
        )}

        {(status === 'ready' || status === 'generating') && (
          <>
            <div className={`dmd-footer-status${outdated ? ' is-outdated' : ''}`} role="status">
              {outdated
                ? 'Settings changed — generate again to refresh your files'
                : `${selectedCount} output${selectedCount === 1 ? '' : 's'} selected`}
            </div>
            {status === 'generating' && (
              <button
                className="dmd-btn dmd-btn-secondary dmd-btn-full"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            )}
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
