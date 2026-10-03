// Run with: npm test
// Runs the bundled plugin (code.ts) against an in-memory Figma mock and checks that a failed
// run leaves the document exactly as it was, whichever step fails.
const { createFigma } = require('./figma-mock');

const BUNDLE = require('path').join(__dirname, '..', '.test-build', 'code.js');
const COLORS = {
  primary: '#3D6BE8', secondary: '#7C3AED', tertiary: '#0891B2', accent: '#EA580C',
  info: '#3B82F6', success: '#22C55E', error: '#EF4444', warning: '#F59E0B', neutral: '#6B7280',
};
const EXISTING = {
  collections: [{ name: '01 Global', variables: ['old/a', 'old/b'] }, { name: 'My Own Collection', variables: ['mine/x'] }],
  paintStyles: [
    ['red-50', .9, .8, .8], ['red-500', .9, .1, .1], ['red-900', .3, 0, 0], ['blue-50', .8, .8, .9],
    ['blue-500', .1, .1, .9], ['blue-900', 0, 0, .3], ['green-500', .1, .8, .1], ['grey-500', .5, .5, .5],
    ['indigo/500', .3, .3, .8],      // looks like a ramp stop this plugin made earlier (a colour that is no longer in use)
    ['Brand/Primary', .2, .2, .2],   // the user's own style
  ],
  textStyles: [['Heading/h1', 32], ['Body/body', 16], ['Label/small', 12]],   // Heading/h1 is this plugin's; the others are the user's
};

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function request(doc, { approach, mode, fontFamily = 'Inter', bodyFontFamily, confirmed = true }) {
  const fig = createFigma(doc);
  fig.load(BUNDLE);
  const msg = { type: confirmed ? 'confirm-continue' : 'generate', approach, mode, fontFamily };
  if (mode === 'scratch') Object.assign(msg, { colors: COLORS, spacingBase: 4, radiusBase: 4, widthBase: 1, fontBase: 16, ratioKey: 'major-third', bodyFontFamily });
  return { fig, run: async () => { const p = fig.send(msg); const result = await fig.finished(); await p; return result; } };
}

const MODES = [['scratch', ['2tier', '3tier']], ['starter', ['2tier', '3tier']], ['convert', ['2tier', '3tier']]];

(async () => {
  // ── Success: old tokens replaced, new ones fully named ──
  for (const [mode, tiers] of MODES) for (const approach of tiers) {
    await test(`${approach} ${mode}: replaces old tokens and leaves no staging names`, async () => {
      const { fig, run } = request(EXISTING, { approach, mode });
      const result = await run();
      assert(result.type === 'generation-complete', `got ${result.type}: ${result.message}`);
      const names = fig.state.collections.map(c => c.name).sort();
      assert(!names.some(n => n.includes('(generating)')), `staging name left over: ${names}`);
      assert(names.includes('01 Global') && names.includes('02 Alias'), `collections: ${names}`);
      assert(names.includes('03 Component') === (approach === '3tier'), `component tier wrong: ${names}`);
      assert(!fig.state.variables.some(v => v.name.startsWith('old/')), 'old tokens in a plugin collection survived');
      // Anything that isn't one of this plugin's collections or styles is left alone.
      assert(names.includes('My Own Collection') && fig.state.variables.some(v => v.name === 'mine/x'), "the user's own collection was removed");
      const paint = fig.state.paintStyles.map(s => s.name), text = fig.state.textStyles.map(s => s.name);
      assert(paint.includes('Brand/Primary') && paint.includes('red-50'), "the user's own paint styles were removed");
      assert(text.includes('Body/body') && text.includes('Label/small'), "the user's own text styles were removed");
      if (mode === 'convert') {
        assert(paint.length === EXISTING.paintStyles.length && text.length === EXISTING.textStyles.length, 'convert must keep every local style');
      } else {
        assert(!paint.includes('indigo/500'), "a stale plugin ramp style survived");
        assert(text.filter(n => n === 'Heading/h1').length === 1, 'Heading/h1 was duplicated instead of replaced');
      }
    });
  }

  // ── Failure: inject a throw at every kind of step; nothing may change ──
  const FAULT_OPS = ['createCollection', 'createVariable', 'setValue', 'createPaintStyle', 'createTextStyle'];
  for (const [mode, tiers] of MODES) for (const approach of tiers) {
    await test(`${approach} ${mode}: a failure at any step restores the document exactly`, async () => {
      // Count how many times each operation runs in a clean pass.
      const probe = request(EXISTING, { approach, mode });
      await probe.run();
      const totals = { ...probe.fig.counts };
      for (const op of FAULT_OPS) {
        const n = totals[op] || 0;
        if (!n) continue;
        const points = new Set([1, 2, n, n - 1, Math.ceil(n / 2)]);
        for (let k = 1; k <= n; k += Math.max(1, Math.floor(n / 25))) points.add(k);
        for (const k of [...points].filter(k => k >= 1 && k <= n)) {
          const doc = { ...EXISTING, faults: { [op]: k } };
          const { fig, run } = request(doc, { approach, mode });
          const before = fig.snapshot();
          const result = await run();
          assert(result.type === 'generation-failed', `${op} #${k}: expected failure, got ${result.type}`);
          assert(result.leftover === 0, `${op} #${k}: leftover ${result.leftover}`);
          assert(fig.snapshot() === before, `${op} #${k}: document changed after a failed run`);
        }
      }
    });
  }

  await test('first run on an empty file (no confirm step) reports failure and leaves it empty', async () => {
    for (const mode of ['scratch', 'starter']) {
      const probe = request({}, { approach: '3tier', mode, confirmed: false });
      await probe.run();
      const n = probe.fig.counts.createVariable;
      for (const k of [1, Math.ceil(n / 2), n]) {
        const { fig, run } = request({ faults: { createVariable: k } }, { approach: '3tier', mode, confirmed: false });
        const result = await run();
        assert(result.type === 'generation-failed', `${mode} #${k}: got ${result.type}`);
        assert(fig.state.collections.length === 0 && fig.state.variables.length === 0 && fig.state.paintStyles.length === 0 && fig.state.textStyles.length === 0, `${mode} #${k}: left tokens behind`);
      }
    }
  });

  await test('both fonts failing to load rolls everything back', async () => {
    const { fig, run } = request({ ...EXISTING, faults: { loadFont: [1, 2] } }, { approach: '3tier', mode: 'scratch' });
    const before = fig.snapshot();
    const result = await run();
    assert(result.type === 'generation-failed', `got ${result.type}`);
    assert(fig.snapshot() === before, 'document changed');
  });

  await test('convert with no solid color styles fails cleanly and keeps old tokens', async () => {
    const doc = { collections: EXISTING.collections, textStyles: EXISTING.textStyles };
    const { fig, run } = request(doc, { approach: '2tier', mode: 'convert' });
    const before = fig.snapshot();
    const result = await run();
    assert(result.type === 'generation-failed' && /solid color/i.test(result.message), `got ${result.type}: ${result.message}`);
    assert(fig.snapshot() === before, 'document changed');
  });

  await test('failed rollback is reported honestly (leftover > 0)', async () => {
    const { run } = request({ faults: { createVariable: 40, removeCollection: [1, 2, 3] } }, { approach: '2tier', mode: 'scratch', confirmed: false });
    const result = await run();
    assert(result.type === 'generation-failed' && result.leftover > 0, `leftover ${result.leftover}`);
  });

  // ── Non-fatal problems stay warnings and the new system is complete ──
  await test('unavailable font falls back to Helvetica with a warning', async () => {
    const { fig, run } = request(EXISTING, { approach: '2tier', mode: 'scratch', fontFamily: 'Missing Font' });
    const result = await run();
    assert(result.type === 'generation-complete' && result.warnings.some(w => /Helvetica/.test(w)), JSON.stringify(result.warnings));
    assert(fig.state.textStyles.filter(s => /^(Display|Heading|Body copy)\//.test(s.name)).length === 13, `text styles: ${fig.state.textStyles.length}`);
  });

  await test('failing to link a text style is a warning, not a rollback', async () => {
    const { fig, run } = request(EXISTING, { approach: '2tier', mode: 'scratch' });
    fig.counts.bind = 0;
    const result = await createAndRunWithFault({ bind: 1 });
    assert(result.type === 'generation-complete' && result.warnings.some(w => /link a text style/.test(w)), JSON.stringify(result));
    async function createAndRunWithFault(faults) { return request({ ...EXISTING, faults }, { approach: '2tier', mode: 'scratch' }).run(); }
  });

  await test('failing to remove an old variable is a warning; new system is complete', async () => {
    const { fig, run } = request({ ...EXISTING, faults: { removeVariable: 1 } }, { approach: '2tier', mode: 'scratch' });
    const result = await run();
    assert(result.type === 'generation-complete' && result.warnings.some(w => /old variable/.test(w)), JSON.stringify(result));
    assert(fig.state.collections.some(c => c.name === '01 Global') && fig.state.collections.some(c => c.name === '02 Alias'), 'new collections missing');
  });

  // ── Request validation ──
  const scratchMsg = (over = {}) => ({
    type: 'confirm-continue', approach: '2tier', mode: 'scratch', colors: COLORS,
    spacingBase: 4, radiusBase: 4, widthBase: 1, fontBase: 16, ratioKey: 'major-third', fontFamily: 'Inter', ...over,
  });
  const BAD_REQUESTS = [
    ['spacing of zero', { spacingBase: 0 }], ['huge spacing', { spacingBase: 1e9 }], ['fractional radius', { radiusBase: 2.5 }],
    ['NaN width', { widthBase: NaN }], ['string font size', { fontBase: '16' }], ['tiny font size', { fontBase: 2 }],
    ['unknown ratio', { ratioKey: 'constructor' }], ['missing font', { fontFamily: '' }],
    ['unknown mode', { mode: 'nuke' }], ['unknown tier', { approach: '9tier' }],
    ['invalid primary hex', { colors: { ...COLORS, primary: 'red' } }],
    ['injected hex', { colors: { ...COLORS, accent: '#fff"><script>' } }],
    ['missing colors', { colors: undefined }],
  ];
  for (const [label, over] of BAD_REQUESTS) {
    await test(`rejects ${label} without touching the document`, async () => {
      const fig = createFigma(EXISTING); fig.load(BUNDLE);
      const before = fig.snapshot();
      fig.send(scratchMsg(over));
      const result = await fig.finished();
      assert(result.type === 'generation-failed' && result.leftover === 0, `got ${result.type}`);
      assert(fig.snapshot() === before, 'document changed');
      assert(fig.counts.createCollection === undefined, 'started building before validating');
    });
  }

  await test('optional semantic colors may be left blank', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    fig.send(scratchMsg({ colors: { ...COLORS, tertiary: '', info: '#', warning: undefined } }));
    const result = await fig.finished();
    assert(result.type === 'generation-complete', `got ${result.type}: ${result.message}`);
  });

  // ── One run at a time ──
  await test('a second request while one is running is ignored', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    const first = fig.send(scratchMsg());
    const second = fig.send(scratchMsg());           // e.g. a double-click
    await Promise.all([first, second]);
    const done = fig.state.messages.filter(m => m.type === 'generation-complete');
    assert(done.length === 1, `completed ${done.length} times`);
    assert(fig.state.notes.some(n => /Still generating/.test(n)), 'no busy notice');
    const names = fig.state.collections.map(c => c.name).sort();
    assert(JSON.stringify(names) === JSON.stringify(['01 Global', '02 Alias', 'My Own Collection']), `collections: ${names}`);
  });

  await test('the plugin can run again after a failed run', async () => {
    const fig = createFigma({ ...EXISTING, faults: { createPaintStyle: 5 } }); fig.load(BUNDLE);
    await fig.send(scratchMsg());
    fig.state.messages.length = 0;
    await fig.send(scratchMsg());
    assert(fig.state.messages.some(m => m.type === 'generation-complete'), 'second run did not complete');
  });

  // ── Closing the plugin mid-build ──
  await test('closing the plugin during the build removes everything staged so far', async () => {
    let snapshotAtClose = null, before = null, fig;
    const hooks = { createTextStyle: (n) => {
      if (n !== 5) return;
      fig.emit('close');                                   // Figma calls this, then stops the plugin
      snapshotAtClose = fig.snapshot();
      throw new Error('plugin terminated');                // the mock keeps running, so stop it here
    } };
    fig = createFigma({ ...EXISTING, hooks }); fig.load(BUNDLE);
    before = fig.snapshot();
    await fig.send(scratchMsg());
    assert(snapshotAtClose === before, 'staged tokens were still in the file when the plugin closed');
  });

  // ── Hostile names in the file ──
  await test('exporting a file with __proto__ / constructor variable names does not pollute Object.prototype', async () => {
    const doc = { collections: [{ name: '__proto__', variables: ['__proto__/polluted', 'constructor/prototype/polluted2', 'a/__proto__/polluted3'] }] };
    const fig = createFigma(doc); fig.load(BUNDLE);
    await fig.send({ type: 'export-json' });
    const out = fig.state.messages.find(m => m.type === 'export-ready');
    assert(out, 'no export produced');
    JSON.parse(out.json);
    const leaked = fig.evalInPlugin('[({}).polluted, ({}).polluted2, ({}).polluted3].filter(v => v !== undefined).length');
    assert(leaked === 0, 'Object.prototype was polluted');
  });

  await test('JSON export of a generated system is valid and resolves aliases', async () => {
    const fig = createFigma(); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', approach: '3tier' }));
    fig.state.messages.length = 0;
    await fig.send({ type: 'export-json' });
    const out = JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json);
    const refs = JSON.stringify(out).match(/\{[^{}"]+\}/g) || [];
    assert(refs.length > 50, `only ${refs.length} alias references`);
    assert(refs.every(r => /^\{[^.]+\.[^{}]+\}$/.test(r)), 'malformed alias reference');
  });

  // ── Optional second font (body copy) ──
  const textStyle = (fig, name) => fig.state.textStyles.find(s => s.name === name);
  const varNamed = (fig, name) => fig.state.variables.find(v => v.name === name);
  const HEADING_STYLES = ['Display/display-lg', 'Display/display-sm', 'Heading/h1', 'Heading/h6'];
  const BODY_STYLES = ['Body copy/body-lg', 'Body copy/body', 'Body copy/caption', 'Body copy/xs'];

  await test('one font (default): a single font-family variable, every text style uses it', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Georgia', confirmed: false });
    const result = await run();
    assert(result.type === 'generation-complete', result.message);
    assert(varNamed(fig, 'typography/font-family'), 'missing typography/font-family');
    assert(!fig.state.variables.some(v => /font-family\/(heading|body)/.test(v.name)), 'role variables created for a single font');
    [...HEADING_STYLES, ...BODY_STYLES].forEach(n => {
      assert(textStyle(fig, n).fontName.family === 'Georgia', `${n} uses ${textStyle(fig, n).fontName.family}`);
      assert(textStyle(fig, n).bound.fontFamily === 'typography/font-family', `${n} bound to ${textStyle(fig, n).bound.fontFamily}`);
    });
  });

  for (const approach of ['2tier', '3tier']) {
    await test(`${approach}: two fonts split headings and body copy, with a variable and alias for each`, async () => {
      const { fig, run } = request({}, { approach, mode: 'scratch', fontFamily: 'Playfair Display', bodyFontFamily: 'Source Sans 3', confirmed: false });
      const result = await run();
      assert(result.type === 'generation-complete' && result.warnings.length === 0, JSON.stringify(result));
      const heading = varNamed(fig, 'typography/font-family/heading'), body = varNamed(fig, 'typography/font-family/body');
      assert(heading && body, 'missing role variables');
      assert(Object.values(heading.valuesByMode)[0] === 'Playfair Display' && Object.values(body.valuesByMode)[0] === 'Source Sans 3', 'wrong font values');
      assert(!varNamed(fig, 'typography/font-family'), 'plain font-family variable should not exist when two fonts are used');
      const aliases = fig.state.variables.filter(v => /^typography\/font-family\/(heading|body)$/.test(v.name) && Object.values(v.valuesByMode)[0].type === 'VARIABLE_ALIAS');
      assert(aliases.length === 2, `expected 2 alias variables, got ${aliases.length}`);
      HEADING_STYLES.forEach(n => {
        assert(textStyle(fig, n).fontName.family === 'Playfair Display', `${n} uses ${textStyle(fig, n).fontName.family}`);
        assert(textStyle(fig, n).bound.fontFamily === 'typography/font-family/heading', `${n} bound to ${textStyle(fig, n).bound.fontFamily}`);
      });
      BODY_STYLES.forEach(n => {
        assert(textStyle(fig, n).fontName.family === 'Source Sans 3', `${n} uses ${textStyle(fig, n).fontName.family}`);
        assert(textStyle(fig, n).bound.fontFamily === 'typography/font-family/body', `${n} bound to ${textStyle(fig, n).bound.fontFamily}`);
      });
    });
  }

  await test('choosing the same font twice behaves like one font', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Inter', bodyFontFamily: 'Inter', confirmed: false });
    const result = await run();
    assert(result.type === 'generation-complete' && varNamed(fig, 'typography/font-family') && !varNamed(fig, 'typography/font-family/body'), 'not treated as a single font');
  });

  await test('a blank body font means one font', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', bodyFontFamily: '', confirmed: false });
    await run();
    assert(varNamed(fig, 'typography/font-family') && !varNamed(fig, 'typography/font-family/heading'), 'blank body font created two variables');
  });

  await test('an unavailable body font falls back to Helvetica for body copy only, with a warning', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Inter', bodyFontFamily: 'Missing Font', confirmed: false });
    const result = await run();
    assert(result.type === 'generation-complete' && result.warnings.some(w => /Missing Font/.test(w) && /Helvetica/.test(w)), JSON.stringify(result));
    assert(textStyle(fig, 'Heading/h1').fontName.family === 'Inter', 'heading font changed');
    assert(textStyle(fig, 'Body copy/body').fontName.family === 'Helvetica', 'body font did not fall back');
  });

  for (const [label, body] of [['a number', 42], ['an over-long name', 'x'.repeat(300)], ['an object', { a: 1 }]]) {
    await test(`rejects ${label} as the body font without touching the document`, async () => {
      const fig = createFigma(EXISTING); fig.load(BUNDLE);
      const before = fig.snapshot();
      fig.send(scratchMsg({ bodyFontFamily: body }));
      const result = await fig.finished();
      assert(result.type === 'generation-failed' && fig.snapshot() === before, `got ${result.type}`);
    });
  }

  await test('two-font generation: a failure at any step restores the document exactly', async () => {
    const opts = { approach: '3tier', mode: 'scratch', fontFamily: 'Playfair Display', bodyFontFamily: 'Source Sans 3' };
    const probe = request(EXISTING, opts);
    await probe.run();
    for (const op of ['createVariable', 'setValue', 'createTextStyle', 'createPaintStyle', 'loadFont']) {
      const n = probe.fig.counts[op] || 0;
      const points = new Set([1, 2, n, n - 1, Math.ceil(n / 2)]);
      for (let k = 1; k <= n; k += Math.max(1, Math.floor(n / 20))) points.add(k);
      for (const k of [...points].filter(k => k >= 1 && k <= n)) {
        // A single loadFont failure is survivable (falls back to Helvetica); fail the fallback too.
        const faults = op === 'loadFont' ? { loadFont: [k, k + 1] } : { [op]: k };
        const { fig, run } = request({ ...EXISTING, faults }, opts);
        const before = fig.snapshot();
        const result = await run();
        if (result.type === 'generation-complete') continue;   // font fallback absorbed it
        assert(result.type === 'generation-failed' && result.leftover === 0, `${op} #${k}: ${result.type}`);
        assert(fig.snapshot() === before, `${op} #${k}: document changed after a failed run`);
      }
    }
  });

  await test('JSON export types font tokens as fontFamily, including aliases to them', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Playfair Display', bodyFontFamily: 'Source Sans 3', confirmed: false });
    await run();
    fig.state.messages.length = 0;
    await fig.send({ type: 'export-json' });
    const out = JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json);
    const g = out.global.typography.fontFamily, a = out.alias.typography.fontFamily;
    assert(g.heading.type === 'fontFamily' && g.heading.value === 'Playfair Display' && g.body.value === 'Source Sans 3', JSON.stringify(g));
    assert(a.heading.type === 'fontFamily' && /^\{global\.typography\.fontFamily\.heading\}$/.test(a.heading.value), JSON.stringify(a));
  });

  // ── Paragraph spacing + font weight ──
  const val = (v) => Object.values(v.valuesByMode)[0];
  const aliasTarget = (fig, name) => {
    const v = fig.state.variables.find(x => x.name === name && val(x) && val(x).type === 'VARIABLE_ALIAS');
    return v && fig.state.variables.find(x => x.id === val(v).id);
  };
  const LEVELS = ['display-lg', 'display-md', 'display-sm', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body-lg', 'body', 'caption', 'xs'];

  for (const approach of ['2tier', '3tier']) {
    await test(`${approach}: paragraph spacing and font weight variables exist for every level, aliased in Alias`, async () => {
      const { fig, run } = request({}, { approach, mode: 'scratch', confirmed: false });
      const result = await run();
      assert(result.type === 'generation-complete' && result.warnings.length === 0, JSON.stringify(result));
      LEVELS.forEach(l => {
        const ps = varNamed(fig, `typography/paragraph-spacing/${l}`);
        assert(ps && typeof val(ps) === 'number', `missing paragraph-spacing/${l}`);
        const target = aliasTarget(fig, `text/${l}/paragraph-spacing`);
        assert(target && target.id === ps.id, `text/${l}/paragraph-spacing does not alias its global`);
        assert(aliasTarget(fig, `text/${l}/font-weight`), `text/${l}/font-weight alias missing`);
      });
      const weights = fig.state.variables.filter(v => v.name.startsWith('typography/font-weight/'));
      assert(JSON.stringify(weights.map(v => [v.name, val(v)])) === JSON.stringify([['typography/font-weight/regular', 400], ['typography/font-weight/semibold', 600], ['typography/font-weight/bold', 700]]), JSON.stringify(weights.map(v => [v.name, val(v)])));
      assert(aliasTarget(fig, 'text/h1/font-weight').name === 'typography/font-weight/bold', 'h1 should alias bold');
      assert(aliasTarget(fig, 'text/h4/font-weight').name === 'typography/font-weight/semibold', 'h4 should alias semibold');
      assert(aliasTarget(fig, 'text/body/font-weight').name === 'typography/font-weight/regular', 'body should alias regular');
    });
  }

  await test('text styles get the weight, paragraph spacing, and bindings for both', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', confirmed: false });
    await run();
    const s = (n) => textStyle(fig, n);
    assert(s('Display/display-lg').fontName.style === 'Bold' && s('Heading/h1').fontName.style === 'Bold', 'display/h1 should be Bold');
    assert(s('Heading/h3').fontName.style === 'Semi Bold', `h3 is ${s('Heading/h3').fontName.style}`);   // Inter's real style name
    assert(s('Body copy/body').fontName.style === 'Regular', 'body should be Regular');
    assert(s('Body copy/body').paragraphSpacing === 12 && s('Display/display-lg').paragraphSpacing === 0, 'paragraph spacing values');
    assert(s('Heading/h1').bound.fontWeight === 'typography/font-weight/bold', `h1 weight bound to ${s('Heading/h1').bound.fontWeight}`);
    assert(s('Heading/h3').bound.fontWeight === 'typography/font-weight/semibold', 'h3 weight binding');
    assert(s('Body copy/body').bound.paragraphSpacing === 'typography/paragraph-spacing/body', 'body paragraph-spacing binding');
    assert(s('Body copy/body').bound.fontFamily === 'typography/font-family', 'font family binding kept');
  });

  await test('two fonts: each uses its own weights, with exact matches and no warnings', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Playfair Display', bodyFontFamily: 'Source Sans 3', confirmed: false });
    const result = await run();
    assert(result.warnings.length === 0, JSON.stringify(result.warnings));
    assert(textStyle(fig, 'Heading/h4').fontName.style === 'SemiBold' && textStyle(fig, 'Heading/h4').fontName.family === 'Playfair Display', 'heading font/weight');
    assert(textStyle(fig, 'Body copy/body').fontName.style === 'Regular' && textStyle(fig, 'Body copy/body').fontName.family === 'Source Sans 3', 'body font/weight');
  });

  await test('a font without the wanted weight uses the nearest, warns, and skips only the weight binding', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Georgia', confirmed: false });   // Georgia: Regular + Bold only
    const result = await run();
    assert(result.type === 'generation-complete', result.message);
    assert(result.warnings.some(w => /Georgia/.test(w) && /semibold/.test(w) && /Bold/.test(w)), JSON.stringify(result.warnings));
    const h4 = textStyle(fig, 'Heading/h4'), h1 = textStyle(fig, 'Heading/h1');
    assert(h4.fontName.style === 'Bold' && h4.bound.fontWeight === undefined, `h4: ${h4.fontName.style} / ${h4.bound.fontWeight}`);
    assert(h4.bound.fontFamily === 'typography/font-family' && h4.bound.fontSize, 'other bindings should remain');
    assert(h1.bound.fontWeight === 'typography/font-weight/bold', 'exact weights are still bound');
  });

  await test('an unavailable font falls back to Helvetica without binding to the missing font', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', fontFamily: 'Missing Font', confirmed: false });
    const result = await run();
    assert(result.warnings.some(w => /Missing Font/.test(w) && /Helvetica/.test(w)), JSON.stringify(result.warnings));
    const h1 = textStyle(fig, 'Heading/h1');
    assert(h1.fontName.family === 'Helvetica' && h1.fontName.style === 'Bold', `${h1.fontName.family} ${h1.fontName.style}`);
    assert(h1.bound.fontFamily === undefined && h1.bound.fontWeight === undefined, 'should not bind to the missing font');
    assert(h1.bound.fontSize, 'size should still be bound');
  });

  await test('font catalog unreadable: styles are still created (Regular), without failing', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    fig.figma.listAvailableFontsAsync = async () => { throw new Error('no font list'); };
    await fig.send(scratchMsg({ type: 'generate', approach: '2tier' }));
    const result = await fig.finished();
    assert(result.type === 'generation-complete', `${result.type}: ${result.message}`);
    assert(fig.state.textStyles.filter(s => /^(Display|Heading|Body copy)\//.test(s.name)).length === 13, 'text styles missing');
  });

  await test('Smart Convert: font weight and paragraph spacing come from the existing text styles', async () => {
    const doc = {
      paintStyles: [['red-500', .9, .1, .1], ['blue-500', .1, .1, .9]],
      textStyles: [['Heading/h1', 32, 'Bold'], ['Body/body', 16, 'Regular'], ['Label/small', 12, 'Semi Bold'], ['Odd/thing', 14, 'Mystery']],
    };
    const { fig, run } = request(doc, { approach: '2tier', mode: 'convert' });
    // give one style paragraph spacing, as a designer would
    fig.state.textStyles.find(s => s.name === 'Body/body').paragraphSpacing = 12;
    const result = await run();
    assert(result.type === 'generation-complete', `${result.type}: ${result.message}`);
    const g = (n) => val(varNamed(fig, n));
    assert(g('typography/fontWeight/heading/h1') === 700 && g('typography/fontWeight/body/body') === 400 && g('typography/fontWeight/label/small') === 600, 'weights from style names');
    assert(g('typography/fontWeight/odd/thing') === 400, 'unknown style name should default to 400');
    assert(g('typography/paragraphSpacing/body/body') === 12, 'paragraph spacing');
    assert(aliasTarget(fig, 'text/heading/h1/fontWeight').name === 'typography/fontWeight/heading/h1', 'weight alias');
    assert(aliasTarget(fig, 'text/body/body/paragraphSpacing').name === 'typography/paragraphSpacing/body/body', 'paragraph spacing alias');
  });

  await test('Smart Convert JSON export: weight tokens are typed fontWeight, spacing as dimension', async () => {
    const doc = { paintStyles: [['red-500', .9, .1, .1]], textStyles: [['h1', 32, 'Bold']] };
    const { fig, run } = request(doc, { approach: '2tier', mode: 'convert' });
    await run();
    fig.state.messages.length = 0;
    await fig.send({ type: 'export-json' });
    const out = JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json);
    const alias = out.alias.text.h1;
    assert(alias.fontWeight.type === 'fontWeight' && alias.fontWeight.value === '{global.typography.fontWeight.h1}', JSON.stringify(alias.fontWeight));
    assert(alias.paragraphSpacing.type === 'dimension' && alias.paragraphSpacing.value === '{global.typography.paragraphSpacing.h1}', JSON.stringify(alias.paragraphSpacing));
    assert(out.global.typography.fontWeight.h1.type === 'fontWeight' && out.global.typography.fontWeight.h1.value === 700, JSON.stringify(out.global.typography));
  });

  await test('scratch JSON export: weight and paragraph-spacing tokens are exported with sensible types', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', confirmed: false });
    await run();
    fig.state.messages.length = 0;
    await fig.send({ type: 'export-json' });
    const out = JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json);
    const g = out.global.typography;
    assert(g.fontWeight.bold.type === 'fontWeight' && g.fontWeight.bold.value === 700, JSON.stringify(g.fontWeight));
    assert(g.paragraphSpacing.body.type === 'dimension' && g.paragraphSpacing.body.value === '12px', JSON.stringify(g.paragraphSpacing));
    assert(out.alias.text.h1.fontWeight.value === '{global.typography.fontWeight.bold}', JSON.stringify(out.alias.text.h1.fontWeight));
  });

  // ── 03 Component tokens ──
  const componentNames = (fig) => {
    const comp = fig.state.collections.find(c => c.name === '03 Component');
    return fig.state.variables.filter(v => v.variableCollectionId === comp.id).map(v => v.name).sort();
  };
  const SURFACES = (roles) => roles.map(r => `surface/${r}`);
  const TEXT_ICON_BORDER = ['border/default', 'border/disabled', 'border/inverse', 'border/subtle', 'icon/default', 'icon/disabled', 'icon/inverse', 'icon/subtle', 'text/default', 'text/disabled', 'text/inverse', 'text/subtle'];

  for (const [label, over, roles] of [
    ['all four brand colors', {}, ['primary', 'secondary', 'tertiary', 'accent']],
    ['Tertiary left blank (it is optional)', { colors: { ...COLORS, tertiary: '' } }, ['primary', 'secondary', 'accent']],
    ['Tertiary missing entirely', { colors: (({ tertiary, ...rest }) => rest)(COLORS) }, ['primary', 'secondary', 'accent']],
  ]) {
    await test(`3-tier Component has a surface group with ${label}`, async () => {
      const fig = createFigma({}); fig.load(BUNDLE);
      await fig.send(scratchMsg({ type: 'generate', approach: '3tier', ...over }));
      const result = await fig.finished();
      assert(result.type === 'generation-complete', `${result.type}: ${result.message}`);
      assert(JSON.stringify(componentNames(fig)) === JSON.stringify([...TEXT_ICON_BORDER, ...SURFACES(roles)].sort()), JSON.stringify(componentNames(fig)));
    });
  }

  await test('Component surface tokens point at the 500 stop of their own color', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', approach: '3tier', colors: { ...COLORS, tertiary: '' } }));
    await fig.finished();
    const byId = Object.fromEntries(fig.state.variables.map(v => [v.id, v.name]));
    const target = (n) => byId[Object.values(fig.state.variables.find(v => v.name === n).valuesByMode)[0].id];
    assert(target('surface/primary') === 'color/primary/500' && target('surface/secondary') === 'color/secondary/500' && target('surface/accent') === 'color/accent/500', 'surface targets');
  });

  // ── Replace only touches what the plugin made ──
  await test('the confirmation lists only the plugin\'s own collections and styles', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate' }));
    const msg = fig.state.messages.find(m => m.type === 'confirm-replace');
    assert(msg, 'no confirmation shown');
    assert(JSON.stringify(msg.existing.collections) === JSON.stringify([{ name: '01 Global', variables: 2 }]), JSON.stringify(msg.existing.collections));
    assert(msg.existing.paintStyles === 1 && msg.existing.textStyles === 1, `styles: ${msg.existing.paintStyles} paint, ${msg.existing.textStyles} text`);
    assert(!fig.state.messages.some(m => m.type === 'generation-complete'), 'generated without asking');
  });

  await test('Smart Convert\'s confirmation lists collections only (styles are kept)', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', mode: 'convert' }));
    const msg = fig.state.messages.find(m => m.type === 'confirm-replace');
    assert(msg && msg.existing.paintStyles === 0 && msg.existing.textStyles === 0 && msg.existing.collections.length === 1, JSON.stringify(msg && msg.existing));
  });

  await test('no confirmation when the file only has the user\'s own collections and styles', async () => {
    const doc = { collections: [{ name: 'My Own Collection', variables: ['x'] }], paintStyles: [['Brand/Primary', .2, .2, .2]], textStyles: [['Label/small', 12]] };
    const fig = createFigma(doc); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate' }));
    const result = await fig.finished();
    assert(result.type === 'generation-complete' && !fig.state.messages.some(m => m.type === 'confirm-replace'), JSON.stringify(result));
    const names = fig.state.collections.map(c => c.name).sort();
    assert(JSON.stringify(names) === JSON.stringify(['01 Global', '02 Alias', 'My Own Collection']), names.join());
    assert(fig.state.paintStyles.some(s => s.name === 'Brand/Primary') && fig.state.textStyles.some(s => s.name === 'Label/small'), "the user's styles were removed");
  });

  await test('a failed run still leaves the user\'s own items and the plugin\'s old ones untouched', async () => {
    const { fig, run } = request({ ...EXISTING, faults: { createTextStyle: 6 } }, { approach: '2tier', mode: 'scratch' });
    const before = fig.snapshot();
    const result = await run();
    assert(result.type === 'generation-failed' && fig.snapshot() === before, result.type);
  });

  // ── JSON export keys ──
  const exportJSON = async (fig) => { fig.state.messages.length = 0; await fig.send({ type: 'export-json' }); return JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json); };

  await test('JSON export uses global / alias / component as the top-level keys, and references use them', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', approach: '3tier' }));
    const out = await exportJSON(fig);
    assert(JSON.stringify(Object.keys(out)) === JSON.stringify(['global', 'alias', 'component']), Object.keys(out).join());
    const refs = JSON.stringify(out).match(/\{[^{}"]+\}/g) || [];
    assert(refs.length > 50 && refs.every(r => /^\{(global|alias|component)\.[A-Za-z0-9.]+\}$/.test(r)), `unexpected references: ${refs.filter(r => !/^\{(global|alias|component)\./.test(r)).slice(0, 3)}`);
  });

  const CONVERT_DOC = {
    paintStyles: [['Red 50', .95, .9, .9], ['Red 500', .9, .1, .1], ['Red 900', .3, 0, 0], ['Blue 50', .9, .9, .95], ['Blue 500', .1, .1, .9], ['Blue 900', 0, 0, .3], ['Green 500', .1, .8, .1]],
    textStyles: [['Heading/h1', 32, 'Bold'], ['Body/body', 16, 'Regular']],
  };
  for (const [mode, doc, extra] of [['scratch', {}, { bodyFontFamily: 'Source Sans 3' }], ['scratch', {}, {}], ['starter', {}, {}], ['convert', CONVERT_DOC, {}]]) {
    for (const approach of ['2tier', '3tier']) {
      await test(`${approach} ${mode}${extra.bodyFontFamily ? ' (two fonts)' : ''}: every reference in the export points at a token that exists`, async () => {
        const fig = createFigma(doc); fig.load(BUNDLE);
        await fig.send({ ...scratchMsg({ type: 'generate', approach, mode, ...extra }) });
        const done = await fig.finished();
        assert(done.type === 'generation-complete', `${done.type}: ${done.message}`);
        const out = await exportJSON(fig);
        const find = (path) => path.split('.').reduce((o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined), out);
        const missing = []; let refs = 0;
        const walk = (node) => { for (const v of Object.values(node)) {
          if (v && typeof v === 'object' && 'value' in v) {
            if (typeof v.value === 'string' && /^\{.+\}$/.test(v.value)) { refs++; const hit = find(v.value.slice(1, -1)); if (!hit || !('value' in hit)) missing.push(v.value); }
            else if (v.value && typeof v.value === 'object') missing.push(`unresolved object value: ${JSON.stringify(v.value)}`);
          } else if (v && typeof v === 'object') walk(v);
        } };
        walk(out);
        assert(refs > 20, `only ${refs} references`);
        assert(missing.length === 0, `${missing.length} dangling: ${missing.slice(0, 3)}`);
      });
    }
  }

  await test('a collection the user made gets a camelCase key and keeps working references', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    const c = fig.figma.variables.createVariableCollection('My Own Collection');
    const v = fig.figma.variables.createVariable('brand-color/primary', c, 'COLOR'); v.setValueForMode(c.modes[0].modeId, { r: 1, g: 0, b: 0, a: 1 });
    const c2 = fig.figma.variables.createVariableCollection('Semantic');
    const a = fig.figma.variables.createVariable('action', c2, 'COLOR'); a.setValueForMode(c2.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: v.id });
    const out = await exportJSON(fig);
    assert(out.myOwnCollection.brandColor.primary.value === '#FF0000', JSON.stringify(out));
    assert(out.semantic.action.value === '{myOwnCollection.brandColor.primary}', JSON.stringify(out.semantic));
  });

  await test('collections that reduce to the same key still get distinct keys', async () => {
    const fig = createFigma({ collections: [{ name: '01 Global', variables: ['a'] }, { name: 'Global', variables: ['b'] }] }); fig.load(BUNDLE);
    const out = await exportJSON(fig);
    assert(JSON.stringify(Object.keys(out)) === JSON.stringify(['global', 'global2']) && out.global.a && out.global2.b, JSON.stringify(Object.keys(out)));
  });

  // ── Units ──
  await test('letter spacing: the variable is in px, matching the text style it is bound to', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', confirmed: false });
    await run();
    for (const [level, group, expected] of [['display-lg', 'Display', -7.4], ['h1', 'Heading', -2.28], ['body', 'Body copy', 0], ['xs', 'Body copy', 0.24]]) {
      const v = varNamed(fig, `typography/letter-spacing/${level}`), style = textStyle(fig, `${group}/${level}`);
      assert(Object.values(v.valuesByMode)[0] === expected, `${level}: variable ${Object.values(v.valuesByMode)[0]}, expected ${expected}`);
      assert(style.letterSpacing.unit === 'PIXELS' && style.letterSpacing.value === expected, `${level}: style ${JSON.stringify(style.letterSpacing)}`);
    }
  });

  await test('JSON export: pixel sizes carry px, weights and families do not, user numbers stay plain', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', approach: '2tier' }));
    const c = fig.figma.variables.createVariableCollection('Motion');
    const o = fig.figma.variables.createVariable('opacity/disabled', c, 'FLOAT'); o.setValueForMode(c.modes[0].modeId, 0.4);
    const out = await exportJSON(fig);
    assert(out.global.spacing['4'].value === '4px' && out.global.spacing['4'].type === 'dimension', JSON.stringify(out.global.spacing['4']));
    assert(out.global.borderRadius['0'].value === '0px' && out.global.borderRadius['9999'].value === '9999px', 'radius units');
    assert(out.global.typography.lineHeight.body.value === '24px' && out.global.typography.letterSpacing.displayLg.value === '-7.4px', JSON.stringify(out.global.typography.letterSpacing.displayLg));
    assert(out.global.typography.fontWeight.bold.value === 700 && out.global.typography.fontFamily.value === 'Inter', 'weight/family must not get units');
    assert(out.alias.borderRadius.sm.value === '{global.borderRadius.2}' && out.alias.borderRadius.sm.type === 'dimension', 'aliases stay references');
    assert(out.motion.opacity.disabled.value === 0.4 && out.motion.opacity.disabled.type === 'number', JSON.stringify(out.motion));
  });

  // ── Scopes, code syntax and extra token types ──
  const ALL3 = { elevation: true, opacity: true, zIndex: true };
  const var1 = (fig, n) => fig.state.variables.find(v => v.name === n);
  const collOf = (fig, v) => fig.state.collections.find(c => c.id === v.variableCollectionId).name;

  await test('scopes: Global primitives are hidden, Alias and Component are scoped to their fields', async () => {
    const { fig, run } = request({}, { approach: '3tier', mode: 'scratch', confirmed: false });
    await run();
    const scopes = (n, layer) => fig.state.variables.find(v => v.name === n && collOf(fig, v) === layer).scopes;
    assert(JSON.stringify(scopes('color/cobalt/500', '01 Global')) === '[]', 'global colour should be hidden');
    assert(JSON.stringify(scopes('spacing/4', '01 Global')) === JSON.stringify(['GAP', 'WIDTH_HEIGHT']), 'spacing');
    assert(JSON.stringify(scopes('color/primary/500', '02 Alias')) === JSON.stringify(['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']), 'alias colour');
    assert(JSON.stringify(scopes('text/h1/font-size', '02 Alias')) === JSON.stringify(['FONT_SIZE']), 'alias font size');
    assert(JSON.stringify(scopes('surface/primary', '03 Component')) === JSON.stringify(['FRAME_FILL', 'SHAPE_FILL']), 'component surface');
  });

  await test('scopes can be turned off: every variable keeps the default scope', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', options: { scopes: false } }));
    await fig.finished();
    assert(fig.state.variables.every(v => JSON.stringify(v.scopes) === '["ALL_SCOPES"]'), 'a scope was set');
  });

  await test('code syntax: every variable gets a WEB var(--…) name, and it can be turned off', async () => {
    const { fig, run } = request({}, { approach: '3tier', mode: 'scratch', confirmed: false });
    await run();
    assert(fig.state.variables.every(v => /^var\(--(global|alias|component)-[a-z0-9-]+\)$/.test(v.codeSyntax.WEB || '')), 'a variable has no valid code syntax');
    assert(var1(fig, 'color/cobalt/500').codeSyntax.WEB === 'var(--global-color-cobalt-500)', var1(fig, 'color/cobalt/500').codeSyntax.WEB);
    const off = createFigma({}); off.load(BUNDLE);
    await off.send(scratchMsg({ type: 'generate', options: { codeSyntax: false } }));
    await off.finished();
    assert(off.state.variables.every(v => !v.codeSyntax.WEB), 'code syntax was set although it was turned off');
  });

  await test('code syntax names are exactly the CSS names the JSON export produces', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', approach: '3tier', extras: ALL3, bodyFontFamily: 'Source Sans 3' }));
    await fig.finished();
    const out = await exportJSON(fig);
    const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const fromExport = new Set();
    const walk = (node, path) => { for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && 'value' in v) fromExport.add(`var(--${[...path, k].map(kebab).join('-')})`);
      else if (v && typeof v === 'object') walk(v, [...path, k]);
    } };
    walk(out, []);
    const fromSyntax = new Set(fig.state.variables.map(v => v.codeSyntax.WEB));
    const onlyExport = [...fromExport].filter(x => !fromSyntax.has(x)), onlySyntax = [...fromSyntax].filter(x => !fromExport.has(x));
    assert(onlyExport.length === 0 && onlySyntax.length === 0, `export-only: ${onlyExport.slice(0, 3)} | syntax-only: ${onlySyntax.slice(0, 3)}`);
  });

  await test('extras: elevation, opacity and z-index create the expected variables', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', confirmed: false });
    const msgFig = createFigma({}); msgFig.load(BUNDLE);
    await msgFig.send(scratchMsg({ type: 'generate', extras: ALL3 }));
    const result = await msgFig.finished();
    assert(result.type === 'generation-complete' && result.warnings.length === 0, JSON.stringify(result));
    const f = msgFig, val = (n) => Object.values(var1(f, n).valuesByMode)[0];
    assert([0, 20, 40, 60, 80, 100].every(n => var1(f, `opacity/${n}`) && val(`opacity/${n}`) === n), 'opacity steps');
    assert(f.state.variables.filter(v => v.name.startsWith('opacity/')).length === 6, 'expected exactly 6 opacity steps');
    assert(val('z-index/base') === 0 && val('z-index/modal') === 1300 && val('z-index/tooltip') === 1600, 'z-index layers');
    for (const l of ['xs', 'sm', 'md', 'lg', 'xl']) assert(['offset-y', 'blur', 'spread', 'color'].every(p => var1(f, `elevation/${l}/${p}`)), `elevation/${l} incomplete`);
    const c = val('elevation/md/color');
    assert(c.a === 0.10 && c.r === val('color/grey/900').r, `shadow colour: ${JSON.stringify(c)}`);
    assert(val('elevation/md/offset-y') === 4 && val('elevation/md/blur') === 6 && val('elevation/md/spread') === -1, 'md values');
    assert(JSON.stringify(var1(f, 'opacity/60').scopes) === '["OPACITY"]' && JSON.stringify(var1(f, 'elevation/md/blur').scopes) === '["EFFECT_FLOAT"]', 'extras scopes');
  });

  await test('extras: each can be left out, and with none there are no extra variables or effect styles', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', extras: { elevation: false, opacity: true, zIndex: false } }));
    await fig.finished();
    assert(fig.state.variables.some(v => v.name === 'opacity/60') && !fig.state.variables.some(v => /^(z-index|elevation)\//.test(v.name)) && fig.state.effectStyles.length === 0, 'only opacity expected');
    const none = createFigma({}); none.load(BUNDLE);
    await none.send(scratchMsg({ type: 'generate' }));
    await none.finished();
    assert(!none.state.variables.some(v => /^(opacity|z-index|elevation)\//.test(v.name)) && none.state.effectStyles.length === 0, 'extras created without being asked for');
  });

  await test('elevation effect styles: five shadows, bound to their variables', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', extras: ALL3 }));
    await fig.finished();
    assert(JSON.stringify(fig.state.effectStyles.map(s => s.name)) === JSON.stringify(['Elevation/xs', 'Elevation/sm', 'Elevation/md', 'Elevation/lg', 'Elevation/xl']), fig.state.effectStyles.map(s => s.name).join());
    const md = fig.state.effectStyles.find(s => s.name === 'Elevation/md').effects[0], id = (n) => var1(fig, n).id;
    assert(md.type === 'DROP_SHADOW' && md.offset.y === 4 && md.radius === 6 && md.spread === -1 && md.color.a === 0.10, JSON.stringify(md));
    const b = md.boundVariables;
    assert(b.color.id === id('elevation/md/color') && b.offsetY.id === id('elevation/md/offset-y') && b.radius.id === id('elevation/md/blur') && b.spread.id === id('elevation/md/spread'), JSON.stringify(b));
  });

  for (const approach of ['2tier', '3tier']) {
    await test(`${approach} Starter includes the extra tokens and elevation styles by default`, async () => {
      const { fig, run } = request({}, { approach, mode: 'starter', confirmed: false });
      const result = await run();
      assert(result.type === 'generation-complete', result.message);
      assert(var1(fig, 'opacity/60') && var1(fig, 'z-index/modal') && var1(fig, 'elevation/lg/blur') && fig.state.effectStyles.length === 5, 'starter is missing the extras');
    });
  }

  await test('Smart Convert does not add the extra tokens', async () => {
    const { fig, run } = request({ paintStyles: [['Red 500', .9, .1, .1]], textStyles: [['h1', 32, 'Bold']] }, { approach: '2tier', mode: 'convert' });
    await run();
    assert(!fig.state.variables.some(v => /^(opacity|z-index|elevation)\//.test(v.name)) && fig.state.effectStyles.length === 0, 'convert created extras');
  });

  await test('replace only touches the plugin\'s own effect styles', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    const mine = fig.figma.createEffectStyle(); mine.name = 'Elevation/md';
    const theirs = fig.figma.createEffectStyle(); theirs.name = 'Shadow/card';
    await fig.send(scratchMsg({ type: 'generate', extras: ALL3 }));
    const ask = fig.state.messages.find(m => m.type === 'confirm-replace');
    assert(ask && ask.existing.effectStyles === 1, JSON.stringify(ask && ask.existing));
    fig.state.messages.length = 0;
    await fig.send(scratchMsg({ extras: ALL3 }));
    await fig.finished();
    const names = fig.state.effectStyles.map(s => s.name);
    assert(names.includes('Shadow/card') && names.filter(n => n === 'Elevation/md').length === 1 && names.length === 6, names.join());
  });

  await test('JSON export: opacity is 0–1, z-index a plain number, elevation sizes px, shadow colour has alpha', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', extras: ALL3 }));
    await fig.finished();
    const out = await exportJSON(fig);
    assert(out.global.opacity['60'].value === 0.6 && out.global.opacity['60'].type === 'number' && out.global.opacity['100'].value === 1 && out.global.opacity['0'].value === 0, JSON.stringify(out.global.opacity['60']));
    assert(out.global.zIndex.modal.value === 1300 && out.global.zIndex.modal.type === 'number', JSON.stringify(out.global.zIndex.modal));
    const md = out.global.elevation.md;
    assert(md.offsetY.value === '4px' && md.blur.value === '6px' && md.spread.value === '-1px' && md.offsetY.type === 'dimension', JSON.stringify(md));
    assert(/^#[0-9A-F]{6}1A$/.test(md.color.value) && md.color.type === 'color', md.color.value);
  });

  await test('rejects non-boolean extras and options without touching the document', async () => {
    for (const over of [{ extras: { elevation: 'yes' } }, { extras: [] }, { extras: null }, { options: { scopes: 1 } }, { options: 'all' }]) {
      const fig = createFigma(EXISTING); fig.load(BUNDLE);
      const before = fig.snapshot();
      fig.send(scratchMsg(over));
      const result = await fig.finished();
      assert(result.type === 'generation-failed' && fig.snapshot() === before, `${JSON.stringify(over)} -> ${result.type}`);
    }
  });

  await test('with extras on, a failure at any step restores the document exactly', async () => {
    const opts = { approach: '3tier', mode: 'scratch' };
    const probe = createFigma(EXISTING); probe.load(BUNDLE);
    await probe.send(scratchMsg({ extras: ALL3, approach: '3tier' })); await probe.finished();
    const totals = { ...probe.counts };
    for (const op of ['createVariable', 'setValue', 'createEffectStyle', 'createCollection', 'createTextStyle']) {
      const n = totals[op] || 0;
      assert(n > 0, `${op} never ran`);
      const points = new Set([1, 2, n, n - 1, Math.ceil(n / 2)]);
      for (let k = 1; k <= n; k += Math.max(1, Math.floor(n / 20))) points.add(k);
      for (const k of [...points].filter(k => k >= 1 && k <= n)) {
        const fig = createFigma({ ...EXISTING, faults: { [op]: k } }); fig.load(BUNDLE);
        const before = fig.snapshot();
        fig.send(scratchMsg({ extras: ALL3, approach: '3tier' }));
        const result = await fig.finished();
        assert(result.type === 'generation-failed' && result.leftover === 0, `${op} #${k}: ${result.type}`);
        assert(fig.snapshot() === before, `${op} #${k}: document changed after a failed run`);
      }
    }
  });

  await test('scopes or code syntax refusing a variable is a warning, not a failed run', async () => {
    const fig = createFigma({ faults: { codeSyntax: [1, 5, 9] } }); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate' }));
    const result = await fig.finished();
    assert(result.type === 'generation-complete' && result.warnings.some(w => /scopes or code syntax on 3 variables/.test(w)), JSON.stringify(result.warnings));
  });

  // ── Live preview + contrast checker ──
  const ask = async (fig, msg, replyType) => { fig.state.messages.length = 0; await fig.send(msg); return fig.state.messages.find(m => m.type === replyType); };
  const hexOfVar = (v) => { const c = Object.values(v.valuesByMode)[0]; const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0'); return `#${h(c.r)}${h(c.g)}${h(c.b)}`; };

  await test('preview: ramps for valid colours only, named like the generated primitives', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    const r = await ask(fig, { type: 'preview-ramps', colors: { ...COLORS, tertiary: '', accent: '#12' } }, 'ramp-preview');
    const keys = r.ramps.map(x => x.key);
    assert(JSON.stringify(keys) === JSON.stringify(['primary', 'secondary', 'info', 'success', 'error', 'warning', 'neutral']), keys.join());
    assert(r.ramps.every(x => x.contrast.stops.length === 10), 'every ramp has 10 stops');
    const p = r.ramps.find(x => x.key === 'primary'), info = r.ramps.find(x => x.key === 'info');
    assert(p.name === 'cobalt' && p.label === 'Primary' && info.name === 'blue', `${p.name} / ${info.name}`);
    assert(p.contrast.stops.find(s => s.stop === 500).hex === '#3d6be8', 'stop 500 is the input colour');
  });

  await test('preview: junk input gives an empty list instead of an error', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    for (const colors of [undefined, null, 'red', 42, [], {}, { primary: 5 }]) {
      const r = await ask(fig, { type: 'preview-ramps', colors }, 'ramp-preview');
      assert(r && Array.isArray(r.ramps) && r.ramps.length === 0, `${JSON.stringify(colors)} -> ${r && r.ramps.length}`);
    }
  });

  await test('preview matches what generation then creates, stop for stop', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    const preview = await ask(fig, { type: 'preview-ramps', colors: COLORS }, 'ramp-preview');
    await fig.send(scratchMsg({ type: 'generate', approach: '2tier' }));
    await fig.finished();
    for (const ramp of preview.ramps) {
      const lowered = ramp.name;
      for (const s of ramp.contrast.stops) {
        const v = fig.state.variables.find(x => x.name === `color/${lowered}/${s.stop}`);
        assert(v && hexOfVar(v) === s.hex, `${lowered}/${s.stop}: preview ${s.hex} vs generated ${v && hexOfVar(v)}`);
      }
    }
  });

  for (const approach of ['2tier', '3tier']) {
    await test(`contrast checker reads a generated ${approach} system and agrees with the preview`, async () => {
      const fig = createFigma({}); fig.load(BUNDLE);
      await fig.send(scratchMsg({ type: 'generate', approach, colors: { ...COLORS, tertiary: '' } }));
      await fig.finished();
      const before = fig.snapshot();
      const data = await ask(fig, { type: 'check-contrast' }, 'contrast-data');
      assert(!data.error, data.error);
      assert(JSON.stringify(data.ramps.map(r => r.key)) === JSON.stringify(['primary', 'secondary', 'accent', 'info', 'success', 'error', 'warning', 'neutral']), data.ramps.map(r => r.key).join());
      const preview = await ask(fig, { type: 'preview-ramps', colors: { ...COLORS, tertiary: '' } }, 'ramp-preview');
      for (const r of data.ramps) {
        const p = preview.ramps.find(x => x.key === r.key);
        assert(r.contrast.stops.length === 10 && p, `${r.key}: ${r.contrast.stops.length} stops`);
        assert(JSON.stringify(r.contrast) === JSON.stringify(p.contrast), `${r.key}: file and preview disagree`);
      }
      assert(fig.snapshot() === before, 'checking contrast changed the document');
    });
  }

  await test('contrast checker works on Starter and Smart Convert systems', async () => {
    const starter = createFigma({}); starter.load(BUNDLE);
    await starter.send(scratchMsg({ type: 'generate', approach: '3tier', mode: 'starter' }));
    await starter.finished();
    const s = await ask(starter, { type: 'check-contrast' }, 'contrast-data');
    assert(s.ramps.length === 9 && s.ramps.every(r => r.contrast.stops.length === 10), `starter: ${s.ramps.length} ramps`);
    for (const approach of ['2tier', '3tier']) {
      const conv = createFigma(CONVERT_DOC); conv.load(BUNDLE);
      await conv.send(scratchMsg({ type: 'generate', approach, mode: 'convert' }));
      await conv.finished();
      const c = await ask(conv, { type: 'check-contrast' }, 'contrast-data');
      assert(c.ramps.length >= 1 && c.ramps.every(r => r.contrast.stops.length >= 2), `${approach} convert: ${c.ramps.length} ramps`);
    }
  });

  await test('contrast checker: an empty file, or only the user\'s collections, has nothing to check', async () => {
    const empty = createFigma({}); empty.load(BUNDLE);
    assert((await ask(empty, { type: 'check-contrast' }, 'contrast-data')).ramps.length === 0, 'empty file');
    const own = createFigma({}); own.load(BUNDLE);
    const c = own.figma.variables.createVariableCollection('Brand');
    const v = own.figma.variables.createVariable('color/primary/500', c, 'COLOR'); v.setValueForMode(c.modes[0].modeId, { r: 1, g: 0, b: 0, a: 1 });
    assert((await ask(own, { type: 'check-contrast' }, 'contrast-data')).ramps.length === 0, "the user's own collection was read");
  });

  await test('contrast checker follows alias chains of more than one hop', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    const g = fig.figma.variables.createVariableCollection('01 Global'), a = fig.figma.variables.createVariableCollection('02 Alias');
    const mk = (coll, name, value) => { const v = fig.figma.variables.createVariable(name, coll, 'COLOR'); v.setValueForMode(coll.modes[0].modeId, value); return v; };
    const blue = mk(g, 'color/blue/500', { r: 0, g: 0, b: 1, a: 1 }), light = mk(g, 'color/blue/50', { r: .9, g: .9, b: 1, a: 1 });
    const mid = mk(a, 'color/accent-mid/500', { type: 'VARIABLE_ALIAS', id: blue.id });
    mk(a, 'color/primary/500', { type: 'VARIABLE_ALIAS', id: mid.id });
    mk(a, 'color/primary/50', { type: 'VARIABLE_ALIAS', id: light.id });
    const data = await ask(fig, { type: 'check-contrast' }, 'contrast-data');
    const p = data.ramps.find(r => r.key === 'primary');
    assert(p && p.contrast.stops.find(s => s.stop === 500).hex === '#0000ff', JSON.stringify(p && p.contrast.stops.map(s => s.hex)));
  });

  // ── Canvas foundation ──
  const CANVAS = { canvas: true };
  const frameNamed = (fig, name = 'Token System Foundation') => fig.page.children.filter(n => n.type === 'FRAME' && n.name === name);
  const descendants = (n) => n.children.flatMap(c => [c, ...descendants(c)]);
  const sectionTitles = (root) => root.children.map(c => (c.children[0] && c.children[0].characters) || '').filter(Boolean);
  const drawn = async (doc, msgOver, mode = 'scratch') => {
    const fig = createFigma(doc || {}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', mode, options: CANVAS, ...msgOver }));
    const result = await fig.finished();
    return { fig, result, root: frameNamed(fig)[0] };
  };

  await test('canvas is off by default: nothing is drawn', async () => {
    for (const mode of ['scratch', 'starter']) {
      const { fig, result } = await drawn({}, { options: {} }, mode);
      assert(result.type === 'generation-complete' && fig.page.children.length === 0, `${mode}: ${fig.page.children.length} nodes drawn`);
    }
  });

  await test('canvas on: one marked frame with every section for the tokens that exist', async () => {
    const { result, root } = await drawn({}, { extras: ALL3 });
    assert(result.type === 'generation-complete' && result.warnings.length === 0, JSON.stringify(result.warnings));
    assert(root && root.getPluginData('tsg-foundation') === '1' && root.layoutMode === 'VERTICAL', 'frame or marker missing');
    assert(JSON.stringify(sectionTitles(root)) === JSON.stringify(['Token System', 'Color ramps', 'Type scale', 'Spacing', 'Radius and border width', 'Elevation', 'Opacity', 'Z-index']), sectionTitles(root).join(' | '));
  });

  await test('canvas: sections for tokens that were not generated are left out', async () => {
    const { root } = await drawn({}, { extras: { elevation: false, opacity: true, zIndex: false } });
    const titles = sectionTitles(root);
    assert(titles.includes('Opacity') && !titles.includes('Elevation') && !titles.includes('Z-index'), titles.join(' | '));
  });

  await test('canvas colour ramps: one row per ramp, every swatch bound to its Global colour variable', async () => {
    const { fig, root } = await drawn({}, { colors: { ...COLORS, tertiary: '' } });
    const section = root.children.find(c => c.name === 'Color ramps');
    const rows = section.children.filter(c => c.type === 'FRAME');
    assert(rows.length === 8, `${rows.length} rows`);
    const swatches = descendants(section).filter(n => n.type === 'RECTANGLE');
    assert(swatches.length === 80, `${swatches.length} swatches`);
    const byId = Object.fromEntries(fig.state.variables.map(v => [v.id, v]));
    const primary = rows[0].children.filter(c => c.type === 'FRAME').slice(0, 10);     // first child is the label column
    const first = descendants(rows[0]).filter(n => n.type === 'RECTANGLE')[5];         // stop 500
    const bound = byId[first.fills[0].boundVariables.color.id];
    assert(bound && bound.name === 'color/cobalt/500', bound && bound.name);
    assert(swatches.every(s => s.fills[0].boundVariables && byId[s.fills[0].boundVariables.color.id].name.startsWith('color/')), 'a swatch is not bound');
  });

  await test('canvas type scale: 13 samples, each using its real text style', async () => {
    const { fig, root } = await drawn({}, {});
    const type = root.children.find(c => c.name === 'Type scale');
    const samples = descendants(type).filter(n => n.type === 'TEXT' && n.textStyleId);
    assert(samples.length === 13, `${samples.length} samples`);
    const names = samples.map(s => fig.state.textStyles.find(t => t.id === s.textStyleId).name);
    assert(names.includes('Display/display-lg') && names.includes('Heading/h1') && names.includes('Body copy/body'), names.join());
  });

  await test('canvas spacing, radius, border width, elevation, opacity and z-index show the tokens', async () => {
    const { fig, root } = await drawn({}, { extras: ALL3 });
    const bars = descendants(root.children.find(c => c.name === 'Spacing')).filter(n => n.type === 'RECTANGLE');
    assert(JSON.stringify(bars.map(b => b._w)) === JSON.stringify([4, 8, 12, 16, 20, 24, 32, 40, 48, 64]), bars.map(b => b._w).join());
    const shape = descendants(root.children.find(c => c.name === 'Radius and border width')).filter(n => n.type === 'RECTANGLE');
    const radiusBoxes = shape.slice(0, 7), widthBoxes = shape.slice(7);
    assert(radiusBoxes.length === 7 && radiusBoxes.every(b => b.boundVariables.topLeftRadius && b.boundVariables.bottomRightRadius), 'radius boxes not bound');
    assert(widthBoxes.length === 5 && widthBoxes.slice(1).every(b => b.boundVariables.strokeWeight), 'border width boxes not bound');
    const cards = descendants(root.children.find(c => c.name === 'Elevation')).filter(n => n.type === 'RECTANGLE');
    const effectIds = fig.state.effectStyles.map(s => s.id);
    assert(cards.length === 5 && cards.every((c, i) => c.effectStyleId === effectIds[i]), 'elevation cards do not use the effect styles');
    const chips = descendants(root.children.find(c => c.name === 'Opacity')).filter(n => n.type === 'RECTANGLE');
    assert(chips.length === 6 && chips.every(c => c.boundVariables.opacity), 'opacity chips not bound');
    const layers = root.children.find(c => c.name === 'Z-index').children.filter(c => c.type === 'FRAME');
    assert(layers.length === 8, `${layers.length} layers`);
  });

  await test('canvas: Starter draws every section, Smart Convert only the colour families it found', async () => {
    const starter = await drawn({}, {}, 'starter');
    assert(sectionTitles(starter.root).includes('Elevation') && sectionTitles(starter.root).includes('Type scale'), sectionTitles(starter.root).join());
    const conv = await drawn(CONVERT_DOC, {}, 'convert');
    assert(JSON.stringify(sectionTitles(conv.root)) === JSON.stringify(['Token System', 'Color ramps']), sectionTitles(conv.root).join(' | '));
    assert(conv.root.children.find(c => c.name === 'Color ramps').children.filter(c => c.type === 'FRAME').length >= 1, 'no colour rows');
  });

  await test('canvas placement: beside existing work, never on top of it', async () => {
    const { root } = await drawn({ pageNodes: [{ name: 'Mine A', x: 0, y: 100, width: 500, height: 300 }, { name: 'Mine B', x: 200, y: 40, width: 900, height: 200 }] }, {});
    assert(root.x === 1100 + 200 && root.y === 40, `placed at ${root.x}, ${root.y}`);
  });

  await test('canvas placement: an empty page centres it on the viewport', async () => {
    const { root } = await drawn({}, {});
    assert(Math.abs((root.x + root.width / 2) - 500) < 2, `centre x ${root.x + root.width / 2}`);
  });

  await test('regenerating with the canvas on replaces the previous frame in place', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', options: CANVAS }));
    await fig.finished();
    const first = frameNamed(fig)[0]; first.x = 777; first.y = 333;                  // the user moved it
    fig.state.messages.length = 0;
    await fig.send(scratchMsg({ type: 'generate', options: CANVAS }));
    const ask = fig.state.messages.find(m => m.type === 'confirm-replace');
    assert(ask && ask.existing.foundationFrames === 1, JSON.stringify(ask && ask.existing));
    fig.state.messages.length = 0;
    await fig.send(scratchMsg({ options: CANVAS }));
    await fig.finished();
    const frames = frameNamed(fig);
    assert(frames.length === 1 && frames[0] !== first && frames[0].x === 777 && frames[0].y === 333, `${frames.length} frames, at ${frames[0] && frames[0].x},${frames[0] && frames[0].y}`);
  });

  await test('regenerating with the canvas off leaves an earlier frame alone, and never touches the user\'s own frames', async () => {
    const fig = createFigma({ pageNodes: [{ name: 'My Design', x: 0, y: 0, width: 400, height: 400 }] }); fig.load(BUNDLE);
    await fig.send(scratchMsg({ type: 'generate', options: CANVAS }));
    await fig.finished();
    fig.state.messages.length = 0;
    await fig.send(scratchMsg({}));
    await fig.finished();
    assert(frameNamed(fig).length === 1 && frameNamed(fig, 'My Design').length === 1, 'frames changed');
  });

  await test('a problem while drawing is a warning: the frame is removed and the tokens still complete', async () => {
    for (const op of ['createFrame', 'createRectangle', 'createText', 'bindPaint']) {
      const probe = createFigma({}); probe.load(BUNDLE);
      await probe.send(scratchMsg({ type: 'generate', options: CANVAS })); await probe.finished();
      const n = probe.counts[op];
      for (const k of [1, Math.ceil(n / 2), n]) {
        const fig = createFigma({ faults: { [op]: k } }); fig.load(BUNDLE);
        await fig.send(scratchMsg({ type: 'generate', options: CANVAS }));
        const result = await fig.finished();
        assert(result.type === 'generation-complete' && result.warnings.some(w => /foundation/.test(w)), `${op} #${k}: ${result.type} ${JSON.stringify(result.warnings)}`);
        assert(fig.page.children.length === 0, `${op} #${k}: ${fig.page.children.length} nodes left on the page`);
        assert(fig.state.variables.some(v => v.name === 'color/cobalt/500') && fig.state.collections.length === 2, `${op} #${k}: tokens missing`);
      }
    }
  });

  await test('with the canvas on, a failure while building tokens still restores the page and the file exactly', async () => {
    const probe = createFigma(EXISTING); probe.load(BUNDLE);
    await probe.send(scratchMsg({ options: CANVAS, extras: ALL3 })); await probe.finished();
    for (const op of ['createVariable', 'setValue', 'createEffectStyle', 'createTextStyle', 'createCollection']) {
      const n = probe.counts[op];
      for (const k of [1, Math.ceil(n / 2), n]) {
        const fig = createFigma({ ...EXISTING, pageNodes: [{ name: 'Mine', x: 0, y: 0, width: 100, height: 100 }], faults: { [op]: k } }); fig.load(BUNDLE);
        const before = fig.snapshot();
        fig.send(scratchMsg({ options: CANVAS, extras: ALL3 }));
        const result = await fig.finished();
        assert(result.type === 'generation-failed' && fig.snapshot() === before, `${op} #${k}: ${result.type}`);
      }
    }
  });

  await test('rejects a non-boolean canvas option', async () => {
    const fig = createFigma(EXISTING); fig.load(BUNDLE);
    const before = fig.snapshot();
    fig.send(scratchMsg({ options: { canvas: 'yes' } }));
    const result = await fig.finished();
    assert(result.type === 'generation-failed' && fig.snapshot() === before, result.type);
  });

  // ── Window size ──
  await test('the plugin opens at 560 x 510 and ignores resize messages', async () => {
    const fig = createFigma({}); fig.load(BUNDLE);
    assert(fig.state.window.width === 560 && fig.state.window.height === 510, JSON.stringify(fig.state.window));
    await fig.send({ type: 'resize', width: 900, height: 900 });
    assert(fig.state.resizes.length === 0, 'the window was resized');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
