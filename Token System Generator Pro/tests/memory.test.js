// Run with: npm run test:memory   (needs --expose-gc, which the script passes)
// Runs one plugin instance through many generations (successful and failed) and checks that
// neither the heap nor the plugin's module-level state grows.
const { createFigma } = require('./figma-mock');

const BUNDLE = require('path').join(__dirname, '..', '.test-build', 'code.js');
const COLORS = { primary: '#3D6BE8', secondary: '#7C3AED', tertiary: '#0891B2', accent: '#EA580C',
  info: '#3B82F6', success: '#22C55E', error: '#EF4444', warning: '#F59E0B', neutral: '#6B7280' };
const msg = (approach, fontFamily = 'Inter') => ({ type: 'confirm-continue', approach, mode: 'scratch', colors: COLORS, spacingBase: 4,
  radiusBase: 4, widthBase: 1, fontBase: 16, ratioKey: 'major-third', fontFamily,
  extras: { elevation: true, opacity: true, zIndex: true } });

const heapMB = () => { global.gc(); return process.memoryUsage().heapUsed / 1048576; };

(async () => {
  if (!global.gc) { console.error('run with --expose-gc'); process.exit(2); }
  const RUNS = 150;
  const faults = {};
  const fig = createFigma({ faults });
  fig.load(BUNDLE);

  const run = async (m) => { fig.state.messages.length = 0; fig.state.notes.length = 0; await fig.send(m); };
  for (let i = 0; i < 20; i++) await run(msg(i % 2 ? '3tier' : '2tier'));   // warm up
  const start = heapMB();

  for (let i = 0; i < RUNS; i++) {
    await run(msg(i % 2 ? '3tier' : '2tier', 'Missing Font'));                // success path, with a font warning every run
    faults.createVariable = fig.counts.createVariable + 40;                     // failure path (rolls back)
    await run(msg('3tier'));
    delete faults.createVariable;
  }
  const end = heapMB();

  // Module state is private to the bundle, so check it through what the plugin reports:
  // a leaked staging list shows up as leftover "(generating)" collections, and an uncleared
  // warning map shows up as a repeat count above one run's worth, like "(×150)" on the last run.
  fig.faultsOff = true;
  await run(msg('2tier', 'Missing Font'));
  const last = fig.state.messages.find(m => m.type === 'generation-complete');
  const stagedLeft = fig.state.collections.filter(c => c.name.includes('(generating)')).length;
  // One run creates 13 text styles, so a single run reports at most (×13).
  const repeatedWarning = last.warnings.find(w => { const m = w.match(/×(\d+)/); return m && Number(m[1]) > 13; });
  const generating = !fig.state.messages.some(m => m.type === 'generation-complete');
  const docVars = fig.state.variables.length, docCols = fig.state.collections.length;

  console.log(`heap: ${start.toFixed(1)} MB -> ${end.toFixed(1)} MB after ${RUNS * 2} runs (Δ ${(end - start).toFixed(1)} MB)`);
  console.log(`staging collections left: ${stagedLeft}, last-run warnings: ${JSON.stringify(last.warnings)}`);
  console.log(`document: ${docCols} collections, ${docVars} variables, ${fig.state.paintStyles.length} paint styles, ${fig.state.textStyles.length} text styles`);

  const problems = [];
  if (end - start > 5) problems.push(`heap grew ${(end - start).toFixed(1)} MB`);
  if (stagedLeft) problems.push('staging collections left in the file');
  if (repeatedWarning) problems.push(`warnings accumulated across runs: ${repeatedWarning}`);
  if (generating) problems.push('the plugin stopped accepting runs');
  if (docCols > 3) problems.push(`collections accumulated (${docCols})`);
  if (fig.state.effectStyles.length > 5) problems.push(`effect styles accumulated (${fig.state.effectStyles.length})`);
  if (fig.state.paintStyles.length > 100) problems.push(`paint styles accumulated (${fig.state.paintStyles.length})`);
  if (problems.length) { console.error('❌ ' + problems.join('; ')); process.exit(1); }
  console.log('✅ no growth');
})();
