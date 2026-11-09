import type { DesignSystem } from '@shared/types';
import type { StructureResult } from '../extraction/structures';
import type { ExportOptions, GeneratedFile } from '@shared/messages';
import { generateComponentDocs } from './componentMd';
import { generateComponentsJson } from './componentsJson';
import { generateCssFile } from './cssFile';
import { generateDesignMd } from './designMd';
import { generateTokensJson } from './tokensJson';

export { generateComponentDocs, generateComponentMd } from './componentMd';
export { generateDesignMd } from './designMd';
export { generateComponentsJson } from './componentsJson';
export { generateCssFile } from './cssFile';
export { generateTokensJson } from './tokensJson';

export interface GenerateExtras {
  /** Structure of each component by id, read from Figma. Needed for components.json. */
  structures?: ReadonlyMap<string, StructureResult>;
}

export function generateOutputs(
  ds: DesignSystem,
  options: ExportOptions,
  extras: GenerateExtras = {},
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (options.designMd) files.push(generateDesignMd(ds));
  if (options.componentDocs) files.push(...generateComponentDocs(ds));
  if (options.tokensJson) files.push(generateTokensJson(ds));
  if (options.cssFile) files.push(generateCssFile(ds));
  if (options.componentsJson)
    files.push(generateComponentsJson(ds, extras.structures ?? new Map()));

  return files;
}
