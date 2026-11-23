# Pattern Pilot — Figma Plugin

Insert production-ready UI section patterns in one click — 25 sections, 6 style variants each, across Desktop, Tablet, and Mobile breakpoints. 100% free, forever.

---

## What's Included

**25 sections · 6 style variants each · 150 patterns total**

| Category | Sections |
|----------|----------|
| Navigation | Footer · Nav Bar · Tab Horizontal · Tab Vertical · Vertical Nav |
| Hero | Bento Grid · Gallery Grid · Split Image · Text Only · Video Hero |
| Content | CTA Banner · FAQ · Feature List · Pricing Table · Stats · Team Grid · Testimonials |
| Forms & Auth | Sign In · Sign Up · Contact Form · Newsletter |
| Utility | Cookie Banner · Announcement Bar · Breadcrumb · Toast |

---

## Breakpoints

Each pattern can be inserted at any of the following widths. Toasts and sidebar patterns (Vertical Nav, Tab Vertical) keep their natural size instead of spanning the full width.

| Breakpoint | Width |
|------------|-------|
| Desktop | 1440 px |
| Tablet | 768 px |
| Mobile | 375 px |

---

## Installation

1. Open the **Figma Desktop App** or **Figma Web**
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select the `manifest.json` file in this folder
4. The plugin appears under **Plugins → Development → Pattern Pilot**

---

## How to Use

1. Open the plugin: **Plugins → Pattern Pilot**
2. Choose a width at the top right: Mobile · Tablet · Desktop
3. Pick a section from the **Section Type** dropdown
4. Click **Generate** to see six style variants
5. Hover a variant and click **Insert into Figma**
6. The pattern is placed on the current page, stacked below existing frames

Repeat for each section to build up a complete page layout.

---

## File Structure

```
pattern-pilot/
├── manifest.json   — Plugin metadata
├── code.js         — Plugin backend (runs in Figma sandbox)
├── ui.html         — Plugin UI (runs in iframe)
├── favicon.svg     — Plugin icon source (128×128 PNG uploaded at publish)
├── thumbnail.svg   — Community listing cover source
├── publish-assets/ — Exported icon and cover PNGs for the Community listing
└── README.md       — This file
```

---

## Technical Notes

- All frames are built with **Figma Auto Layout** — fully editable after insertion
- Font: **Inter** (Regular, Medium, SemiBold, Bold) — built into Figma, no installs needed
- No network requests — runs entirely locally
- No account, login, or telemetry of any kind
- Compatible with all Figma plans (Starter, Professional, Organisation, Enterprise)
- Works on Figma Desktop and Figma Web

---

## Limitations

- **Font:** Inter only. Replace with your own font after insertion.
- **Colours:** Preset per variant. Edit fills directly in Figma after insertion.
- **Images:** Shown as placeholder blocks. Replace with your own assets after insertion.
- **One frame per click:** Insert multiple times to build a full page.

---

## License

Free to use for personal and commercial projects. No attribution required.
