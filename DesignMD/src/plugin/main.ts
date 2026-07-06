import type { DesignSystem } from '@shared/types';
import type { PluginToUIMessage, UIToPluginMessage } from '@shared/messages';
import { extractDesignSystem } from './extraction';
import { generateOutputs } from './generators';
import { transformToDesignSystem } from './transform';

figma.showUI(__html__, { width: 480, height: 700, themeColors: true });

let cachedDesignSystem: DesignSystem | undefined;

function post(message: PluginToUIMessage): void {
  figma.ui.postMessage(message);
}

async function handleExtract(): Promise<void> {
  try {
    const raw = await extractDesignSystem((progress) => {
      const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 100;
      post({ type: 'progress', stage: progress.stage, percent });
    });

    const designSystem = transformToDesignSystem(raw, figma.root.name);
    cachedDesignSystem = designSystem;

    post({ type: 'extraction-complete', designSystem });
  } catch (err) {
    post({
      type: 'error',
      stage: 'extraction',
      message: `Failed to extract the design system: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function handleGenerate(options: UIToPluginMessage & { type: 'generate' }): Promise<void> {
  try {
    if (!cachedDesignSystem) {
      post({
        type: 'error',
        stage: 'generation',
        message: 'Nothing to generate yet — extract the design system first.',
      });
      return;
    }

    const files = generateOutputs(cachedDesignSystem, options.options);

    if (files.length === 0) {
      post({
        type: 'error',
        stage: 'generation',
        message: 'No output types were selected. Choose at least one export option and try again.',
      });
      return;
    }

    post({ type: 'generation-complete', files });
  } catch (err) {
    post({
      type: 'error',
      stage: 'generation',
      message: `Failed to generate output files: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

figma.ui.onmessage = async (message: UIToPluginMessage) => {
  switch (message.type) {
    case 'extract':
      await handleExtract();
      break;
    case 'generate':
      await handleGenerate(message);
      break;
  }
};
