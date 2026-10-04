---
name: DesignMD
description: A calm, document-like Figma plugin panel that turns a design system into developer-ready files with one burnt-orange action.
colors:
  burnt-orange: '#c74504'
  burnt-orange-deep: '#af3d04'
  orange-wash: '#faeee8'
  orange-wash-dark: '#422f25'
  paper: '#ffffff'
  paper-dark: '#2b2b2b'
  paper-sunken: '#f7f7f7'
  paper-sunken-dark: '#333333'
  ink: '#1a1a1a'
  ink-dark: '#f2f2f2'
  ink-muted: '#6b6b6b'
  ink-muted-dark: '#a3a3a3'
  rule: '#e5e5e5'
  rule-dark: '#444444'
  rule-strong: '#d8d8d8'
  rule-strong-dark: '#545454'
  error-wash: '#fdecea'
  error-wash-dark: '#4a2523'
  error-ink: '#b3261e'
  error-ink-dark: '#ff8a80'
typography:
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.01em'
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '15px'
    fontWeight: 700
  button:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '14px'
    fontWeight: 700
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.5
  card-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 700
  stat:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '18px'
    fontWeight: 700
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '11px'
    fontWeight: 400
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: '11px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '10px'
    fontWeight: 400
rounded:
  xs: '3px'
  sm: '8px'
  md: '10px'
  lg: '12px'
  xl: '14px'
  pill: '50%'
spacing:
  xs: '6px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  gutter: '24px'
components:
  button-primary:
    backgroundColor: '{colors.burnt-orange}'
    textColor: '{colors.paper}'
    typography: '{typography.button}'
    rounded: '{rounded.lg}'
    padding: '14px 16px'
  button-primary-hover:
    backgroundColor: '{colors.burnt-orange-deep}'
  button-text:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink-muted}'
    rounded: '{rounded.sm}'
    padding: '6px 12px'
  option-card:
    backgroundColor: '{colors.paper}'
    rounded: '{rounded.xl}'
    padding: '14px'
  option-card-checked:
    backgroundColor: '{colors.orange-wash}'
  stat-tile:
    backgroundColor: '{colors.paper-sunken}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
  text-field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '9px 10px'
  segment-selected:
    backgroundColor: '{colors.orange-wash}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '7px 10px'
  code-preview:
    backgroundColor: '{colors.paper-sunken}'
    textColor: '{colors.ink}'
    typography: '{typography.code}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
  error-banner:
    backgroundColor: '{colors.error-wash}'
    textColor: '{colors.error-ink}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
---

# Design System: DesignMD

## Overview

**Creative North Star: "The Field Notebook"**

DesignMD lives in a 480×700 Figma plugin panel and does one job: read a file's variables, styles and components, then hand back plain files. The interface behaves like a page in a notebook: white paper, hairline rules, small honest type, and a single ink color, burnt orange, that marks the one thing to do next. Nothing performs. The tool is deterministic and has no AI or backend, and the UI says only what is true.

Density is compact and calm. Content stacks in one column inside a fixed header and footer, so the primary action never scrolls away. It follows Figma's own light and dark theme through `prefers-color-scheme`, so it reads as part of the host rather than a guest.

**Key Characteristics:**

- One accent (burnt orange) for the primary action, selection and progress. It is never decorative.
- Hairline borders and tonal fills do the structural work; there are no shadows.
- 12px Inter throughout, with weight (not size) carrying hierarchy.
- Fixed header and footer, scrolling single-column body, 24px side gutters.
- Native controls get themed (checkbox, focus rings, selection, scrollbar), not replaced.

## Colors

Warm paper and graphite ink, with one burnt-orange accent. Light and dark are a full pair; every neutral has a `-dark` twin.

### Primary

- **Burnt Orange** (#c74504): the primary button, selected option borders and check fills, progress fill, the "MD" in the wordmark, focus rings. White text on it is ≈4.9:1.
- **Burnt Orange Deep** (#af3d04): hover state of the primary button only.
- **Orange Wash** (#faeee8 light, #422f25 dark): the fill of a checked option card and the text-selection background. It marks "chosen", never "warning".

### Neutral

- **Paper** (#ffffff / #2b2b2b): app, header, footer and card background.
- **Sunken Paper** (#f7f7f7 / #333333): stat tiles and the progress track, one step down from the page.
- **Ink** (#1a1a1a / #f2f2f2): body and title text.
- **Muted Ink** (#6b6b6b / #a3a3a3): subtitles, descriptions, counts, footer status.
- **Rule** (#e5e5e5 / #444444): hairline borders between header, body and footer, and around cards.
- **Strong Rule** (#d8d8d8 / #545454): unchecked radio ring, scrollbar thumb, hovered text button.

### Feedback

- **Error Wash / Error Ink** (#fdecea + #b3261e light; #4a2523 + #ff8a80 dark): the dismissible error banner only. There is no success color: completion is shown by the footer changing to Download.

### Named Rules

**The One Ink Rule.** Burnt orange appears on the single next action, the current selection and the progress fill. If two orange things compete on one screen, one of them is wrong.

**The Tint, Don't Gray Rule.** Secondary text on a tinted surface (Orange Wash, Error Wash) keeps the surface's hue; it is never the neutral Muted Ink.

## Typography

**Font:** Inter, falling back to the system sans (-apple-system, Segoe UI). **Code:** the system monospace stack (ui-monospace, SF Mono, Menlo, Consolas), used only inside code previews.

**Character:** One family at small sizes. Bold weights separate title, section and control labels from 12px regular body. The only other face is the system monospace, reserved for generated file contents.

### Hierarchy

- **Title** (700, 20px, 1.2, -0.01em): the wordmark only.
- **Headline** (700, 15px): section titles such as "Design system summary".
- **Button** (700, 14px): the full-width primary action.
- **Card title** (700, 13px): output option names.
- **Body** (400, 12px, 1.5): descriptions and subtitles, capped near 34ch in the header.
- **Stat** (700, 18px): summary tile values.
- **Caption** (400–600, 11px): page counts, progress text, warnings.
- **Label** (400, 10px): stat tile labels.
- **Code** (400, 11px, 1.5, system mono): the file preview. Never used for labels, buttons or decoration.

### Named Rules

**The Weight Step Rule.** Hierarchy comes from 400 versus 700, not from many sizes. Stay on the documented ramp (10, 11, 12, 13, 14, 15, 18, 20px) and do not add steps.

## Layout

A fixed shell: header, scrolling content, footer, pinned with `position: fixed; inset: 0`. Content is a single flex column with 22px between sections and 24px side gutters (20px top, 24px bottom). Inside sections the rhythm is 8–10px; the summary is a two-column grid with 8px gaps. The panel is a fixed-size plugin window, so there are no breakpoints; narrow widths are handled by `min-width: 0` and ellipsis on long page names.

### Named Rules

**The Pinned Action Rule.** The primary action lives in the footer and is always visible. The footer changes its meaning with state (Scan, Scanning…, Generate, Download), never its position.

## Elevation & Depth

Flat. Depth is conveyed by tonal steps (Paper, Sunken Paper) and 1px rules. There are no shadows anywhere, and none should be introduced; a selected card gets a darker border and Orange Wash, not lift.

### Named Rules

**The Flat Paper Rule.** Surfaces are flat at rest and flat on hover. State changes the border color or fill.

## Shapes

Softly rounded, one family of radii that grows with the size of the element: 3px progress track, 8px text button, 10px tiles, fields and banners, 12px page list and primary button, 14px option cards, and a full circle for the radio-style check. Borders are 1px (1.5px on option cards so selection reads at a glance).

## Components

### Buttons

- **Primary:** Burnt Orange fill, white 14px bold, 14px 16px padding, 12px radius, full width in the footer. Hover deepens to Burnt Orange Deep. Disabled drops to 50% opacity.
- **Text button (Rescan):** Paper fill, 1px Rule border, muted 12px semibold text, 8px radius; hover raises text to Ink and the border to Strong Rule.
- **Focus:** a 2px Burnt Orange outline with 2px offset on every button and checkbox (`:focus-visible`).

### Option cards

Full-width labels containing icon, title, description and a circular check. Unchecked: Paper with a 1.5px Rule border. Hover and checked: Burnt Orange border. Checked also fills with Orange Wash and fills the circle with Burnt Orange and a white check.

### Stat tiles

Sunken Paper, 1px Rule border, 10px radius. Bold 18px value over a 10px muted label. They are summary data, shown in a 2-column grid, and are not a navigation structure.

### Page filter

A bordered list (12px radius) of rows separated by hairlines: checkbox (accent Burnt Orange), page name with ellipsis, component count.

### Text field

10px radius, 1px Rule border, 13px text. Focus shows a 2px Burnt Orange outline and a Burnt Orange border.

### Progress

6px track in Sunken Paper with a Burnt Orange fill; exposed as `role="progressbar"` with the stage name as its label.

### Error banner

Error Wash with Error Ink text, 10px radius, `role="alert"`, with a dismiss (×) button that has an accessible name.

### Scan scope toggle

A two-segment radio group (Whole file, Selection with its layer count) in a Sunken Paper track with a 1px Rule border and 10px radius. The selected segment takes Orange Wash with a Burnt Orange border (the same "chosen" language as option cards). Selection is disabled, at 50% opacity, until layers are selected in Figma. A one-line caption states what the scope covers, and switches to "Rescan to apply this scope." when it differs from the data on screen.

### Output groups

Outputs are grouped under quiet 12px semibold headings, Documentation and Tokens and code, each a list of option cards. Group headings are muted ink, not accent, and carry no counts or numbering.

### Generated file preview

After generating, the result leads the screen. A bordered list of files (path, size) works like the page filter, with the selected row in Orange Wash. Below it, the file name, a text-button Copy with a polite status ("Copied" or "Copy blocked — select the text instead"), and a scrollable code preview on Sunken Paper capped at 300 lines. The note about hidden lines appears only when the file is longer; Copy always copies the full file.

### Generate → Download flow

The footer is a small state machine: Scan → Scanning… → Generate → Download. The choice of outputs is remembered between sessions. Changing any output selection or the excluded pages after generating clears the files and returns to Generate, with the status line switching to "Settings changed — generate again to refresh your files". Toggling ZIP does not reset, since it only changes how files are downloaded.

## Do's and Don'ts

### Do:

- **Do** keep the primary action in the footer and make it the only filled Burnt Orange element on screen.
- **Do** theme native controls and browser surfaces (focus rings, selection, scrollbar) from the palette.
- **Do** carry every neutral through the light/dark pair via `prefers-color-scheme`.
- **Do** use `role="status"` for the footer line and `role="progressbar"` for scan progress.
- **Do** keep monospace to file contents the user may copy; everything else is Inter.
- **Do** keep copy plain and specific: controls name their action, errors name the problem.

### Don't:

- **Don't** add shadows, gradients or glass; depth is tone and hairlines.
- **Don't** add a second accent color or a success green.
- **Don't** put icon-heading-text cards in a repeating grid as page structure; the summary tiles are the one exception and stay data-only.
- **Don't** add a colored side-stripe border to cards or banners.
- **Don't** introduce a font size off the documented ramp, or any typeface other than Inter and the code-preview monospace.
