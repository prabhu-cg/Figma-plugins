import type { RootManifest } from './schemas';
import type { DetectedPages } from '@/plugin/filter/page-detection';

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
  markdownMode?: 'selected' | 'current-page' | 'full-system';
  useComponentDocEngine?: boolean;
  selectedPages?: string[];
}

export interface GenerationResult {
  manifest: RootManifest;
  exports: {
    markdown?: string;
    figmaPageId?: string;
  };
}

export type PluginToUiMessage =
  | { type: 'SELECTION_CHANGED'; count: number; selectedNames?: string[] }
  | { type: 'PAGES_DETECTED'; detectedPages: DetectedPages }
  | { type: 'PROGRESS'; step: ProgressStep; index: number; total: number; percent: number }
  | { type: 'COMPLETE'; result: GenerationResult; selectedNames?: string[] }
  | { type: 'ERROR'; message: string };

export type UiToPluginMessage =
  | { type: 'GENERATE'; options: GenerationOptions }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'CANCEL' }
  | { type: 'READY' }
  | { type: 'REQUEST_PAGES' };
