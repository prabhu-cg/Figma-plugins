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

function request(doc, { approach, mode, fontFamily = 'Inter', confirmed = true }) {
  const fig = createFigma(doc);
  fig.load(BUNDLE);
  const msg = { type: confirmed ? 'confirm-continue' : 'generate', approach, mode, fontFamily };
  if (mode === 'scratch') Object.assign(msg, { colors: COLORS, spacingBase: 4, radiusBase: 4, widthBase: 1, fontBase: 16, ratioKey: 'major-third' });
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
