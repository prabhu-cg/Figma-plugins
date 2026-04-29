import type {
  ComponentsSchema, ComponentDoc, AnatomyPart, VariantGroup,
  ComponentVariant, TokenBindings, AccessibilityNotes, UsageGuidelines,
} from '@/types/schemas';
import type { RawExtractionResult } from '@/types/raw';
import { inferAnatomyRole, inferComponentCategory, inferAccessibilityRole, inferKeyboardInteraction, inferAriaAttributes } from '@/plugin/inference/anatomy-mapper';
import { classifyVariantProperty, extractStatesFromVariants } from '@/plugin/inference/variant-classifier';
import { detectTokenBindings } from '@/plugin/inference/token-binder';

export function buildVariantGroups(
  definitions: Record<string, { type: string; variantOptions?: string[] }>
): VariantGroup[] {
  return Object.entries(definitions)
    .filter(([, def]) => def.type === 'VARIANT')
    .map(([property, def]) => ({
      property,
      type: classifyVariantProperty(property),
      values: def.variantOptions ?? [],
    }));
}

export function buildVariants(
  variantNodes: Array<{ id: string; name: string; componentProperties: Record<string, { value: unknown }> }>
): ComponentVariant[] {
  return variantNodes.map(v => ({
    id: v.id,
    combination: Object.fromEntries(
      Object.entries(v.componentProperties).map(([k, p]) => [k, String(p.value)])
    ),
    nodeId: v.id,
  }));
}

export function buildComponentDoc(
  raw: {
    id: string;
    name: string;
    description: string;
    componentPropertyDefinitions: Record<string, { type: string; variantOptions?: string[] }>;
    children: Array<{ id: string; name: string }>;
  },
  variantNodes: Array<{ id: string; name: string; componentProperties: Record<string, { value: unknown }> }>,
  tokenBindings: TokenBindings
): ComponentDoc {
  const variantGroups = buildVariantGroups(raw.componentPropertyDefinitions);
  const states = extractStatesFromVariants(variantGroups);
  const variants = buildVariants(variantNodes);

  const anatomy: AnatomyPart[] = raw.children.map(child => ({
    partName: child.name,
    nodeId: child.id,
    role: inferAnatomyRole(child.name),
  }));

  const a11yRole = inferAccessibilityRole(raw.name);
  const accessibilityNotes: AccessibilityNotes = {
    role: a11yRole,
    keyboardInteraction: inferKeyboardInteraction(a11yRole),
    ariaAttributes: inferAriaAttributes(a11yRole, states),
  };

  const usageGuidelines: UsageGuidelines = { when: [], whenNot: [], antiPatterns: [] };

  return {
    id: raw.id, name: raw.name, description: raw.description,
    category: inferComponentCategory(raw.name),
    anatomy, variantGroups, variants, states,
    tokenBindings, accessibilityNotes, usageGuidelines,
    doExamples: [], dontExamples: [],
  };
}

export function assembleComponents(raw: RawExtractionResult): ComponentsSchema {
  const components: ComponentDoc[] = raw.components.map((rawComp: any) => {
    const variants = raw.variantsByComponentId[rawComp.id] ?? [];
    const { bindings } = detectTokenBindings(rawComp as any);
    const children = Array.isArray(rawComp.children) ? rawComp.children : [];
    return buildComponentDoc(
      {
        id: rawComp.id,
        name: rawComp.name,
        description: rawComp.description ?? '',
        componentPropertyDefinitions: rawComp.componentPropertyDefinitions ?? {},
        children: children.map((c: any) => ({ id: c.id as string, name: c.name as string })),
      },
      variants.map((v: any) => ({
        id: v.id,
        name: v.name,
        componentProperties: v.componentProperties ?? {},
      })),
      bindings
    );
  });
  return { components };
}
