import { Header } from '@ui/components/Header';
import { StatusBanner } from '@ui/components/StatusBanner';
import { QuestionsTab } from '@ui/components/tabs/QuestionsTab';
import { usePluginBridge } from '@ui/hooks/usePluginBridge';
import { useAppStore } from '@ui/store/appStore';

export function App() {
  usePluginBridge();
  const status = useAppStore((s) => s.status);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        {status !== 'ready' ? <StatusBanner /> : <QuestionsTab />}
      </main>
    </div>
  );
}
