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

### Changed

- Component docs show property names without Figma's `#id:id` suffix, and the default of an
  instance-swap property as a component name instead of a node id.

### Removed

- `css-tokens.json`: `tokens.json` already has the CSS names and per-mode values, and `tokens.css`
  has the same custom properties.
- `tailwind.tokens.js`: use `tokens.css` with Tailwind (see the README).
- `_tokens.scss`.
