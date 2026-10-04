import type { DesignSystem } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { buildCssVariableMaps } from './cssVariables';

export function generateCssTokensJson(ds: DesignSystem): GeneratedFile {
  const { root, modes } = buildCssVariableMaps(ds);

  const output = {
    metadata: {
      fileName: ds.metadata.fileName,
      generatedAt: ds.metadata.generatedAt,
    },
    root,
    modes,
  };

  return {
    path: 'css-tokens.json',
    content: JSON.stringify(output, null, 2),
  };
}
