import type { RootManifest } from './schemas';

export type ProgressStep =
  | 'EXTRACTING_STYLES'
  | 'EXTRACTING_VARIABLES'
  | 'EXTRACTING_COMPONENTS'
  | 'BUILDING_SCHEMA'
  | 'RENDERING_FIGMA_PAGE'
  | 'EXPORTING_FILES';

export interface GenerationOptions {
  exportFigmaPage: boolean;
  exportMarkdown: boolean;
  exportHtml: boolean;
  exportJson: boolean;
}

export interface GenerationResult {
  manifest: RootManifest;
  exports: {
    markdown?: string;
    html?: string;
    json?: string;
    figmaPageId?: string;
  };
}

export type PluginToUiMessage =
  | { type: 'SELECTION_CHANGED'; count: number }
  | { type: 'PROGRESS'; step: ProgressStep; index: number; total: number; percent: number }
  | { type: 'COMPLETE'; result: GenerationResult }
  | { type: 'ERROR'; message: string };

export type UiToPluginMessage =
  | { type: 'GENERATE'; options: GenerationOptions }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'CANCEL' };
