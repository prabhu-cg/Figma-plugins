import type { FoundationsSchema } from '@/types/schemas';
import { validateSelection, createErrorResult } from './validator';
import { extractComponentDocumentation } from './extractor';
import { generateMarkdown } from './generators/markdown-generator';
import { separateIconsFromComponents } from './generators/icon-utils';
import type { ComponentDocumentation, DocumentationResult, ExtractionContext } from './types';

export async function generateComponentDocumentation(
  selection: readonly any[],
  options: { exportMarkdown?: boolean; markdownMode?: 'selected' | 'current-page' | 'full-system' } = {},
  context: ExtractionContext = { components: [], variantsByComponentId: {} },
  foundations?: FoundationsSchema
): Promise<DocumentationResult> {
  // Validate selection
  const validation = validateSelection(selection);
  if (!validation.valid) {
    return createErrorResult(validation.error || 'Invalid selection');
  }

  // Extract valid components
  const validComponents = selection.filter(
    (node: any) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  );

  console.log(`generateComponentDocumentation - selection size: ${selection.length}, validComponents: ${validComponents.length}`);
  console.log(`generateComponentDocumentation - validComponents names:`, validComponents.slice(0, 5).map((c: any) => c.name));

  // Extract component documentation with actual variant counts
  const componentsData: ComponentDocumentation[] = [];
  const variantCounts: Record<string, number> = {};

  for (const component of validComponents) {
    const variants = context.variantsByComponentId[component.id] || [];
    const isComponentSet = component.type === 'COMPONENT_SET';
    const documentation = extractComponentDocumentation(component, variants, context, isComponentSet);
    componentsData.push(documentation);
    // Store actual variant count from Figma
    variantCounts[component.id] = variants.length;
  }

  // Generate exports
  const exports: Record<string, string> = {};

  if (options.exportMarkdown !== false) {
    // Only include foundations for full-system markdown
    const includeFoundations = options.markdownMode === 'full-system';

    // Separate icons from regular components for full-system mode
    let componentsToRender = componentsData;
    let iconLibraryData = undefined;

    if (includeFoundations) {
      const { regularComponents, iconLibrary } = separateIconsFromComponents(componentsData);
      componentsToRender = regularComponents;
      iconLibraryData = iconLibrary || undefined;
    }

    exports.markdown = generateMarkdown(componentsToRender, foundations, includeFoundations, iconLibraryData);
  }

  // Build UI metadata with actual variant counts
  const uiComponents = validComponents.map((component) => {
    const comp = componentsData.find((c) => c.name === component.name);
    if (!comp) return null;

    const variantChips = comp.variantGroups
      .slice(0, 3)
      .map((group) => `${group.name}: ${group.values.slice(0, 2).join(', ')}${group.values.length > 2 ? '...' : ''}`);

    return {
      name: comp.name,
      variantChips,
      variantCount: variantCounts[component.id] || 0,
    };
  }).filter((c) => c !== null) as any[];

  return {
    valid: true,
    components: componentsData,
    markdown: exports.markdown,
    ui: {
      components: uiComponents,
    },
  };
}

export type { ComponentDocumentation, DocumentationResult };
export { validateSelection };
