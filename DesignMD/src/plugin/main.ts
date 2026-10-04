import type { DesignSystem } from '@shared/types';
import type { ExtractionScope } from '@shared/types';
import {
  sanitizeSavedSettings,
  type PluginToUIMessage,
  type SavedSettings,
  type UIToPluginMessage,
} from '@shared/messages';
import { extractDesignSystem } from './extraction';
import { generateOutputs } from './generators';
import { transformToDesignSystem } from './transform';
import { filterDesignSystemByPages } from './transform/pageFilter';

figma.showUI(__html__, { width: 480, height: 700, themeColors: true });

let cachedDesignSystem: DesignSystem | undefined;

function post(message: PluginToUIMessage): void {
  figma.ui.postMessage(message);
}

const SETTINGS_KEY = 'designmd.settings.v1';

async function loadSettings(): Promise<SavedSettings | null> {
  try {
    return sanitizeSavedSettings(await figma.clientStorage.getAsync(SETTINGS_KEY));
  } catch {
    return null; // Storage unavailable: behave as a first run.
  }
}

async function saveSettings(settings: SavedSettings): Promise<void> {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch {
    // Not being able to remember settings must never get in the user's way.
  }
}

function postSelection(): void {
  post({ type: 'selection', count: figma.currentPage.selection.length });
}

async function handleReady(): Promise<void> {
  postSelection();
  post({ type: 'settings', settings: await loadSettings() });
}

async function handleExtract(scope: ExtractionScope): Promise<void> {
  try {
    const selection = scope === 'selection' ? figma.currentPage.selection : undefined;
    if (selection && selection.length === 0) {
      post({
        type: 'error',
        stage: 'extraction',
        message: 'Select at least one layer in Figma to scan only the selection.',
      });
      return;
    }

    const raw = await extractDesignSystem(
      (progress) => {
        const percent =
          progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 100;
        post({ type: 'progress', stage: progress.stage, percent });
      },
      { selection },
    );

    const designSystem = transformToDesignSystem(raw, figma.root.name, scope);
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

    const designSystem = filterDesignSystemByPages(cachedDesignSystem, options.excludedPages);
    const files = generateOutputs(designSystem, options.options);

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
    case 'ready':
      await handleReady();
      break;
    case 'extract':
      await handleExtract(message.scope ?? 'file');
      break;
    case 'save-settings':
      await saveSettings(message.settings);
      break;
    case 'generate':
      await handleGenerate(message);
      break;
  }
};

figma.on('selectionchange', postSelection);
