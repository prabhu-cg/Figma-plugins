# Changelog

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
