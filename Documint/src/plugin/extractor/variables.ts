import type { RawVariable } from '@/types/raw';

function buildCollectionMap(): Map<string, string> {
  const collections = figma.variables.getLocalVariableCollections() as any[];
  return new Map(collections.map((c: any) => [c.id as string, c.name as string]));
}

function mapVariable(v: any, collections: Map<string, string>): RawVariable {
  return {
    id: v.id as string,
    name: v.name as string,
    collectionId: v.variableCollectionId as string,
    collectionName: collections.get(v.variableCollectionId as string) ?? '',
    resolvedType: v.resolvedType,
    valuesByMode: v.valuesByMode as Record<string, unknown>,
    aliasedVariableId: null,
  };
}

export function extractColorVariables(): RawVariable[] {
  const collections = buildCollectionMap();
  const vars = figma.variables.getLocalVariables('COLOR') as any[];
  return vars.map(v => mapVariable(v, collections));
}

export function extractSpacingVariables(): RawVariable[] {
  const collections = buildCollectionMap();
  const allFloats = figma.variables.getLocalVariables('FLOAT') as any[];
  return allFloats
    .filter((v: any) => {
      const lower = (v.name as string).toLowerCase();
      // Primary patterns
      if (lower.includes('spacing') || lower.includes('space') ||
          lower.includes('gap') || lower.includes('padding')) return true;
      // Fallback patterns
      if (lower.includes('margin') || lower.includes('inset') ||
          lower.includes('offset') || lower.includes('gutter')) return true;
      return false;
    })
    .map(v => mapVariable(v, collections));
}

export function extractBorderRadiusVariables(): RawVariable[] {
  const collections = buildCollectionMap();
  const allFloats = figma.variables.getLocalVariables('FLOAT') as any[];
  return allFloats
    .filter((v: any) => {
      const lower = (v.name as string).toLowerCase();
      // Primary patterns
      if (lower.includes('radius') || lower.includes('corner') || lower.includes('border-radius')) return true;
      // Fallback patterns
      if (lower.includes('roundness') || lower.includes('rounding') || lower.includes('borderradius')) return true;
      return false;
    })
    .map(v => mapVariable(v, collections));
}

export function extractBorderWidthVariables(): RawVariable[] {
  const collections = buildCollectionMap();
  const allFloats = figma.variables.getLocalVariables('FLOAT') as any[];
  return allFloats
    .filter((v: any) => {
      const lower = (v.name as string).toLowerCase();
      // Primary patterns
      if ((lower.includes('border') || lower.includes('stroke')) &&
          (lower.includes('width') || lower.includes('size') || lower.includes('weight'))) return true;
      // Fallback patterns
      if (lower.includes('lineweight') || lower.includes('line-weight') ||
          lower.includes('strokewidth') || lower.includes('stroke-width') ||
          lower.includes('strokesize') || lower.includes('stroke-size') ||
          lower.includes('thickness')) return true;
      return false;
    })
    .map(v => mapVariable(v, collections));
}
