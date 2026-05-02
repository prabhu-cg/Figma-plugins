# Token System Generator Pro

A free Figma plugin that scaffolds a complete design token system — color ramps, spacing, border radius, and typography — directly into your Figma Variables in seconds.

## Overview

Token System Generator Pro creates production-ready Figma Variable collections following a 2-tier (Global + Alias) or 3-tier (Global + Alias + Component) token architecture. It generates tokens in multiple ways and exports them as collection-aware JSON following industry standards for seamless developer handoffs.

## Key Features

✨ **Three generation approaches** — pick what works for your workflow
- **From Scratch** — brand hex input → complete token system
- **Starter System** — boilerplate tokens ready to edit
- **Smart Convert** — auto-scan local paint/text styles → token hierarchy

📐 **Two architecture options** — choose your scale
- **2-Tier** (Global → Alias) — suitable for smaller design systems
- **3-Tier** (Global → Alias → Component) — for complex systems with component-level tokens

🎨 **What gets generated**
- **Color ramps** — 10-stop (50–900) per brand color with semantic aliases (Primary, Secondary, Tertiary, Accent, Feedback)
- **Typography scale** — 13 levels (Display-lg → xs) across 5 musical scale ratios with font family binding
- **Spacing scale** — 10-level scale from configurable base unit
- **Border radius** — 7 semantic values (none → full circle)
- **Border width** — 5 semantic values (hairline → xl)

📦 **Collection-aware JSON export**
```json
{
  "global": { 
    "color": { "primary": { "50": "#...", "100": "#...", ... } },
    "typography": { "heading": { "fontSize": 48, "lineHeight": 56, ... } },
    "spacing": { ... },
    "radius": { ... }
  },
  "alias": {
    "color": { "primary": { "50": "{global.color.primary.50}", ... } },
    "text": { ... }
  },
  "component": {
    "surface": { ... },
    "text": { ... },
    "icon": { ... },
    "border": { ... }
  }
}
```

Export includes proper token path references, composite typography objects, and is ready for Style Dictionary integration.

## How it works

### From Scratch
1. Input brand colors (hex)
2. Set spacing base, border radius base, typography base size
3. Choose type scale ratio (5 options: Major Second, Minor Third, Major Third, Perfect Fourth, √2)
4. Optional: select font family (defaults to Inter with fallback to Helvetica)
5. Choose 2-tier or 3-tier architecture
6. Plugin generates all token collections + local text styles with font bindings

### Starter System
1. Choose 2-tier or 3-tier architecture
2. Plugin scaffolds collections with placeholder values
3. Edit directly in Figma Variables UI
4. Export to JSON for dev handoff

### Smart Convert
1. Plugin scans existing **local paint styles** and **local text styles** in your file
2. Auto-extracts color families (e.g., `Red 50`, `Red 100` → `red` family with 10 stops)
3. Organizes into Global → Alias hierarchy
4. For 3-tier, creates Component collection with text, icon, surface, border tokens
5. Text styles are converted to typography variables with font family binding
6. All mappings are automatically wired (Alias → Global, Component → Alias)

## Token Architecture Details

### 2-Tier (Global + Alias)
- **Global** — raw primitives, not for direct use
  - `color/primary/50` ... `color/primary/900`
  - `color/secondary/50` ... (all primary colors with stops)
  - `typography/font-size/*`, `typography/line-height/*`, `typography/letter-spacing/*`
  - `spacing/*`, `radius/*`, `border-width/*`

- **Alias** — semantic decisions, for use in designs
  - `color/primary/50` ... (all stops mapped to Global)
  - `text/*` — typography composites (fontSize, lineHeight, letterSpacing)

### 3-Tier (Global + Alias + Component)
Adds **Component** collection:
- `surface/*` — surface background tokens mapped to Alias
- `text/*` — text color tokens mapped to Alias
- `icon/*` — icon color tokens mapped to Alias
- `border/*` — border color tokens mapped to Alias

All component tokens reference Alias tokens, which reference Global tokens. This creates a clear dependency chain for maintenance.

## Smart Convert — What happens to your styles

| Your Local Style | → Global Variable | → Alias Reference |
|---|---|---|
| `Red 50` | `color/red/50` | `color/red/50: {global.color.red.50}` |
| `Red 100` | `color/red/100` | `color/red/100: {global.color.red.100}` |
| `...` (up to 900) | ... | ... |
| `Heading/h1` (Inter, 48px, 1.4× LH) | `typography/font-size/h1`, `typography/line-height/h1`, etc. | `text/h1: { fontSize: {global.typography.font-size.h1}, ... }` |

**Key improvements in Smart Convert (latest):**
- Proper color family extraction — groups `Red 50`, `Red 100`, etc. by base name
- Correct slash-based variable naming (`color/red/50` not `color/red-50`)
- All color stops (50–900) for each family
- Full typography variable support with font binding
- Proper alias resolution to collection-aware paths (e.g., `{global.color.primary.50}`)
- 3-tier component collection automatically wired to Alias

## JSON Export Format

The export is **collection-aware** and **standards-compliant**:
- Root nodes mirror Figma collections: `global`, `alias`, `component`
- Token paths use dot-notation (camelCase): `{global.color.primary.50}`
- Variable aliases resolve to `{collection.path.to.token}` format
- Typography tokens are composite objects (not scattered individual variables)
- Type metadata included (`{ value, type }`) for Style Dictionary compatibility

**Example:**
```json
{
  "global": {
    "color": {
      "primary": {
        "50": { "value": "#EBF2FF", "type": "color" },
        "500": { "value": "#3B6BE8", "type": "color" }
      }
    },
    "typography": {
      "fontSize": {
        "h1": { "value": 48, "type": "dimension" }
      }
    }
  },
  "alias": {
    "color": {
      "primary": {
        "50": { "value": "{global.color.primary.50}", "type": "color" },
        "500": { "value": "{global.color.primary.500}", "type": "color" }
      }
    },
    "text": {
      "h1": {
        "value": {
          "fontSize": 48,
          "lineHeight": 56,
          "letterSpacing": 0
        },
        "type": "typography"
      }
    }
  }
}
```

## Font Loading & Fallback

- **From Scratch** approach binds local text styles to your selected font family (default: Inter)
- If the selected font is unavailable on your system, the plugin automatically falls back to Helvetica
- Font loading is async and safe — no permission warnings or font errors

## Development

Built with TypeScript + Figma Plugin API. No external dependencies.

```bash
npm install
npm run build          # Builds once
npm run watch         # Auto-rebuilds on file changes
npm run test          # Run test suite (algorithms only)
```

### Project structure
- `code.ts` — Figma plugin logic, token generation, variable management
- `ui.html` — UI shell, form inputs, wizard screens, JSON display
- `tests/algorithms.test.js` — Pure algorithm tests (color ramps, type scales)
- `tsconfig.json` — TypeScript config (strict mode, ES2020 target)

## How to contribute

Suggestions for next features:
1. **Accessibility Validator** — WCAG AA/AAA contrast checking for semantic color pairs
2. **Dark Mode Generator** — auto-generate dark mode from light palette
3. **Import from JSON** — reverse-engineer Style Dictionary JSON back to Figma variables
4. **Token Health Audit** — scan and flag duplicates, off-scale values, missing aliases
5. **Variable Scope Auto-Assignment** — auto-set correct Figma scopes per token type
6. **Elevation/Shadow Scale** — box-shadow tokens from neutral color base

## License

Free for all Figma plan tiers. No restrictions.

---

Made for designers and developers who want production-ready design systems, fast.
