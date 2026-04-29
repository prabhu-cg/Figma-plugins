import type { GenerationOptions, GenerationResult, ProgressStep } from '@/types/messages';
import type { RootManifest, SourceInfo } from '@/types/schemas';
import type { RawExtractionResult } from '@/types/raw';
import { extractColorStyles, extractTextStyles, extractEffectStyles, extractGridStyles } from './extractor/styles';
import { extractColorVariables, extractSpacingVariables } from './extractor/variables';
import { extractComponents } from './extractor/components';
import { assembleFoundations } from './assembler/foundations';
import { assembleComponents } from './assembler/components';
import { assembleMetadata } from './assembler/metadata';
import { assembleHealth } from './assembler/health';

export async function generateDocumentation(
  selection: readonly any[],
  options: GenerationOptions,
  onProgress: (step: ProgressStep, index: number, total: number) => void
): Promise<GenerationResult> {
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

    onProgress('EXTRACTING_COMPONENTS', 2, total);
    const { components, variantsByComponentId } = extractComponents(selection);

    const currentPage = figma.currentPage;
    if (!currentPage) {
      throw new Error('No active page in Figma');
    }

    const raw: RawExtractionResult = {
      colorStyles,
      textStyles,
      effectStyles,
      gridStyles,
      colorVariables,
      typographyVariables: [],
      spacingVariables,
      components,
      variantsByComponentId,
      selectedNodeIds: (selection as any[]).map((n: any) => n.id as string),
      fileKey: (figma as any).fileKey ?? '',
      fileName: figma.root.name,
      pageId: currentPage.id,
      pageName: currentPage.name,
    };

    onProgress('BUILDING_SCHEMA', 3, total);
    const foundations = assembleFoundations(raw);
    const componentsSchema = assembleComponents(raw);
    const source: SourceInfo = {
      fileKey: raw.fileKey,
      fileName: raw.fileName,
      pageId: raw.pageId,
      pageName: raw.pageName,
      selectionIds: raw.selectedNodeIds,
    };
    const metadata = assembleMetadata(foundations, componentsSchema, source);
    const health = assembleHealth(foundations, componentsSchema);

    const manifest: RootManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      source,
      domains: { foundations, components: componentsSchema, metadata, health },
    };

    onProgress('RENDERING_FIGMA_PAGE', 4, total);
    let figmaPageId: string | undefined;
    if (options.exportFigmaPage) {
      // TODO: Implement page rendering in Figma
      // For now, this step is a no-op
    }

    onProgress('EXPORTING_FILES', 5, total);

    const exports: any = {};
    if (options.exportJson) {
      exports.json = JSON.stringify(manifest, null, 2);
    }
    if (options.exportMarkdown) {
      // TODO: Implement markdown export
      exports.markdown = '';
    }
    if (options.exportHtml) {
      // TODO: Implement HTML export
      exports.html = '';
    }
    if (options.exportFigmaPage && figmaPageId) {
      exports.figmaPageId = figmaPageId;
    }

    return {
      manifest,
      exports,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unknown error during documentation generation'
    );
  }
}
