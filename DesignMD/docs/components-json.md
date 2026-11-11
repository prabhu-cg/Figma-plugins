# components.json (`designmd.components/v1`)

A machine-readable description of the components in a Figma file: the layer tree of each default
variant, how every other variant differs, component properties, and the tokens the components use.
It is tool-neutral, versioned, and deterministic (no AI, no network).

- **Schema:** [`schemas/designmd-components-v1.json`](../schemas/designmd-components-v1.json), generated from
  [`src/shared/componentsSchema.ts`](../src/shared/componentsSchema.ts) with `npm run schema`.
  `npm run schema:check` (and the test suite) fail when the two disagree.
- **Example:** [`examples/components.example.json`](../examples/components.example.json). Every file in
  `examples/` is validated against the schema by the tests.

## Reading the file

Start with `metadata` and `index` to decide what to load. `tokens` maps Figma ids to the variables and
styles the components use, with their default-mode values; full token data and modes stay in
`tokens.json`, where `$extensions.figma.id` carries the same id.

## Rules for consumers

- Lengths are numbers in px. A layer's `radius` is a number, or `{ tl, tr, br, bl }` when corners differ. Line height and letter spacing are `{ value, unit }`.
- Colors are `{ hex, alpha, r, g, b }`. Hex never carries alpha.
- A missing field means "not applicable". `null` means "applies, no value". `[]` means "none".
- `role` is a hint. Treat `roleSource: "name"` as low confidence.
- Match warnings on `code`, never on `message`.
- Ignore fields and enum values you do not know. New optional fields and values can be added within `v1`.
- Every id the file refers to exists in the file. `findBrokenRefs` in `src/shared/componentsRefs.ts` checks this.

## Layer trees and variant diffs

- `tree` is the default variant's layer tree. Its root layer is named after the component, not the variant
  (variant names are in `variants[]`), so name paths in `variantDiffs` start at the same name as `tree`.
- A layer missing an attribute in a variant is not reported as a change, except `radius`, where missing means
  square corners (`radius: 0`).
- A layer whose type changed is reported as removed plus added. Only the top-most added or removed layer is
  listed; its children come inside it.
- Layer trees are read only when `components.json` is selected, so a token-only export stays fast.
- The plugin reads the layers from Figma and streams them to the UI, which builds, hashes and splits the
  file. This keeps the heavy work off Figma's main thread.

## Large files

Above 20 MB the output is split. `components.json` then holds `metadata`, `index`, `tokens` and
`warnings` (including an `OUTPUT_TOO_LARGE` warning) with `components: []`. Each `index.components[]`
entry has a `file` (for example `components/Button.json`) and that file's `contentHash`, so a change
inside any component is visible without opening it. Each per-component file is a complete, valid
`designmd.components/v1` file with a single component and only the tokens it uses.

**Split into one file per component** (a setting under components.json) can be **Only above 20 MB**
(the default) or **Always**. With Always the output is split whatever its size, and `components.json`
has an `OUTPUT_SPLIT` warning instead of `OUTPUT_TOO_LARGE`. An export with no components is never split.

If a run is cancelled, components that were not read are still listed, with an empty `tree`,
`treeTruncated: true` and a `SCAN_CANCELLED` warning.

## Library styles

A style from a library the file has imported is a token like any other, flagged `library: true`. Its
`styleId` looks like `S:<key>,<node id>`, while a style defined in the file ends with a comma. If the
library is not available to the file, the style cannot be read: the layer keeps its resolved values,
the token link is left out, and an `UNRESOLVED_REFERENCE` warning says so.

## Nested instances

With **Include layers inside nested instances** on (the default), the layers inside a nested instance
are read too, so a button inside a card arrives complete. It is slower and makes a larger file. With it
off, the instance layer is listed with `instanceOf` and its insides are in the file of the component it
points at. `metadata.options.includeInstanceInternals` records which.

An instance always says how this use of the component differs from the library version, so a consumer
that fills the insides in from the component it points at can apply the changes:

- `instanceOf.properties` is every component property with the value this use gives it, keyed by
  property key (`{ "label#1:0": { "type": "TEXT", "value": "Save" } }`). For `INSTANCE_SWAP` the value
  is the id of the component swapped in. Written in both modes.
- `instanceOf.overrides` lists the layers inside the instance that this use changed, such as a
  different label or a hidden layer. Each entry has `layerId`, `name` and `changes`, which uses the
  same shapes as a layer (`text`, `visible`, `fills`, ...) and holds only the attributes that were
  changed. `layerId` is the id inside the instance (for example `I12:3;45:6`); the part after the last
  `;` is the id of the same layer in the main component. Written only when the insides are not read,
  because otherwise they carry their own values. At most 100 per instance; `overridesTruncated` is
  true when there were more.

## Placement, position and appearance

Enough to rebuild a layer's box and paint without guessing:

- **Auto-layout children.** `placement` is on every child of an auto-layout frame, text and shapes
  included: `sizingH`/`sizingV` (FIXED, HUG, FILL), `grow`, `align` (STRETCH or the parent's
  counter-axis alignment) and `positioning`. `layout.sizingH` on a frame describes the same
  thing for the frame itself.
- **Everything else.** `position` (`x`, `y` from the parent's top-left corner) and `constraints` are
  written for children of a frame that is not auto layout, and for absolute layers inside one that
  is. Children of a group are measured from the nearest ancestor that is not a group. `rotation` is in
  degrees, counter-clockwise; `size` is the unrotated size.
- **Limits and clipping.** `sizeLimits` (min/max width and height), `clipsContent` (overflow hidden),
  `isMask`, `blendMode`, `cornerSmoothing`, and `layoutGrids` on frames. Auto layout also has
  `counterGap`/`counterAlignContent` for wrapping, `reverseZIndex` and `strokesIncludedInLayout`.
- **Gradients.** A gradient paint has `stops` (position and colour with alpha), `transform` (Figma's
  `gradientTransform`, a 2x3 matrix; invert it to get the start and end points) and `alpha`. Any paint
  may have a `blendMode`.
- **Strokes.** `strokes.sides` holds each side's weight when they differ (`weight` is then the largest),
  with `dash`, `cap`, `join` and `miterLimit`. A missing `cap` is flat, a missing `join` is MITER.
- **Text.** `italic`, `autoResize` (fixed, hug or truncate), `truncation` and `maxLines`,
  `alignVertical`, `paragraphSpacing`, `paragraphIndent`, `listType` and `hyperlink`. When the colours
  of the text differ, the layer has no `fills` and each run has its own `fills`.
- **Bound variables.** `bindings` maps fields such as `paddingLeft`, `itemSpacing`, `topLeftRadius`,
  `fontSize` or `width` to the token the layer uses, so generated code can write `var(--space-4)`
  instead of `16px`. Colour bindings are on the paints.
- Variant diffs compare all of the above.

Not captured: OpenType features, and variable bindings that do not resolve to a token in the file.

## Vector shapes

With **Include vector shapes** on (the default), a `VECTOR`, `BOOLEAN_OPERATION`, `STAR`, `POLYGON` or
`LINE` layer has `vector: { fill, stroke }`, enough to draw an icon. Each entry is
`{ windingRule, data }` with SVG path data in the layer's own coordinates (0,0 is its top-left corner),
at the layer's `size`.

- `fill` is painted with the layer's `fills`. `stroke` is the _outline_ of the stroke, also a filled
  shape, so paint it with the stroke colour, not as a line. Both are read only when the layer has a
  fill or a stroke.
- The parts of a boolean shape have no `vector` of their own: the shape already holds the merged path.
- A layer with more than 60,000 characters of path data gets no `vector` and a `VECTOR_OMITTED` warning.
- Rectangles and ellipses are not listed: `size` and `radius` describe them.
- Variant diffs compare `vector` like any other attribute.

## Images

With **Export pictures behind image fills** on, each image fill gets `image` and its picture is saved
next to `components.json` as `assets/images/<hash>.<png|jpg|gif|webp>`. The same picture in many layers
is one file. Off (the default), image fills have no `image` and no bytes are exported.

- `image.hash`, `scaleMode`, and where they apply `rotation`, `scalingFactor` (TILE) and
  `imageTransform` (CROP, a 2x3 matrix as Figma reports it) say how the picture is placed.
- `image.file` is the path from the export root, `width` and `height` the picture's pixel size. In a
  split export (below) the path is still relative to the root, not to the component file.
- A picture over 8 MB, one that would pass the 96 MB total, or one Figma cannot provide keeps its
  `hash` but has no `file`, and an `IMAGE_OMITTED` warning says why.
- Pictures are not scanned for content; they are the original files from the Figma file.

## What was left out

`metadata.options` says which options the file was made with. `includeVariantDiffs: false` means every
`variantDiffs` is `[]` because nothing was compared, not because the variants are identical.
`includeText: false` means `text.characters` is absent everywhere. `includeVectorShapes` and
`includeImages` are absent in files from before 1.2.0, which have neither; `false` means no `vector`
or `image` was written.

## Content hash

`metadata.contentHash` is the SHA-256 of the file text with `generatedAt` and `contentHash` set to `""`.
Equal hashes mean equal content.
