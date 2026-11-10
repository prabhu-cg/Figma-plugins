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

If a run is cancelled, components that were not read are still listed, with an empty `tree`,
`treeTruncated: true` and a `SCAN_CANCELLED` warning.

## Nested instances

By default the layers inside a nested instance are not read: the instance layer is listed with
`instanceOf`, and its insides are in the file of the component it points at. With
**Include layers inside nested instances** on, they are read too, which is slower and makes a larger
file. `metadata.options.includeInstanceInternals` records which.

## What was left out

`metadata.options` says which options the file was made with. `includeVariantDiffs: false` means every
`variantDiffs` is `[]` because nothing was compared, not because the variants are identical.
`includeText: false` means `text.characters` is absent everywhere.

## Content hash

`metadata.contentHash` is the SHA-256 of the file text with `generatedAt` and `contentHash` set to `""`.
Equal hashes mean equal content.
