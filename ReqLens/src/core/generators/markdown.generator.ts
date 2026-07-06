import type { AnalysisResult } from '@core/types/analysis.types';
import type { GeneratedQuestion, QuestionGroup } from '@core/types/question.types';
import type { ResponseSet } from '@core/types/response.types';

const GROUP_LABELS: Record<QuestionGroup, string> = {
  business: 'Business Requirements',
  functional: 'Functional Requirements',
  'non-functional': 'Non-Functional Requirements',
  security: 'Security',
  accessibility: 'Accessibility',
};

const GROUP_ORDER: readonly QuestionGroup[] = ['business', 'functional', 'non-functional', 'security', 'accessibility'];

function formatAnswer(question: GeneratedQuestion, responses: ResponseSet | null): string {
  const response = responses?.responses[question.id];
  if (!response) return '_Not yet answered._';
  if (response.skipped) return '_Skipped._';
  if (!response.answer.trim()) return '_Not yet answered._';
  return response.answer.trim();
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export interface MarkdownGeneratorInput {
  projectName?: string;
  analysis: AnalysisResult;
  questions: GeneratedQuestion[];
  responses: ResponseSet | null;
  generatedAt?: Date;
}

/**
 * Renders the full ReqLens requirements report: screen overview, detected
 * components, and every generated question grouped into the standard
 * business/functional/non-functional/security/accessibility requirement
 * sections, each paired with its recorded answer (or a "not yet answered"
 * placeholder so the doc is still useful as a checklist mid-discovery).
 */
export function generateMarkdown(input: MarkdownGeneratorInput): string {
  const { analysis, questions, responses } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const lines: string[] = [];

  lines.push(`# ${input.projectName ?? 'Requirements Discovery'} — ReqLens Report`);
  lines.push('');
  lines.push(
    `_Generated ${generatedAt.toISOString()} from ${pluralize(analysis.frames.length, 'selected frame')}._`,
  );
  lines.push('');

  lines.push('## 1. Screen Overview');
  lines.push('');
  for (const frame of analysis.frames) {
    const truncatedNote = frame.truncated ? ' (analysis capped — frame exceeds the 10,000-layer limit)' : '';
    lines.push(
      `- **${frame.frameName}** — ${pluralize(frame.nodeCount, 'layer')}${truncatedNote}, ${pluralize(frame.components.length, 'component')} detected`,
    );
  }
  lines.push('');

  lines.push('## 2. Components Detected');
  lines.push('');
  for (const frame of analysis.frames) {
    lines.push(`### ${frame.frameName}`);
    lines.push('');
    if (frame.components.length === 0) {
      lines.push('_No recognizable UI patterns detected in this frame._');
      lines.push('');
      continue;
    }
    lines.push('| Component | Category | Variant | Confidence |');
    lines.push('|---|---|---|---|');
    for (const component of frame.components) {
      const name = (component.label ?? component.nodeName).replace(/\|/g, '\\|');
      lines.push(`| ${name} | ${component.category} | ${component.variant ?? '—'} | ${Math.round(component.confidence * 100)}% |`);
    }
    lines.push('');
  }

  lines.push('## 3–4. Requirements Summary (Generated Questions & Responses)');
  lines.push('');

  const byGroup = new Map<QuestionGroup, GeneratedQuestion[]>();
  for (const question of questions) {
    const list = byGroup.get(question.group) ?? [];
    list.push(question);
    byGroup.set(question.group, list);
  }

  for (const group of GROUP_ORDER) {
    const groupQuestions = byGroup.get(group) ?? [];
    lines.push(`### ${GROUP_LABELS[group]}`);
    lines.push('');

    if (groupQuestions.length === 0) {
      lines.push('_No questions generated in this category for the current selection._');
      lines.push('');
      continue;
    }

    const byFrame = new Map<string, GeneratedQuestion[]>();
    for (const question of groupQuestions) {
      const list = byFrame.get(question.frameName) ?? [];
      list.push(question);
      byFrame.set(question.frameName, list);
    }

    for (const [frameName, frameQuestions] of byFrame) {
      if (analysis.multiFrame) {
        lines.push(`**${frameName}**`);
        lines.push('');
      }
      for (const question of frameQuestions) {
        lines.push(`- **Q:** ${question.text}`);
        lines.push(`  **A:** ${formatAnswer(question, responses)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
