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
  weightFromStyleName, pickFontStyle, collectionKey,
  scopesFor, webCodeSyntax, ELEVATION_LEVELS, OPACITY_STEPS, Z_INDEX_LAYERS,
  relativeLuminance, wcagRatio, wcagLevel, apcaLc, apcaUse, analyzeRamp, brandColorNames,
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

test('weightFromStyleName maps common style names to 100–900', () => {
  const cases = { Thin: 100, 'Extra Light': 200, ExtraLight: 200, Light: 300, Regular: 400, Book: 400, Medium: 500,
    'Semi Bold': 600, SemiBold: 600, 'Demi Bold': 600, Bold: 700, 'Extra Bold': 800, ExtraBold: 800, 'Ultra Bold': 800, Black: 900, Heavy: 900 };
  for (const [style, weight] of Object.entries(cases)) assertEqual(weightFromStyleName(style), weight, style);
});
test('weightFromStyleName ignores italic, oblique and unrecognised styles', () => {
  for (const s of ['Italic', 'Bold Italic', 'Light Oblique', 'Condensed Bold', 'Weird']) assertEqual(weightFromStyleName(s), null, s);
});
test('pickFontStyle returns the exact weight when the font has it', () => {
  assertEqual(pickFontStyle(600, ['Regular', 'Medium', 'Semi Bold', 'Bold']), { style: 'Semi Bold', weight: 600, exact: true });
});
test('pickFontStyle falls back to the nearest weight, heavier on a tie', () => {
  assertEqual(pickFontStyle(600, ['Regular', 'Bold']), { style: 'Bold', weight: 700, exact: false });
  assertEqual(pickFontStyle(500, ['Light', 'Bold']).style, 'Bold');
  assertEqual(pickFontStyle(700, ['Regular', 'Medium']).style, 'Medium');
});
test('pickFontStyle skips italics and returns null when nothing usable', () => {
  assertEqual(pickFontStyle(400, ['Italic', 'Bold Italic']), null);
  assertEqual(pickFontStyle(400, ['Regular', 'Italic']).style, 'Regular');
});
test('typography scale: weights step down from displays to body', () => {
  const s = generateTypographyScale(16, 'major-third'), w = (n) => s.find(l => l.name === n).fontWeight;
  assertEqual([w('display-lg'), w('h1'), w('h3'), w('h6'), w('body'), w('xs')], [700, 700, 600, 600, 400, 400]);
});
test('typography scale: paragraph spacing is on the 4pt grid, none for displays, 12px for 16px body', () => {
  const s = generateTypographyScale(16, 'major-third'), ps = (n) => s.find(l => l.name === n).paragraphSpacing;
  assertEqual([ps('display-lg'), ps('display-md'), ps('display-sm')], [0, 0, 0]);
  assertEqual(ps('body'), 12);
  s.forEach(l => { if (l.paragraphSpacing % 4 !== 0 || l.paragraphSpacing < 0) throw new Error(`${l.name}: ${l.paragraphSpacing}`); });
});
test('typography scale: body paragraph spacing grows with the base size', () => {
  const ps = (base) => generateTypographyScale(base, 'major-third').find(l => l.name === 'body').paragraphSpacing;
  if (!(ps(12) < ps(16) && ps(16) < ps(24))) throw new Error('not increasing');
});

test('collectionKey drops ordering numbers and camelCases', () => {
  const cases = { '01 Global': 'global', '02 Alias': 'alias', '03 Component': 'component', 'My Own Collection': 'myOwnCollection',
    'design-tokens': 'designTokens', 'UI Kit': 'uiKit', '2024 Tokens': 'tokens', 'Global': 'global', 'brand_colors': 'brandColors' };
  for (const [name, key] of Object.entries(cases)) assertEqual(collectionKey(name), key, name);
});
test('collectionKey always returns a usable identifier', () => {
  for (const name of ['01', '  ', '---', '日本語', '__proto__']) {
    const k = collectionKey(name);
    if (!/^[A-Za-z0-9]+$/.test(k) && k !== 'collection') throw new Error(`${JSON.stringify(name)} -> ${JSON.stringify(k)}`);
  }
});

test('scopesFor: Global primitives with an Alias counterpart are hidden, the rest stay visible where they apply', () => {
  assertEqual(scopesFor('global', 'color/cobalt/500', 'COLOR'), []);
  assertEqual(scopesFor('global', 'borderRadius/4', 'FLOAT'), []);
  assertEqual(scopesFor('global', 'typography/font-size/h1', 'FLOAT'), []);
  assertEqual(scopesFor('global', 'typography/fontSize/heading/h1', 'FLOAT'), []);
  assertEqual(scopesFor('global', 'spacing/4', 'FLOAT'), ['GAP', 'WIDTH_HEIGHT']);
  assertEqual(scopesFor('global', 'opacity/50', 'FLOAT'), ['OPACITY']);
  assertEqual(scopesFor('global', 'elevation/md/blur', 'FLOAT'), ['EFFECT_FLOAT']);
  assertEqual(scopesFor('global', 'elevation/md/color', 'COLOR'), ['EFFECT_COLOR']);
});
test('scopesFor: Alias and Component tokens are scoped to the fields they are for', () => {
  assertEqual(scopesFor('alias', 'color/primary/500', 'COLOR'), ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']);
  assertEqual(scopesFor('alias', 'colors/primary/500', 'COLOR'), ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']);
  assertEqual(scopesFor('alias', 'borderRadius/sm', 'FLOAT'), ['CORNER_RADIUS']);
  assertEqual(scopesFor('alias', 'borderWidth/sm', 'FLOAT'), ['STROKE_FLOAT']);
  assertEqual(scopesFor('alias', 'typography/font-family', 'STRING'), ['FONT_FAMILY']);
  assertEqual(scopesFor('alias', 'typography/font-family/heading', 'STRING'), ['FONT_FAMILY']);
  assertEqual(scopesFor('alias', 'text/h1/font-size', 'FLOAT'), ['FONT_SIZE']);
  assertEqual(scopesFor('alias', 'text/h1/paragraphSpacing', 'FLOAT'), ['PARAGRAPH_SPACING']);
  assertEqual(scopesFor('alias', 'text/h1/font-weight', 'FLOAT'), ['FONT_WEIGHT']);
  assertEqual(scopesFor('component', 'text/default', 'COLOR'), ['TEXT_FILL']);
  assertEqual(scopesFor('component', 'icon/subtle', 'COLOR'), ['SHAPE_FILL']);
  assertEqual(scopesFor('component', 'surface/primary', 'COLOR'), ['FRAME_FILL', 'SHAPE_FILL']);
  assertEqual(scopesFor('component', 'border/default', 'COLOR'), ['STROKE_COLOR']);
});
test('webCodeSyntax matches Style Dictionary css naming (layer + kebab-cased path)', () => {
  assertEqual(webCodeSyntax('global', 'color/cobalt/500'), 'var(--global-color-cobalt-500)');
  assertEqual(webCodeSyntax('alias', 'borderRadius/2xl'), 'var(--alias-border-radius-2xl)');
  assertEqual(webCodeSyntax('alias', 'text/h1/letter-spacing'), 'var(--alias-text-h1-letter-spacing)');
  assertEqual(webCodeSyntax('alias', 'text/h1/paragraphSpacing'), 'var(--alias-text-h1-paragraph-spacing)');
  assertEqual(webCodeSyntax('global', 'z-index/modal'), 'var(--global-z-index-modal)');
  assertEqual(webCodeSyntax('component', 'surface/primary'), 'var(--component-surface-primary)');
});
test('elevation levels never shrink in offset or opacity and always grow in blur; opacity and z-index scales ascend', () => {
  for (let i = 1; i < ELEVATION_LEVELS.length; i++) {
    const a = ELEVATION_LEVELS[i - 1], b = ELEVATION_LEVELS[i];
    if (!(b.offsetY >= a.offsetY && b.blur > a.blur && b.alpha >= a.alpha)) throw new Error(`${a.name} -> ${b.name}`);
  }
  for (let i = 1; i < OPACITY_STEPS.length; i++) if (OPACITY_STEPS[i] <= OPACITY_STEPS[i - 1]) throw new Error('opacity not ascending');
  assertEqual([OPACITY_STEPS[0], OPACITY_STEPS[OPACITY_STEPS.length - 1]], [0, 100]);
  for (let i = 1; i < Z_INDEX_LAYERS.length; i++) if (Z_INDEX_LAYERS[i][1] <= Z_INDEX_LAYERS[i - 1][1]) throw new Error('z-index not ascending');
});

const WHITE = hexToRgb('#ffffff'), BLACK = hexToRgb('#000000');

test('wcagRatio matches reference values', () => {
  assertApprox(wcagRatio(BLACK, WHITE), 21, 0.001);
  assertApprox(wcagRatio(WHITE, WHITE), 1, 0.001);
  assertApprox(wcagRatio(hexToRgb('#767676'), WHITE), 4.54, 0.01);   // the lightest grey that passes AA on white
  assertApprox(wcagRatio(hexToRgb('#777777'), WHITE), 4.48, 0.01);   // just fails
  assertApprox(wcagRatio(BLACK, WHITE), wcagRatio(WHITE, BLACK), 1e-9);
});
test('wcagLevel thresholds: 7 AAA, 4.5 AA, 3 AA large', () => {
  assertEqual([7, 6.99, 4.5, 4.49, 3, 2.99, 1].map(wcagLevel), ['AAA', 'AA', 'AA', 'AA large', 'AA large', 'Fail', 'Fail']);
});
test('relativeLuminance: white is 1, black is 0, green outweighs blue', () => {
  assertApprox(relativeLuminance(WHITE), 1, 1e-9); assertApprox(relativeLuminance(BLACK), 0, 1e-9);
  if (!(relativeLuminance(hexToRgb('#00ff00')) > relativeLuminance(hexToRgb('#0000ff')))) throw new Error('weights wrong');
});
test('apcaLc matches reference values and is polarity dependent', () => {
  assertApprox(apcaLc(BLACK, WHITE), 106.04, 0.05);
  assertApprox(apcaLc(WHITE, BLACK), -107.88, 0.05);
  assertApprox(apcaLc(hexToRgb('#888888'), WHITE), 63.06, 0.05);
  assertEqual(apcaLc(WHITE, WHITE), 0);
  if (!(apcaLc(WHITE, hexToRgb('#888888')) < 0)) throw new Error('light text on mid grey should be negative');
});
test('apcaUse maps Lc magnitude to a use', () => {
  assertEqual([95, 80, 65, 50, 35, 10, -108].map(apcaUse), ['Any text', 'Body text', 'Content text', 'Large text', 'Spot use', 'Not for text', 'Any text']);
});
test('analyzeRamp: ratios rise toward white-dark stops and fall toward black', () => {
  for (const hex of Object.values(STARTER_COLORS)) {
    const r = analyzeRamp(generateColorRamp(hex));
    for (let i = 1; i < r.stops.length; i++) {
      if (!(r.stops[i].white >= r.stops[i - 1].white - 1e-9)) throw new Error(`${hex}: white ratio falls at ${r.stops[i].stop}`);
      if (!(r.stops[i].black <= r.stops[i - 1].black + 1e-9)) throw new Error(`${hex}: black ratio rises at ${r.stops[i].stop}`);
    }
  }
});
test('analyzeRamp: bestText is the higher-contrast of white and black, and its APCA sign agrees', () => {
  const r = analyzeRamp(generateColorRamp('#3D6BE8'));
  for (const s of r.stops) {
    assertEqual(s.bestText, s.white >= s.black ? 'white' : 'black', `stop ${s.stop}`);
    assertApprox(s.bestRatio, Math.max(s.white, s.black), 1e-9);
    if ((s.bestText === 'white') !== (s.apca < 0)) throw new Error(`stop ${s.stop}: apca sign ${s.apca}`);
  }
});
test('analyzeRamp summary: lowest AA stop on white, highest AA stop on black, and on the lightest tint', () => {
  const ramp = generateColorRamp('#3D6BE8'), r = analyzeRamp(ramp);
  assertEqual(r.aaOnWhiteFrom, 500); assertEqual(r.aaOnBlackUpTo, 400); assertEqual(r.aaOnLightTintFrom, 600);
  const at = (s) => r.stops.find(x => x.stop === s);
  if (!(at(r.aaOnWhiteFrom).white >= 4.5 && at(r.aaOnWhiteFrom - 100).white < 4.5)) throw new Error('white boundary off');
  if (!(at(r.aaOnBlackUpTo).black >= 4.5 && at(r.aaOnBlackUpTo + 100).black < 4.5)) throw new Error('black boundary off');
});
test('analyzeRamp: a very light colour never reaches AA on white, so the summary says null', () => {
  assertEqual(analyzeRamp(generateColorRamp('#fafafa')).aaOnWhiteFrom !== null, true);   // its 900 stop is dark
  const flat = analyzeRamp({ 50: hexToRgb('#ffffff'), 500: hexToRgb('#eeeeee') });
  assertEqual([flat.aaOnWhiteFrom, flat.aaOnLightTintFrom], [null, null]);
});
test('brandColorNames de-duplicates and skips invalid or blank colours', () => {
  assertEqual(brandColorNames({ primary: '#3D6BE8', secondary: '#3D6BE9', tertiary: '', accent: 'nope' }, ['primary', 'secondary', 'tertiary', 'accent']), { primary: 'cobalt', secondary: 'cobalt-2' });
});

test('analyzeRamp: every stop reaches AA with white or black text (the better of the two is at least 4.58:1)', () => {
  for (let i = 0; i < 40; i++) {
    const hex = '#' + [i * 37 % 256, i * 91 % 256, i * 53 % 256].map(v => v.toString(16).padStart(2, '0')).join('');
    for (const s of analyzeRamp(generateColorRamp(hex)).stops) if (s.bestRatio < 4.5) throw new Error(`${hex} stop ${s.stop}: ${s.bestRatio}`);
  }
});
test('analyzeRamp: per-stop levels match the ratios against white and black', () => {
  for (const s of analyzeRamp(generateColorRamp('#3D6BE8')).stops) {
    assertEqual(s.whiteLevel, wcagLevel(s.white), `white ${s.stop}`); assertEqual(s.blackLevel, wcagLevel(s.black), `black ${s.stop}`);
  }
  const s400 = analyzeRamp(generateColorRamp('#3D6BE8')).stops.find(s => s.stop === 400);
  assertEqual([s400.whiteLevel, s400.blackLevel], ['AA large', 'AA']);   // white text on 400 is only OK for large text; black passes AA (6.8:1)
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
