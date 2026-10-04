---
name: DesignLens
description: A quiet, precise instrument for auditing Figma design systems; orange marks the brand and the action, color-coded status marks the findings.
colors:
  lens-orange: "#ee661d"
  lens-orange-hover: "#d85812"
  ember-fill: "#c2490a"
  ember-fill-hover: "#a83d08"
  ember-text: "#b83f06"
  orange-tint: "#fdeee3"
  paper: "#ffffff"
  fog: "#f7f7f8"
  hairline: "#e5e5e7"
  graphite: "#17181a"
  slate: "#58585c"
  ash: "#6b6b70"
  alarm: "#d92d20"
  alarm-text: "#c4271b"
  alarm-tint: "#fef1f0"
  amber: "#f0900a"
  amber-text: "#8a5a04"
  amber-tint: "#fef1de"
  cobalt: "#2970ff"
  cobalt-text: "#1d5fe0"
  cobalt-tint: "#eef4ff"
  verdigris: "#12b76a"
  verdigris-text: "#0a7a45"
  verdigris-tint: "#ecfdf3"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.5
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.04em"
  caption:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ember-fill}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ember-fill-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.fog}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.slate}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  button-small:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.lg}"
    padding: "16px"
  issue-card-selected:
    backgroundColor: "{colors.orange-tint}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "7px 30px 7px 10px"
  badge-critical:
    backgroundColor: "{colors.alarm-tint}"
    textColor: "{colors.alarm-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 8px"
  badge-warning:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.amber-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 8px"
  badge-suggestion:
    backgroundColor: "{colors.cobalt-tint}"
    textColor: "{colors.cobalt-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 8px"
  badge-success:
    backgroundColor: "{colors.verdigris-tint}"
    textColor: "{colors.verdigris-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 8px"
  nav-item:
    textColor: "{colors.slate}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "9px 8px"
  nav-item-active:
    backgroundColor: "{colors.orange-tint}"
    textColor: "{colors.ember-text}"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  toast:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 8px 8px 16px"
---

# Design System: DesignLens

## Overview

**Creative North Star: "The Calm Inspector"**

DesignLens is a measuring instrument that lives inside someone else's file. It looks the way a good inspection report reads: neutral surfaces, plain bordered containers, small precise type, and numbers and statuses doing the talking. The interface is deliberately quiet so that the findings are the loudest thing on screen, and so that a maintainer can sit in it for an hour working through a long list without fatigue.

Color is rationed and each hue has one job. Orange is the brand and the action: the wordmark accent, the one filled primary button, the selected row, the active nav item. Status never borrows it. Critical, warning, suggestion and success each have their own hue, a soft tint for backgrounds, and a darker text step that clears AA. Depth is almost absent: surfaces are flat, separated by hairlines, and only things that genuinely float (a toast, a narrow-window bottom sheet) leave the page.

The system is precise, calm and trustworthy. It rejects loud SaaS marketing-dashboard energy, gamified scoring, and decorative gradients or glass. It is a tool that audits accessibility, so its own interface is held to the same standard it enforces.

**Key Characteristics:**
- Flat, bordered, softly rounded surfaces; one filled orange button marks the primary action.
- Orange means brand and action only; severity and score use their own hues.
- Every text color has an AA-passing step; vivid fills are for graphics and large marks.
- Six-step type scale in a single variable face (Manrope), heavy weights for hierarchy, tabular numerals for data.
- Light and dark themes share one token set; dark is defined in exactly one block.
- Fully keyboard-operable with a single visible focus ring.

## Colors

A near-neutral palette with one brand accent and a four-hue status set. Light-mode values below; the dark theme remaps the same roles (Paper becomes #1f2023 on a #18191b ground, Fog #26272b, Hairline #35363a, Graphite becomes #f3f3f4) and lifts the text steps (Ember Text #ff8a4c, Alarm Text #ff6b60, Cobalt Text #6b9bff, Verdigris Text #3ccf8e) so they keep their contrast on dark tints.

### Primary
- **Lens Orange** (#ee661d): the brand accent. Wordmark "Lens", progress-bar fills, focus-adjacent accents and graphics. 3.2:1 on white, so it is never used for small text. Hover #d85812.
- **Ember Fill** (#c2490a): the fill behind white button labels (4.9:1). Hover #a83d08. The only filled orange surface in the UI.
- **Ember Text** (#b83f06): orange when it must be read as type or a thin icon on light or tinted surfaces (active nav label, "Review in Audit →", rescan banner text).
- **Orange Tint** (#fdeee3): selected-row and active-nav background.

### Neutral
- **Paper** (#ffffff): the app ground and card surface.
- **Fog** (#f7f7f8): nav background, tab track, hover fill, bulk-action bar.
- **Hairline** (#e5e5e7): every border and divider.
- **Graphite** (#17181a): primary text.
- **Slate** (#58585c): secondary text (6.6:1 on Fog).
- **Ash** (#6b6b70): tertiary metadata, shortcut hints, timestamps (5.3:1 on white; this was darkened from #8a8a8f, which failed AA).

### Status
Each status has a vivid fill for graphics (bars, donut, dots), a tint for badge backgrounds, and a text step for anything read as type.
- **Alarm** (#d92d20, text #c4271b, tint #fef1f0): critical findings and low scores.
- **Amber** (#f0900a, text #8a5a04, tint #fef1de): warnings and the "needs work" score band. A gold-shifted amber, validated at about 20 ΔE from Alarm so the two never read as "red but lighter".
- **Cobalt** (#2970ff, text #1d5fe0, tint #eef4ff): suggestions.
- **Verdigris** (#12b76a, text #0a7a45, tint #ecfdf3): passing, resolved, healthy scores.

### Named Rules
**The One Voice Rule.** Orange means brand and action. It never encodes status, severity or score; a score that needs work is Amber, not orange, so it can never be mistaken for a button.

**The AA-or-It-Doesn't-Ship Rule.** Any color used as text comes from a `-text` step (or Graphite/Slate/Ash). Vivid fills are for bars, dots, rings and large marks only. A contrast auditor cannot fail contrast.

**The Not-By-Color-Alone Rule.** Status is always paired with a word or glyph (a "Critical" badge, ▲/▼ on trend), never hue alone.

## Typography

**Display Font:** Manrope (variable, weight 200–800, Latin subset bundled into the HTML; falls back to the system sans)
**Body Font:** Manrope
**Label/Mono Font:** none; tabular numerals (`font-variant-numeric: tabular-nums`) on score columns instead of a monospace

**Character:** One geometric-humanist family used at a restrained size range, with weight (800 vs 400–600) rather than size doing most of the hierarchy. Dense but legible, in the register of a well-set report.

### Hierarchy
- **Display** (800, 24px, 1.5, -0.02em): stat values on inventory cards and the gauge's large numeral scale.
- **Headline** (800, 18px, 1.5, -0.01em): view titles ("Audit", "Design System Health"), priority-strip scores.
- **Title** (800, 15px): detail-panel issue titles, state-screen titles, brand wordmark.
- **Body** (400–700, 13px, 1.5): default text, issue titles inside cards, buttons. Long prose (the score explainer) is capped at 68ch.
- **Label** (700, 12px, 0.04em, uppercase for card titles and table headers): secondary copy, controls, small buttons, card titles.
- **Caption** (600–700, 11px): badges, legends, metadata, shortcut hints, helper text.

### Named Rules
**The Six-Step Rule.** Font sizes come from `--text-xs/sm/base/md/lg/xl` (11/12/13/15/18/24). There are no half-pixel or one-off sizes; a test fails the build if a raw size appears.

**The Weight-Over-Size Rule.** Hierarchy is made with weight (800 headings, 700 labels, 400 body) before size. Resolved and ignored items recede by color (Slate, lighter weight), never by opacity, so their text keeps its contrast.

## Layout

A two-column shell: a 208px Fog navigation rail and a fluid content area. Views are scroll containers with 24px padding (16px when narrow). Content is built from auto-fit grids (`minmax(220px | 180px | 160px | 260px, 1fr)`) so cards wrap before they overflow, with 16px gaps. Spacing is a 4px-based scale (4, 8, 16, 24, 32, 40) and groups are kept tight with generous separation between sections.

The Audit view is a list column plus a fixed 360px detail panel that sticks while the list scrolls. The window is user-resizable, so the layout responds to the plugin iframe's own width:
- Below 980px the dashboard health card reflows to two columns and the trend moves under it.
- Below 900px the nav collapses to a 56px icon rail (names remain as tooltips) and view padding tightens.
- Below 820px the detail panel becomes a bottom sheet over the list, shown only while an issue is selected, with an explicit Close.

Filters wrap freely; sort and bulk actions sit directly above the list they act on.

## Elevation & Depth

Flat by default. Depth is conveyed with 1px Hairline borders and tonal steps (Paper cards on a Paper ground separated by borders; Fog for recessed or secondary regions), not shadows. Shadows exist only for things that genuinely float or for a single hairline lift on the active tab.

### Shadow Vocabulary
- **Hairline lift** (`box-shadow: 0 1px 2px rgba(20, 20, 24, 0.06)`): the active tab segment only.
- **Floating** (`box-shadow: 0 4px 16px rgba(20, 20, 24, 0.08)`; dark `0 4px 20px rgba(0,0,0,0.5)`): the undo toast and the narrow-window bottom sheet.
- **Selected ring** (`box-shadow: inset 0 0 0 1px` Ember Text, plus a 1px Ember Text border): the selected issue row, drawn as a ring on all four sides over Orange Tint.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only on elements that float above the page or in direct response to state, never as decoration on a card.

## Shapes

Softly rounded rectangles in a three-step radius scale: 12px for cards and containers, 8px for buttons, inputs, selects, tab tracks and nav items, 6px for small buttons and tab segments, and fully rounded (999px) for badges and progress tracks. Borders are always 1px Hairline; there are no heavy strokes. Icons are single-weight line glyphs at 16px. Progress and score bars are 8px-tall rounded tracks whose fill is scaled with a transform; the gauge is a half-ring with round caps.

## Components

### Buttons
- **Shape:** gently rounded (8px; 6px for small), 1px transparent border, weight 700, 13px (12px small).
- **Primary:** Ember Fill (#c2490a) with white label, padding 9px 16px. The single filled orange element in a view.
- **Hover / Focus / Active:** hover darkens to #a83d08; `:active` nudges down 1px; disabled drops to 50% opacity and a not-allowed cursor; focus shows the global 2px ring. A loading state shows a 12px spinner and `aria-busy`.
- **Secondary:** Paper with a Hairline border and Graphite text; hover fills Fog.
- **Ghost:** transparent with Slate text; hover fills Fog and darkens text to Graphite.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper, with a 1px Hairline border.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 16px. Card titles are 12px, uppercase, Slate, 0.04em tracking. Cards are never nested.

### Issue rows
A checkbox column (16px, Ember Fill accent) beside a full-width card button. Contents stack: severity badge and module on one line, a 700 title, a 12px Slate description, and Ash component metadata. Hover fills Fog. Selected is Orange Tint with a 2px-equivalent Ember Text ring. Resolved/ignored rows keep a neutral badge and a Slate, lighter-weight title.

### Badges
Fully rounded 11px/700 pills with a tint background and the matching `-text` color: Critical (Alarm), Warning (Amber), Suggestion (Cobalt), Success (Verdigris), Neutral (Fog with Hairline border and Slate text).

### Inputs / Fields
- **Style:** 8px radius, 1px Hairline border, Paper background, Graphite text, 13px. Selects are 12px/600 with a themeable CSS-mask chevron drawn on a wrapper, because the native arrow cannot be positioned inside Figma's Chromium.
- **Focus:** the global 2px Lens-Orange-family ring (Ember Text in light, #ff8a4c in dark) drawn inset by 1px.
- **Labels:** inputs and selects carry `aria-label`s; placeholders are never the only label.

### Navigation
A Fog rail with a Hairline right edge. Items are 12-13px/600 Slate with a 16px line icon; hover goes to Paper and Graphite; the active item is Orange Tint with Ember Text and `aria-current="page"`. Items are disabled (55% opacity, "Run an audit first" tooltip) until a scan exists. The brand block sits at the top: a 26px lens mark and "Design" + "Lens" with the second word in Ember Text. Below 900px only icons remain.

### Tabs
An inline Fog track with a Hairline border and 3px padding; the active segment is Paper with Graphite text and the hairline lift. Implements the full WAI-ARIA tabs pattern (roving tabindex, arrow/Home/End keys, linked tab panels).

### Score bars and gauge (signature)
The health score is a half-ring gauge with a 0–100 numeral inside, and categories are 8px bars with right-aligned scores. Color comes from three bands that every chart shares: 85+ Verdigris, 60–84 Amber, below 60 Alarm, with the numeral in the matching `-text` step. The dashboard also leads with a "Start here" strip of the three categories that cost the most score, each a button that opens Audit filtered to it.

### Toast
Graphite pill with Paper text, bottom-center, 8px radius, floating shadow, and an underlined inherit-color Undo button; auto-dismisses after 8 seconds and announces itself with `role="status"`.

## Do's and Don'ts

### Do:
- **Do** use Ember Fill (#c2490a) for any filled orange surface that carries white text, and Ember Text (#b83f06) for orange type.
- **Do** keep orange to brand and action: one primary button per view, the wordmark, the selected row, the active nav item.
- **Do** pair every status color with a label or glyph, and use the `-text` step whenever the color is read as type.
- **Do** size type from the six `--text-*` tokens and build hierarchy with weight first.
- **Do** separate surfaces with 1px Hairline borders; lift only what floats.
- **Do** give every interactive element the global 2px focus ring, keep full keyboard operation, and honor `prefers-reduced-motion`.
- **Do** keep Paper/Fog/Hairline/Graphite relationships identical in both themes by remapping tokens, never by adding per-component dark overrides.
- **Do** animate progress with `transform`, not `width`, and keep transitions to 80–200ms (the gauge's 600ms stroke is the one slow, deliberate exception).

### Don't:
- **Don't** use Lens Orange (#ee661d) as text or for score, severity or "needs attention" meaning; it is 3.2:1 on white and it is the action color.
- **Don't** put shadows on cards or nest cards inside cards.
- **Don't** mark selection with a one-sided colored stripe; use the full ring over Orange Tint.
- **Don't** dim resolved or ignored content with opacity; change its color and weight instead.
- **Don't** introduce gradients, glass or blur, decorative illustrations, or gamified celebration (confetti, badges, streaks).
- **Don't** add a new font size, radius, or text color outside the scales above; extend the scale deliberately or reuse a step.
- **Don't** convey status by hue alone, and don't use the vivid status fills for small text.
- **Don't** fetch anything at runtime: fonts, icons and scripts are inlined, because the plugin has no network access.
