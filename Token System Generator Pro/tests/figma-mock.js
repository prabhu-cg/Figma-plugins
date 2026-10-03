// Minimal in-memory Figma API, just enough to run code.ts end to end in Node.
// `faults` lets a test make the Nth call of an operation throw.
const vm = require('vm');
const fs = require('fs');

function createFigma({ paintStyles = [], textStyles = [], collections = [], faults = {}, hooks = {} } = {}) {
  let nextId = 0;
  const state = { collections: [], variables: [], paintStyles: [], textStyles: [], messages: [], notes: [] };
  const counts = {};
  let armed = false; // faults only apply to the run, not to seeding the document
  const tick = (op) => {
    if (!armed) return;
    counts[op] = (counts[op] || 0) + 1;
    if (hooks[op]) hooks[op](counts[op]);
    const f = faults[op];
    if (f === counts[op] || (Array.isArray(f) && f.includes(counts[op]))) throw new Error(`injected ${op} failure #${counts[op]}`);
  };
  let handler;
  const listeners = {};

  const makeVariable = (name, collection, type) => {
    // dynamic-page: the collection must be passed as an object, not an id string
    if (!collection || typeof collection !== 'object') throw new Error('createVariable needs a VariableCollection object');
    const collectionId = collection.id;
    tick('createVariable');
    const v = {
      id: 'v' + nextId++, name, variableCollectionId: collectionId, resolvedType: type, valuesByMode: {},
      setValueForMode(mode, value) { tick('setValue'); v.valuesByMode[mode] = value; },
      remove() { tick('removeVariable'); state.variables.splice(state.variables.indexOf(v), 1); },
    };
    state.variables.push(v);
    return v;
  };
  const makeCollection = (name) => {
    tick('createCollection');
    const modeId = 'm' + nextId;
    const c = {
      id: 'c' + nextId++, name, modes: [{ modeId, name: 'Mode 1' }],
      remove() {
        tick('removeCollection');
        state.variables.filter(v => v.variableCollectionId === c.id).forEach(v => state.variables.splice(state.variables.indexOf(v), 1));
        state.collections.splice(state.collections.indexOf(c), 1);
      },
    };
    state.collections.push(c);
    return c;
  };
  const makePaintStyle = () => {
    tick('createPaintStyle');
    const s = { name: '', paints: [], remove() { tick('removePaintStyle'); state.paintStyles.splice(state.paintStyles.indexOf(s), 1); } };
    state.paintStyles.push(s);
    return s;
  };
  const makeTextStyle = () => {
    tick('createTextStyle');
    const s = {
      name: '', bound: {}, fontSize: 0,
      lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 0 }, paragraphSpacing: 0,
      remove() { tick('removeTextStyle'); state.textStyles.splice(state.textStyles.indexOf(s), 1); },
      setBoundVariable(field, variable) { tick('bind'); s.bound[field] = variable.name; },
    };
    state.textStyles.push(s);
    return s;
  };

  // Seed pre-existing document content.
  collections.forEach(({ name, variables }) => {
    const c = makeCollection(name);
    (variables || []).forEach(vn => { const v = makeVariable(vn, c, 'FLOAT'); v.setValueForMode(c.modes[0].modeId, 1); });
  });
  paintStyles.forEach(([name, r, g, b]) => { const s = makePaintStyle(); s.name = name; s.paints = [{ type: 'SOLID', color: { r, g, b } }]; });
  textStyles.forEach(([name, size]) => { const s = makeTextStyle(); s.name = name; s.fontSize = size; });
  armed = true;

  // With "documentAccess": "dynamic-page" the synchronous getters throw, so the mock only has the async ones.
  const syncRemoved = (name) => () => { throw new Error(`${name} is not available with documentAccess: dynamic-page`); };
  const figma = {
    showUI() {},
    notify(text) { state.notes.push(text); },
    on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    ui: { postMessage(m) { state.messages.push(m); }, set onmessage(f) { handler = f; } },
    variables: {
      createVariableCollection: makeCollection,
      createVariable: makeVariable,
      getLocalVariablesAsync: async () => state.variables.slice(),
      getLocalVariableCollectionsAsync: async () => state.collections.slice(),
      getLocalVariables: syncRemoved('getLocalVariables'),
      getLocalVariableCollections: syncRemoved('getLocalVariableCollections'),
    },
    getLocalPaintStylesAsync: async () => state.paintStyles.slice(),
    getLocalTextStylesAsync: async () => state.textStyles.slice(),
    getLocalPaintStyles: syncRemoved('getLocalPaintStyles'),
    getLocalTextStyles: syncRemoved('getLocalTextStyles'),
    createPaintStyle: makePaintStyle,
    createTextStyle: makeTextStyle,
    loadFontAsync: async (font) => { tick('loadFont'); if (font.family === 'Missing Font') throw new Error('font not found'); },
    listAvailableFontsAsync: async () => [],
  };

  let ctx;
  const load = (bundlePath) => {
    ctx = { figma, __html__: '', console, setTimeout };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(bundlePath, 'utf8'), ctx);
  };
  const evalInPlugin = (code) => vm.runInContext(code, ctx);
  const emit = (event) => (listeners[event] || []).forEach(fn => fn());
  const send = (msg) => handler(msg);
  const finished = () => new Promise(resolve => {
    const check = () => {
      const m = state.messages.find(x => x.type === 'generation-complete' || x.type === 'generation-failed' || x.type === 'generation-blocked');
      if (m) resolve(m); else setTimeout(check, 1);
    };
    check();
  });
  const snapshot = () => JSON.stringify({
    collections: state.collections.map(c => c.name).sort(),
    variables: state.variables.map(v => [v.name, v.variableCollectionId, JSON.stringify(v.valuesByMode)]).sort(),
    paint: state.paintStyles.map(s => [s.name, JSON.stringify(s.paints)]).sort(),
    text: state.textStyles.map(s => [s.name, s.fontSize]).sort(),
  });
  return { figma, state, counts, load, send, finished, snapshot, evalInPlugin, emit };
}

module.exports = { createFigma };
