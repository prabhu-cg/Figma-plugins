# Pattern Pilot — Figma Plugin

Insert production-ready UI section patterns in one click — 21 sections, 6 style variants each, across Desktop, Tablet, and Mobile breakpoints. 100% free, forever.

---

## What's Included

**21 sections · 6 style variants each · 126 patterns total**

| Category | Sections |
|----------|----------|
| Navigation | Footer · Nav Bar · Tab Horizontal · Tab Vertical · Vertical Nav |
| Hero | Bento Grid · Gallery Grid · Split Image · Text Only · Video Hero |
| Content | CTA Banner · FAQ · Feature List · Pricing Table · Stats · Team Grid · Testimonials |
| Forms & Auth | Sign In · Sign Up · Contact Form · Newsletter |

---

## Breakpoints

Each pattern can be inserted at any of the following widths:

| Breakpoint | Width |
|------------|-------|
| Desktop | 1440 px |
| Tablet | 768 px |
| Mobile | 390 px |

---

## Installation

1. Open the **Figma Desktop App** or **Figma Web**
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select the `manifest.json` file in this folder
4. The plugin appears under **Plugins → Development → Pattern Pilot**

---

## How to Use

1. Open the plugin: **Plugins → Pattern Pilot**
2. Select a section category from the left sidebar
3. Click a style variant to preview it in the panel
4. Select a breakpoint: Desktop · Tablet · Mobile
5. Click **Insert into Figma**
6. The pattern is placed on the current page, stacked below existing frames

Repeat for each section to build up a complete page layout.

---

## File Structure

```
pattern-pilot/
├── manifest.json   — Plugin metadata
├── code.js         — Plugin backend (runs in Figma sandbox)
├── ui.html         — Plugin UI (runs in iframe)
├── favicon.svg     — Plugin icon (export as PNG for manifest)
├── thumbnail.svg   — Community listing cover (export as 1920×960 PNG)
└── README.md       — This file
```

---

## Technical Notes

- All frames are built with **Figma Auto Layout** — fully editable after insertion
- Font: **Inter** (Regular, Medium, SemiBold, Bold) — built into Figma, no installs needed
- No network requests — runs entirely locally
- No account, login, or telemetry of any kind
- Compatible with all Figma plans (Starter, Professional, Organisation, Enterprise)
- Works on Figma Desktop and Figma Web; not supported on Figma for iPad

---

## Limitations

- **Font:** Inter only. Replace with your own font after insertion.
- **Colours:** Preset per variant. Edit fills directly in Figma after insertion.
- **Images:** Shown as placeholder blocks. Replace with your own assets after insertion.
- **One frame per click:** Insert multiple times to build a full page.

---

## License

Free to use for personal and commercial projects. No attribution required.
