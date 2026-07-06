import type { DesignSystem } from '@shared/types';
import type { ExportOptions, GeneratedFile } from '@shared/messages';
import { generateComponentDocs } from './componentMd';
import { generateCssTokensJson } from './cssTokensJson';
import { generateDesignMd } from './designMd';
import { generateTokensJson } from './tokensJson';

export { generateComponentDocs, generateComponentMd } from './componentMd';
export { generateCssTokensJson } from './cssTokensJson';
export { generateDesignMd } from './designMd';
export { generateTokensJson } from './tokensJson';

export function generateOutputs(ds: DesignSystem, options: ExportOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (options.designMd) files.push(generateDesignMd(ds));
  if (options.componentDocs) files.push(...generateComponentDocs(ds));
  if (options.tokensJson) files.push(generateTokensJson(ds));
  if (options.cssTokensJson) files.push(generateCssTokensJson(ds));

  return files;
}
