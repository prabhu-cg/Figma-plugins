// Builds data.json: the real messages the plugin sends the panel (ramp preview, contrast data, JSON export),
// so the carousel slides show the actual UI with the actual numbers. Run via build.sh.
const path = require('path');
const { createFigma } = require(path.join(__dirname, '..', '..', 'tests', 'figma-mock'));

const colors = { primary: '#3D6BE8', secondary: '#7C3AED', tertiary: '#0891B2', accent: '#EA580C',
  info: '#0066FF', success: '#00BB66', error: '#FF3333', warning: '#FFAA00', neutral: '#6B7280' };

(async () => {
  const fig = createFigma();
  fig.load(path.join(__dirname, '..', '..', '.test-build', 'code.js'));
  await fig.send({ type: 'preview-ramps', colors });
  const preview = fig.state.messages.find(m => m.type === 'ramp-preview');
  await fig.send({ type: 'generate', approach: '3tier', mode: 'scratch', colors, spacingBase: 4, radiusBase: 4, widthBase: 1,
    fontBase: 16, ratioKey: 'major-third', fontFamily: 'Inter',
    extras: { elevation: true, opacity: true, zIndex: true }, options: { scopes: true, codeSyntax: true, canvas: false } });
  const done = await fig.finished();
  fig.state.messages.length = 0;
  await fig.send({ type: 'check-contrast' });
  const contrast = fig.state.messages.find(m => m.type === 'contrast-data');
  require('fs').writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify({ colors, preview, contrast, json: done.json, total: done.total, cols: done.cols }));
  console.log(`data.json: ${preview.ramps.length} ramps, ${done.total} variables`);
})();
