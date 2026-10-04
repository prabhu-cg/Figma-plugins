import type { DesignSystem } from '@shared/types';
import type { ExportOptions, GeneratedFile } from '@shared/messages';
import { generateComponentDocs } from './componentMd';
import { generateCssFile } from './cssFile';
import { generateCssTokensJson } from './cssTokensJson';
import { generateDesignMd } from './designMd';
import { generateScssFile } from './scssFile';
import { generateTailwindPreset } from './tailwindPreset';
import { generateTokensJson } from './tokensJson';

export { generateComponentDocs, generateComponentMd } from './componentMd';
export { generateCssTokensJson } from './cssTokensJson';
export { generateDesignMd } from './designMd';
export { generateCssFile } from './cssFile';
export { generateScssFile } from './scssFile';
export { generateTailwindPreset } from './tailwindPreset';
export { generateTokensJson } from './tokensJson';

export function generateOutputs(ds: DesignSystem, options: ExportOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (options.designMd) files.push(generateDesignMd(ds));
  if (options.componentDocs) files.push(...generateComponentDocs(ds));
  if (options.tokensJson) files.push(generateTokensJson(ds));
  if (options.cssTokensJson) files.push(generateCssTokensJson(ds));
  if (options.cssFile) files.push(generateCssFile(ds));
  if (options.scssFile) files.push(generateScssFile(ds));
  if (options.tailwindPreset) files.push(generateTailwindPreset(ds));

  return files;
}
