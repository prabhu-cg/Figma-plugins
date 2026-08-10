import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Figma's plugin main-thread sandbox (dist/code.js) is a restricted JS VM —
 * not a browser, not Node. It provides ES built-ins and the `figma` global,
 * but not most Web/Node APIs. This has already broken DSLog twice in one
 * session (TextEncoder/TextDecoder), so: statically scan the actual built
 * bundle for known-unavailable globals and fail the build if any are used,
 * rather than finding out from a runtime error in Figma's console.
 *
 * This list is deliberately conservative (known-bad, not exhaustive) — if
 * something else turns out to be unavailable in the sandbox, add it here.
 */
const BANNED_IN_SANDBOX = [
  "TextEncoder",
  "TextDecoder",
  "fetch",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "Buffer",
  "structuredClone",
  "atob",
  "btoa",
  "Worker",
  "WeakRef",
  "FinalizationRegistry",
  "requestAnimationFrame",
  "requestIdleCallback",
  "indexedDB",
  "navigator",
  "document",
  "window",
];

const root = path.resolve(import.meta.dirname, "..");
const bundlePath = path.join(root, "dist", "code.js");
const source = readFileSync(bundlePath, "utf-8");

const hits = [];
for (const name of BANNED_IN_SANDBOX) {
  const pattern = new RegExp(`\\b${name}\\b`, "g");
  const matches = source.match(pattern);
  if (matches) hits.push({ name, count: matches.length });
}

if (hits.length > 0) {
  console.error(`\ndist/code.js references globals that don't exist in Figma's plugin sandbox:\n`);
  for (const hit of hits) {
    console.error(`  - ${hit.name} (${hit.count} occurrence${hit.count === 1 ? "" : "s"})`);
  }
  console.error(
    `\nThese will throw a ReferenceError at plugin load time in real Figma even though they work fine ` +
      `in Node/Vitest/browser test environments. Replace with a sandbox-safe alternative ` +
      `(see src/shared/utils/utf8.ts for an example) or, if this identifier is a false positive ` +
      `(e.g. it only appears in a string/comment), adjust BANNED_IN_SANDBOX in ` +
      `scripts/verify-sandbox-globals.mjs.\n`,
  );
  process.exit(1);
}

console.log("dist/code.js: no known sandbox-incompatible globals found.");
