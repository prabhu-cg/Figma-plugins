# Changelog

## 1.2.1

### Added

- **Added layers know their position.** A layer a variant adds has `index`, its place among its
  parent's children in that variant (the real position, not a guess from names). To build the variant,
  take the default variant's children, drop `removed`, then insert each added layer at its `index`,
  lowest first.

### Changed

- **Pictures behind image fills are now exported by default**, so avatars and photos are not left as a
  flat colour. A choice you saved earlier is kept: tick **Export pictures** once if an export says
  `includeImages: false`.

## 1.2.0

### Added

- **Vector shapes in `components.json`.** Vector layers (`VECTOR`, `BOOLEAN_OPERATION`, `STAR`,
  `POLYGON`, `LINE`) carry `vector: { fill, stroke }` as SVG path data, so icons can be drawn. On by
  default (**Include vector shapes**). A layer over 60,000 characters of path data is left out with
  a `VECTOR_OMITTED` warning; the parts of a boolean shape are not repeated.
- **Pictures behind image fills.** With **Export pictures behind image fills** on, image paints get
  `image` (hash, scale mode, placement, pixel size, file) and the picture is saved as
  `assets/images/<hash>.<ext>` in the export (ZIP or individual download). Limits: 8 MB per picture,
  96 MB in total; anything left out gets an `IMAGE_OMITTED` warning. Off by default (on from 1.2.1).
- **Instance changes.** An instance now lists `instanceOf.properties` (the value each component
  property has in that use) and, when its insides are not read, `instanceOf.overrides` (the layers
  that use changed, such as a different label, with their new values). A consumer that fills the
  insides in from the library component can apply them.
- **Split setting.** _Split into one file per component_ can be _Only above 20 MB_ (as before) or
  _Always_. New warning code `OUTPUT_SPLIT`.
- **Placement and position.** Every child of an auto-layout frame has `placement` (sizing, grow, align,
  absolute), including text layers, which had no sizing before. Children of other frames have
  `position` and `constraints`; layers have `rotation`, `sizeLimits`, `clipsContent`, `isMask`,
  `blendMode`, `cornerSmoothing`, and frames have `layoutGrids`. Wrapping auto layout adds
  `counterGap`, `counterAlignContent`, `reverseZIndex` and `strokesIncludedInLayout`.
- **Gradients** now have `stops`, `transform` and `alpha`; paints may carry a `blendMode`.
- **Strokes** keep each side's weight when sides differ (`sides`), plus `dash`, `cap`, `join` and
  `miterLimit`.
- **Text** adds `italic`, `autoResize`, `truncation`, `maxLines`, `alignVertical`, `paragraphSpacing`,
  `paragraphIndent`, `listType` and `hyperlink`, and per-run `fills` when the colours differ (before,
  a text layer with two colours had no colour at all).
- **Variable bindings** on number and string fields (`bindings`: padding, gap, radius, size, font
  size, ...) as tokens, so code can use `var(--space-4)` rather than `16px`.
- Variant diffs compare all of the new attributes.
- Generated files can now be binary (the pictures); the Files tab shows them with their size.

### Changed

- **Layers inside nested instances are now read by default** (the option is still there, and a saved
  choice is kept). A component used inside another no longer arrives empty.
- The layer budget per component went from 500 layers and 10 levels to 2,000 layers and 16 levels.
  A component over it is still flagged `treeTruncated`, with a `TREE_TRUNCATED` warning.
- The schema gained `LayerAttributes`, the optional attributes shared by `Layer` and `LayerChanges`.
  All additions are optional fields and new enum values, so `designmd.components/v1` is unchanged for
  existing consumers. `metadata.options` gains optional `includeVectorShapes` and `includeImages`.

## 1.1.0

### Added

- **`components.json`** (`designmd.components/v1`): a machine-readable description of components. Per
  component it has the default variant's layer tree, how every other variant differs, full property
  details, inferred layer roles, and the tokens the components use. It is deterministic, has a
  published JSON Schema (`schemas/designmd-components-v1.json`) and a content hash. Off by default,
  with options to leave out text content and variant differences.
- Component structure is read only when `components.json` is selected, with a progress bar.
- `tokens.json` tokens now carry their Figma id in `$extensions.figma.id`.

- Whole-file safety for `components.json`: per-component time and size budgets, isolated failures
  (`COMPONENT_FAILED`, `PROPERTIES_UNREADABLE`), progress as "done of total", a Cancel button that
  returns partial results (`SCAN_CANCELLED`), large results sent in pieces, and automatic splitting
  into `components/<name>.json` above 20 MB.
- A 10-minute budget for reading all component layers in one generate (a 2,581-component file takes
  about 3.5 minutes); components not reached get a `TIME_BUDGET_EXCEEDED` warning. A per-layer time
  check keeps each component inside its 5 s budget, and the plugin console reports layers read and
  instance-lookup time.
- Figma stays responsive while `components.json` is generated: layer reading is time-sliced, and the
  file is assembled, hashed and split in the plugin UI rather than on Figma's main thread.
- If one output fails to generate, the others are still offered and the failure is shown.

### Changed

- A library text style whose font Figma does not report now takes it from a text layer that uses the
  style (works for any file with library text styles). If no layer can say, the family stays unknown and
  is left out of `tokens.css` and `tokens.json` and shown as "—" in `design.md`, instead of being written
  as the value "Unknown".
- `tokens.css` now also declares a style a component uses (or a library style) when the file has
  variables for that kind of token. Before, a file with a few colour variables and hundreds of colour
  styles got no CSS for the styles, although `components.json` named them. A test now checks that every
  custom property `components.json` refers to is declared.
- Library styles go under a `library` branch in `tokens.json`, so one cannot overwrite a local style of
  the same name (four local styles were missing from `tokens.json` for that reason).
- Component docs: the Variants table shows at most 40 rows (a set can have hundreds; the Properties table
  already lists every option), and Token References lists the styles a component uses, not only
  variables, with library styles marked.
- Generate and Scan scroll the panel to the top so the progress bar is in view.
- CSS names that collapse to the same name (names that differ only in characters CSS names drop, such
  as `divider ↓` and `divider ↑`) now get a numeric suffix, so every CSS variable is distinct. Before,
  `tokens.css` kept only the last of them and a `cssName` in `components.json` could mean several tokens.
- Contrast: in a file with very many foreground-like and background-like colour tokens (more than 400
  combinations), pairs are only inferred between tokens in the same group, so an unrelated component's
  text colour is no longer reported as failing against another's background. `design.md` says which
  mode was used.
- Contrast: within a group, tokens that name an interaction state (Default, Hover, Pressed, Active,
  Selected, Focus, Disabled) are paired only with backgrounds in the same state, so white "Active Text"
  is checked on "Active Background" and not reported as 1.00:1 on "Default Background". When no
  background matches, every background in the group is used.
- `design.md` lists pairs that pass AA Large (3:1) but not AA Normal (4.5:1) in a second table, so
  near-misses are visible and not only pairs below 3:1.
- Font sizes, line heights, letter spacing and paragraph spacing from text styles are rounded to 2
  decimals (Figma returns 13.600000381469727 for 13.6).
- `design.md` marks library styles with "(library)" and trims padded page names.
- Styles that components use from a library the file has imported are now read (by id) and become tokens
  in `components.json`, flagged `library: true`, and in `tokens.json` (`$extensions.figma.library`).
  Before, their token link was dropped with a warning. A style from a library that is not available is
  still left out with a warning; its values stay on the layer. Library styles are not counted in the
  Summary's style counts.
- `tokens.json` now also lists a style that a component uses when the file has variables for that
  category, under a `styles` branch (for example `color.styles.…`). Before, such a style was in
  `components.json` but not in `tokens.json`.
- Fixed: the ZIP was not compressed (files were stored as they are), so a 35 MB export made a 37 MB
  zip. It is now compressed with DEFLATE; text like this typically shrinks about tenfold.
- Fixed: the `r`, `g` and `b` of colour tokens in `components.json` were Figma's 0 to 1 fractions; they
  are now 0 to 255 as the schema says (the hex was always right).
- Variant diffs now cover sets of up to 512 variants (was 256). With the insides of nested instances no
  longer read, trees are small, and Bootstrap's `button` has 420 variants.
- Role inference also reads the name of the component an instance points at, so an instance of
  "button" or "icon / arrow" gets a role even when its own name is generic.
- The scan no longer reads the layers inside nested instances. They are another component's layers and
  that component is scanned itself, so a component's token usage now lists what it binds directly.
  This is much faster on files built from nested components, and stops those layers counting toward a
  component's 500-layer budget.
- `components.json` does not read the layers inside nested instances by default either. An instance
  layer still has `instanceOf`, which points at the component whose file has its insides. New option
  **Include layers inside nested instances** reads them (slower, larger); `metadata.options` records it.
- Progress during layer reading is weighted by work (a set of 200 variants counts for more than a
  standalone component), so the time-left estimate is not thrown off by the sets coming first.
- Progress bars show an estimate of the time left ("about 3 min left") from the pace of the current
  stage.
- Reading a layer makes fewer calls into Figma: the style id, weight and alignment of a stroke, the
  effect style id and the fill style id are only read when the layer has strokes, effects or fills.
- Contrast tab: the two colour dropdowns no longer overflow the panel when token names are long, and
  each tab opens scrolled to the top.
- The plugin console now splits the components stage into finding components and reading their
  bindings, with the number of layers read.
- Pages are loaded and searched one at a time instead of with `loadAllPagesAsync`, and the progress bar shows "Searching pages · N of M · page name". A page that fails to load is skipped with a warning.
- The scan no longer holds Figma's main thread for long stretches: the document is searched one page
  at a time (one bad page no longer loses the rest), component bindings are read in time slices, and
  the plugin console reports per-stage timings.
- A text layer whose text style is not in the file (a library style) no longer keeps its style id; the
  id would point outside the file. The values stay, with a warning.
- Variant diffs now cover sets of up to 256 variants (was 128), and a component may use 20 s (was 5 s)
  to read its layers, inside the same 10-minute budget for the whole run.
- `propertyRefs` are written only for layers driven by the component itself: layers inside a nested
  instance no longer carry that instance's own property keys, which the file did not contain.
- Role inference no longer reads "dropdown" or "select" as an input, or "content" as a slot.

- Component docs show property names without Figma's `#id:id` suffix, and the default of an
  instance-swap property as a component name instead of a node id.

### Removed

- `css-tokens.json`: `tokens.json` already has the CSS names and per-mode values, and `tokens.css`
  has the same custom properties.
- `tailwind.tokens.js`: use `tokens.css` with Tailwind (see the README).
- `_tokens.scss`.
