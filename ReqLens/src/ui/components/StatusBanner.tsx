import { sendToMain } from '@ui/lib/pluginBridge';
import { useAppStore } from '@ui/store/appStore';

export function StatusBanner() {
  const status = useAppStore((s) => s.status);
  const errorMessage = useAppStore((s) => s.errorMessage);

  if (status === 'ready') return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {status === 'analyzing' && (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-xs text-gray-500">Analyzing selected frames…</p>
        </>
      )}
      {status === 'empty' && (
        <>
          <p className="text-sm font-medium text-gray-700">No frames selected</p>
          <p className="max-w-[260px] text-xxs text-gray-500">
            Select one or more frames, components, or sections in Figma to generate contextual requirements
            questions.
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-sm font-medium text-red-700">Something went wrong</p>
          <p className="max-w-[260px] text-xxs text-gray-500">{errorMessage ?? 'Unknown error.'}</p>
          <button
            type="button"
            onClick={() => sendToMain({ type: 'analyze-selection' })}
            className="mt-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xxs font-semibold text-white hover:bg-brand-700"
          >
            Retry analysis
          </button>
        </>
      )}
      {status === 'idle' && <p className="text-xs text-gray-500">Connecting…</p>}
    </div>
  );
}
