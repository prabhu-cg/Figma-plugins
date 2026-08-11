# Token System Generator Pro — v2 Design Spec

**Date:** 2026-04-19
**Status:** Approved

---

## Overview

Extend the existing Figma plugin from a 2-screen wizard into a comprehensive 4-screen wizard that supports building a full token system from scratch (with color ramp generation), a boilerplate starter, or smart conversion from existing styles — plus an optional JSON export for dev handoff in Style Dictionary v3 format.

The visual language (card UI, orange brand color `#EE661D`, Inter font, slide animations) stays identical to the current version.

---

## Goals

- Let designers pick their own brand colors and auto-generate complete color ramps
- Keep Starter and Smart Convert modes fully intact
- Make JSON export optional and re-entrant (open plugin later to export without regenerating)
- Deliver dev-ready Style Dictionary v3 JSON covering all token types
- Zero new dependencies — pure JS/TS only

---

## Screen Flow

### Entry Point (Smart Landing)

When the plugin opens it checks `figma.variables.getLocalVariableCollections()`:

- **No variables found** → show Screen 1 (Mode selection, normal flow)
- **Variables found** → show Smart Landing screen:
  - Displays: "Found X variables across Y collections"
  - Two cards: **Export to JSON** (→ Screen 4) and **Regenerate tokens** (→ Screen 1)

### Screen 1 — Mode Selection

Three cards (same card component as today):

| Card | Description |
|------|-------------|
| From Scratch | Pick your own colors, generate full ramps |
| Starter System | Clean boilerplate with best-practice defaults |
| Smart Convert | Scan existing local styles and map to token hierarchy |

- Selecting any card auto-advances (200ms highlight delay, same as today)
- From Scratch → Screen 2
- Starter / Smart Convert → Screen 3 (skip color picker)

### Screen 2 — Color Picker (From Scratch only)

Back button returns to Screen 1. Shows two groups:

**Brand Colors** (required — Next button disabled until all three are valid hex):
- Primary
- Secondary
- Tertiary

**Semantic Colors** (pre-filled with sensible defaults, editable):
- Info: `#0066FF`
- Success: `#00BB66`
- Error: `#FF3333`
- Warning: `#FFAA00`

Each row: live color swatch + hex input field. Invalid hex → red swatch border, Next stays disabled.

**Spacing** (base unit input):
- Single number input: "Base unit (px)" — default `4`
- Live preview label below: "Scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64" (updates as user types)
- Contextual hint: "Use multiples of 4 or 8 for grid-friendly layouts. Your base unit is the smallest spacing step."
- Generates 10 tokens: base×1 through base×16 at Tailwind-equivalent multipliers

**Border Radius** (base unit input):
- Single number input: "Base radius (px)" — default `4`
- Live preview label: "none(0) · sm(2) · md(4) · lg(8) · xl(16) · 2xl(24) · full(∞)" (values scale from base)
- Contextual hint: "Controls how rounded your UI feels. 0 = sharp, 4 = subtle, 8 = friendly, 16 = soft."
- Generates 7 semantic tokens: none, sm (base÷2), md (base), lg (base×2), xl (base×4), 2xl (base×6), full (9999)

Next button requires: all 3 brand colors valid + base unit ≥ 1 + base radius ≥ 0.

### Screen 3 — Architecture

Same two-card layout as current Screen 1:
- 2 Tier System (Global → Alias)
- 3 Tier System (Global → Alias → Component)

Approach badge in top-right shows the selected mode from Screen 1 (e.g. "From Scratch", "Starter", "Smart Convert").
Generate button enabled after card selection.

### Screen 4 — Done + Export

Shown after successful generation AND as the Export destination from Smart Landing.

```
✅ X variables created across Y collections

── JSON Export ──────────────────────────────────
  [scrollable pre-formatted JSON code panel]
─────────────────────────────────────────────────
  [Copy to clipboard]       [Download tokens.json]

  [← Start over]    [Refresh JSON]
```

- **Copy to clipboard**: uses `navigator.clipboard.writeText()`
- **Download tokens.json**: creates a Blob URL and triggers `<a download>` click
- **Refresh JSON**: re-reads current Figma variables live (picks up manual edits)
- **Start over**: returns to Screen 1, clears state

---

## Color Ramp Algorithm

Applies to all 7 colors in From Scratch mode (primary, secondary, tertiary, info, success, error, warning).

**Stops:** 50, 100, 200, 300, 400, 500, 600, 700, 800, 900

**500 = the user's exact input color.**

Algorithm (pure JS, no dependencies):
1. Parse hex → RGB → HSL
2. For stops lighter than 500: increase lightness linearly toward ~95% (stop 50), slightly decrease saturation
3. For stops darker than 500: decrease lightness linearly toward ~10% (stop 900), slightly increase saturation for richness
4. Convert back HSL → hex for display; RGB floats (0–1) for Figma Variables API

---

## Token / Variable Structure

### From Scratch — 3 Tier

**01 Global**
```
color/primary/50 … color/primary/900
color/secondary/50 … color/secondary/900
color/tertiary/50 … color/tertiary/900
color/info/50 … color/info/900
color/success/50 … color/success/900
color/error/50 … color/error/900
color/warning/50 … color/warning/900
spacing/4, spacing/8, spacing/12, spacing/16, spacing/20, spacing/24, spacing/32, spacing/40, spacing/48, spacing/64
borderRadius/none, borderRadius/sm, borderRadius/md, borderRadius/lg, borderRadius/xl, borderRadius/2xl, borderRadius/full
typography/fontSize/body
typography/lineHeight/body
typography/letterSpacing/body
typography/paragraphSpacing/body
```

**02 Alias**
```
surface/primary        → color/primary/500
surface/secondary      → color/secondary/500
surface/tertiary       → color/tertiary/500
text/primary           → color/primary/900
text/inverse           → color/primary/50
semantic/info/default  → color/info/500
semantic/info/subtle   → color/info/100
semantic/success/default → color/success/500
semantic/success/subtle  → color/success/100
semantic/error/default → color/error/500
semantic/error/subtle  → color/error/100
semantic/warning/default → color/warning/500
semantic/warning/subtle  → color/warning/100
text/body/fontSize     → typography/fontSize/body
text/body/lineHeight   → typography/lineHeight/body
text/body/letterSpacing → typography/letterSpacing/body
text/body/paragraphSpacing → typography/paragraphSpacing/body
spacing/xs  → spacing/4
spacing/sm  → spacing/8
spacing/md  → spacing/16
spacing/lg  → spacing/24
spacing/xl  → spacing/40
borderRadius/default → borderRadius/md
```

**03 Component** (3-tier only)
```
component/text/primary    → text/primary
component/text/inverse    → text/inverse
component/surface/primary → surface/primary
component/icon/primary    → text/primary
component/icon/inverse    → text/inverse
component/border/default  → text/primary
component/feedback/info   → semantic/info/default
component/feedback/success → semantic/success/default
component/feedback/error  → semantic/error/default
component/feedback/warning → semantic/warning/default
```

### From Scratch — 2 Tier

Same Global layer. Alias layer maps the same tokens. No Component collection.

### Starter / Smart Convert

Unchanged from current implementation (existing `createStarterSystem`, `createStarterSystem2Tier`, `convertStylesToTokens`, `convertStylesToTokens2Tier` functions in `code.js`). These also get Screen 4 appended after generation.

---

## Naming Conventions (Style Dictionary v3)

All token names follow these rules consistently across Figma variables and JSON output:

| Rule | Example |
|------|---------|
| Slash-delimited paths in Figma variables | `color/primary/500` |
| Dot-nested keys in JSON | `color.primary.500` |
| camelCase for multi-word segments | `borderRadius/md`, `typography/fontSize/body` |
| Lowercase for all segments | `color/primary`, not `Color/Primary` |
| Numeric stops for color ramps | `50, 100, 200 … 900` |
| Numeric values for spacing primitives | `spacing/4`, `spacing/16` |
| Semantic names for radius and alias tokens | `borderRadius/md`, `surface/primary`, `spacing/sm` |
| No underscores, no spaces | `semantic/error/default`, not `semantic_error_default` |

Alias and component tokens use only semantic names — never raw values.

---

## JSON Export — Style Dictionary v3 Format

Reads live from `figma.variables.getLocalVariables()` at export time (always reflects current state).

Variable aliases are written as Style Dictionary references: `{path.to.token}`.

Example output:
```json
{
  "color": {
    "primary": {
      "50":  { "value": "#f5f0ff" },
      "100": { "value": "#ede0ff" },
      "500": { "value": "#6600ff" },
      "900": { "value": "#1a0040" }
    },
    "semantic": {
      "error": {
        "default": { "value": "{color.error.500}" }
      }
    }
  },
  "spacing": {
    "4":  { "value": 4 },
    "8":  { "value": 8 },
    "12": { "value": 12 },
    "16": { "value": 16 },
    "20": { "value": 20 },
    "24": { "value": 24 },
    "32": { "value": 32 },
    "40": { "value": 40 },
    "48": { "value": 48 },
    "64": { "value": 64 }
  },
  "borderRadius": {
    "none": { "value": 0 },
    "sm":   { "value": 2 },
    "md":   { "value": 4 },
    "lg":   { "value": 8 },
    "xl":   { "value": 16 },
    "2xl":  { "value": 24 },
    "full": { "value": 9999 }
  },
  "typography": {
    "fontSize": {
      "body": { "value": 16 }
    }
  }
}
```

Variable name `color/primary/500` → JSON path `color.primary.500` (slash-delimited → dot-nested).

---

## What Changes in Code

### `ui.html`
- Add Smart Landing screen (Screen 0)
- Rename current Screen 1 → Screen 3 (architecture)
- Add Screen 2 (color picker): 7 hex input rows with live swatches
- Add Screen 4 (export): JSON panel + copy/download/refresh/start-over buttons
- Update wizard JS: new state variables (`selectedMode`, `colorInputs`), new screen transitions
- Receive JSON string from `code.js` via `onmessage` and display in the export panel

### `code.js` / `code.ts`
- Add `createFromScratch3Tier(colors, spacing, radius)` and `createFromScratch2Tier(colors, spacing, radius)` functions
- Add `generateColorRamp(hex)` → returns object `{ 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 }` as RGB floats
- Add `generateSpacingScale(baseUnit)` → returns 10 spacing values using Tailwind-equivalent multipliers
- Add `generateRadiusScale(baseRadius)` → returns 7 semantic stops (none, sm, md, lg, xl, 2xl, full)
- Add `exportVariablesToJSON()` → reads all local variables/collections, returns Style Dictionary v3 object
- Add message handlers: `'export-json'`, `'from-scratch-generate'`
- Keep all 4 existing generation functions untouched
- Wire Screen 4 `postMessage` from existing `generate` + `confirm-continue` handlers

---

## Out of Scope

- Dark mode / light mode token modes (separate feature)
- Font family / font weight tokens
- Shadow tokens
- Figma Styles (paint styles, text styles) — only Figma Variables
- Publishing to Figma Community

---

## Open Questions

None — all resolved during brainstorming.
