import { QuestionsSidebar } from '@ui/components/sidebar/QuestionsSidebar';
import { QuestionsList } from './QuestionsList';

export function QuestionsTab() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <QuestionsSidebar />
      <QuestionsList />
    </div>
  );
}
