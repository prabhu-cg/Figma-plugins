import { describe, expect, it } from 'vitest';
import type { DetectedComponent, FrameAnalysis } from '@core/types/analysis.types';
import { generateQuestionsForFrame } from './question-engine.service';

function makeComponent(overrides: Partial<DetectedComponent> & { category: DetectedComponent['category']; nodeId: string }): DetectedComponent {
  return {
    id: `frame-1:${overrides.nodeId}:${overrides.category}`,
    frameId: 'frame-1',
    frameName: 'Dashboard',
    nodeName: overrides.nodeId,
    confidence: 0.8,
    evidence: [],
    ...overrides,
  };
}

function makeFrame(components: DetectedComponent[]): FrameAnalysis {
  return {
    frameId: 'frame-1',
    frameName: 'Dashboard',
    nodeCount: 10,
    truncated: false,
    components,
    analyzedAt: Date.now(),
    durationMs: 1,
  };
}

describe('question-engine.service', () => {
  it('generates the button question set for a detected button', () => {
    const frame = makeFrame([makeComponent({ category: 'button', nodeId: 'btn-1' })]);
    const questions = generateQuestionsForFrame(frame);

    expect(questions.some((q) => q.text.includes('should occur when this button is clicked'))).toBe(true);
    expect(questions.every((q) => q.componentIds.includes('frame-1:btn-1:button'))).toBe(true);
  });

  it('fires the table+search+export composite rule only when all three are present', () => {
    const withoutExport = makeFrame([
      makeComponent({ category: 'table', nodeId: 'table-1' }),
      makeComponent({ category: 'search', nodeId: 'search-1' }),
    ]);
    const withExport = makeFrame([
      makeComponent({ category: 'table', nodeId: 'table-1' }),
      makeComponent({ category: 'search', nodeId: 'search-1' }),
      makeComponent({ category: 'button', nodeId: 'export-btn', nodeName: 'Export CSV' }),
    ]);

    const questionsWithout = generateQuestionsForFrame(withoutExport);
    const questionsWith = generateQuestionsForFrame(withExport);

    expect(questionsWithout.some((q) => q.ruleId === 'table-search-export')).toBe(false);
    expect(questionsWith.some((q) => q.ruleId === 'table-search-export')).toBe(true);
  });

  it('merges duplicate question text from repeated components of the same category into one question', () => {
    const frame = makeFrame([
      makeComponent({ category: 'button', nodeId: 'btn-1' }),
      makeComponent({ category: 'button', nodeId: 'btn-2' }),
      makeComponent({ category: 'button', nodeId: 'btn-3' }),
    ]);
    const questions = generateQuestionsForFrame(frame);

    const actionQuestions = questions.filter((q) => q.text.includes('should occur when this button is clicked'));
    expect(actionQuestions).toHaveLength(1);
    expect(actionQuestions[0]?.componentIds).toEqual(['frame-1:btn-1:button', 'frame-1:btn-2:button', 'frame-1:btn-3:button']);
  });

  it('produces stable, deterministic ids for the same input', () => {
    const frame = makeFrame([makeComponent({ category: 'button', nodeId: 'btn-1' })]);
    const first = generateQuestionsForFrame(frame);
    const second = generateQuestionsForFrame(frame);
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
  });
});
