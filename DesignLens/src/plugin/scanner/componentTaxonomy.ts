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

/** Lowercases, splits camelCase and punctuation into single-spaced words: "ButtonPrimary/Large" -> "button primary large". */
function normalizeWords(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function detectComponentKind(name: string): ComponentKind {
  // Whole-word matching (with an optional plural "s") so "Table" isn't a tab, "Stage" isn't a tag, etc.
  const padded = ` ${normalizeWords(name)} `;
  for (const [kind, keywords] of KIND_KEYWORDS) {
    if (keywords.some((k) => padded.includes(` ${k} `) || padded.includes(` ${k}s `))) return kind;
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

/** Spelling variants designers use for the same state, mapped to the canonical name used in EXPECTED_STATES. */
const STATE_ALIASES: Record<string, string> = {
  focused: "focus",
  "focus visible": "focus",
  "focus ring": "focus",
  hovered: "hover",
  press: "pressed",
  active: "pressed",
  enabled: "default",
  rest: "default",
  normal: "default",
  inactive: "disabled",
  selected: "selected",
  unselected: "unselected",
  deselected: "unselected"
};

const KNOWN_STATE_VOCAB = new Set(
  Array.from(new Set(Object.values(EXPECTED_STATES).flat())).concat([
    "pressed",
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

/** Boolean-style property names that describe a state (e.g. "Disabled=True"), and what their False value means. */
const STATE_PROPERTIES: Record<string, { on: string; off?: string }> = {
  disabled: { on: "disabled" },
  error: { on: "error" },
  loading: { on: "loading" },
  focus: { on: "focus" },
  focused: { on: "focus" },
  hover: { on: "hover" },
  hovered: { on: "hover" },
  pressed: { on: "pressed" },
  active: { on: "pressed" },
  selected: { on: "selected", off: "unselected" },
  checked: { on: "checked", off: "unchecked" },
  indeterminate: { on: "indeterminate" },
  expanded: { on: "expanded", off: "collapsed" },
  open: { on: "open" },
  visited: { on: "visited" },
  on: { on: "on", off: "off" }
};

const TRUE_VALUES = new Set(["true", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "no", "off"]);

/** Canonical state name for a raw variant value ("Focused" -> "focus"), or null if it isn't a known state. */
export function canonicalState(raw: string): string | null {
  const value = normalizeWords(raw);
  const canonical = STATE_ALIASES[value] ?? value;
  return KNOWN_STATE_VOCAB.has(canonical) ? canonical : null;
}

/** States expressed by one variant's property dictionary, handling both "State=Hover" and "Disabled=True" styles. */
export function variantStatesOf(properties: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const [prop, rawValue] of Object.entries(properties)) {
    const value = normalizeWords(rawValue);
    const state = canonicalState(rawValue);
    if (state) found.add(state);
    const meaning = STATE_PROPERTIES[normalizeWords(prop)];
    if (meaning) {
      if (TRUE_VALUES.has(value)) found.add(meaning.on);
      else if (FALSE_VALUES.has(value) && meaning.off) found.add(meaning.off);
    }
  }
  return Array.from(found);
}

/** Boolean component properties that toggle a state (e.g. a "Disabled" boolean) count as covering that state. */
export function statesFromPropertyNames(propertyNames: string[]): string[] {
  const found = new Set<string>();
  for (const name of propertyNames) {
    const meaning = STATE_PROPERTIES[normalizeWords(name.split("#")[0])];
    if (meaning) found.add(meaning.on);
  }
  return Array.from(found);
}

export function detectStatesFromVariants(variantProperties: Record<string, string>[], propertyNames: string[] = []): string[] {
  const found = new Set<string>(statesFromPropertyNames(propertyNames));
  for (const props of variantProperties) {
    for (const state of variantStatesOf(props)) found.add(state);
  }
  return Array.from(found);
}
