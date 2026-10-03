// Minimal in-memory Figma API, just enough to run code.ts end to end in Node.
// `faults` lets a test make the Nth call of an operation throw.
const vm = require('vm');

// Installed fonts: family -> styles. Style names follow real fonts ("Semi Bold" in Inter, "SemiBold" elsewhere).
const DEFAULT_FONTS = {
  'Inter': ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black', 'Italic', 'Bold Italic'],
  'Georgia': ['Regular', 'Bold', 'Italic', 'Bold Italic'],
  'Playfair Display': ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'],
  'Source Sans 3': ['ExtraLight', 'Light', 'Regular', 'SemiBold', 'Bold', 'Black'],
  'Helvetica': ['Light', 'Regular', 'Bold'],
};
const fs = require('fs');

function createFigma({ paintStyles = [], textStyles = [], collections = [], faults = {}, hooks = {}, fonts = DEFAULT_FONTS, pageNodes = [] } = {}) {
  let nextId = 0;
  const state = { collections: [], variables: [], paintStyles: [], textStyles: [], effectStyles: [], messages: [], notes: [], resizes: [], window: null, logs: [] };
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
      scopes: ['ALL_SCOPES'], codeSyntax: {},
      setVariableCodeSyntax(platform, value) { tick('codeSyntax'); v.codeSyntax[platform] = value; },
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
    const s = { id: 'S' + nextId++, name: '', paints: [], remove() { tick('removePaintStyle'); state.paintStyles.splice(state.paintStyles.indexOf(s), 1); } };
    state.paintStyles.push(s);
    return s;
  };
  const makeEffectStyle = () => {
    tick('createEffectStyle');
    const s = { id: 'S' + nextId++, name: '', effects: [], remove() { tick('removeEffectStyle'); state.effectStyles.splice(state.effectStyles.indexOf(s), 1); } };
    state.effectStyles.push(s);
    return s;
  };

  // Like Figma: a new text style starts as Inter Regular, and changing size, line height or letter
  // spacing throws unless the style's *current* font has been loaded. Changing fontName needs the
  // *new* font loaded. (Seeding the document skips these checks.)
  const loadedFonts = new Set();
  const fontKey = (f) => `${f.family} ${f.style}`;
  const makeTextStyle = () => {
    tick('createTextStyle');
    const values = { fontSize: 12, lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 0 }, fontName: { family: 'Inter', style: 'Regular' } };
    const s = {
      id: 'S' + nextId++, name: '', bound: {}, paragraphSpacing: 0,
      remove() { tick('removeTextStyle'); state.textStyles.splice(state.textStyles.indexOf(s), 1); },
      setBoundVariable(field, variable) { tick('bind'); s.bound[field] = variable.name; },
    };
    for (const prop of Object.keys(values)) {
      Object.defineProperty(s, prop, {
        enumerable: true,
        get: () => values[prop],
        set: (v) => {
          if (armed) {
            if (prop === 'fontName') {
              if (!loadedFonts.has(fontKey(v))) throw new Error(`in set_fontName: Cannot write to node with unloaded font "${fontKey(v)}". Please call figma.loadFontAsync first.`);
            } else if (!loadedFonts.has(fontKey(values.fontName))) {
              throw new Error(`in set_${prop}: Cannot write to node with unloaded font "${fontKey(values.fontName)}". Please call figma.loadFontAsync({ family: "${values.fontName.family}", style: "${values.fontName.style}" }) and await the returned promise first.`);
            }
          }
          values[prop] = v;
        },
      });
    }
    state.textStyles.push(s);
    return s;
  };

  // ── Canvas: a page of nodes with just enough behaviour to draw the foundation ──
  const page = { id: 'page', type: 'PAGE', children: [] };
  page.findChildren = (fn) => page.children.filter(fn);
  page.appendChild = (c) => attach(c, page);
  function detach(n) { if (n.parent) { const a = n.parent.children; const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); n.parent = null; } }
  function attach(child, parent) { detach(child); child.parent = parent; parent.children.push(child); }
  const dim = (n, axis) => {                        // 0 = width, 1 = height
    const fixed = axis === 0 ? n._w : n._h;
    if (n.type === 'TEXT') return axis === 0 ? String(n.characters || '').length * (n.fontSize || 12) * 0.55 : (n.fontSize || 12) * 1.3;
    if (n.type !== 'FRAME' || !n.layoutMode || n.layoutMode === 'NONE') return fixed !== undefined ? fixed : 100;
    const horizontal = n.layoutMode === 'HORIZONTAL';
    const along = (axis === 0) === horizontal;      // is this axis the layout direction?
    const sizing = along ? n.primaryAxisSizingMode : n.counterAxisSizingMode;
    if (sizing === 'FIXED' && fixed !== undefined) return fixed;
    const sizes = n.children.map(c => dim(c, axis));
    const pad = axis === 0 ? (n.paddingLeft || 0) + (n.paddingRight || 0) : (n.paddingTop || 0) + (n.paddingBottom || 0);
    if (along) return sizes.reduce((a, b) => a + b, 0) + (n.itemSpacing || 0) * Math.max(0, sizes.length - 1) + pad;
    return (sizes.length ? Math.max(...sizes) : 0) + pad;
  };
  const makeNode = (type, extra = {}) => {
    tick('create' + type[0] + type.slice(1).toLowerCase());   // createFrame, createRectangle, createText
    const n = {
      id: 'N' + nextId++, type, name: '', children: [], parent: null, x: 0, y: 0, fills: [], strokes: [],
      pluginData: {}, boundVariables: {}, layoutMode: 'NONE', itemSpacing: 0, ...extra,
      get width() { return dim(n, 0); }, get height() { return dim(n, 1); },
      appendChild(c) { attach(c, n); },
      remove() { tick('removeNode'); detach(n); n.removed = true; },
      resize(w, h) { n._w = w; n._h = h; },
      setPluginData(k, v) { n.pluginData[k] = v; },
      getPluginData(k) { return n.pluginData[k] || ''; },
      setBoundVariable(field, variable) { tick('bindNode'); if (!variable || typeof variable !== 'object') throw new Error('bind needs a Variable'); n.boundVariables[field] = variable.id; },
      async setTextStyleIdAsync(id) { if (!state.textStyles.some(s => s.id === id)) throw new Error('unknown text style'); n.textStyleId = id; },
      async setEffectStyleIdAsync(id) { if (!state.effectStyles.some(s => s.id === id)) throw new Error('unknown effect style'); n.effectStyleId = id; },
    };
    attach(n, page);            // new nodes land on the current page
    return n;
  };
  const makeText = () => {
    const n = makeNode('TEXT', { fontName: { family: 'Inter', style: 'Regular' }, fontSize: 12 });
    let characters = '';
    Object.defineProperty(n, 'characters', {
      enumerable: true, get: () => characters,
      set: (v) => { if (armed && !loadedFonts.has(fontKey(n.fontName))) throw new Error(`in set_characters: Cannot write to node with unloaded font "${fontKey(n.fontName)}"`); characters = v; },
    });
    return n;
  };
  pageNodes.forEach(({ name, x, y, width, height }) => { const n = makeNode('FRAME'); n.name = name; n.x = x; n.y = y; n.resize(width, height); });

  // Seed pre-existing document content.
  collections.forEach(({ name, variables }) => {
    const c = makeCollection(name);
    (variables || []).forEach(vn => { const v = makeVariable(vn, c, 'FLOAT'); v.setValueForMode(c.modes[0].modeId, 1); });
  });
  paintStyles.forEach(([name, r, g, b]) => { const s = makePaintStyle(); s.name = name; s.paints = [{ type: 'SOLID', color: { r, g, b } }]; });
  textStyles.forEach(([name, size, fontStyle]) => { const s = makeTextStyle(); s.name = name; s.fontSize = size; if (fontStyle) s.fontName = { family: 'Inter', style: fontStyle }; });
  armed = true;
  page.children.forEach(n => { n.seeded = true; });

  // With "documentAccess": "dynamic-page" the synchronous getters throw, so the mock only has the async ones.
  const syncRemoved = (name) => () => { throw new Error(`${name} is not available with documentAccess: dynamic-page`); };
  const figma = {
    showUI(html, options) { state.window = options; },
    notify(text) { state.notes.push(text); },
    on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    ui: {
      postMessage(m) { state.messages.push(m); },
      set onmessage(f) { handler = f; },
      resize(w, h) { state.resizes.push([w, h]); },
    },
    variables: {
      createVariableCollection: makeCollection,
      createVariable: makeVariable,
      setBoundVariableForPaint(paint, field, variable) {
        tick('bindPaint');
        if (!variable || typeof variable !== 'object') throw new Error('bind needs a Variable');
        return { ...paint, boundVariables: { ...(paint.boundVariables || {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } };
      },
      setBoundVariableForEffect(effect, field, variable) {
        tick('bindEffect');
        if (!variable || typeof variable !== 'object') throw new Error('bind needs a Variable');
        return { ...effect, boundVariables: { ...(effect.boundVariables || {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } };
      },
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
    createEffectStyle: makeEffectStyle,
    createFrame: () => makeNode('FRAME'),
    createRectangle: () => makeNode('RECTANGLE', { cornerRadius: 0 }),
    createText: makeText,
    currentPage: page,
    viewport: { center: { x: 500, y: 300 }, scrollAndZoomIntoView() {} },
    getLocalEffectStylesAsync: async () => state.effectStyles.slice(),
    getLocalEffectStyles: syncRemoved('getLocalEffectStyles'),
    createTextStyle: makeTextStyle,
    loadFontAsync: async (font) => {
      tick('loadFont');
      if (!(fonts[font.family] || []).includes(font.style)) throw new Error(`The font "${fontKey(font)}" could not be loaded`);
      loadedFonts.add(fontKey(font));
    },
    listAvailableFontsAsync: async () => Object.entries(fonts).flatMap(([family, styles]) => styles.map(style => ({ fontName: { family, style } }))),
  };

  let ctx;
  const load = (bundlePath) => {
    ctx = { figma, __html__: '', console: { log() {}, warn() {}, error: (...args) => state.logs.push(args) }, setTimeout };
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
    text: state.textStyles.map(s => [s.name, s.fontSize, s.paragraphSpacing, s.fontName && s.fontName.style]).sort(),
    effect: state.effectStyles.map(s => [s.name, JSON.stringify(s.effects)]).sort(),
    nodes: page.children.map(n => [n.name, n.type]).sort(),
  });
  return { figma, state, counts, page, load, send, finished, snapshot, evalInPlugin, emit };
}

module.exports = { createFigma };
