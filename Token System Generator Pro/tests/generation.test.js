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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
