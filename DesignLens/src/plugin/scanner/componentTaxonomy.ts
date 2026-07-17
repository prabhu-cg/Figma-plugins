import type { ComponentKind } from "@shared/types";

const KIND_KEYWORDS: Array<[ComponentKind, string[]]> = [
  ["checkbox", ["checkbox"]],
  ["radio", ["radio"]],
  ["switch", ["switch", "toggle"]],
  ["select", ["select", "dropdown", "combobox"]],
  ["input", ["input", "textfield", "text field", "textarea", "text area"]],
  ["button", ["button", "btn", "cta"]],
  ["tab", ["tab"]],
  ["accordion", ["accordion", "disclosure"]],
  ["menu-item", ["menu item", "menuitem", "list item", "dropdown item"]],
  ["link", ["link"]],
  ["card", ["card"]],
  ["badge", ["badge", "tag", "chip", "pill"]],
  ["alert", ["alert", "banner", "toast", "notification"]],
  ["icon", ["icon"]]
];

export function detectComponentKind(name: string): ComponentKind {
  const lower = name.toLowerCase();
  for (const [kind, keywords] of KIND_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return kind;
  }
  return "unknown";
}

/** Expected interaction states per component kind, used to flag coverage gaps. Empty = no expectation. */
export const EXPECTED_STATES: Record<ComponentKind, string[]> = {
  button: ["default", "hover", "pressed", "focus", "disabled"],
  input: ["default", "focus", "error", "disabled"],
  checkbox: ["checked", "unchecked", "indeterminate", "disabled"],
  radio: ["selected", "unselected", "disabled"],
  switch: ["on", "off", "disabled"],
  select: ["default", "open", "disabled"],
  tab: ["default", "selected", "disabled"],
  accordion: ["collapsed", "expanded"],
  "menu-item": ["default", "hover", "selected", "disabled"],
  link: ["default", "hover", "visited"],
  card: [],
  badge: [],
  alert: [],
  icon: [],
  unknown: []
};

const KNOWN_STATE_VOCAB = new Set(
  Array.from(new Set(Object.values(EXPECTED_STATES).flat())).concat([
    "active",
    "loading",
    "expanded",
    "collapsed",
    "indeterminate",
    "visited",
    "error",
    "success",
    "warning"
  ])
);

export function detectStatesFromVariants(variantPropertyValues: string[]): string[] {
  const found = new Set<string>();
  for (const raw of variantPropertyValues) {
    const value = raw.trim().toLowerCase();
    if (KNOWN_STATE_VOCAB.has(value)) found.add(value);
  }
  return Array.from(found);
}
