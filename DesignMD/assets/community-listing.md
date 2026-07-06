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

- **design.md** — a single Markdown file covering your variable collections, color/typography/spacing/effect/grid tokens, a component index, naming conventions, and accessibility notes
- **Component docs** — one Markdown file per component or component set: variants, sizes, states, properties, token references, and related components
- **tokens.json** — a normalized, nested token export that preserves your variable hierarchy, ready for design-token pipelines
- **css-tokens.json** — a CSS custom-property-ready export (`--color-primary-500`, `--spacing-md`, …) including per-mode values

Everything is bundled into a single ZIP you can drop straight into a Git repository.

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

Everything is generated from a single normalized internal schema, so all four output
formats stay consistent with each other.

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
- `screenshot-1.png` — gallery screenshot of the plugin UI (full output-selection flow)

All three were generated to match the plugin's actual UI (same colors, same component
styling) so the listing accurately represents what using the plugin looks like.
