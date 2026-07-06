import { useMemo, useState } from 'react';
import { generateMarkdown } from '@core/generators/markdown.generator';
import type { ResponseSet } from '@core/types/response.types';
import { useAppStore } from '@ui/store/appStore';
import { computeProgress } from '@ui/utils/questionFilters';
import { Badge } from './shared/Badge';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'reqlens-report';
}

export function Header() {
  const status = useAppStore((s) => s.status);
  const frameSummaries = useAppStore((s) => s.frameSummaries);
  const analysis = useAppStore((s) => s.analysis);
  const questions = useAppStore((s) => s.questions);
  const customQuestions = useAppStore((s) => s.customQuestions);
  const responses = useAppStore((s) => s.responses);
  const autosaveStatus = useAppStore((s) => s.autosaveStatus);
  const selectionSignature = useAppStore((s) => s.selectionSignature);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const allQuestions = useMemo(() => [...questions, ...customQuestions], [questions, customQuestions]);
  const progress = computeProgress(allQuestions, responses);

  const markdown = useMemo(() => {
    if (!analysis) return '';
    const responseSet: ResponseSet | null = selectionSignature
      ? { selectionSignature, responses, updatedAt: Date.now() }
      : null;
    return generateMarkdown({
      projectName: frameSummaries.map((f) => f.frameName).join(', ') || undefined,
      analysis,
      questions: allQuestions,
      responses: responseSet,
    });
  }, [analysis, allQuestions, responses, selectionSignature, frameSummaries]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    } finally {
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(frameSummaries[0]?.frameName ?? 'reqlens-report')}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-canvas-border bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-canvas-border px-4 pb-3 pt-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-gray-900">ReqLens</h1>
          <p className="mt-0.5 text-xs text-gray-500">Contextual requirements questions from your Figma selection</p>
        </div>
        {autosaveStatus !== 'idle' && (
          <Badge tone={autosaveStatus === 'error' ? 'danger' : autosaveStatus === 'saving' ? 'neutral' : 'success'}>
            {autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'error' ? 'Save failed' : 'Saved'}
          </Badge>
        )}
      </div>

      <div className="px-4 pt-3">
        <p className="text-xxs text-gray-500">
          {status === 'ready' && analysis
            ? `${frameSummaries.length} frame${frameSummaries.length === 1 ? '' : 's'} · ${analysis.totalComponents} components · ${allQuestions.length} questions`
            : status === 'analyzing'
              ? 'Analyzing selection…'
              : status === 'empty'
                ? 'Select one or more frames to begin'
                : status === 'error'
                  ? 'Analysis error'
                  : 'Waiting for selection…'}
        </p>
      </div>

      {status === 'ready' && progress.percentComplete > 0 && (
        <div className="px-4 pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-subtle">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {status === 'ready' && analysis && (
        <div className="flex gap-2 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy report'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-canvas-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-canvas-subtle"
          >
            Download .md
          </button>
        </div>
      )}
    </header>
  );
}
