# Documint

**Extract and document your design system directly from Figma — no APIs, no subscriptions, no data leaving your machine.**

Documint is a free, open Figma plugin that turns your design system into structured documentation in seconds. Everything runs locally inside Figma. There are no third-party services, no cloud backends, no AI APIs, and nothing to sign up for.

---

## What it does

Documint reads your Figma file and generates a complete design system reference document covering:

- **Components** — props, variants, anatomy, descriptions
- **Color tokens** — all paint styles and color variables
- **Typography** — text styles, font families, sizes, weights
- **Spacing & layout** — spacing variables and grid definitions
- **Icons** — auto-detected icon library with grouping by category

Output formats:

| Format | What you get |
|---|---|
| **Markdown** | A single `.md` file — version-control friendly, readable by AI tools, and compatible with any docs platform |
| **Figma Page** | A visual reference page created directly inside your Figma file |

---

## How to use it

1. Open your Figma file
2. Run the **Documint** plugin
3. Select one or more frames, or choose a generation mode:
   - **Selected components** — document only what you've selected (fastest)
   - **Current page scan** — extract everything on the current page
   - **Full design system** — scan all pages and choose which to include
4. Pick your export format (Markdown, Figma Page, or both)
5. For full-system mode, choose which pages to include using the page selector — component pages, foundation pages (colors, typography, spacing), and icon pages are listed separately
6. Press **Generate docs**

The file downloads automatically. No upload, no API call, no waiting on a server.

---

## Why Documint is different

Most design documentation tools require you to:

- Connect to a cloud service
- Share your Figma file with a third party
- Pay a subscription
- Wait for an AI to process your designs remotely

**Documint does none of that.** It is a self-contained Figma plugin. All extraction, analysis, and rendering happens inside the Figma plugin sandbox on your own machine. Your design data never leaves Figma.

---

## What gets extracted

### Foundations
Extracted from Figma file-level styles and variables — only when the corresponding foundation pages are included in your selection:

- Paint styles → color tokens
- Text styles → typography scale
- Effect styles → shadows and elevation
- Grid styles → layout grids
- Variables → color, spacing, border radius, border width

### Components
Extracted from `COMPONENT` and `COMPONENT_SET` nodes:

- Name, description, and page grouping
- Variant groups and property definitions
- Anatomy (named layers)
- Usage notes where available

### Icons
Auto-detected from pages whose names suggest an icon library (e.g. "Icons", "Glyphs"). Grouped by prefix — `arrow-up`, `arrow-down`, `arrow-left` are grouped under `arrow`.

---

## Page selection

In full-system mode, Documint categorises your file's pages automatically:

| Category | Description | Included by default |
|---|---|---|
| **Foundations** | Colors, typography, spacing, tokens | Yes |
| **Icons** | Icon library pages | Yes |
| **Components** | All other component pages | Yes |
| **Examples** | Demo, playground, template pages | No |

Deselecting a foundation page removes that section from the output — deselect "Colors" and no color section is generated.

---

## Output structure (Markdown)

```
# Design System Name

## 1. Overview
## 2. Color Tokens
## 3. Typography
## 4. Spacing
## 5. Components
   ### ComponentName
   - Variants
   - Anatomy
   - Properties
## 6. Icon Library
```

---

## Development

### Prerequisites
- Node.js 18+
- A Figma desktop app (for running the plugin locally)

### Setup

```bash
npm install
```

### Build

```bash
npm run build        # production build
npm run watch        # development watch mode
```

Build output goes to `dist/`. Load the plugin in Figma via **Plugins → Development → Import plugin from manifest** and point it at `manifest.json`.

### Test

```bash
npm test             # run all tests
npm run typecheck    # TypeScript type checking only
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Plugin runtime | Figma Plugin API (sandboxed JS worker) |
| UI | React 18 + inline styles |
| Icons | Phosphor React |
| Build | Webpack 5 + TypeScript |
| Tests | Jest |

No external runtime dependencies beyond React. No network requests.

---

## Privacy

Documint operates entirely within the Figma plugin sandbox:

- No data is sent to any server
- No analytics or telemetry
- No API keys required
- No account or login needed
- The generated file is saved directly to your local machine via your browser's download mechanism

---

## License

MIT
