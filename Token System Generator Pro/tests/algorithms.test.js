// Run with: node tests/algorithms.test.js
// Pure function mirrors from code.js — keep in sync manually.

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

// ── Mirrored pure functions ───────────────────────────────────────

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return { r: parseInt(c.slice(0,2),16)/255, g: parseInt(c.slice(2,4),16)/255, b: parseInt(c.slice(4,6),16)/255 };
}
function rgbToHsl(r, g, b) {
  const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2;
  if (max===min) return {h:0,s:0,l};
  const d = max-min, s = l>0.5 ? d/(2-max-min) : d/(max+min);
  let h=0;
  if (max===r) h=((g-b)/d+(g<b?6:0))/6;
  else if (max===g) h=((b-r)/d+2)/6;
  else h=((r-g)/d+4)/6;
  return {h,s,l};
}
function hslToRgb(h, s, l) {
  if (s===0) return {r:l,g:l,b:l};
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const hue2rgb = (p,q,t) => {
    if (t<0) t+=1; if (t>1) t-=1;
    if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q;
    if (t<2/3) return p+(q-p)*(2/3-t)*6; return p;
  };
  return { r:hue2rgb(p,q,h+1/3), g:hue2rgb(p,q,h), b:hue2rgb(p,q,h-1/3) };
}
function rgbToHex(r,g,b) {
  const h = n => Math.round(n*255).toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
const RAMP_STOPS = [50,100,200,300,400,500,600,700,800,900];
function generateColorRamp(hex) {
  const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lMap = {50:.95,100:.88,200:.76,300:.64,400:.52,500:hsl.l,
    600:hsl.l*.78,700:hsl.l*.58,800:hsl.l*.40,900:hsl.l*.24};
  const sMap = {50:hsl.s*.30,100:hsl.s*.45,200:hsl.s*.60,300:hsl.s*.75,400:hsl.s*.90,500:hsl.s,
    600:Math.min(1,hsl.s*1.05),700:Math.min(1,hsl.s*1.10),
    800:Math.min(1,hsl.s*1.15),900:Math.min(1,hsl.s*1.20)};
  const result = {};
  for (const stop of RAMP_STOPS) result[stop] = hslToRgb(hsl.h, sMap[stop], lMap[stop]);
  result[500] = rgb;
  return result;
}
const SPACING_MULTIPLIERS = [1,2,3,4,5,6,8,10,12,16];
function generateSpacingScale(base) {
  const s = {};
  for (const m of SPACING_MULTIPLIERS) s[String(base*m)] = base*m;
  return s;
}
function generateRadiusScale(base) {
  return { none:0, sm:Math.max(1,Math.round(base/2)), md:base, lg:base*2, xl:base*4, '2xl':base*6, full:9999 };
}

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

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
