import type { DesignSystem } from '@shared/types';
import type { StructureResult } from '@shared/structureTypes';
import type { ExportOptions, GeneratedFile, OutputFailure } from '@shared/messages';
import { generateComponentDocs } from './componentMd';
import { generateComponentsJsonFiles } from './componentsJson';
import { generateCssFile } from './cssFile';
import { generateDesignMd } from './designMd';
import { generateTokensJson } from './tokensJson';

export { generateComponentDocs, generateComponentMd } from './componentMd';
export { generateDesignMd } from './designMd';
export { generateComponentsJson, generateComponentsJsonFiles } from './componentsJson';
export { generateCssFile } from './cssFile';
export { generateTokensJson } from './tokensJson';

export interface GenerateExtras {
  /** Structure of each component by id, read from Figma. Needed for components.json. */
  structures?: ReadonlyMap<string, StructureResult>;
  /** Size above which components.json is split into per-component files. Defaults to 20 MB. */
  splitThresholdBytes?: number;
}

export interface GenerateResult {
  files: GeneratedFile[];
  failures: OutputFailure[];
}

/**
 * Generates every selected output. One output failing does not stop the others: its reason is
 * returned in `failures` and the rest are still offered.
 */
export function generateOutputsDetailed(
  ds: DesignSystem,
  options: ExportOptions,
  extras: GenerateExtras = {},
): GenerateResult {
  const files: GeneratedFile[] = [];
  const failures: OutputFailure[] = [];
  const run = (output: string, make: () => GeneratedFile | GeneratedFile[]) => {
    try {
      const made = make();
      files.push(...(Array.isArray(made) ? made : [made]));
    } catch (err) {
      failures.push({ output, reason: err instanceof Error ? err.message : String(err) });
    }
  };

  if (options.designMd) run('design.md', () => generateDesignMd(ds));
  if (options.componentDocs) run('Component docs', () => generateComponentDocs(ds));
  if (options.tokensJson) run('tokens.json', () => generateTokensJson(ds));
  if (options.cssFile) run('tokens.css', () => generateCssFile(ds));
  if (options.componentsJson) {
    run('components.json', () =>
      generateComponentsJsonFiles(ds, extras.structures ?? new Map(), {
        splitThresholdBytes: extras.splitThresholdBytes,
        includeText: options.includeText,
        includeVariantDiffs: options.includeVariantDiffs,
        includeInstanceInternals: options.includeInstanceInternals,
      }),
    );
  }
  return { files, failures };
}

/** Like generateOutputsDetailed, but throws when any selected output fails. */
export function generateOutputs(
  ds: DesignSystem,
  options: ExportOptions,
  extras: GenerateExtras = {},
): GeneratedFile[] {
  const { files, failures } = generateOutputsDetailed(ds, options, extras);
  if (failures.length > 0) {
    throw new Error(failures.map((f) => `${f.output}: ${f.reason}`).join('; '));
  }
  return files;
}
