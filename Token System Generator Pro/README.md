<img width="1000" height="560" alt="thumbnail" src="https://github.com/user-attachments/assets/144687b7-94e3-49ab-8b7a-660a5b39c371" />


# Token System Generator Pro

A free Figma plugin that scaffolds a complete design token system — color ramps, spacing, border radius, border width, and typography — directly into your Figma Variables in seconds.

## What it does

Token System Generator Pro creates structured Figma Variable collections following a 2-tier (Global + Alias) or 3-tier (Global + Alias + Component) token architecture, ready to hand off to developers.

## Three approaches

| Approach | Best for |
|---|---|
| **From Scratch** | New projects — enter your brand hex colors and let the plugin generate full 10-stop color ramps, spacing, radius, and a 13-level type scale |
| **Starter System** | Rapid prototyping — scaffolds a complete boilerplate token system with placeholder values you edit directly in Figma |
| **Smart Convert** | Existing projects — scans your file's local paint and text styles and organises them into a Global + Alias (+ Component) variable hierarchy |

## What gets generated

- **Color ramps** — 10 stops (50–900) per color, auto-named by hue (e.g. `cobalt/500`, `violet/200`)
- **Semantic colors** — info, success, error, warning, neutral mapped to alias tokens
- **Spacing scale** — configurable base unit, 10 tokens at Tailwind-equivalent multipliers
- **Border radius** — 7 semantic stops (none → full) from a configurable base
- **Border width** — 5 semantic stops (none → xl)
- **Typography** — 13 levels (display-lg → xs) across 5 musical scale ratios

## Development

Built with TypeScript + the Figma Plugin API. No external dependencies.

```bash
npm install
# Then in VS Code: Terminal > Run Build Task > npm: watch
```

Tests live in `tests/`.
