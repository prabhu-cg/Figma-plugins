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
      return lower.includes('spacing') || lower.includes('space') ||
             lower.includes('gap') || lower.includes('padding');
    })
    .map(v => mapVariable(v, collections));
}
