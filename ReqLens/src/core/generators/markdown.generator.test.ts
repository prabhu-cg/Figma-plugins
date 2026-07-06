import { describe, expect, it } from 'vitest';
import type { AnalysisResult, DetectedComponent, FrameAnalysis } from '@core/types/analysis.types';
import { emptyCategoryCounts } from '@core/types/analysis.types';
import type { GeneratedQuestion } from '@core/types/question.types';
import { generateMarkdown } from './markdown.generator';

const component: DetectedComponent = {
  id: 'frame-1:btn-1:button',
  category: 'button',
  nodeId: 'btn-1',
  nodeName: 'Submit Button',
  frameId: 'frame-1',
  frameName: 'Checkout',
  confidence: 0.82,
  evidence: ['Layer name matches button naming convention'],
  label: 'Submit',
};

const frame: FrameAnalysis = {
  frameId: 'frame-1',
  frameName: 'Checkout',
  nodeCount: 42,
  truncated: false,
  components: [component],
  analyzedAt: Date.now(),
  durationMs: 1,
};

const analysis: AnalysisResult = {
  frames: [frame],
  totalComponents: 1,
  componentsByCategory: { ...emptyCategoryCounts(), button: 1 },
  multiFrame: false,
};

const question: GeneratedQuestion = {
  id: 'q1',
  ruleId: 'button.action',
  ruleDescription: 'A button was detected',
  text: 'What action should occur when this button is clicked?',
  group: 'functional',
  priority: 'high',
  category: 'button',
  componentIds: ['frame-1:btn-1:button'],
  frameId: 'frame-1',
  frameName: 'Checkout',
};

describe('generateMarkdown', () => {
  it('includes screen overview, detected components, and grouped questions', () => {
    const markdown = generateMarkdown({ analysis, questions: [question], responses: null, generatedAt: new Date(0) });

    expect(markdown).toContain('## 1. Screen Overview');
    expect(markdown).toContain('Checkout');
    expect(markdown).toContain('## 2. Components Detected');
    expect(markdown).toContain('Submit');
    expect(markdown).toContain('### Functional Requirements');
    expect(markdown).toContain('What action should occur when this button is clicked?');
    expect(markdown).toContain('_Not yet answered._');
  });

  it('renders a recorded answer instead of the placeholder', () => {
    const markdown = generateMarkdown({
      analysis,
      questions: [question],
      responses: {
        selectionSignature: 'sig',
        updatedAt: Date.now(),
        responses: { q1: { questionId: 'q1', answer: 'Navigates to order confirmation', skipped: false, updatedAt: Date.now() } },
      },
    });

    expect(markdown).toContain('Navigates to order confirmation');
    expect(markdown).not.toContain('_Not yet answered._');
  });

  it('shows an empty-state message for groups with no generated questions', () => {
    const markdown = generateMarkdown({ analysis, questions: [], responses: null });
    expect(markdown).toContain('_No questions generated in this category for the current selection._');
  });
});
