import type { QuestionRule } from '@core/types/question.types';
import { compositeRules } from './composite.rules';
import { singleComponentRules } from './single-component.rules';

export const allQuestionRules: readonly QuestionRule[] = [...singleComponentRules, ...compositeRules];

export { compositeRules, singleComponentRules };
