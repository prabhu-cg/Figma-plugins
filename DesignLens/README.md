# DesignLens

A free, local Design System Auditor for Figma. DesignLens scans a file's components, variants,
variables, and styles, runs a registry of independent audit rules against them, and produces an
interactive health dashboard plus exportable reports (Markdown, JSON) — entirely inside
the Figma plugin sandbox. No servers, no AI, no paid APIs, no network access (the manifest sets
`networkAccess.allowedDomains: ["none"]`).

## Getting started

```bash
npm install
npm run build
```

This produces `dist/code.js` (the plugin sandbox bundle) and `dist/ui.html` (a single self-contained
HTML file with the React UI, CSS, and every dependency inlined — required because Figma plugin UIs
can't fetch external scripts/styles at runtime).

### Load it in Figma

1. Open the Figma desktop app.
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` at the root of this repo.
4. Run **Plugins → Development → DesignLens**.

### Development loop

```bash
npm run dev
```

Watches both the UI (Vite) and the plugin sandbox code (esbuild) and rebuilds `dist/` on save. Reload
the plugin in Figma (`Cmd/Ctrl+Alt+P` or right-click → Re-run) to pick up changes — Figma doesn't
hot-reload plugin code automatically.

```bash
npm run typecheck   # both the UI and plugin-sandbox TS projects
```

## How a scan works

1. `src/plugin/main.ts` is the plugin entry point. It registers every audit rule once
   (`registerAllRules()`) and wires `figma.ui.onmessage` to the scan lifecycle.
2. `src/plugin/scanner/collect.ts` walks every page (`figma.loadAllPagesAsync` first, required for
   `documentAccess: "dynamic-page"`), collecting components, component sets, variants, variables,
   styles, and instance-usage counts — yielding to the event loop between pages/batches so Figma's
   UI thread never freezes, even on large libraries.
3. `src/plugin/scanner/scanEngine.ts` builds a `RuleContext` from the collected data and hands it to
   the rule registry.
4. `src/plugin/rules/registry.ts` runs every registered `AuditRule` against the context, turning each
   rule's findings into fully-formed `Issue` objects (severity, why-it-matters, recommendation,
   estimated impact/effort, WCAG/best-practice reference).
5. `src/plugin/scoring/healthScore.ts` turns the issue list into weighted category scores and an
   overall Design System Health Score.
6. `src/plugin/persistence.ts` applies any previously saved resolved/ignored status onto the fresh
   issue list, saves the full result and a compact trend snapshot to `figma.clientStorage` (keyed by
   file), and the full `ScanResult` (stats, health score, issues, components, variables) plus trend
   history is posted to the UI in one message and rendered by the React dashboard (`src/ui`). Progress
   and cancellation flow the other direction as lightweight messages, so a scan of a large library can
   be cancelled mid-flight.

Every rule is independently registered — nothing in the scan engine, registry, or UI needs to change
to add a new one.

## Persistence, trend indicators & issue status

Three things survive closing and reopening the plugin (scoped per file, stored locally via
`figma.clientStorage` — see `src/plugin/persistence.ts`):

- **Last scan result** — reopening the plugin shows your previous dashboard immediately instead of an
  empty state; `main.ts`'s `handleInit()` sends it as an `init` message before any scan runs.
- **Health score trend** — every completed scan appends a compact `{scannedAt, overall, categories,
  totals}` snapshot (capped at the last 20) that powers the dashboard's sparkline and the ▲/▼ delta
  badges next to the health score and each category score.
- **Issue status** — marking an issue Resolved or Ignored in the Audit view persists against a stable
  key (`ruleId::nodeId`, see `src/shared/util.ts#issueKey`) rather than the per-scan issue id, so status
  survives a rescan as long as the same rule keeps flagging the same node. The Status filter
  (Open/Resolved/Ignored) reads off this.

The WCAG contrast level (AA/AAA, Settings → Contrast standard) is a global setting, not per-file, and
is read fresh at the start of every scan — the contrast/icon-contrast rules use whichever level is
active.

This is local-machine storage tied to the user+plugin, not written into the `.fig` file itself, so it
won't follow the file to a teammate's computer — only the trend/status/last-result you generate on your
own machine.

## Adding a new audit rule

Rules live in `src/plugin/rules/<category>.ts` and implement the `AuditRule` interface
(`src/plugin/rules/types.ts`):

```ts
const myRule: AuditRule = {
  id: "category-short-slug",       // must be globally unique
  category: "tokens",              // one of AUDIT_CATEGORIES (src/shared/types.ts)
  title: "Human-readable rule name",
  description: "What this rule checks for.",
  whyItMatters: "Why violating this rule is a real problem, not just style nitpicking.",
  severity: "warning",             // default severity; a finding can override it
  reference: "WCAG 2.1 SC 1.4.3",  // optional
  evaluate(context: RuleContext): RuleFinding[] {
    // inspect context.components / context.allComponentNodes / context.variables /
    // context.wcagLevel / context.instanceCounts / context.variantInstanceCounts / etc.
    // return one RuleFinding per instance of the problem found. A finding can set
    // `collection` (variable collection name) to make it filterable in the Variables/Audit
    // Collection dropdown.
  },
  recommendation(finding) {
    return "The specific fix to suggest for this finding.";
  }
};

export const myCategoryRules: AuditRule[] = [myRule /* , ...other rules */];
```

Then add the array to `src/plugin/rules/index.ts`'s `registerAllRules()`. The registry runs it
automatically on the next scan, and the UI's category filters, dashboard scores, and exports all
pick it up with no further changes — `AuditCategory` in `src/shared/types.ts` is the only place you'd
need to touch if you're introducing a genuinely new category rather than reusing one of the 11
already defined (visual, contrast, typography, spacing, tokens, components, states, accessibility,
documentation, governance, deprecated).

## Project layout

```
src/
  shared/
    types.ts             Domain model + UI<->plugin postMessage protocol (imported by both sides)
    util.ts               issueKey() — stable issue identity shared by plugin persistence and UI
  plugin/                Runs in the Figma sandbox — no DOM
    main.ts               Entry point, message handling, init/persistence orchestration
    persistence.ts         figma.clientStorage: settings, last result, trend history, issue status
    scanner/               Async document traversal, component/variant/variable collection
    rules/                 Rule interface, registry, and one module per audit category (~40 rules)
    scoring/                Weighted health score calculation
    color/                  WCAG contrast math
  ui/                     React app rendered in the plugin iframe
    App.tsx                Top-level layout/routing
    state/                  useScan (postMessage bridge + persisted state), useTheme
    components/             Nav, Dashboard, Charts (donut/gauge/sparkline), Views, Filters, IssueList
    export/                 JSON / CSV / Markdown / PDF report builders (client-side, jsPDF for PDF)
```

## Scope notes / honest limitations

This is a from-scratch build of a very large brief. The architecture (rule registry, async scanner,
scoring model, full dashboard, all four export formats, clientStorage persistence, trend indicators,
issue status tracking) is complete and functional end-to-end. Rule *coverage* per category is broad
but still not the exhaustive checklist in the original brief (~40 rules across the 11 categories) —
adding more is mechanical given the pattern above. A few specific caveats:

- **Unused-component and unused-variable detection** only sees usage within the currently scanned
  file. A component/variable with zero hits may still be consumed by other files in a multi-file
  library — the recommendations say so explicitly.
- **Manrope** is referenced via `font-family` with system-font fallbacks; no font binary is bundled
  (the plugin can't fetch one at runtime given `networkAccess: none`, and none was available to embed
  at build time). Add a base64 `@font-face` in `src/ui/styles/global.css` if pixel-exact brand
  typography matters for your use case.
- Contrast/typography/spacing/visual checks read directly off node geometry and paints; they don't
  attempt to resolve complex nested blend modes or effects beyond simple opacity compositing.
