# DesignLens: Figma Community listing

Copy-paste source for the Figma Community publish form. Everything here describes what the plugin does today; nothing is aspirational, and there are no usage numbers, testimonials or customer claims because none exist.

## Name
DesignLens

## Tagline
Audit your design system without leaving the file.

## Description

DesignLens is a free design system auditor that runs entirely inside Figma. It scans your file's components, variants, variables and styles against about 40 independent rules and turns the result into a health score, a prioritized issue list and exportable reports.

**Built for design system maintainers** who need to see what has drifted, decide what to fix first, and work through it.

**What it checks**
- Accessibility and contrast: text contrast against WCAG AA or AAA, UI component and icon contrast, touch target size, focus indicators, minimum text size
- Tokens: hardcoded colors, radii and opacity, unused and duplicate variables, broken aliases
- Typography and spacing: unlinked text styles, off-scale sizes, off-grid spacing, missing Auto Layout
- Components: missing descriptions, missing variant combinations, missing interaction states, unused variants
- Governance and documentation: duplicate and legacy names, inconsistent naming, incomplete docs, deprecated components

**What you get**
- A weighted health score with a plain-language explanation of how it is calculated
- A "Start here" list: the categories that would lift your score the most, one click from their issues
- An Audit view to filter, sort, select and bulk resolve or ignore issues, with undo, keyboard shortcuts, and a button that jumps to the layer in Figma
- Score trend across scans, per file
- Markdown and JSON reports
- Light and dark themes that follow Figma, and a layout that works in narrow plugin windows

**Private by design**
DesignLens makes no network requests, uses no AI and needs no account. The manifest declares no network access, so your file's contents cannot leave your machine. Results, trend history and your resolved/ignored choices are stored locally on your computer.

**Good to know**
- A scan covers the current file only, so "unused" findings are hints: usage in other files is not visible.
- Large libraries are supported; you can cancel a scan at any time.

## Suggested tags
design system, audit, accessibility, contrast, wcag, tokens, variables, components, governance, qa

## Network access
None. `manifest.json` sets `networkAccess.allowedDomains` to `["none"]`.

## Permissions and file access
- `documentAccess: dynamic-page`: the plugin loads pages on demand to scan them.
- No special permissions or capabilities.
- Writes one small piece of plugin data on the document root (a random id) so that results for unsaved/local files are kept separate per file. Everything else is stored in the plugin's local client storage.

## Support
Issues and questions: https://github.com/prabhu-cg/Figma-plugins/issues (add a support email here if you prefer one).

## Release notes (first version)
First public release. File-wide audit with ~40 rules across 11 categories, health score and trend, Audit workflow with bulk actions and undo, Markdown/JSON reports, light/dark themes, WCAG AA/AAA contrast setting.

## Assets in this folder
| File | Use | Size |
|---|---|---|
| `icon-128.png` | Plugin icon (required) | 128 × 128 |
| `icon-256.png`, `icon.svg` | Higher-resolution icon and its vector source | 256 × 256 |
| `cover-1920x960.png` | Cover art (required) | 1920 × 960 |
| `gallery-1-dashboard.png` | Gallery: health score and Start here | 1920 × 960 |
| `gallery-2-audit.png` | Gallery: audit workflow and bulk actions | 1920 × 960 |
| `gallery-3-dark.png` | Gallery: dark theme | 1920 × 960 |
| `gallery-4-score.png` | Gallery: score explainer | 1920 × 960 |
| `gallery-5-reports.png` | Gallery: exports | 1920 × 960 |

All screenshots show the real plugin UI with **synthetic demo data** (a fictional "Northwind Design System"); the health score is computed by the plugin's own scoring code. Regenerate them with `npm run build && npm run store:assets`.

## Before you publish (things only you can do)
1. Test the plugin on a real file in the Figma desktop app, including a large library and the cancel button. This has been verified in a browser harness and with unit tests, not yet inside Figma.
2. Publish from the Figma desktop app: **Plugins → Manage plugins → Publish** next to DesignLens. Figma assigns the real plugin `id` and writes it into `manifest.json`; commit that change.
3. Your Figma account needs two-factor authentication enabled and a Community profile to publish.
4. Confirm the support link, then submit. Figma reviews new plugins before they appear in the Community.
