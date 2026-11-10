import { isCancelled } from '../utils/async';
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
  | 'variables'
  | 'text-styles'
  | 'color-styles'
  | 'effect-styles'
  | 'grid-styles'
  | 'pages'
  | 'components';

export interface ExtractionProgress {
  stage: ExtractionProgressStage;
  done: number;
  total: number;
  /** What is being worked on, for example the name of the page being searched. */
  detail?: string;
}

/**
 * Runs every extractor. Each stage is isolated with its own error handling
 * (see `safely` inside each extractor) so a failure in one area — e.g. a
 * corrupted style — never prevents the rest of the design system from
 * being extracted.
 */
export interface ExtractionOptions {
  /** Limit component extraction to these layers. Variables and styles are always file-wide. */
  selection?: readonly SceneNode[];
}

export async function extractDesignSystem(
  onProgress?: (progress: ExtractionProgress) => void,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  // Per-stage timings, printed once at the end (Plugins > Development > Open console).
  const timings: string[] = [];
  const timed = async <T>(label: string, run: () => Promise<T>, count: (r: T) => number) => {
    const started = Date.now();
    const result = await run();
    timings.push(`${label} ${count(result)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return result;
  };

  const { collections, variables } = await timed(
    'variables',
    () =>
      extractVariableCollections(
        (done, total) => onProgress?.({ stage: 'variables', done, total }),
        warn,
      ),
    (r) => r.variables.length,
  );

  const textStyles = await timed(
    'text styles',
    () =>
      extractTextStyles((done, total) => onProgress?.({ stage: 'text-styles', done, total }), warn),
    (r) => r.length,
  );

  const paintStyles = await timed(
    'color styles',
    () =>
      extractPaintStyles(
        (done, total) => onProgress?.({ stage: 'color-styles', done, total }),
        warn,
      ),
    (r) => r.length,
  );

  const effectStyles = await timed(
    'effect styles',
    () =>
      extractEffectStyles(
        (done, total) => onProgress?.({ stage: 'effect-styles', done, total }),
        warn,
      ),
    (r) => r.length,
  );

  const gridStyles = await timed(
    'grid styles',
    () =>
      extractGridStyles((done, total) => onProgress?.({ stage: 'grid-styles', done, total }), warn),
    (r) => r.length,
  );

  const components = await timed(
    'components',
    () =>
      extractComponents(
        (done, total) => onProgress?.({ stage: 'components', done, total }),
        warn,
        options.selection,
        (done, total, name) => onProgress?.({ stage: 'pages', done, total, detail: name }),
      ),
    (r) => r.length,
  );
  console.log(`[DesignMD] scan: ${timings.join(', ')}`);

  if (isCancelled()) {
    warn('The scan was cancelled before it finished, so these results are partial.');
  } else if (collections.length === 0 && variables.length === 0) {
    warn('No local variables found — falling back to styles as the token source of truth.');
  }
  if (components.length === 0 && !isCancelled()) {
    warn(
      options.selection
        ? 'No components or component sets found in the selection.'
        : 'No components or component sets found in this file.',
    );
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
