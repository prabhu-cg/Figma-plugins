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

## Content hash

`metadata.contentHash` is the SHA-256 of the file text with `generatedAt` and `contentHash` set to `""`.
Equal hashes mean equal content.
