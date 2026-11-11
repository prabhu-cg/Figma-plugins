import type { DesignSystem } from '@shared/types';
import type { ExtractionScope } from '@shared/types';
import {
  sanitizeFileSettings,
  sanitizeSavedSettings,
  type FileSettings,
  type PluginToUIMessage,
  type SavedSettings,
  type UIToPluginMessage,
} from '@shared/messages';
import { extractDesignSystem } from './extraction';
import { newReadStats } from './extraction/layers';
import { createImageResolver } from './extraction/images';
import { extractStructures } from './extraction/structures';
import { generateOutputsDetailed } from './generators';
import { transformToDesignSystem } from './transform';
import { filterDesignSystemByPages } from './transform/pageFilter';
import { withCancellation, yieldToEventLoop } from './utils/async';
import { chunkFile, needsChunking } from '@shared/chunking';

figma.showUI(__html__, { width: 480, height: 700, themeColors: true });

let cachedDesignSystem: DesignSystem | undefined;
/** Set by the UI's Cancel button; read by the batched loops of the running scan or generation. */
let cancelRequested = false;

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

/** Per-file settings are keyed by file name: plugins can't read a file's id without extra access. */
const fileSettingsKey = () => `designmd.file.v1:${figma.root.name}`;

async function loadFileSettings(): Promise<FileSettings> {
  try {
    return sanitizeFileSettings(await figma.clientStorage.getAsync(fileSettingsKey()));
  } catch {
    return sanitizeFileSettings(null);
  }
}

async function saveFileSettings(fileSettings: FileSettings): Promise<void> {
  try {
    await figma.clientStorage.setAsync(fileSettingsKey(), fileSettings);
  } catch {
    // Remembering is best-effort.
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
  post({
    type: 'settings',
    settings: await loadSettings(),
    fileSettings: await loadFileSettings(),
  });
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

    cancelRequested = false;
    const raw = await withCancellation(
      () => cancelRequested,
      () =>
        extractDesignSystem(
          (progress) => {
            const percent =
              progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 100;
            post({
              type: 'progress',
              stage: progress.stage,
              percent,
              done: progress.done,
              total: progress.total,
              ...(progress.detail ? { message: progress.detail } : {}),
            });
          },
          { selection },
        ),
    );

    const transformStarted = Date.now();
    const designSystem = transformToDesignSystem(raw, figma.root.name, scope);
    cachedDesignSystem = designSystem;
    console.log(
      `[DesignMD] transform: ${designSystem.summary.variablesCount} variables, ${designSystem.summary.componentSetsCount} sets in ${((Date.now() - transformStarted) / 1000).toFixed(1)}s; sending the result to the UI`,
    );

    post({ type: 'extraction-complete', designSystem });
  } catch (err) {
    post({
      type: 'error',
      stage: 'extraction',
      message: `Failed to extract the design system: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/** Looks up the CSS name of a variable or style by id, for token references inside layer trees. */
function tokenResolver(ds: DesignSystem) {
  const names = new Map<string, string>();
  for (const v of ds.variables) names.set(`variable:${v.id}`, v.cssName);
  for (const s of [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid]) {
    names.set(`style:${s.id}`, s.cssName);
  }
  return (kind: 'variable' | 'style', id: string) => names.get(`${kind}:${id}`);
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

    const designSystem = {
      ...filterDesignSystemByPages(cachedDesignSystem, options.excludedPages),
      contrastPairs: options.contrastPairs ?? [],
    };
    // components.json is assembled in the UI (see handleReadStructures), never here.
    const { files, failures } = generateOutputsDetailed(designSystem, {
      ...options.options,
      componentsJson: false,
    });

    if (files.length === 0 && failures.length > 0) {
      post({
        type: 'error',
        stage: 'generation',
        message: `Failed to generate output files: ${failures
          .map((f) => `${f.output} (${f.reason})`)
          .join('; ')}`,
      });
      return;
    }

    if (files.length === 0) {
      post({
        type: 'error',
        stage: 'generation',
        message: 'No output types were selected. Choose at least one export option and try again.',
      });
      return;
    }

    const failureField = failures.length > 0 ? { failures } : {};
    if (needsChunking(files)) {
      // One huge message can fail or freeze the UI, so large results go over in pieces.
      for (const file of files) {
        for (const chunk of chunkFile(file)) {
          post(chunk);
          await yieldToEventLoop();
        }
      }
      post({
        type: 'generation-complete',
        files: [],
        chunked: files.map((f) => f.path),
        ...failureField,
      });
    } else {
      post({ type: 'generation-complete', files, ...failureField });
    }
  } catch (err) {
    post({
      type: 'error',
      stage: 'generation',
      message: `Failed to generate output files: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/**
 * Reads the layers of every component and streams the results to the UI. This is the only part of
 * components.json that needs Figma; the UI builds, hashes and splits the file. Reading is sliced
 * into short stretches (see createTimeSlicer) so Figma stays responsive.
 */
async function handleReadStructures(
  message: UIToPluginMessage & { type: 'read-structures' },
): Promise<void> {
  try {
    if (!cachedDesignSystem) {
      post({
        type: 'error',
        stage: 'generation',
        message: 'Nothing to generate yet — extract the design system first.',
      });
      return;
    }
    const designSystem = filterDesignSystemByPages(cachedDesignSystem, message.excludedPages);
    cancelRequested = false;
    const stats = newReadStats();
    const started = Date.now();
    // Progress by work, not by count: a set of 200 variants costs far more than a standalone
    // component, and the sets come first, so counting components makes the estimate wildly pessimistic.
    const prefix = [0];
    for (const c of designSystem.components) {
      const trees =
        message.includeVariantDiffs && c.isComponentSet ? Math.max(1, c.variants.length) : 1;
      prefix.push(prefix[prefix.length - 1] + trees);
    }
    await withCancellation(
      () => cancelRequested,
      () =>
        extractStructures(
          designSystem.components,
          {
            includeText: message.includeText,
            includeVariantDiffs: message.includeVariantDiffs,
            includeInstanceInternals: message.includeInstanceInternals,
            includeVectorShapes: message.includeVectorShapes,
            resolveImage: message.includeImages
              ? createImageResolver((path, bytes) => post({ type: 'image', path, bytes }))
              : undefined,
            resolveToken: tokenResolver(designSystem),
            stats,
          },
          (done, total) =>
            post({
              type: 'progress',
              stage: 'structure',
              percent:
                prefix[total] > 0
                  ? Math.round((prefix[Math.min(done, total)] / prefix[total]) * 100)
                  : 100,
              done,
              total,
            }),
          (items) => post({ type: 'structures', items }),
          false,
        ),
    );
    // Visible in the plugin's console (Plugins > Development > Open console).
    const seconds = Math.round((Date.now() - started) / 1000);
    const perLayer = stats.layers > 0 ? ((Date.now() - started) / stats.layers).toFixed(2) : '0';
    console.log(
      `[DesignMD] read ${stats.trees} layer trees (${stats.layers} layers) in ${seconds}s, ${perLayer} ms per layer; ` +
        `${stats.instanceLookups} instance lookups took ${Math.round(stats.instanceMs / 1000)}s`,
    );
    post({ type: 'structures-complete', cancelled: cancelRequested });
  } catch (err) {
    post({
      type: 'error',
      stage: 'generation',
      message: `Failed to read the component layers: ${err instanceof Error ? err.message : String(err)}`,
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
    case 'save-file-settings':
      await saveFileSettings(message.fileSettings);
      break;
    case 'generate':
      await handleGenerate(message);
      break;
    case 'read-structures':
      await handleReadStructures(message);
      break;
    case 'cancel':
      cancelRequested = true;
      break;
  }
};

figma.on('selectionchange', postSelection);
