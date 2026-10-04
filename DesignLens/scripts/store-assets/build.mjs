#!/usr/bin/env node
/**
 * Generates the Figma Community listing assets into store/ from the real built UI (dist/ui.html),
 * synthetic demo data, and headless Chrome. Run `npm run build && npm run store:assets`.
 *
 *   store/icon-128.png, icon-256.png, icon.svg
 *   store/cover-1920x960.png
 *   store/gallery-*.png   (1920x960)
 */
import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "store");
const TMP = join(ROOT, "node_modules/.cache/store-assets");
// Needs a local Chrome/Chromium; override the path with CHROME_PATH.
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TAGLINE = "Audit your design system without leaving the file.";

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// ---- demo data -------------------------------------------------------------------------------
await build({
  entryPoints: [join(ROOT, "scripts/store-assets/demoData.ts")], bundle: true, platform: "node", format: "esm",
  outfile: join(TMP, "demoData.mjs"), alias: { "@shared": join(ROOT, "src/shared") }, logLevel: "error"
});
const { buildDemo } = await import(pathToFileURL(join(TMP, "demoData.mjs")).href);
const demo = buildDemo();
const score = demo.init.result.health.overall;
console.log(`demo health score: ${score}; issues: ${demo.init.result.issues.length}`);

// ---- icon ------------------------------------------------------------------------------------
const LENS = readFileSync(join(ROOT, "src/ui/components/Icons.tsx"), "utf8");
const paths = [...LENS.slice(LENS.indexOf("export const LogoMark"), LENS.indexOf("</svg>", LENS.indexOf("export const LogoMark"))).matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
if (paths.length < 4) throw new Error("could not read LogoMark paths");
const markSvg = (ring, bars) =>
  `<path fill-rule="evenodd" clip-rule="evenodd" d="${paths[0]}" fill="${ring}"/>` +
  paths.slice(1).map((d) => `<path fill-rule="evenodd" clip-rule="evenodd" d="${d}" fill="${bars}"/>`).join("");
// Graphite tile, Paper lens, Lens Orange bars. 256-unit canvas with the mark scaled to 62% and centered.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><rect width="256" height="256" fill="#17181a"/><g transform="translate(49 49) scale(0.617)">${markSvg("#ffffff", "#ee661d")}</g></svg>\n`;
writeFileSync(join(OUT, "icon.svg"), iconSvg);

// ---- pages -----------------------------------------------------------------------------------
copyFileSync(join(ROOT, "dist/ui.html"), join(TMP, "ui.html"));
copyFileSync(join(ROOT, "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2"), join(TMP, "manrope.woff2"));
writeFileSync(join(TMP, "demo.json"), JSON.stringify(demo.init));
writeFileSync(join(TMP, "icon.svg"), iconSvg);

const FONT = `@font-face{font-family:Manrope;font-weight:200 800;src:url(/manrope.woff2) format("woff2-variations")}`;
const brand = (accent) => `Design<span style="color:${accent}">Lens</span>`;

/** One 1920x960 composition: a caption on the left, the real UI in a window bleeding off the right/bottom edge. */
function frame({ theme, ground, ink, sub, accent, headline, body, kicker, win, view, steps, big }) {
  const dark = theme === "dark";
  const chrome = dark ? { bg: "#1f2023", fg: "#f3f3f4", line: "#35363a" } : { bg: "#ffffff", fg: "#17181a", line: "#e5e5e7" };
  return `<!doctype html><meta charset="utf-8"><title>frame</title><style>
${FONT}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:960px;overflow:hidden;background:${ground};font-family:Manrope,sans-serif;-webkit-font-smoothing:antialiased}
.cap{position:absolute;left:96px;top:50%;transform:translateY(-50%);width:${big ? 560 : 430}px;color:${ink}}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:26px;letter-spacing:-.01em;margin-bottom:${big ? 56 : 40}px}
.brand svg{width:44px;height:44px}
h1{margin:0;font-weight:800;letter-spacing:-.03em;line-height:1.06;font-size:${big ? 68 : 52}px}
p{margin:${big ? 28 : 22}px 0 0;color:${sub};font-weight:500;font-size:${big ? 26 : 22}px;line-height:1.5}
.foot{position:absolute;left:96px;bottom:64px;color:${sub};font-weight:700;font-size:18px;letter-spacing:.01em}
.win{position:absolute;left:${win.x}px;top:${win.y}px;width:${win.w}px;height:${960 - win.y}px;background:${chrome.bg};border-radius:12px 0 0 0;
 border:1px solid ${chrome.line};border-right:0;border-bottom:0;box-shadow:0 4px 16px rgba(20,20,24,.08),0 24px 64px rgba(20,20,24,${dark ? ".5" : ".14"});overflow:hidden}
.bar{height:44px;display:flex;align-items:center;gap:10px;padding:0 16px;color:${chrome.fg};font-weight:700;font-size:14px;border-bottom:1px solid ${chrome.line}}
.bar img{width:22px;height:22px;border-radius:5px}.bar .x{margin-left:auto;font-weight:400;font-size:22px;opacity:.7;line-height:1}
iframe{display:block;border:0;width:${win.w}px;height:${960 - win.y - 44}px;background:${chrome.bg}}
</style>
<div class="cap"><div class="brand"><svg viewBox="0 0 256 256" fill="none">${markSvg(ink, accent)}</svg><span>${brand(accent)}</span></div>
<h1>${headline}</h1><p>${body}</p></div>
${kicker ? `<div class="foot">${kicker}</div>` : ""}
<div class="win"><div class="bar"><img src="/icon.svg" alt="">DesignLens<span class="x">&times;</span></div><iframe id="f" src="/ui.html"></iframe></div>
<script>
try{localStorage.setItem("designlens-theme","${theme}");localStorage.setItem("designlens-shortcut-hint","${view === "audit" ? "shown" : "hidden"}")}catch(e){}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const f=document.getElementById("f");
f.addEventListener("load",async()=>{
  const demo=await fetch("/demo.json").then(r=>r.json());
  f.contentWindow.postMessage({pluginMessage:demo},"*"); await sleep(500);
  const d=f.contentDocument, nav=n=>d.querySelector('.nav-item[aria-label="'+n+'"]').click();
  ${steps}
  await sleep(500); document.title="ready";
});
</script>`;
}

const NAV = (n) => `nav(${JSON.stringify(n)}); await sleep(400);`;
const frames = {
  "cover-1920x960": frame({ theme: "light", ground: "#17181a", ink: "#ffffff", sub: "#b2b3b7", accent: "#ee661d", headline: TAGLINE,
    body: "Free, local and private. No network, no AI, no accounts.", win: { x: 720, y: 120, w: 1200 }, view: "dashboard", big: true, steps: NAV("Dashboard") }),
  "gallery-1-dashboard": frame({ theme: "light", ground: "#f7f7f8", ink: "#17181a", sub: "#58585c", accent: "#b83f06", headline: "See where to start.",
    body: "A weighted health score, and the three categories that would lift it most, one click from their issues.", win: { x: 560, y: 96, w: 1360 }, view: "dashboard", steps: NAV("Dashboard") }),
  "gallery-2-audit": frame({ theme: "light", ground: "#f7f7f8", ink: "#17181a", sub: "#58585c", accent: "#b83f06", headline: "Work through findings fast.",
    body: "Filter, sort, bulk resolve with undo, and jump straight to the layer in Figma.", win: { x: 560, y: 96, w: 1360 }, view: "audit",
    steps: `${NAV("Audit")}
      const cards=[...d.querySelectorAll('.issue-card')]; cards[1].click(); await sleep(250);
      for (const i of [0,2,3]) { d.querySelectorAll('.issue-check')[i].click(); await sleep(60); } await sleep(250);` }),
  "gallery-3-dark": frame({ theme: "dark", ground: "#101112", ink: "#f3f3f4", sub: "#b2b3b7", accent: "#ee661d", headline: "Follows Figma's theme.",
    body: "Light and dark, with AA text contrast in both, because a contrast auditor should pass its own checks.", win: { x: 560, y: 96, w: 1360 }, view: "audit",
    steps: `${NAV("Audit")} d.querySelectorAll('.issue-card')[1].click(); await sleep(300);` }),
  "gallery-4-score": frame({ theme: "light", ground: "#f7f7f8", ink: "#17181a", sub: "#58585c", accent: "#b83f06", headline: "A score you can explain.",
    body: "Penalties, bands and category weights are right in the dashboard. Nothing is a black box.", win: { x: 560, y: 96, w: 1360 }, view: "dashboard",
    steps: `${NAV("Dashboard")} d.querySelector('.score-explainer summary').click(); await sleep(300); d.querySelector('.view').scrollTop = 250; await sleep(300);` }),
  "gallery-5-reports": frame({ theme: "light", ground: "#f7f7f8", ink: "#17181a", sub: "#58585c", accent: "#b83f06", headline: "Export when you're done.",
    body: "Markdown and JSON reports of every finding, generated locally. Nothing leaves your file.", win: { x: 560, y: 96, w: 1360 }, view: "reports", steps: NAV("Reports") })
};
for (const [name, html] of Object.entries(frames)) writeFileSync(join(TMP, name + ".html"), html);

writeFileSync(join(TMP, "icon-128.html"), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#17181a}img{display:block;width:128px;height:128px}</style><img src="/icon.svg">`);
writeFileSync(join(TMP, "icon-256.html"), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#17181a}img{display:block;width:256px;height:256px}</style><img src="/icon.svg">`);

// ---- render ----------------------------------------------------------------------------------
const types = { ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const p = join(TMP, decodeURIComponent((req.url || "/").split("?")[0]));
  let body;
  try {
    body = readFileSync(p); // read first so a missing file (e.g. /favicon.ico) can still get a clean 404
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": types[p.slice(p.lastIndexOf("."))] || "application/octet-stream" });
  res.end(body);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, userDataDir: join(TMP, "chrome-profile"), args: ["--no-first-run", "--disable-gpu", "--hide-scrollbars"], timeout: 30000
});
async function shoot(page, outFile, w, h, waitReady) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  tab.on("pageerror", (e) => console.warn(`[${page}] page error:`, e.message));
  await tab.goto(`http://localhost:${port}/${page}.html`, { waitUntil: "load" });
  if (waitReady) await tab.waitForFunction(() => document.title === "ready", { timeout: 30000 });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: outFile, type: "png" });
  await tab.close();
}
await shoot("icon-128", join(OUT, "icon-128.png"), 128, 128);
await shoot("icon-256", join(OUT, "icon-256.png"), 256, 256);
for (const name of Object.keys(frames)) {
  await shoot(name, join(OUT, name + ".png"), 1920, 960, true);
  console.log("rendered", name);
}
await browser.close();
server.close();
console.log("done ->", OUT);
