import React from 'react';
import ReactDOM from 'react-dom/client';
import type { GenerationOptions, PluginToUiMessage, UiToPluginMessage, ProgressStep } from '@/types/messages';
import type { GenerationResult } from '@/types/messages';
import { IdleScreen } from './components/IdleScreen';
import { EmptyStateScreen } from './components/EmptyStateScreen';
import { GeneratingScreen } from './components/GeneratingScreen';
import { CompleteScreen } from './components/CompleteScreen';
import { ErrorScreen } from './components/ErrorScreen';
import {
  containerStyle,
  headerStyle,
  headerTitleStyle,
  headerIntroStyle,
  badgeStyle,
  badgeDisabledStyle,
  colors,
} from './styles';

type AppPhase = 'idle' | 'generating' | 'complete' | 'error';

interface IdleState {
  phase: 'idle';
  selectionCount: number;
}

interface GeneratingState {
  phase: 'generating';
  selectionCount: number;
  step: ProgressStep;
  percent: number;
}

interface CompleteState {
  phase: 'complete';
  result: GenerationResult;
}

interface ErrorState {
  phase: 'error';
  message: string;
}

type AppState = IdleState | GeneratingState | CompleteState | ErrorState;

function App() {
  const [state, setState] = React.useState<AppState>({ phase: 'idle', selectionCount: 0 });
  const [options, setOptions] = React.useState<GenerationOptions>({
    exportJson: false,
    exportMarkdown: false,
    exportHtml: false,
    exportFigmaPage: false,
  });

  React.useEffect(() => {
    window.onmessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as PluginToUiMessage | undefined;
      if (!msg) return;

      switch (msg.type) {
        case 'SELECTION_CHANGED': {
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

        case 'PROGRESS': {
          setState({
            phase: 'generating',
            selectionCount: state.phase === 'generating' ? state.selectionCount : 0,
            step: msg.step,
            percent: msg.percent,
          });
          break;
        }

        case 'COMPLETE': {
          setState({ phase: 'complete', result: msg.result });
          break;
        }

        case 'ERROR': {
          setState({ phase: 'error', message: msg.message });
          break;
        }
      }
    };
  }, []);

  const sendMessage = (msg: UiToPluginMessage) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const handleGenerate = () => {
    sendMessage({ type: 'GENERATE', options });
  };

  const handleCancel = () => {
    sendMessage({ type: 'CANCEL' });
  };

  const handleReset = () => {
    const currentSelectionCount = state.phase === 'generating' || state.phase === 'complete' || state.phase === 'error'
      ? (state as any).selectionCount || 0
      : 0;
    setState({ phase: 'idle', selectionCount: currentSelectionCount });
    setOptions({
      exportJson: false,
      exportMarkdown: false,
      exportHtml: false,
      exportFigmaPage: false,
    });
  };

  const handleNavigateToPage = (pageId: string) => {
    sendMessage({ type: 'NAVIGATE_TO_PAGE', pageId });
  };

  const getSelectionBadge = () => {
    const count = state.phase === 'idle' ? state.selectionCount : state.phase === 'generating' ? state.selectionCount : 0;
    return `${count} selected`;
  };

  const selectionCount = state.phase === 'idle' ? state.selectionCount : state.phase === 'generating' ? state.selectionCount : 0;

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ flex: 1 }}>
          <div style={headerTitleStyle}>Documint</div>
          <div style={headerIntroStyle}>Extract and document your design system from multiple Figma frames in seconds</div>
        </div>
      </header>

      {state.phase === 'idle' && selectionCount === 0 && <EmptyStateScreen />}

      {state.phase === 'idle' && selectionCount > 0 && (
        <IdleScreen
          selectionCount={selectionCount}
          options={options}
          onOptionsChange={setOptions}
          onGenerate={handleGenerate}
        />
      )}

      {state.phase === 'generating' && (
        <GeneratingScreen
          step={state.step}
          percent={state.percent}
          onCancel={handleCancel}
        />
      )}

      {state.phase === 'complete' && (
        <CompleteScreen
          result={state.result}
          onNavigateToPage={handleNavigateToPage}
          onReset={handleReset}
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
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
