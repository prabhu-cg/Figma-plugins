# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The UI is a React app inlined into a single `ui.html` and rendered in Figma's plugin iframe (desktop app). It is web technology inside Figma, not a native app or a standalone site.

## Users
Design system maintainers: the people who own a Figma component library and are responsible for keeping it consistent, documented, accessible and tokenized. They open DesignLens inside the library file, usually before a release, during a cleanup pass, or when asked "how healthy is our system?", and need to find what has drifted, decide what to fix first, and work through the list.

## Product Purpose
DesignLens audits a Figma file's components, variants, variables and styles against a registry of independent rules (accessibility, contrast, tokens, typography, spacing, components, states, documentation, governance, deprecation, visual consistency) and turns the result into a health score, a prioritized issue list, and exportable reports (Markdown, JSON). Success is a maintainer who can see what is wrong, fix it layer by layer, re-scan, and watch the score and trend improve.

## Positioning
Free, local and private. The whole audit runs inside the Figma plugin sandbox: no servers, no AI, no paid APIs, no network access (the manifest sets `networkAccess.allowedDomains: ["none"]`), so file contents never leave the user's machine. No neighbouring paid or cloud-based auditor can truthfully make that promise.

## Operating Context
- Runs as a Figma desktop development plugin today (Plugins → Development → Import plugin from manifest); a Figma Community release is planned.
- Default plugin window is 1180×760 and user-resizable; the UI follows Figma's light/dark theme.
- Scans are file-wide and can be large (thousands of components, tens of thousands of issues), so scanning must stay cancellable and the UI responsive.
- Per-file state (last result, score trend, resolved/ignored issues) is stored locally via `figma.clientStorage`; it does not travel with the file to teammates.
- Cross-file usage is not visible to a single-file scan, so "unused" findings are hints, not verdicts.
- Source lives in this repo and is mirrored to the `prabhu-cg/Figma-plugins` monorepo (`DesignLens/`) with a pre-built `dist/`, so it can be installed from a ZIP download without running npm.

## Capabilities and Constraints
- Rules are independent, pluggable modules (about 40) grouped into 11 categories, each with a severity, rationale, recommendation and reference where applicable.
- Health score is a weighted average of category scores; the penalty math and weights are defined in `src/shared/scoring.ts` and explained in the dashboard.
- Contrast checks follow a user-selectable WCAG level (AA or AAA).
- Issue workflow: filter, sort, select, bulk resolve/ignore/reopen with undo, keyboard shortcuts, jump-to-layer in Figma.
- Hard constraints: no network access, no external runtime dependencies, UI must be a single self-contained HTML file (Figma plugin UIs cannot fetch external scripts, styles or fonts), plugin sandbox code is a separate bundle (`dist/code.js`).
- Terminology in use: component, component set, variant, variable, collection, token (variables + styles), module (audit category), health score.
- Undecided: final plugin id and Community listing details (the manifest id is still `designlens-local-dev`); pricing is not applicable while it stays free.

## Brand Commitments
- Name: DesignLens, set as "Design" + "Lens" with the second part in the brand accent.
- Orange is the brand accent and a binding commitment; in the UI it should mean brand and action, not status.
- Existing logo mark and wordmark are kept.

## Evidence on Hand
- Working source, a README describing scan flow and rules, and a unit-test suite (`tests/`).
- No customer testimonials, case studies, usage numbers or benchmarks exist. Future copy must not invent any.

## Product Principles
1. Privacy is the product: nothing about a scan may leave the file, and the UI should say so plainly where it matters.
2. Show where to start, not just what is wrong: the score is a means to a prioritized, actionable fix list.
3. Be honest about what a single-file scan can and cannot know; hedge "unused" and "missing" findings accordingly.
4. A tool that audits accessibility must hold its own interface to the same standard.
5. Stay fast and cancellable on very large libraries; never freeze Figma.

## Accessibility & Inclusion
WCAG AA is the default bar for the plugin's own UI (text contrast ≥ 4.5:1, visible keyboard focus, full keyboard operation, semantic roles, reduced-motion support), consistent with the standard DesignLens enforces on users' files. Both light and dark themes must meet it.
