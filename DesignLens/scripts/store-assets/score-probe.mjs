import { build } from "esbuild";
import { pathToFileURL } from "node:url";
await build({ entryPoints: ["scripts/store-assets/demoData.ts"], bundle: true, platform: "node", format: "esm", outfile: "node_modules/.cache/probe.mjs", alias: { "@shared": "src/shared" }, logLevel: "error" });
const { buildDemo } = await import(pathToFileURL("node_modules/.cache/probe.mjs").href + "?" + Date.now());
const r = buildDemo().init.result;
console.log("overall", r.health.overall, "issues", r.issues.length, "crit/warn/sugg", r.health.totalCritical, r.health.totalWarnings, r.health.totalSuggestions);
console.log(r.health.categories.map((c) => `${c.category}:${c.score}`).join("  "));
