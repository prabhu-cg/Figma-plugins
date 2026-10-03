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
  ],
  textStyles: [['Heading/h1', 32], ['Body/body', 16]],
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
      assert(!names.includes('My Own Collection') && !fig.state.variables.some(v => v.name.startsWith('old/')), 'old tokens survived');
      if (mode === 'convert') assert(fig.state.paintStyles.length === EXISTING.paintStyles.length, 'convert must keep local styles');
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
    assert(fig.state.textStyles.length === 13, `text styles: ${fig.state.textStyles.length}`);
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
    assert(JSON.stringify(names) === JSON.stringify(['01 Global', '02 Alias']), `collections: ${names}`);
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
    const g = out['01 Global'].typography.fontFamily, a = out['02 Alias'].typography.fontFamily;
    assert(g.heading.type === 'fontFamily' && g.heading.value === 'Playfair Display' && g.body.value === 'Source Sans 3', JSON.stringify(g));
    assert(a.heading.type === 'fontFamily' && /^\{01 Global\.typography\.fontFamily\.heading\}$/.test(a.heading.value), JSON.stringify(a));
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
    assert(fig.state.textStyles.length === 13, 'text styles missing');
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
    const alias = out['02 Alias'].text.h1;
    assert(alias.fontWeight.type === 'fontWeight' && alias.fontWeight.value === '{01 Global.typography.fontWeight.h1}', JSON.stringify(alias.fontWeight));
    assert(alias.paragraphSpacing.type === 'dimension' && alias.paragraphSpacing.value === '{01 Global.typography.paragraphSpacing.h1}', JSON.stringify(alias.paragraphSpacing));
    assert(out['01 Global'].typography.fontWeight.h1.type === 'fontWeight' && out['01 Global'].typography.fontWeight.h1.value === 700, JSON.stringify(out['01 Global'].typography));
  });

  await test('scratch JSON export: weight and paragraph-spacing tokens are exported with sensible types', async () => {
    const { fig, run } = request({}, { approach: '2tier', mode: 'scratch', confirmed: false });
    await run();
    fig.state.messages.length = 0;
    await fig.send({ type: 'export-json' });
    const out = JSON.parse(fig.state.messages.find(m => m.type === 'export-ready').json);
    const g = out['01 Global'].typography;
    assert(g.fontWeight.bold.type === 'fontWeight' && g.fontWeight.bold.value === 700, JSON.stringify(g.fontWeight));
    assert(g.paragraphSpacing.body.type === 'dimension' && g.paragraphSpacing.body.value === 12, JSON.stringify(g.paragraphSpacing));
    assert(out['02 Alias'].text.h1.fontWeight.value === '{01 Global.typography.fontWeight.bold}', JSON.stringify(out['02 Alias'].text.h1.fontWeight));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
