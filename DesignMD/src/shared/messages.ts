import type { DesignSystem } from './types';

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

export type UIToPluginMessage =
  { type: 'extract' } | { type: 'generate'; options: ExportOptions; excludedPages: string[] };

export type PluginToUIMessage =
  | { type: 'progress'; stage: string; percent: number; message?: string }
  | { type: 'extraction-complete'; designSystem: DesignSystem }
  | { type: 'generation-complete'; files: GeneratedFile[] }
  | { type: 'error'; stage: string; message: string };

export interface FigmaPluginMessageEvent<T> {
  pluginMessage: T;
}
