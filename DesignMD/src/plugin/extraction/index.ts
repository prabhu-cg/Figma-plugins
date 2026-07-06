import { extractComponents } from './components';
import {
  extractEffectStyles,
  extractGridStyles,
  extractPaintStyles,
  extractTextStyles,
} from './styles';
import { extractVariableCollections } from './variables';
import type { ExtractionResult } from './rawTypes';

export type ExtractionProgressStage =
  'variables' | 'text-styles' | 'color-styles' | 'effect-styles' | 'grid-styles' | 'components';

export interface ExtractionProgress {
  stage: ExtractionProgressStage;
  done: number;
  total: number;
}

/**
 * Runs every extractor. Each stage is isolated with its own error handling
 * (see `safely` inside each extractor) so a failure in one area — e.g. a
 * corrupted style — never prevents the rest of the design system from
 * being extracted.
 */
export async function extractDesignSystem(
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);

  const { collections, variables } = await extractVariableCollections(
    (done, total) => onProgress?.({ stage: 'variables', done, total }),
    warn,
  );

  const textStyles = await extractTextStyles(
    (done, total) => onProgress?.({ stage: 'text-styles', done, total }),
    warn,
  );

  const paintStyles = await extractPaintStyles(
    (done, total) => onProgress?.({ stage: 'color-styles', done, total }),
    warn,
  );

  const effectStyles = await extractEffectStyles(
    (done, total) => onProgress?.({ stage: 'effect-styles', done, total }),
    warn,
  );

  const gridStyles = await extractGridStyles(
    (done, total) => onProgress?.({ stage: 'grid-styles', done, total }),
    warn,
  );

  const components = await extractComponents(
    (done, total) => onProgress?.({ stage: 'components', done, total }),
    warn,
  );

  if (collections.length === 0 && variables.length === 0) {
    warn('No local variables found — falling back to styles as the token source of truth.');
  }
  if (components.length === 0) {
    warn('No components or component sets found in this file.');
  }

  return {
    collections,
    variables,
    textStyles,
    paintStyles,
    effectStyles,
    gridStyles,
    components,
    warnings,
  };
}
