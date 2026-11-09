import type { FileChunk } from './chunking';
import type { StructureResult } from './structureTypes';
import type { ContrastPairSpec, DesignSystem, ExtractionScope } from './types';

export interface ExportOptions {
  designMd: boolean;
  componentDocs: boolean;
  tokensJson: boolean;
  /** tokens.css: CSS custom properties with a [data-theme] block per extra mode. */
  cssFile: boolean;
  /** components.json: layer trees, variant diffs and the tokens components use. */
  componentsJson: boolean;
  /** components.json: include text content (layer characters). */
  includeText: boolean;
  /** components.json: include how each variant differs from the default variant. */
  includeVariantDiffs: boolean;
  zip: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  designMd: true,
  componentDocs: true,
  tokensJson: false,
  cssFile: false,
  componentsJson: false,
  includeText: true,
  includeVariantDiffs: true,
  zip: true,
};

/** An output that could not be generated; the others are still returned. */
export interface OutputFailure {
  output: string;
  reason: string;
}

export interface GeneratedFile {
  /** Relative output path, e.g. "design.md" or "components/Button.md" */
  path: string;
  content: string;
}

/** Settings remembered between sessions (figma.clientStorage). */
export interface SavedSettings {
  options: ExportOptions;
}

/**
 * Validates stored settings of unknown shape (older versions, hand-edited storage). Unknown or
 * missing option keys fall back to the defaults, so new options never break saved settings.
 */
export function sanitizeSavedSettings(value: unknown): SavedSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const stored = (value as { options?: unknown }).options;
  if (typeof stored !== 'object' || stored === null) return null;

  const options = { ...DEFAULT_EXPORT_OPTIONS };
  for (const key of Object.keys(DEFAULT_EXPORT_OPTIONS) as Array<keyof ExportOptions>) {
    const candidate = (stored as Record<string, unknown>)[key];
    if (typeof candidate === 'boolean') options[key] = candidate;
  }
  return { options };
}

/** Settings that belong to one Figma file (keyed by file name), remembered between sessions. */
export interface FileSettings {
  excludedPages: string[];
  contrastPairs: ContrastPairSpec[];
}

export const EMPTY_FILE_SETTINGS: FileSettings = { excludedPages: [], contrastPairs: [] };

const isString = (v: unknown): v is string => typeof v === 'string';

/** Validates stored per-file settings; anything malformed is dropped rather than trusted. */
export function sanitizeFileSettings(value: unknown): FileSettings {
  if (typeof value !== 'object' || value === null) return EMPTY_FILE_SETTINGS;
  const { excludedPages, contrastPairs } = value as Record<string, unknown>;
  return {
    excludedPages: Array.isArray(excludedPages) ? excludedPages.filter(isString) : [],
    contrastPairs: Array.isArray(contrastPairs)
      ? contrastPairs.flatMap((pair) => {
          const { foreground, background } = (pair ?? {}) as Record<string, unknown>;
          return isString(foreground) && isString(background) ? [{ foreground, background }] : [];
        })
      : [],
  };
}

export type UIToPluginMessage =
  | { type: 'ready' }
  | { type: 'extract'; scope?: ExtractionScope }
  | {
      type: 'generate';
      options: ExportOptions;
      excludedPages: string[];
      contrastPairs?: ContrastPairSpec[];
    }
  | { type: 'save-settings'; settings: SavedSettings }
  | { type: 'save-file-settings'; fileSettings: FileSettings }
  /**
   * Read the layers of the components (components.json). The plugin streams the results back as
   * 'structures' messages; the UI assembles, hashes and splits the file so that work never blocks
   * Figma's main thread.
   */
  | {
      type: 'read-structures';
      excludedPages: string[];
      includeText: boolean;
      includeVariantDiffs: boolean;
    }
  /** Stop the running scan or generation and return what is done so far. */
  | { type: 'cancel' };

export type PluginToUIMessage =
  | {
      type: 'progress';
      stage: string;
      percent: number;
      done?: number;
      total?: number;
      message?: string;
    }
  | { type: 'selection'; count: number }
  | { type: 'settings'; settings: SavedSettings | null; fileSettings: FileSettings }
  | { type: 'extraction-complete'; designSystem: DesignSystem }
  | FileChunk
  | { type: 'structures'; items: Array<[string, StructureResult]> }
  | { type: 'structures-complete'; cancelled: boolean }
  | {
      type: 'generation-complete';
      /** Empty when `chunked` is set: the files arrived as file-chunk messages. */
      files: GeneratedFile[];
      /** Paths of the files sent as file-chunk messages, in order. */
      chunked?: string[];
      failures?: OutputFailure[];
    }
  | { type: 'error'; stage: string; message: string };

export interface FigmaPluginMessageEvent<T> {
  pluginMessage: T;
}
