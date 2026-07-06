import type { DesignSystem } from './types';

export interface ExportOptions {
  designMd: boolean;
  componentDocs: boolean;
  tokensJson: boolean;
  cssTokensJson: boolean;
  zip: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  designMd: true,
  componentDocs: true,
  tokensJson: true,
  cssTokensJson: true,
  zip: true,
};

export interface GeneratedFile {
  /** Relative output path, e.g. "design.md" or "components/Button.md" */
  path: string;
  content: string;
}

export type UIToPluginMessage = { type: 'extract' } | { type: 'generate'; options: ExportOptions };

export type PluginToUIMessage =
  | { type: 'progress'; stage: string; percent: number; message?: string }
  | { type: 'extraction-complete'; designSystem: DesignSystem }
  | { type: 'generation-complete'; files: GeneratedFile[] }
  | { type: 'error'; stage: string; message: string };

export interface FigmaPluginMessageEvent<T> {
  pluginMessage: T;
}
