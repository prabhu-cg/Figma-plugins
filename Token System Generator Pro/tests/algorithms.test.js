// Run with: npm test

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); failed++; }
}
function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, got ${a} ${msg}`);
}
function assertApprox(actual, expected, delta = 0.01, msg = '') {
  if (Math.abs(actual - expected) > delta)
    throw new Error(`Expected ~${expected}, got ${actual} (Δ${delta}) ${msg}`);
}

// ── Real implementations (bundled from algorithms.ts by `npm test`) ──

const {
  hexToRgb, rgbToHsl, rgbToHex, generateColorRamp, generateSpacingScale, generateRadiusScale,
  generateTypographyScale, generateBorderWidthScale, getColorName,
  rgbToOklch, oklchToRgb, STARTER_COLORS,
} = require('../.test-build/algorithms.js');

// ── Tests ─────────────────────────────────────────────────────────

test('hexToRgb parses #6600ff correctly', () => {
  const {r,g,b} = hexToRgb('#6600ff');
  assertApprox(r, 0.400); assertApprox(g, 0); assertApprox(b, 1.000);
});
test('hexToRgb parses #000000 as black', () => {
  const {r,g,b} = hexToRgb('#000000');
  assertEqual({r,g,b}, {r:0,g:0,b:0});
});
test('hexToRgb parses #ffffff as white', () => {
  const {r,g,b} = hexToRgb('#ffffff');
  assertEqual({r,g,b}, {r:1,g:1,b:1});
});
test('rgbToHex round-trips with hexToRgb', () => {
  const hex = '#6600ff';
  const {r,g,b} = hexToRgb(hex);
  assertEqual(rgbToHex(r,g,b), hex);
});
test('generateColorRamp returns exactly 10 stops', () => {
  assertEqual(Object.keys(generateColorRamp('#6600ff')).length, 10);
});
test('generateColorRamp stop 500 equals exact input color', () => {
  const hex = '#6600ff';
  const ramp = generateColorRamp(hex);
  assertEqual(rgbToHex(ramp[500].r, ramp[500].g, ramp[500].b), hex);
});
test('generateColorRamp stop 50 is lighter than stop 500', () => {
  const ramp = generateColorRamp('#6600ff');
  const l50  = rgbToHsl(ramp[50].r,  ramp[50].g,  ramp[50].b).l;
  const l500 = rgbToHsl(ramp[500].r, ramp[500].g, ramp[500].b).l;
  if (l50 <= l500) throw new Error(`stop 50 (${l50.toFixed(3)}) not lighter than 500 (${l500.toFixed(3)})`);
});
test('generateColorRamp stop 900 is darker than stop 500', () => {
  const ramp = generateColorRamp('#6600ff');
  const l900 = rgbToHsl(ramp[900].r, ramp[900].g, ramp[900].b).l;
  const l500 = rgbToHsl(ramp[500].r, ramp[500].g, ramp[500].b).l;
  if (l900 >= l500) throw new Error(`stop 900 (${l900.toFixed(3)}) not darker than 500 (${l500.toFixed(3)})`);
});
test('generateColorRamp works for a dark input color', () => {
  const ramp = generateColorRamp('#1a0040');
  assertEqual(Object.keys(ramp).length, 10);
});
test('generateColorRamp works for a light input color', () => {
  const ramp = generateColorRamp('#f0e8ff');
  assertEqual(Object.keys(ramp).length, 10);
});
test('generateSpacingScale base=4 returns 10 values', () => {
  assertEqual(Object.keys(generateSpacingScale(4)).length, 10);
});
test('generateSpacingScale base=4 first key is "4"', () => {
  assertEqual(Object.keys(generateSpacingScale(4))[0], '4');
});
test('generateSpacingScale base=4 last value is 64', () => {
  const vals = Object.values(generateSpacingScale(4));
  assertEqual(vals[vals.length-1], 64);
});
test('generateSpacingScale base=8 scales correctly', () => {
  const s = generateSpacingScale(8);
  assertEqual(s['8'], 8); assertEqual(s['16'], 16); assertEqual(s['128'], 128);
});
test('generateRadiusScale returns 7 stops', () => {
  assertEqual(Object.keys(generateRadiusScale(4)).length, 7);
});
test('generateRadiusScale none is always 0', () => {
  assertEqual(generateRadiusScale(4).none, 0);
  assertEqual(generateRadiusScale(0).none, 0);
});
test('generateRadiusScale md equals base input', () => {
  assertEqual(generateRadiusScale(4).md, 4);
  assertEqual(generateRadiusScale(8).md, 8);
  assertEqual(generateRadiusScale(16).md, 16);
});
test('generateRadiusScale full is always 9999', () => {
  assertEqual(generateRadiusScale(4).full, 9999);
  assertEqual(generateRadiusScale(0).full, 9999);
});
test('generateRadiusScale stops are strictly ascending', () => {
  const s = generateRadiusScale(4);
  const vals = [s.none, s.sm, s.md, s.lg, s.xl, s['2xl'], s.full];
  for (let i = 0; i < vals.length - 1; i++)
    if (vals[i] >= vals[i+1])
      throw new Error(`stop ${i} (${vals[i]}) >= stop ${i+1} (${vals[i+1]})`);
});

test('generateTypographyScale returns 13 levels, all sizes on the 4pt grid', () => {
  const s = generateTypographyScale(16, 'major-third');
  assertEqual(s.length, 13);
  s.forEach(l => { if (l.fontSize % 4 !== 0) throw new Error(`${l.name} ${l.fontSize} off grid`); });
});
test('generateTypographyScale body equals font base and sizes never increase toward xs', () => {
  const s = generateTypographyScale(16, 'major-third');
  assertEqual(s.find(l => l.name === 'body').fontSize, 16);
  for (let i = 0; i < s.length - 1; i++)
    if (s[i].fontSize < s[i+1].fontSize) throw new Error(`${s[i].name} < ${s[i+1].name}`);
});
test('generateBorderWidthScale scales from base', () => {
  assertEqual(generateBorderWidthScale(1), { none:0, sm:1, md:2, lg:4, xl:8 });
});
test('getColorName never returns reserved semantic names', () => {
  const reserved = ['blue','green','red','amber','grey'];
  for (let h = 0; h < 360; h += 5) {
    const hex = '#' + [0,1,2].map(i => {
      const k = (i*4 + h/60) % 6, v = 1 - Math.max(0, Math.min(k, 4-k, 1));
      return Math.round((0.5 + v*0.4) * 255).toString(16).padStart(2,'0');
    }).join('');
    const name = getColorName(hex);
    if (reserved.some(r => name === r || name.endsWith('-' + r))) throw new Error(`${hex} -> ${name}`);
  }
});

const STOPS = [50,100,200,300,400,500,600,700,800,900];
const lch = (c) => rgbToOklch(c.r, c.g, c.b);
const hueDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('rgbToOklch matches reference values for sRGB red', () => {
  const { l, c, h } = rgbToOklch(1, 0, 0);
  assertApprox(l, 0.628, 0.002); assertApprox(c, 0.2577, 0.002); assertApprox(h, 29.23, 0.1);
});
test('rgbToOklch: white is L=1 with no chroma, black is L=0', () => {
  const w = rgbToOklch(1, 1, 1), k = rgbToOklch(0, 0, 0);
  assertApprox(w.l, 1, 0.001); assertApprox(w.c, 0, 0.001); assertApprox(k.l, 0, 0.001);
});
test('oklchToRgb round-trips rgbToOklch for in-gamut colors', () => {
  for (const hex of ['#3D6BE8', '#EA580C', '#22C55E', '#6B7280', '#0891B2', '#F59E0B']) {
    const { r, g, b } = hexToRgb(hex), { l, c, h } = rgbToOklch(r, g, b);
    assertEqual(rgbToHex(...Object.values(oklchToRgb(l, c, h))), hex.toLowerCase());
  }
});
test('oklchToRgb gamut-maps by reducing chroma and keeps lightness and hue', () => {
  const rgb = oklchToRgb(0.7, 0.4, 145);        // far outside sRGB
  [rgb.r, rgb.g, rgb.b].forEach(v => { if (!(v >= 0 && v <= 1)) throw new Error(`out of range: ${v}`); });
  const back = rgbToOklch(rgb.r, rgb.g, rgb.b);
  assertApprox(back.l, 0.7, 0.02); assertApprox(hueDelta(back.h, 145), 0, 2);
});
test('generateColorRamp lightness strictly decreases from stop 50 to 900', () => {
  for (const hex of Object.values(STARTER_COLORS)) {
    const ramp = generateColorRamp(hex);
    for (let i = 0; i < STOPS.length - 1; i++) {
      const a = lch(ramp[STOPS[i]]).l, b = lch(ramp[STOPS[i + 1]]).l;
      if (a <= b) throw new Error(`${hex}: L(${STOPS[i]})=${a.toFixed(3)} <= L(${STOPS[i + 1]})=${b.toFixed(3)}`);
    }
  }
});
test('generateColorRamp keeps the input hue across every stop', () => {
  for (const hex of [...Object.values(STARTER_COLORS).slice(0, 8), '#00ff00', '#ff00ff', '#0000ff', '#ffff00']) {
    const ramp = generateColorRamp(hex), h500 = lch(ramp[500]).h;
    for (const s of STOPS) {
      const p = lch(ramp[s]);
      if (p.c > 0.02 && hueDelta(p.h, h500) > 4) throw new Error(`${hex} stop ${s}: hue ${p.h.toFixed(1)} vs ${h500.toFixed(1)}`);
    }
  }
});
test('generateColorRamp: chroma eases off toward both ends', () => {
  const ramp = generateColorRamp('#3D6BE8');
  const c = (s) => lch(ramp[s]).c;
  if (!(c(50) < c(200) && c(200) < c(500) && c(900) < c(600))) throw new Error('chroma curve not peaked at 500');
});
test('generateColorRamp: greys stay neutral', () => {
  const ramp = generateColorRamp('#808080');
  STOPS.forEach(s => { if (lch(ramp[s]).c > 0.01) throw new Error(`stop ${s} has chroma ${lch(ramp[s]).c}`); });
});
test('generateColorRamp handles near-white and near-black inputs without NaN or inversions', () => {
  for (const hex of ['#fefefe', '#f8f4ff', '#050505', '#0a0014', '#000000', '#ffffff']) {
    const ramp = generateColorRamp(hex);
    let prev = Infinity;
    for (const s of STOPS) {
      const { r, g, b } = ramp[s];
      if ([r, g, b].some(v => Number.isNaN(v) || v < 0 || v > 1)) throw new Error(`${hex} stop ${s} invalid`);
      const l = lch(ramp[s]).l;
      if (l > prev + 1e-6) throw new Error(`${hex}: lightness rises at stop ${s}`);
      prev = l;
    }
  }
});
test('generateColorRamp yields distinct, valid hex values for every starter color', () => {
  for (const hex of Object.values(STARTER_COLORS)) {
    const ramp = generateColorRamp(hex);
    const hexes = STOPS.map(s => rgbToHex(ramp[s].r, ramp[s].g, ramp[s].b));
    if (new Set(hexes).size !== 10) throw new Error(`${hex}: duplicate stops ${hexes}`);
    hexes.forEach(h => { if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error(`bad hex ${h}`); });
  }
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
