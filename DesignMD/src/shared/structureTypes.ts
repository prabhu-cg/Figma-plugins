/** What the plugin reads from Figma for one component; the UI turns it into components.json. */
import type {
  ComponentPropertyV1,
  ComponentsWarning,
  FontUse,
  Layer,
  VariantDiff,
} from './componentsSchema';

export interface ComponentStructure {
  properties: ComponentPropertyV1[];
  defaultVariantId: string;
  tree: Layer;
  variantDiffs: VariantDiff[];
  treeTruncated: boolean;
  usedVariableIds: string[];
  usedStyleIds: string[];
  /** Fonts used by text in the component's trees. */
  usedFonts?: FontUse[];
  warnings: ComponentsWarning[];
}

export type StructureResult =
  ComponentStructure | { error: string; cancelled?: boolean; timedOut?: boolean };

export const isStructure = (r: StructureResult | undefined): r is ComponentStructure =>
  !!r && !('error' in r);
