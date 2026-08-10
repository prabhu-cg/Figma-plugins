import type { RawChange } from "@plugin/diff/rawChange";

function fieldLabel(change: RawChange): string {
  return change.field ? change.field.split("/").pop() ?? change.field : "";
}

const SUMMARY_BUILDERS: Record<string, (c: RawChange) => string> = {
  "component-added": () => "Component added",
  "component-removed": () => "Component removed",
  "component-renamed": (c) => `Renamed from "${c.before}" to "${c.after}"`,
  "component-description-changed": () => "Description changed",
  "property-added": (c) => `Added property ${fieldLabel(c)}`,
  "property-removed": (c) => `Removed property ${fieldLabel(c)}`,
  "property-changed": (c) => `Changed property ${fieldLabel(c)}`,
  "variant-added": (c) => `Added variant ${fieldLabel(c)}`,
  "variant-removed": (c) => `Removed variant ${fieldLabel(c)}`,
  "structure-child-added": (c) => `Added layer ${fieldLabel(c)}`,
  "structure-child-removed": (c) => `Removed layer ${fieldLabel(c)}`,
  "structure-child-type-changed": (c) => `Layer type changed at ${fieldLabel(c)}`,
  "visibility-changed": (c) => `Visibility changed at ${fieldLabel(c)}`,
  "dimensions-changed": (c) => `Dimensions changed at ${fieldLabel(c)}`,
  "corner-radius-changed": (c) => `Corner radius changed at ${fieldLabel(c)}`,
  "fills-changed": (c) => `Fills changed at ${fieldLabel(c)}`,
  "strokes-changed": (c) => `Strokes changed at ${fieldLabel(c)}`,
  "effects-changed": (c) => `Effects changed at ${fieldLabel(c)}`,
  "typography-changed": (c) => `Typography changed at ${fieldLabel(c)}`,
  "token-binding-changed": (c) => `Variable binding changed at ${fieldLabel(c)}`,
  "style-binding-changed": (c) => `Style binding changed at ${fieldLabel(c)}`,
  "layout-mode-changed": () => "Layout mode changed",
  "padding-changed": () => "Padding changed",
  "gap-changed": () => "Gap changed",
  "alignment-changed": () => "Alignment changed",

  "token-added": () => "Token added",
  "token-removed": () => "Token removed",
  "token-renamed": (c) => `Renamed from "${c.before}" to "${c.after}"`,
  "token-type-changed": (c) => `Type changed from ${c.before} to ${c.after}`,
  "token-mode-added": (c) => `Added mode ${c.field}`,
  "token-mode-removed": (c) => `Removed mode ${c.field}`,
  "token-value-changed": () => "Token value changed",
  "token-alias-changed": () => "Token alias changed",
  "token-description-changed": () => "Description changed",
  "token-scopes-changed": () => "Scopes changed",
};

export function summarize(change: RawChange): string {
  const builder = SUMMARY_BUILDERS[change.changeType];
  return builder ? builder(change) : change.changeType;
}
