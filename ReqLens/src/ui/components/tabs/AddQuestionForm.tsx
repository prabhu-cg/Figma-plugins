import { useState, type FormEvent } from 'react';
import type { QuestionGroup, QuestionPriority } from '@core/types/question.types';
import { useAppStore } from '@ui/store/appStore';
import { GROUP_LABELS, GROUP_ORDER } from '@ui/utils/labels';

const PRIORITY_OPTIONS: QuestionPriority[] = ['high', 'medium', 'low'];

export interface AddQuestionFormProps {
  /** Pre-selected group, matching whichever category the sidebar currently has active. */
  defaultGroup: QuestionGroup;
}

export function AddQuestionForm({ defaultGroup }: AddQuestionFormProps) {
  const addCustomQuestion = useAppStore((s) => s.addCustomQuestion);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [group, setGroup] = useState<QuestionGroup>(defaultGroup);
  const [priority, setPriority] = useState<QuestionPriority>('medium');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addCustomQuestion({ text: trimmed, group, priority });
    setText('');
    setPriority('medium');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setGroup(defaultGroup);
          setOpen(true);
        }}
        className="self-start rounded-lg border border-dashed border-canvas-border px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700"
      >
        + Add custom question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-canvas-border bg-white p-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type your question…"
        rows={2}
        autoFocus
        className="w-full resize-none rounded-md border border-canvas-border px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <div className="flex gap-1.5">
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value as QuestionGroup)}
          className="flex-1 rounded-md border border-canvas-border px-2 py-1 text-xxs text-gray-700"
        >
          {GROUP_ORDER.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as QuestionPriority)}
          className="rounded-md border border-canvas-border px-2 py-1 text-xxs text-gray-700"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} priority
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2.5 py-1 text-xxs font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-2.5 py-1 text-xxs font-semibold text-white hover:bg-brand-700"
        >
          Add question
        </button>
      </div>
    </form>
  );
}
