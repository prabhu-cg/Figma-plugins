import type { DesignSystem } from '@shared/types';
import type { ExportOptions, GeneratedFile } from '@shared/messages';
import { generateComponentDocs } from './componentMd';
import { generateCssFile } from './cssFile';
import { generateDesignMd } from './designMd';
import { generateTokensJson } from './tokensJson';

export { generateComponentDocs, generateComponentMd } from './componentMd';
export { generateDesignMd } from './designMd';
export { generateCssFile } from './cssFile';
export { generateTokensJson } from './tokensJson';

export function generateOutputs(ds: DesignSystem, options: ExportOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (options.designMd) files.push(generateDesignMd(ds));
  if (options.componentDocs) files.push(...generateComponentDocs(ds));
  if (options.tokensJson) files.push(generateTokensJson(ds));
  if (options.cssFile) files.push(generateCssFile(ds));

  return files;
}
