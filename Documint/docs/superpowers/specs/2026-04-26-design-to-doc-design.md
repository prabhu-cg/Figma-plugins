# Design to Doc — Figma Plugin Design Spec

**Date:** 2026-04-26
**Status:** Approved
**Author:** Design session with Claude Code

---

## Problem Statement

Senior design system architects and designers lack a tool that auto-generates complete, structured, single-source-of-truth design system documentation from within Figma — without external services, AI dependencies, or manual content authoring. Existing tools (Zeroheight, Supernova, Specify) require SaaS subscriptions and live outside Figma.

**Design to Doc** is a free, self-contained Figma plugin that generates professional documentation from a designer's selection, living entirely inside Figma and exportable as Markdown, HTML, and JSON.

---

## Goals

- Generate structured design system documentation from selected Figma frames in one click
- Document foundations (colors, typography, spacing, grid) and components (atoms through organisms)
- Produce a styled Figma documentation page AND exportable file bundle
- Infer all semantic meaning from naming conventions, token structure, and Figma annotations — no AI, no manual input
- Provide a health score and actionable warnings for documentation completeness
- Compete with Zeroheight-quality output, free, inside Figma

---

## Non-Goals

- No AI or LLM integration
- No external API calls
- No SaaS subscription or backend
- No support for non-selected content (whole-file or whole-page modes)
- No real-time sync or versioning system

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Content population | Convention-based inference only | Free, offline, no dependencies |
| Output targets | Figma page + Markdown + HTML + JSON | Covers all handoff scenarios |
| Naming convention support | Agnostic — handles any pattern | Works with any team's existing files |
| Extraction scope | Selected frames only | Precision, designer control |
| Tech stack | React + TypeScript | Component reuse, type safety, ecosystem |
| Figma data sources | Styles + Variables (merged) | Future-proof across both Figma systems |
| Architecture | Domain-driven composable schemas | Scalable, independently evolvable domains |
| Plugin UI | 3-screen: Home → Progress → Results | Minimal, focused, no clutter |

---

## Architecture

Five layers, each with a single responsibility, communicating only with immediate neighbors:

```
Plugin UI (React)
      ↕  postMessage bridge
Plugin Controller (orchestration)
      ↓
Figma Extractor  (reads selection → raw data)
      ↓
Inference Engine  (raw → normalized + semantic)
      ↓
Domain Schema Assembler  (populates 4 domain schemas)
      ↓
Renderers  (Figma page | Markdown | HTML | JSON)
```

---

## Domain Schemas

The assembled output is a root manifest containing four domain schemas.

### Root Manifest

```json
{
  "version": "1.0.0",
  "generatedAt": "ISO-8601",
  "source": {
    "fileKey": "string",
    "fileName": "string",
    "pageId": "string",
    "pageName": "string",
    "selectionIds": ["string"]
  },
  "domains": {
    "foundations": {},
    "components": {},
    "metadata": {},
    "health": {}
  }
}
```

---

### Domain 1 — Foundations

#### Colors

```json
{
  "colors": [{
    "id": "string",
    "tokenName": "color/primary/500",
    "label": "Primary 500",
    "value": {
      "hex": "#3B82F6",
      "rgb": { "r": 59, "g": 130, "b": 246 }
    },
    "semanticRole": "primary | secondary | success | warning | error | neutral | surface | on-surface | unknown",
    "source": "style | variable",
    "variableMode": "string | null",
    "aliases": ["string"],
    "contrastOnWhite": 4.52,
    "contrastOnBlack": 3.21,
    "wcagAA": true,
    "wcagAAA": false,
    "usageHint": "string"
  }]
}
```

#### Typography

```json
{
  "typography": [{
    "id": "string",
    "tokenName": "text/heading/h1",
    "label": "Heading 1",
    "fontFamily": "Inter",
    "fontWeight": 700,
    "fontSize": 32,
    "lineHeight": { "value": 40, "unit": "px | % | auto" },
    "letterSpacing": { "value": -0.5, "unit": "px | %" },
    "textCase": "none | uppercase | lowercase | capitalize",
    "textDecoration": "none | underline | strikethrough",
    "role": "display | h1 | h2 | h3 | h4 | h5 | h6 | body-lg | body-md | body-sm | caption | label | code | overline | unknown",
    "source": "style | variable",
    "usageHint": "string"
  }]
}
```

#### Spacing

```json
{
  "spacing": [{
    "tokenName": "spacing/4",
    "label": "Spacing 4",
    "value": 16,
    "unit": "px",
    "scaleBase": 4,
    "scaleStep": 4,
    "usageHint": "string"
  }]
}
```

#### Grid

```json
{
  "grids": [{
    "tokenName": "string",
    "label": "string",
    "type": "columns | rows | grid",
    "count": 12,
    "gutter": 16,
    "margin": 24,
    "sectionSize": 64,
    "breakpointHint": "mobile | tablet | desktop | wide | unknown"
  }]
}
```

---

### Domain 2 — Components

```json
{
  "components": [{
    "id": "string",
    "name": "Button",
    "description": "string",
    "category": "atom | molecule | organism | template | unknown",
    "anatomy": [{
      "partName": "label",
      "nodeId": "string",
      "role": "text | icon | container | indicator | media | unknown"
    }],
    "variantGroups": [{
      "property": "Size",
      "type": "variant | state",
      "values": ["sm", "md", "lg"]
    }],
    "variants": [{
      "id": "string",
      "combination": { "Size": "md", "Type": "primary", "State": "default" },
      "nodeId": "string"
    }],
    "states": ["default", "hover", "focus", "active", "disabled", "error", "loading"],
    "tokenBindings": {
      "colors": ["color/primary/500"],
      "typography": ["text/label/md"],
      "spacing": ["spacing/4", "spacing/2"],
      "effects": ["shadow/sm"]
    },
    "accessibilityNotes": {
      "role": "button | link | input | checkbox | radio | listitem | unknown",
      "keyboardInteraction": "string",
      "ariaAttributes": ["aria-disabled", "aria-pressed"]
    },
    "usageGuidelines": {
      "when": ["string"],
      "whenNot": ["string"],
      "antiPatterns": ["string"]
    },
    "doExamples": [{ "label": "string", "description": "string" }],
    "dontExamples": [{ "label": "string", "description": "string" }]
  }]
}
```

---

### Domain 3 — Metadata

```json
{
  "pluginVersion": "string",
  "schemaVersion": "string",
  "generatedAt": "ISO-8601",
  "source": {
    "fileKey": "string",
    "fileName": "string",
    "selectionIds": ["string"]
  },
  "counts": {
    "colorTokens": 0,
    "typographyTokens": 0,
    "spacingTokens": 0,
    "gridTokens": 0,
    "components": 0,
    "variants": 0,
    "tokenBindings": 0
  },
  "exportFormats": ["figma-page", "markdown", "html", "json"]
}
```

---

### Domain 4 — Health

```json
{
  "overallScore": 0,
  "breakdown": {
    "foundationsScore": 0,
    "componentsScore": 0,
    "tokenCoverageScore": 0,
    "namingConsistencyScore": 0
  },
  "warnings": [{
    "severity": "error | warning | info",
    "domain": "foundations | components | metadata",
    "itemId": "string",
    "itemName": "string",
    "code": "MISSING_DESCRIPTION | UNLINKED_TOKEN | INCONSISTENT_NAMING | NO_STATES | NO_VARIANTS | HARDCODED_VALUE",
    "message": "string",
    "suggestion": "string"
  }],
  "missingFields": [{
    "domain": "string",
    "itemId": "string",
    "field": "string"
  }],
  "namingPatterns": {
    "detected": ["slash-separated", "camelCase"],
    "consistent": false,
    "recommendation": "string"
  }
}
```

---

## Inference Engine

### Naming Parser

Priority cascade handles any naming convention:

1. Detect separator: slash → dot → space → camelCase → PascalCase
2. Tokenize into segments: `["color", "primary", "500"]`
3. Map: `segment[0]` → domain, `segment[1]` → category, `segment[2]` → scale/step
4. Humanize: `color/primary/500` → `Primary 500`

Unknown patterns fall back to raw name + health warning.

### Color Semantic Role Keywords

| Keywords | Role |
|---|---|
| `primary`, `brand`, `main`, `key` | `primary` |
| `secondary`, `accent` | `secondary` |
| `success`, `positive`, `green`, `confirm` | `success` |
| `warning`, `caution`, `yellow`, `alert` | `warning` |
| `error`, `danger`, `red`, `destructive` | `error` |
| `neutral`, `gray`, `grey`, `slate` | `neutral` |
| `surface`, `background`, `bg`, `canvas` | `surface` |
| `on-surface`, `text`, `foreground`, `fg` | `on-surface` |

Cross-reference: tokens bound to a component whose name implies a role get that role in context (e.g., `red-500` in `AlertBanner` → role `error`).

### Typography Role Mapping

| Name pattern | Role |
|---|---|
| `display`, `hero` | `display` |
| `h1`–`h6`, `heading-1`–`heading-6` | `h1`–`h6` |
| `body`, `paragraph` + size | `body-lg/md/sm` |
| `caption`, `helper`, `hint` | `caption` |
| `label`, `tag` | `label` |
| `code`, `mono` | `code` |
| `overline`, `eyebrow` | `overline` |

### Variant vs. State Classifier

**State keywords** → classified as `type: "state"`, mapped to the `states` array:
`default`, `hover`, `hovered`, `focus`, `focused`, `active`, `pressed`, `disabled`, `error`, `loading`, `selected`, `checked`, `indeterminate`, `empty`, `filled`

**Variant keywords** → classified as `type: "variant"`:
`size`, `variant`, `type`, `style`, `color`, `emphasis`, `shape`, `weight`, `layout`, `density`

### Anatomy Layer Name Mapping

| Layer name pattern | Role |
|---|---|
| `icon`, `leading-icon`, `trailing-icon` | `icon` |
| `label`, `text`, `title` | `text` |
| `container`, `background`, `fill` | `container` |
| `indicator`, `dot`, `badge` | `indicator` |

### Token Binding Detection

Walks each component's node tree. Matches fills, strokes, text styles, and effects to known style/variable IDs. Hardcoded values (unlinked hex colors) generate `HARDCODED_VALUE` health warnings.

### Health Scoring

| Check | Points |
|---|---|
| Color token has semantic role | +2 each |
| Typography token has role | +2 each |
| Component has description | +5 each |
| Component has ≥2 states | +3 each |
| Component has token bindings | +4 each |
| Consistent naming patterns | +10 global |
| All tokens have labels | +5 global |

Score normalized to 0–100.

---

## Renderers

### Figma Documentation Page

Creates `📄 Design System Docs` page using auto-layout frames only (no absolute positioning).

**Page structure:**
```
Cover Frame
  └── System name · Timestamp · Health badge · Token/component counts

Foundations
  ├── Colors      — swatch grid grouped by semantic role + WCAG badges
  ├── Typography  — live type scale table with spec rows
  ├── Spacing     — proportional scale bar + token table
  └── Grid        — spec cards per breakpoint

Components
  └── Per component:
      Name + category · Anatomy · Variant matrix · States · Token bindings
      Accessibility notes · When/When Not · Do/Don't

Health Report
  └── Overall score · Breakdown bars · Warnings by severity
```

**Visual principles:**
- 8pt grid throughout
- System/Inter font for documentation text
- Section colors derived from the design system's own primary token
- WCAG badges: AA / AAA / FAIL
- Component anatomy frames are live linked embeds, not copies

### File Exporters

**Markdown** — one `.md` file per domain, plus `index.md`. Component files follow: description → anatomy → variants table → states → token bindings → accessibility → usage guidelines.

**HTML** — single self-contained file. Inline CSS, no external dependencies. Collapsible sections. Shareable as email attachment or static host drop-in.

**JSON** — raw assembled schema. Intended for engineering tooling, CI pipelines, Storybook integration.

---

## Plugin UI

### Screen 1 — Home

- Frame selection count (live, updates as selection changes)
- Export format checkboxes (Figma Page, Markdown, HTML, JSON — all on by default)
- Generate button (disabled until ≥1 frame selected)

### Screen 2 — Progress

- Step-by-step checklist with live status (✓ done, ● active, ○ pending)
- Progress bar with percentage
- Step labels: Extract Styles → Extract Variables → Analyse Components → Build Schema → Render Figma Page → Export Files

### Screen 3 — Results

- Health score (0–100, color-coded: ≥80 green, 50–79 amber, <50 red)
- Token + component counts
- Expandable warnings list (grouped by severity)
- Download links for each export format
- "View Figma Page" button (navigates to generated docs page)
- "Generate again" link (returns to Screen 1)

---

## File Structure (Plugin Repository)

```
design-to-doc/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   ├── plugin/
│   │   ├── main.ts                  # plugin sandbox entry point
│   │   ├── controller.ts            # orchestrates the run
│   │   ├── extractor/
│   │   │   ├── styles.ts            # extract Figma Styles
│   │   │   ├── variables.ts         # extract Figma Variables
│   │   │   └── components.ts        # extract components + variants
│   │   ├── inference/
│   │   │   ├── naming-parser.ts     # separator detection + humanization
│   │   │   ├── color-roles.ts       # semantic role inference
│   │   │   ├── type-roles.ts        # typography role mapping
│   │   │   ├── variant-classifier.ts # variant vs. state classification
│   │   │   ├── anatomy-mapper.ts    # layer name → anatomy role
│   │   │   └── token-binder.ts      # token binding detection
│   │   ├── assembler/
│   │   │   ├── foundations.ts       # populate foundations schema
│   │   │   ├── components.ts        # populate components schema
│   │   │   ├── metadata.ts          # populate metadata schema
│   │   │   └── health.ts            # populate health schema + scoring
│   │   └── renderers/
│   │       ├── figma-page/
│   │       │   ├── cover.ts
│   │       │   ├── foundations.ts
│   │       │   ├── components.ts
│   │       │   └── health-report.ts
│   │       ├── markdown.ts
│   │       ├── html.ts
│   │       └── json.ts
│   └── ui/
│       ├── index.html               # plugin UI entry point
│       ├── App.tsx
│       ├── screens/
│       │   ├── Home.tsx
│       │   ├── Progress.tsx
│       │   └── Results.tsx
│       └── components/
│           ├── HealthBadge.tsx
│           ├── WarningsList.tsx
│           └── DownloadLink.tsx
├── schemas/
│   ├── root.schema.json
│   ├── foundations.schema.json
│   ├── components.schema.json
│   ├── metadata.schema.json
│   └── health.schema.json
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-26-design-to-doc-design.md
```

---

## Differentiators vs. Market

| Feature | Design to Doc | Zeroheight | Supernova |
|---|---|---|---|
| Free | Yes | No | No |
| Lives inside Figma | Yes | No | No |
| No AI required | Yes | Partial | Partial |
| Convention-agnostic inference | Yes | No | No |
| Health scoring | Yes | No | Partial |
| Figma Variables support | Yes | Yes | Yes |
| Figma Styles support | Yes | Yes | Yes |
| One-click generation | Yes | No | No |
| Exportable Figma page | Yes | No | No |
