import type { AnalysisResult, FrameAnalysis } from '@core/types/analysis.types';
import type { GeneratedQuestion, QuestionRule } from '@core/types/question.types';
import { stableHash } from '@core/utils/id';
import { allQuestionRules } from './question-rules';

function runSingleComponentRule(rule: Extract<QuestionRule, { kind: 'single' }>, frame: FrameAnalysis): GeneratedQuestion[] {
  const matched = frame.components.filter((c) => c.category === rule.appliesTo && (!rule.when || rule.when(c)));

  // Multiple instances of the same category (e.g. 3 buttons) produce the same question
  // text; merge those into one question with all contributing component ids rather than
  // repeating identical text once per instance.
  const componentIdsByText = new Map<string, string[]>();
  for (const component of matched) {
    for (const text of rule.questions(component)) {
      const ids = componentIdsByText.get(text);
      if (ids) ids.push(component.id);
      else componentIdsByText.set(text, [component.id]);
    }
  }

  return Array.from(componentIdsByText.entries()).map(([text, componentIds]) => ({
    id: stableHash(`${rule.id}:${frame.frameId}:${text}`),
    ruleId: rule.id,
    ruleDescription: rule.description,
    text,
    group: rule.group,
    priority: rule.priority,
    category: rule.appliesTo,
    componentIds,
    frameId: frame.frameId,
    frameName: frame.frameName,
  }));
}

function runCompositeRule(rule: Extract<QuestionRule, { kind: 'composite' }>, frame: FrameAnalysis): GeneratedQuestion[] {
  const matched = rule.matches(frame);
  if (!matched || matched.length === 0) return [];

  const componentIds = matched.map((c) => c.id);
  return rule.questions(frame, matched).map((text) => ({
    id: stableHash(`${rule.id}:${frame.frameId}:${text}`),
    ruleId: rule.id,
    ruleDescription: rule.description,
    text,
    group: rule.group,
    priority: rule.priority,
    category: 'composite' as const,
    componentIds,
    frameId: frame.frameId,
    frameName: frame.frameName,
  }));
}

/** Evaluates all configured rules against one frame's detected components. */
export function generateQuestionsForFrame(frame: FrameAnalysis, rules: readonly QuestionRule[] = allQuestionRules): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  for (const rule of rules) {
    questions.push(...(rule.kind === 'single' ? runSingleComponentRule(rule, frame) : runCompositeRule(rule, frame)));
  }
  return questions;
}

export function generateQuestions(analysis: AnalysisResult, rules: readonly QuestionRule[] = allQuestionRules): GeneratedQuestion[] {
  return analysis.frames.flatMap((frame) => generateQuestionsForFrame(frame, rules));
}
