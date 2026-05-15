import type { GenerationOptions, GenerationResult, ProgressStep } from '@/types/messages';
import type { RootManifest, SourceInfo } from '@/types/schemas';
import type { RawExtractionResult } from '@/types/raw';
import { extractColorStyles, extractTextStyles, extractEffectStyles, extractGridStyles } from './extractor/styles';
import { extractColorVariables, extractSpacingVariables, extractBorderRadiusVariables, extractBorderWidthVariables } from './extractor/variables';
import { extractComponents } from './extractor/components';
import { assembleFoundations } from './assembler/foundations';
import { assembleComponents } from './assembler/components';
import { assembleMetadata } from './assembler/metadata';
import { assembleHealth } from './assembler/health';
import { renderMarkdown } from './renderer/markdown';
import { renderFigmaPage } from './renderer/figma-page';
import { filterFoundationsByComponents, filterComponentsBySelection, getParentComponentName } from './filter/selection-filter';
import { categorizePages, getDefaultSettings, isFoundationPageName } from './filter/page-detection';
import { generateComponentDocumentation } from './documentation-engine';

function buildVariableIdToNameMap(colorVariables: any[], spacingVariables: any[]): Record<string, string> {
  const map: Record<string, string> = {};

  colorVariables?.forEach((v: any) => {
    if (v.id && v.name) {
      map[v.id] = v.name;
    }
  });

  spacingVariables?.forEach((v: any) => {
    if (v.id && v.name) {
      map[v.id] = v.name;
    }
  });

  return map;
}

// Safely serialize objects using JSON round-trip to ensure only JSON-serializable data
function serializeForPostMessage(obj: any): any {
  try {
    // JSON.stringify will throw or skip any non-serializable properties
    // Using a replacer to handle circular references and non-serializable values
    const jsonStr = JSON.stringify(obj, (key, value) => {
      // Skip functions, symbols, and Figma objects
      if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
      }
      // Skip arrays of objects that might contain Figma references
      if (Array.isArray(value) && value.length > 1000) {
        return undefined; // Skip very large arrays that might contain DOM or Figma refs
      }
      return value;
    });

    return JSON.parse(jsonStr);
  } catch (error) {
    // If serialization fails, return safe empty structure
    console.error('Serialization error:', error);
    return { valid: false, error: 'Serialization failed' };
  }
}

export async function generateDocumentation(
  selection: readonly any[],
  options: GenerationOptions,
  onProgress: (step: ProgressStep, index: number, total: number) => void
): Promise<GenerationResult> {
  // Check if selection contains valid components
  const hasValidComponents = selection.some((node: any) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET');

  // Route to component documentation engine for Markdown and Figma exports
  if ((options.exportMarkdown || options.exportFigmaPage) && hasValidComponents) {
    const markdownMode = options.markdownMode || 'selected';
    if (markdownMode === 'selected') {
      return generateDocumentationWithComponentEngine(selection, options, onProgress);
    } else if (markdownMode === 'current-page') {
      return generateCurrentPageDocumentation(selection, options, onProgress);
    } else if (markdownMode === 'full-system') {
      return generateFullSystemDocumentation(selection, options, onProgress);
    }
  }

  const total = 6;

  try {
    onProgress('EXTRACTING_STYLES', 0, total);
    const colorStyles = extractColorStyles();
    const textStyles = extractTextStyles();
    const effectStyles = extractEffectStyles();
    const gridStyles = extractGridStyles();

    onProgress('EXTRACTING_VARIABLES', 1, total);
    const colorVariables = extractColorVariables();
    const spacingVariables = extractSpacingVariables();
    const borderRadiusVariables = extractBorderRadiusVariables();
    const borderWidthVariables = extractBorderWidthVariables();

    onProgress('EXTRACTING_COMPONENTS', 2, total);
    const { components, variantsByComponentId } = extractComponents(selection);

    const currentPage = figma.currentPage;
    if (!currentPage) {
      throw new Error('No active page in Figma');
    }

    const selectedNodeIds = (selection as any[]).map((n: any) => n.id as string);

    const raw: RawExtractionResult = {
      colorStyles,
      textStyles,
      effectStyles,
      gridStyles,
      colorVariables,
      typographyVariables: [],
      spacingVariables,
      borderRadiusVariables,
      borderWidthVariables,
      components,
      variantsByComponentId,
      selectedNodeIds,
      fileKey: (figma as any).fileKey ?? '',
      fileName: figma.root.name,
      pageId: currentPage.id,
      pageName: currentPage.name,
    };

    onProgress('BUILDING_SCHEMA', 3, total);
    const foundations = assembleFoundations(raw);
    const componentsSchema = assembleComponents(raw);

    // Filter to only selected components and their used foundations
    const filteredComponentsSchema = filterComponentsBySelection(componentsSchema, { selectedNodeIds });
    const filteredFoundations = filterFoundationsByComponents(foundations, filteredComponentsSchema.components);
    const source: SourceInfo = {
      fileKey: raw.fileKey,
      fileName: raw.fileName,
      pageId: raw.pageId,
      pageName: raw.pageName,
      selectionIds: raw.selectedNodeIds,
    };
    const metadata = assembleMetadata(filteredFoundations, filteredComponentsSchema, source);
    const health = assembleHealth(filteredFoundations, filteredComponentsSchema);

    const manifest: RootManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source,
      domains: { foundations: filteredFoundations, components: filteredComponentsSchema, metadata, health },
    };

    onProgress('RENDERING_FIGMA_PAGE', 4, total);
    let figmaPageId: string | undefined;
    if (options.exportFigmaPage) {
      // Pass first selected component for smart positioning and component docs
      const selectedComp = (selection as any[]).find((n: any) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
      figmaPageId = await renderFigmaPage(filteredComponentsSchema.components, selectedComp, filteredFoundations);
    }

    onProgress('EXPORTING_FILES', 5, total);

    const exports: any = {};
    if (options.exportMarkdown) {
      exports.markdown = renderMarkdown(manifest);
    }
    if (options.exportFigmaPage && figmaPageId) {
      exports.figmaPageId = figmaPageId;
    }

    return {
      manifest: serializeForPostMessage(manifest),
      exports,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unknown error during documentation generation'
    );
  }
}

async function generateDocumentationWithComponentEngine(
  selection: readonly any[],
  options: GenerationOptions,
  onProgress: (step: ProgressStep, index: number, total: number) => void
): Promise<GenerationResult> {
  const total = 5;

  console.log('Component engine - received options:', options);

  try {
    onProgress('EXTRACTING_STYLES', 0, total);
    const colorStyles = extractColorStyles();
    const textStyles = extractTextStyles();
    const effectStyles = extractEffectStyles();
    const gridStyles = extractGridStyles();

    onProgress('EXTRACTING_VARIABLES', 1, total);
    const colorVariables = extractColorVariables();
    const spacingVariables = extractSpacingVariables();
    const borderRadiusVariables = extractBorderRadiusVariables();
    const borderWidthVariables = extractBorderWidthVariables();

    onProgress('EXTRACTING_COMPONENTS', 2, total);
    const { components, variantsByComponentId } = extractComponents(selection);

    const currentPage = figma.currentPage;
    if (!currentPage) {
      throw new Error('No active page in Figma');
    }

    const selectedNodeIds = (selection as any[]).map((n: any) => n.id as string);

    const raw: RawExtractionResult = {
      colorStyles,
      textStyles,
      effectStyles,
      gridStyles,
      colorVariables,
      typographyVariables: [],
      spacingVariables,
      borderRadiusVariables,
      borderWidthVariables,
      components,
      variantsByComponentId,
      selectedNodeIds,
      fileKey: (figma as any).fileKey ?? '',
      fileName: figma.root.name,
      pageId: currentPage.id,
      pageName: currentPage.name,
    };

    onProgress('BUILDING_SCHEMA', 3, total);
    const foundations = assembleFoundations(raw);

    const result = await generateComponentDocumentation(
      selection,
      options,
      { components, variantsByComponentId, colorVariables, spacingVariables, variableIdToNameMap: buildVariableIdToNameMap(colorVariables, spacingVariables) },
      foundations
    );

    // Calculate actual variant counts from Figma
    const actualVariantCounts: Record<string, number> = {};
    (selection as any[]).forEach((node) => {
      const variants = variantsByComponentId[node.id] || [];
      actualVariantCounts[node.id] = variants.length;
    });

    onProgress('EXPORTING_FILES', 4, total);

    if (!result.valid) {
      throw new Error(result.error || 'Invalid selection');
    }

    // Convert component documentation to manifest format for UI display
    // Use actual variants from Figma, not generated from variant groups
    const componentsForManifest = result.components?.map((comp) => {
      // Find the source component to get actual variant count
      const sourceComponent = (selection as any[]).find((c) => c.name === comp.name);
      const actualVariants = sourceComponent ? (variantsByComponentId[sourceComponent.id] || []) : [];

      return {
        id: comp.name,
        name: comp.name,
        description: comp.description,
        category: 'unknown' as const,
        anatomy: comp.anatomy.map((part) => ({
          partName: part.name,
          nodeId: '',
          role: 'unknown' as const,
        })),
        variantGroups: comp.variantGroups.map((group) => ({
          property: group.name,
          type: 'variant' as const,
          values: group.values,
        })),
        // Use actual variants from Figma
        variants: actualVariants.map((v, idx) => ({
          id: v.id,
          combination: Object.fromEntries(
            Object.entries(v.componentProperties || {}).map(([key, value]: [string, any]) => [
              key,
              String(value?.value ?? value ?? ''),
            ])
          ),
          nodeId: v.id,
        })),
        states: comp.states.map((s) => s.name),
        tokenBindings: {
          colors: comp.tokenBindings.colors.map((t) => t.value),
          typography: comp.tokenBindings.typography.map((t) => t.value),
          spacing: comp.tokenBindings.spacing.map((t) => t.value),
          effects: [],
        },
        accessibilityNotes: {
          role: 'unknown' as const,
          keyboardInteraction: comp.accessibility.interactionClarity,
          ariaAttributes: [],
        },
        usageGuidelines: {
          when: comp.usage.whenToUse,
          whenNot: comp.usage.whenNotToUse,
          antiPatterns: comp.usage.donts,
        },
        doExamples: [],
        dontExamples: [],
      };
    }) || [];

    // Create a compatible manifest structure for the UI
    const manifest: RootManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        fileKey: (figma as any).fileKey ?? '',
        fileName: figma.root.name,
        pageId: figma.currentPage.id,
        pageName: figma.currentPage.name,
        selectionIds: (selection as any[]).map((n: any) => n.id),
      },
      domains: {
        foundations: { colors: [], typography: [], spacing: [], borderRadius: [], borderWidth: [], elevation: [], grids: [] },
        components: { components: componentsForManifest },
        metadata: {
          pluginVersion: '1.0.0',
          schemaVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          source: {
            fileKey: (figma as any).fileKey ?? '',
            fileName: figma.root.name,
            selectionIds: (selection as any[]).map((n: any) => n.id),
          },
          counts: {
            colorTokens: 0,
            typographyTokens: 0,
            spacingTokens: 0,
            gridTokens: 0,
            components: result.components?.length || 0,
            variants: Object.values(actualVariantCounts).reduce((sum, c) => sum + c, 0),
            tokenBindings: 0,
          },
          exportFormats: ['markdown', 'figmaPage'],
        },
        health: {
          overallScore: 0,
          breakdown: {
            foundationsScore: 0,
            componentsScore: 0,
            tokenCoverageScore: 0,
            namingConsistencyScore: 0,
          },
          warnings: [],
          missingFields: [],
          namingPatterns: { detected: [], consistent: true, recommendation: '' },
        },
      },
    };

    // Handle Figma page export
    let figmaPageId: string | undefined;
    if (options.exportFigmaPage) {
      // Pass first selected component for smart positioning
      const selectedComp = (selection as any[]).find((n: any) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
      figmaPageId = await renderFigmaPage(result.components || [], selectedComp, foundations);
    }

    const exports: any = {};
    if (result.markdown) exports.markdown = result.markdown;
    if (figmaPageId) exports.figmaPageId = figmaPageId;

    return {
      manifest: serializeForPostMessage(manifest),
      exports,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unknown error during documentation generation'
    );
  }
}

async function generateCurrentPageDocumentation(
  _selection: readonly any[],
  options: GenerationOptions,
  onProgress: (step: ProgressStep, index: number, total: number) => void
): Promise<GenerationResult> {
  const total = 5;

  try {
    onProgress('EXTRACTING_STYLES', 0, total);
    const colorStyles = extractColorStyles();
    const textStyles = extractTextStyles();
    const effectStyles = extractEffectStyles();
    const gridStyles = extractGridStyles();

    onProgress('EXTRACTING_VARIABLES', 1, total);
    const colorVariables = extractColorVariables();
    const spacingVariables = extractSpacingVariables();
    const borderRadiusVariables = extractBorderRadiusVariables();
    const borderWidthVariables = extractBorderWidthVariables();

    const currentPage = figma.currentPage;
    if (!currentPage) {
      throw new Error('No active page in Figma');
    }

    // Extract all components from current page
    onProgress('EXTRACTING_COMPONENTS', 2, total);
    const { components, variantsByComponentId } = extractComponents(currentPage.children as any[]);

    // Build foundations from current page
    onProgress('BUILDING_SCHEMA', 3, total);
    const raw: RawExtractionResult = {
      colorStyles,
      textStyles,
      effectStyles,
      gridStyles,
      colorVariables,
      typographyVariables: [],
      spacingVariables,
      borderRadiusVariables,
      borderWidthVariables,
      components,
      variantsByComponentId,
      selectedNodeIds: [],
      fileKey: (figma as any).fileKey ?? '',
      fileName: figma.root.name,
      pageId: currentPage.id,
      pageName: currentPage.name,
    };

    const foundations = assembleFoundations(raw);
    const componentsSchema = assembleComponents(raw);

    // Generate component documentation for all components
    const componentsToDocument = components.filter(
      (c: any) => c.type === 'COMPONENT' || c.type === 'COMPONENT_SET'
    );

    const result = await generateComponentDocumentation(
      componentsToDocument,
      options,
      { components, variantsByComponentId, colorVariables, spacingVariables, variableIdToNameMap: buildVariableIdToNameMap(colorVariables, spacingVariables) },
      foundations
    );

    onProgress('EXPORTING_FILES', 4, total);

    if (!result.valid) {
      throw new Error(result.error || 'Invalid selection');
    }

    // Create manifest with foundations
    const manifest: RootManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        fileKey: raw.fileKey,
        fileName: raw.fileName,
        pageId: raw.pageId,
        pageName: raw.pageName,
        selectionIds: [],
      },
      domains: {
        foundations,
        components: componentsSchema,
        metadata: {
          pluginVersion: '1.0.0',
          schemaVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          source: {
            fileKey: raw.fileKey,
            fileName: raw.fileName,
            selectionIds: [],
          },
          counts: {
            colorTokens: foundations.colors?.length || 0,
            typographyTokens: foundations.typography?.length || 0,
            spacingTokens: foundations.spacing?.length || 0,
            gridTokens: foundations.grids?.length || 0,
            components: result.components?.length || 0,
            variants: 0,
            tokenBindings: 0,
          },
          exportFormats: ['markdown', 'figmaPage'],
        },
        health: {
          overallScore: 0,
          breakdown: {
            foundationsScore: 0,
            componentsScore: 0,
            tokenCoverageScore: 0,
            namingConsistencyScore: 0,
          },
          warnings: [],
          missingFields: [],
          namingPatterns: { detected: [], consistent: true, recommendation: '' },
        },
      },
    };

    // Handle Figma page export
    let figmaPageId: string | undefined;
    if (options.exportFigmaPage) {
      // Pass first selected component for smart positioning
      const selectedComp = (_selection as any[]).find((n: any) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
      figmaPageId = await renderFigmaPage(result.components || [], selectedComp, foundations);
    }

    const exports: any = {};
    if (result.markdown) exports.markdown = result.markdown;
    if (figmaPageId) exports.figmaPageId = figmaPageId;

    return {
      manifest: serializeForPostMessage(manifest),
      exports,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unknown error during current page documentation'
    );
  }
}

async function generateFullSystemDocumentation(
  _selection: readonly any[],
  options: GenerationOptions,
  onProgress: (step: ProgressStep, index: number, total: number) => void
): Promise<GenerationResult> {
  const total = 5;

  try {
    // Determine whether to extract foundation sections (colors, typography, etc.)
    // Only extract if the file has dedicated foundation pages AND at least one is selected.
    // If the file has no foundation pages at all, always extract (backward-compat).
    const allFilePageNames = (figma.root.children as any[]).map((p) => p.name);
    const fileHasFoundationPages = allFilePageNames.some((n) => isFoundationPageName(n));
    const selectedPageNames = options.selectedPages ?? [];
    const hasSelectedFoundationPage = fileHasFoundationPages
      ? selectedPageNames.some((n) => isFoundationPageName(n))
      : true;

    onProgress('EXTRACTING_STYLES', 0, total);
    const colorStyles = hasSelectedFoundationPage ? extractColorStyles() : [];
    const textStyles = hasSelectedFoundationPage ? extractTextStyles() : [];
    const effectStyles = hasSelectedFoundationPage ? extractEffectStyles() : [];
    const gridStyles = hasSelectedFoundationPage ? extractGridStyles() : [];

    onProgress('EXTRACTING_VARIABLES', 1, total);
    const colorVariables = hasSelectedFoundationPage ? extractColorVariables() : [];
    const spacingVariables = hasSelectedFoundationPage ? extractSpacingVariables() : [];
    const borderRadiusVariables = hasSelectedFoundationPage ? extractBorderRadiusVariables() : [];
    const borderWidthVariables = hasSelectedFoundationPage ? extractBorderWidthVariables() : [];

    // Extract all components from all pages
    onProgress('EXTRACTING_COMPONENTS', 2, total);
    const allPages = figma.root.children;
    let allFigmaComponents: any[] = [];
    let allComponents: any[] = [];
    const variantsByComponentId: Record<string, any[]> = {};
    const componentIdToPageName: Record<string, string> = {};
    const processedIds = new Set<string>();

    // Recursively find all COMPONENT and COMPONENT_SET nodes
    const variantComponentIds = new Set<string>();

    // First pass: identify variant component IDs (children of COMPONENT_SET)
    function identifyVariants(nodes: any[]): void {
      for (const node of nodes) {
        if (node.type === 'COMPONENT_SET' && node.children) {
          for (const child of node.children) {
            if (child.type === 'COMPONENT') {
              variantComponentIds.add(child.id);
            }
          }
        }
        if (node.children) {
          identifyVariants(node.children);
        }
      }
    }

    // Second pass: collect components (skip variant instances)
    // Only collect top-level components, don't recurse into component children
    function collectComponentNodes(nodes: any[], pageName: string): void {
      for (const node of nodes) {
        if (!node || processedIds.has(node.id)) continue;

        if (node.type === 'COMPONENT_SET') {
          processedIds.add(node.id);
          componentIdToPageName[node.id] = pageName; // Track page name separately
          allFigmaComponents.push(node);
          // Don't recurse into component set children - they're variants
        } else if (node.type === 'COMPONENT' && !variantComponentIds.has(node.id)) {
          // Only include standalone components, not variant components
          processedIds.add(node.id);
          componentIdToPageName[node.id] = pageName; // Track page name separately
          allFigmaComponents.push(node);
          // Don't recurse into component children
        } else if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
          // For non-component nodes (frames, groups, etc), recurse to find top-level components
          if (node.children && Array.isArray(node.children)) {
            collectComponentNodes(node.children, pageName);
          }
        }
      }
    }

    // Use user-selected pages if provided, otherwise use smart detection
    let pagesToInclude: Set<string>;
    if (options.selectedPages && options.selectedPages.length > 0) {
      pagesToInclude = new Set(options.selectedPages);
      console.log('Using user-selected pages:', Array.from(pagesToInclude));
    } else {
      // Detect page types for smart filtering
      const pageNames = allPages.map((p: any) => p.name);
      const detectedPages = categorizePages(pageNames);
      const settings = getDefaultSettings(detectedPages);
      pagesToInclude = new Set(settings.includedPages);
      console.log('Using auto-detected pages:', Array.from(pagesToInclude));
    }


    // Run both passes, only on selected pages
    for (const page of allPages) {
      if (pagesToInclude.has((page as any).name)) {
        identifyVariants(page.children as any[]);
      }
    }

    for (const page of allPages) {
      if (pagesToInclude.has((page as any).name)) {
        collectComponentNodes(page.children as any[], (page as any).name);
      }
    }

    // Log page and component breakdown for debugging
    const pageComponentBreakdown: Record<string, string[]> = {};
    allFigmaComponents.forEach((c: any) => {
      const page = componentIdToPageName[c.id] || 'unknown';
      if (!pageComponentBreakdown[page]) pageComponentBreakdown[page] = [];
      pageComponentBreakdown[page].push(c.name);
    });
    console.log(`Full-system extraction - ${allFigmaComponents.length} component sets across ${Object.keys(pageComponentBreakdown).length} pages:`);
    Object.entries(pageComponentBreakdown).forEach(([page, comps]) => {
      console.log(`  Page "${page}": ${comps.join(', ')}`);
    });

    // Extract component data for manifest building
    const { components: extractedComponents, variantsByComponentId: extractedVariants } = extractComponents(allFigmaComponents, componentIdToPageName);
    allComponents = extractedComponents;
    Object.assign(variantsByComponentId, extractedVariants);

    // Build foundations from entire file
    onProgress('BUILDING_SCHEMA', 3, total);
    const raw: RawExtractionResult = {
      colorStyles,
      textStyles,
      effectStyles,
      gridStyles,
      colorVariables,
      typographyVariables: [],
      spacingVariables,
      borderRadiusVariables,
      borderWidthVariables,
      components: allComponents,
      variantsByComponentId,
      selectedNodeIds: [],
      fileKey: (figma as any).fileKey ?? '',
      fileName: figma.root.name,
      pageId: figma.currentPage?.id ?? '',
      pageName: figma.currentPage?.name ?? '',
    };

    const foundations = assembleFoundations(raw);
    const componentsSchema = assembleComponents(raw);

    // Generate component documentation for all components using original Figma nodes
    let result;
    if (allFigmaComponents.length === 0) {
      result = {
        valid: true,
        components: [],
        markdown: undefined,
        ui: { components: [] },
      };
    } else {
      result = await generateComponentDocumentation(
        allFigmaComponents,
        options,
        { components: allComponents, variantsByComponentId, colorVariables, spacingVariables, variableIdToNameMap: buildVariableIdToNameMap(colorVariables, spacingVariables), componentIdToPageName },
        foundations
      );
    }

    onProgress('EXPORTING_FILES', 4, total);

    if (!result.valid) {
      throw new Error(result.error || 'Invalid selection');
    }

    // Create manifest with foundations
    const manifest: RootManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source: {
        fileKey: raw.fileKey,
        fileName: raw.fileName,
        pageId: raw.pageId,
        pageName: raw.pageName,
        selectionIds: [],
      },
      domains: {
        foundations,
        components: componentsSchema,
        metadata: {
          pluginVersion: '1.0.0',
          schemaVersion: '1.0.0',
          generatedAt: new Date().toISOString(),
          source: {
            fileKey: raw.fileKey,
            fileName: raw.fileName,
            selectionIds: [],
          },
          counts: {
            colorTokens: foundations.colors?.length || 0,
            typographyTokens: foundations.typography?.length || 0,
            spacingTokens: foundations.spacing?.length || 0,
            gridTokens: foundations.grids?.length || 0,
            components: result.components?.length || 0,
            variants: 0,
            tokenBindings: 0,
          },
          exportFormats: ['markdown', 'figmaPage'],
        },
        health: {
          overallScore: 0,
          breakdown: {
            foundationsScore: 0,
            componentsScore: 0,
            tokenCoverageScore: 0,
            namingConsistencyScore: 0,
          },
          warnings: [],
          missingFields: [],
          namingPatterns: { detected: [], consistent: true, recommendation: '' },
        },
      },
    };

    // Handle Figma page export
    let figmaPageId: string | undefined;
    if (options.exportFigmaPage) {
      // Pass first selected component for smart positioning
      const selectedComp = allComponents.find((n: any) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
      figmaPageId = await renderFigmaPage(result.components || [], selectedComp, foundations);
    }

    const exports: any = {};
    if (result.markdown) exports.markdown = result.markdown;
    if (figmaPageId) exports.figmaPageId = figmaPageId;

    // For full-system, return minimal manifest since user only needs the markdown export
    return {
      manifest: {
        version: '1.0.0',
        generatedAt: manifest.generatedAt,
        source: manifest.source,
        domains: {
          foundations: { colors: [], typography: [], spacing: [], grids: [] } as any,
          components: { components: [] } as any,
          metadata: {} as any,
          health: { overallScore: 0, breakdown: {} as any, warnings: [], missingFields: [], namingPatterns: {} as any } as any,
        },
      },
      exports,
    } as any;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unknown error during full system documentation'
    );
  }
}
