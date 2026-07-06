import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

function resetStore() {
  useAppStore.setState({
    customQuestions: [],
    customQuestionsDirty: false,
    responses: {},
    responsesDirty: false,
  });
}

describe('appStore custom questions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('adds a custom question with the given group and priority, and marks it dirty', () => {
    useAppStore.getState().addCustomQuestion({ text: 'What about offline mode?', group: 'non-functional', priority: 'high' });

    const { customQuestions, customQuestionsDirty } = useAppStore.getState();
    expect(customQuestions).toHaveLength(1);
    expect(customQuestions[0]!).toMatchObject({
      text: 'What about offline mode?',
      group: 'non-functional',
      priority: 'high',
      category: 'custom',
      ruleId: 'custom',
    });
    expect(customQuestionsDirty).toBe(true);
  });

  it('adds new custom questions to the top of the list', () => {
    useAppStore.getState().addCustomQuestion({ text: 'First', group: 'business', priority: 'low' });
    useAppStore.getState().addCustomQuestion({ text: 'Second', group: 'business', priority: 'low' });
    useAppStore.getState().addCustomQuestion({ text: 'Third', group: 'business', priority: 'low' });

    expect(useAppStore.getState().customQuestions.map((q) => q.text)).toEqual(['Third', 'Second', 'First']);
  });

  it('updates the priority of an existing custom question', () => {
    useAppStore.getState().addCustomQuestion({ text: 'Q', group: 'business', priority: 'low' });
    const id = useAppStore.getState().customQuestions[0]!.id;

    useAppStore.getState().updateCustomQuestionPriority(id, 'high');

    expect(useAppStore.getState().customQuestions[0]!.priority).toBe('high');
  });

  it('removes a custom question and cleans up any response recorded against it', () => {
    useAppStore.getState().addCustomQuestion({ text: 'Q', group: 'business', priority: 'medium' });
    const id = useAppStore.getState().customQuestions[0]!.id;
    useAppStore.getState().answerQuestion(id, 'An answer');

    useAppStore.getState().removeCustomQuestion(id);

    const { customQuestions, responses } = useAppStore.getState();
    expect(customQuestions).toHaveLength(0);
    expect(responses[id]).toBeUndefined();
  });

  it('does not mark responses dirty when removing a question with no recorded response', () => {
    useAppStore.getState().addCustomQuestion({ text: 'Q', group: 'business', priority: 'medium' });
    const id = useAppStore.getState().customQuestions[0]!.id;
    useAppStore.setState({ responsesDirty: false });

    useAppStore.getState().removeCustomQuestion(id);

    expect(useAppStore.getState().responsesDirty).toBe(false);
  });
});
