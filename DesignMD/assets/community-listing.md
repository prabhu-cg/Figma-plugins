# Figma Community listing copy for DesignMD

Use this when filling out the "Publish plugin" form in the Figma desktop app
(Plugins → Development → Manage plugins in development → Publish).

---

## Plugin name

DesignMD

## Tagline (one-liner shown under the name in search/results — keep under ~60 chars)

Turn your design system into developer-ready docs & tokens

## Tags / categories

Suggested tags (Figma lets you pick a few from its own taxonomy plus free-text search terms):

- Design systems
- Documentation
- Developer handoff
- Design tokens
- Variables

## Support / contact

- Support email: (your email)
- Repository: https://github.com/prabhu-cg/Figma-plugins/tree/main/DesignMD

---

## Full description

Paste this into the description field. Figma's editor supports basic Markdown-like
formatting (headings, bold, lists) via its rich text toolbar — reformat with the
toolbar if plain markdown isn't rendered.

---

**DesignMD turns a Figma file's Variables, Styles, and Components into developer-ready
documentation and token files — automatically, deterministically, and entirely offline.**

No AI. No servers. No account. Nothing leaves your machine.

### What it generates

- **design.md** — a single Markdown file covering your variable collections, color/typography/spacing/effect/grid tokens, a component index, token and style usage, naming conventions, and accessibility notes with WCAG contrast checked for every color mode (Light, Dark, …)
- **Component docs** — one Markdown file per component or component set: variants, sizes, states, layout (size, auto layout, gap, padding, radius), properties, token references, and related components
- **tokens.json** — nested, W3C-style design tokens (color, dimension, typography, shadow, …) with modes and usage, ready for design-token pipelines
- **css-tokens.json** and **tokens.css** — CSS custom properties (`--color-primary-500`, `--spacing-md`, …) with a `[data-theme]` block per mode and automatic dark-mode support
- **\_tokens.scss** — Sass variables plus a `$modes` map
- **tailwind.tokens.js** — a Tailwind preset that reads those variables, including opacity modifiers like `bg-primary/50`

Bundle everything into a single ZIP you can drop straight into a Git repository, or preview and copy any file right in the plugin first.

### Made for real workflows

- **Scan the whole file or just your selection** — document one section of a big system without waiting for the rest
- **Contrast pairs you choose** — add the text/background combinations you care about and see ratios in every mode, plus automatic checks inferred from token names
- **Skip what you don't want documented** — leave out draft pages, and anything hidden from publishing is ignored automatically
- **Find dead weight** — see which variables and styles no component uses
- **It remembers** — your outputs, excluded pages and contrast pairs are restored next time

### Why it's useful

- **Developer handoff** — stop writing token references and component specs by hand
- **AI-assisted coding workflows** — feed `design.md` and `tokens.json` straight into an LLM as grounded context about your design system
- **Design system documentation** — keep docs in sync with the source of truth instead of a wiki that drifts out of date
- **Internal engineering references** — a version-controllable snapshot of your system's tokens and components

### How it works

Variables are treated as the primary source of truth. If a token category has no
variables (e.g. no color variables defined), DesignMD automatically falls back to the
equivalent Styles (Paint/Text/Effect/Grid) and notes that it did so — so the output is
useful even in files that predate Variables.

Everything is generated from a single normalized internal schema, so every output
format stays consistent with the others.

### Built for real files

Extraction is batched and yields to the event loop, so it stays responsive on large,
production design systems — 10,000+ variables, 5,000+ components. A problem with one
style or component (missing reference, corrupted node) is recorded as a warning and
skipped, rather than crashing the whole run.

### Free forever

No paywalls, no per-seat pricing, no file-size limits, no feature gating by company
size. This plugin is free for anyone, forever.

### Privacy

DesignMD makes zero network requests. It reads your file's Variables, Styles, and
Components using the standard Figma Plugin API and generates output entirely in the
plugin sandbox. Nothing is uploaded anywhere.

---

## Cover / icon / screenshot assets

- `icon.png` — 128×128 plugin icon
- `thumbnail.png` — 1920×960 Community cover image
- `screenshot-1.png` — 1600×1300 gallery screenshot of the tabbed plugin UI (Summary tab, with realistic sample numbers)
- `screenshot-2.png` — Contrast tab: user-defined pairs with live ratios and a failing pair
- `screenshot-3.png` — Files tab: the generated file list with a `tokens.css` preview and Copy

All of these were generated to match the plugin's actual UI (same colors, same component
styling) so the listing accurately represents what using the plugin looks like.
