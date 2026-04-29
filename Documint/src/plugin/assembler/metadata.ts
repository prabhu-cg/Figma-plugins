import type { MetadataSchema, FoundationsSchema, ComponentsSchema, SourceInfo } from '@/types/schemas';

const PLUGIN_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0.0';

export function assembleMetadata(
  foundations: FoundationsSchema,
  components: ComponentsSchema,
  source: Pick<SourceInfo, 'fileKey' | 'fileName' | 'selectionIds'>
): MetadataSchema {
  const totalBindings = components.components.reduce(
    (sum, c) =>
      sum + c.tokenBindings.colors.length + c.tokenBindings.typography.length +
      c.tokenBindings.spacing.length + c.tokenBindings.effects.length,
    0
  );

  return {
    pluginVersion: PLUGIN_VERSION,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source,
    counts: {
      colorTokens: foundations.colors.length,
      typographyTokens: foundations.typography.length,
      spacingTokens: foundations.spacing.length,
      gridTokens: foundations.grids.length,
      components: components.components.length,
      variants: components.components.reduce((sum, c) => sum + c.variants.length, 0),
      tokenBindings: totalBindings,
    },
    exportFormats: ['figma-page', 'markdown', 'html', 'json'],
  };
}
