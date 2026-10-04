import type { DesignSystem, ExtractionScope } from './types';

export interface ExportOptions {
  designMd: boolean;
  componentDocs: boolean;
  tokensJson: boolean;
  cssTokensJson: boolean;
  /** tokens.css: CSS custom properties with a [data-theme] block per extra mode. */
  cssFile: boolean;
  /** _tokens.scss: Sass variables plus a $modes map. */
  scssFile: boolean;
  /** tailwind.tokens.js: a Tailwind preset that references the CSS variables. */
  tailwindPreset: boolean;
  zip: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  designMd: true,
  componentDocs: true,
  tokensJson: false,
  cssTokensJson: false,
  cssFile: false,
  scssFile: false,
  tailwindPreset: false,
  zip: true,
};

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

export type UIToPluginMessage =
  | { type: 'ready' }
  | { type: 'extract'; scope?: ExtractionScope }
  | { type: 'generate'; options: ExportOptions; excludedPages: string[] }
  | { type: 'save-settings'; settings: SavedSettings };

export type PluginToUIMessage =
  | { type: 'progress'; stage: string; percent: number; message?: string }
  | { type: 'selection'; count: number }
  | { type: 'settings'; settings: SavedSettings | null }
  | { type: 'extraction-complete'; designSystem: DesignSystem }
  | { type: 'generation-complete'; files: GeneratedFile[] }
  | { type: 'error'; stage: string; message: string };

export interface FigmaPluginMessageEvent<T> {
  pluginMessage: T;
}
