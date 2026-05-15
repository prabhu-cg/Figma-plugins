import React from 'react';
import ReactDOM from 'react-dom/client';
import type { GenerationOptions, PluginToUiMessage, UiToPluginMessage, ProgressStep } from '@/types/messages';
import type { GenerationResult } from '@/types/messages';
import type { DetectedPages } from '@/plugin/filter/page-detection';
import { IdleScreen } from './components/IdleScreen';
import { EmptyStateScreen } from './components/EmptyStateScreen';
import { ErrorScreen } from './components/ErrorScreen';
import {
  containerStyle,
  headerStyle,
  headerTitleStyle,
  headerIntroStyle,
  colors,
} from './styles';

function downloadFile(result: GenerationResult, selectedNames?: string[]) {
  const { exports: exp } = result;

  console.log('downloadFile - exports received:', Object.keys(exp));
  console.log('downloadFile - export contents:', {
    hasMarkdown: !!exp.markdown,
    hasFigmaPageId: !!exp.figmaPageId,
  });

  // Generate filename from selected component name or use default
  let baseFileName = selectedNames && selectedNames.length > 0
    ? selectedNames[0]
    : 'design-system';

  // Convert to uppercase for full-system exports
  if (baseFileName === 'fulldesign') {
    baseFileName = 'FULLDESIGN';
  }

  // Download markdown if available
  if (exp.markdown) {
    triggerDownload(exp.markdown, `${baseFileName}.md`, 'text/markdown');
  }

  // Navigate to Figma page if available
  if (exp.figmaPageId) {
    parent.postMessage({
      pluginMessage: {
        type: 'NAVIGATE_TO_PAGE',
        pageId: exp.figmaPageId
      }
    }, '*');
  }
}

function triggerDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  // Delay removal and revocation to ensure download starts
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

type AppPhase = 'idle' | 'generating' | 'complete' | 'error';

interface IdleState {
  phase: 'idle';
  selectionCount: number;
  detectedPages?: DetectedPages;
  selectedPages: Set<string>;
}

interface GeneratingState {
  phase: 'generating';
  selectionCount: number;
  step: ProgressStep;
  percent: number;
  selectedPages: Set<string>;
}

interface ErrorState {
  phase: 'error';
  message: string;
  selectedPages: Set<string>;
}

type AppState = IdleState | GeneratingState | ErrorState;

function App() {
  const [state, setState] = React.useState<AppState>({ phase: 'idle', selectionCount: 0, selectedPages: new Set() });
  const [options, setOptions] = React.useState<GenerationOptions>({
    exportMarkdown: false,
    exportFigmaPage: false,
    markdownMode: 'selected',
  });
  const lastSelectionRef = React.useRef(0);
  const selectedNamesRef = React.useRef<string[]>([]);
  const cancelledRef = React.useRef(false);

  React.useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'READY' } }, '*');

    window.onmessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as PluginToUiMessage | undefined;
      if (!msg) return;

      switch (msg.type) {
        case 'SELECTION_CHANGED': {
          lastSelectionRef.current = msg.count;
          if (msg.selectedNames) {
            selectedNamesRef.current = msg.selectedNames;
          }
          setState((prev) => {
            if (prev.phase === 'idle') {
              return { ...prev, selectionCount: msg.count };
            }
            if (prev.phase === 'generating') {
              return { ...prev, selectionCount: msg.count };
            }
            return prev;
          });
          break;
        }

        case 'PAGES_DETECTED': {
          console.log('UI: Received PAGES_DETECTED:', msg.detectedPages);
          setState((prev) => {
            if (prev.phase === 'idle') {
              // Pre-select everything except examples — user can deselect what they don't want
              const defaultSelected = new Set([
                ...msg.detectedPages.foundations,
                ...msg.detectedPages.core,
                ...msg.detectedPages.icons,
                ...msg.detectedPages.other,
              ]);
              console.log('UI: Default selected pages:', Array.from(defaultSelected));
              return { ...prev, detectedPages: msg.detectedPages, selectedPages: defaultSelected };
            }
            return prev;
          });
          break;
        }

        case 'PROGRESS': {
          // Ignore progress updates after the user cancels
          if (cancelledRef.current) break;
          setState((prev) => ({
            phase: 'generating',
            selectionCount: lastSelectionRef.current,
            step: msg.step,
            percent: msg.percent,
            selectedPages: prev.selectedPages,
            detectedPages: (prev as any).detectedPages,
          }));
          break;
        }

        case 'COMPLETE': {
          // If the user cancelled, swallow the result
          if (cancelledRef.current) {
            cancelledRef.current = false;
            break;
          }
          if (msg.selectedNames) {
            selectedNamesRef.current = msg.selectedNames;
          }
          downloadFile(msg.result, selectedNamesRef.current);
          // Reset immediately — no delay, file is already downloaded
          setState((prev) => ({
            phase: 'idle',
            selectionCount: lastSelectionRef.current,
            selectedPages: prev.selectedPages,
            detectedPages: (prev as any).detectedPages,
          }));
          setOptions((prev) => ({
            exportMarkdown: false,
            exportFigmaPage: false,
            markdownMode: prev.markdownMode,
          }));
          break;
        }

        case 'ERROR': {
          setState((prev) => ({ phase: 'error', message: msg.message, selectedPages: prev.selectedPages }));
          break;
        }
      }
    };
  }, []);

  const sendMessage = (msg: UiToPluginMessage) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const handleGenerate = () => {
    // Immediately show generating state for better UX feedback
    const selectedPages = state.phase === 'idle' ? Array.from(state.selectedPages) : [];
    const optionsToSend: GenerationOptions = {
      ...options,
      ...(options.markdownMode === 'full-system' && { selectedPages }),
    };

    setState((prev) => ({
      ...prev,
      phase: 'generating',
      selectionCount: prev.phase === 'idle' ? prev.selectionCount : 0,
      step: 'EXTRACTING_STYLES' as ProgressStep,
      percent: 0,
    }));
    sendMessage({ type: 'GENERATE', options: optionsToSend });
  };

  const handleReset = () => {
    setState((prev) => ({
      phase: 'idle',
      selectionCount: lastSelectionRef.current,
      selectedPages: prev.selectedPages,
      detectedPages: (prev as any).detectedPages,
    }));
    setOptions((prev) => ({
      exportMarkdown: false,
      exportFigmaPage: false,
      markdownMode: prev.markdownMode,
    }));
  };

  const handlePageToggle = (pageName: string) => {
    setState((prev) => {
      if (prev.phase === 'idle') {
        const newSelected = new Set(prev.selectedPages);
        if (newSelected.has(pageName)) {
          newSelected.delete(pageName);
        } else {
          newSelected.add(pageName);
        }
        return { ...prev, selectedPages: newSelected };
      }
      return prev;
    });
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    sendMessage({ type: 'CANCEL' });
    setState((prev) => ({
      phase: 'idle',
      selectionCount: lastSelectionRef.current,
      selectedPages: prev.selectedPages,
      detectedPages: (prev as any).detectedPages,
    }));
  };

  const handleSetSelectedPages = (pages: Set<string>) => {
    setState((prev) => {
      if (prev.phase === 'idle') {
        return { ...prev, selectedPages: pages };
      }
      return prev;
    });
  };

  const selectionCount = state.phase === 'idle' ? state.selectionCount : state.phase === 'generating' ? state.selectionCount : 0;

  return (
    <div style={{
      ...containerStyle,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      <header style={headerStyle}>
        <div style={{ flex: 1 }}>
          <div style={headerTitleStyle}>Documint</div>
          <div style={headerIntroStyle}>Extract and document your design system from multiple Figma frames in seconds</div>
        </div>
      </header>

      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {state.phase === 'idle' && selectionCount === 0 && <EmptyStateScreen />}

        {state.phase === 'idle' && selectionCount > 0 && (
          <IdleScreen
            selectionCount={selectionCount}
            options={options}
            onOptionsChange={setOptions}
            onGenerate={handleGenerate}
            isMinting={false}
            detectedPages={'detectedPages' in state ? state.detectedPages : undefined}
            selectedPages={state.selectedPages}
            onPageToggle={handlePageToggle}
            onSetSelectedPages={handleSetSelectedPages}
            onRequestPages={() => sendMessage({ type: 'REQUEST_PAGES' })}
          />
        )}

        {state.phase === 'generating' && (
          <IdleScreen
            selectionCount={state.selectionCount}
            options={options}
            onOptionsChange={setOptions}
            onGenerate={handleGenerate}
            isMinting={true}
            mintingStep={state.step}
            mintingPercent={state.percent}
            onCancel={handleCancel}
            detectedPages={undefined}
            selectedPages={state.selectedPages}
          />
        )}

        {state.phase === 'error' && (
          <ErrorScreen
            message={state.message}
            selectionCount={(state as any).selectionCount || 0}
            onRetry={handleReset}
          />
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
