"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 560, height: 510 });
// ─── PURE ALGORITHMS (keep in sync with tests/algorithms.test.js) ─
function hexToRgb(hex) {
    const c = hex.replace('#', '');
    return {
        r: parseInt(c.slice(0, 2), 16) / 255,
        g: parseInt(c.slice(2, 4), 16) / 255,
        b: parseInt(c.slice(4, 6), 16) / 255,
    };
}
function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r)
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g)
        h = ((b - r) / d + 2) / 6;
    else
        h = ((r - g) / d + 4) / 6;
    return { h, s, l };
}
function hslToRgb(h, s, l) {
    if (s === 0)
        return { r: l, g: l, b: l };
    const hue2rgb = (p, q, t) => {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return { r: hue2rgb(p, q, h + 1 / 3), g: hue2rgb(p, q, h), b: hue2rgb(p, q, h - 1 / 3) };
}
function rgbToHex(r, g, b) {
    const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}
const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const STARTER_COLORS = {
    primary: '#3D6BE8',
    secondary: '#7C3AED',
    tertiary: '#0891B2',
    accent: '#EA580C',
    info: '#3B82F6',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    neutral: '#6B7280',
};
function generateColorRamp(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const lightnessMap = {
        50: 0.95, 100: 0.88, 200: 0.76, 300: 0.64, 400: 0.52,
        500: hsl.l,
        600: hsl.l * 0.78, 700: hsl.l * 0.58, 800: hsl.l * 0.40, 900: hsl.l * 0.24,
    };
    const satMap = {
        50: hsl.s * 0.30, 100: hsl.s * 0.45, 200: hsl.s * 0.60,
        300: hsl.s * 0.75, 400: hsl.s * 0.90, 500: hsl.s,
        600: Math.min(1, hsl.s * 1.05), 700: Math.min(1, hsl.s * 1.10),
        800: Math.min(1, hsl.s * 1.15), 900: Math.min(1, hsl.s * 1.20),
    };
    const result = {};
    for (const stop of RAMP_STOPS) {
        result[stop] = hslToRgb(hsl.h, satMap[stop], lightnessMap[stop]);
    }
    result[500] = rgb;
    return result;
}
// ─── TYPOGRAPHY SCALE ─────────────────────────────────────────────
const TS_RATIO = {
    'major-second': 1.125,
    'minor-third': 1.200,
    'major-third': 1.250,
    'perfect-fourth': 1.333,
    'aug-fourth': 1.414,
};
function generateTypographyScale(fontBase, ratioKey) {
    var _a;
    const ratio = (_a = TS_RATIO[ratioKey]) !== null && _a !== void 0 ? _a : 1.25;
    const levels = [
        { name: 'display-lg', step: 10, lh: 1.0, ls: -0.05 },
        { name: 'display-md', step: 9, lh: 1.0, ls: -0.05 },
        { name: 'display-sm', step: 8, lh: 1.05, ls: -0.04 },
        { name: 'h1', step: 7, lh: 1.1, ls: -0.03 },
        { name: 'h2', step: 6, lh: 1.1, ls: -0.03 },
        { name: 'h3', step: 5, lh: 1.2, ls: -0.02 },
        { name: 'h4', step: 4, lh: 1.2, ls: -0.02 },
        { name: 'h5', step: 3, lh: 1.2, ls: 0 },
        { name: 'h6', step: 2, lh: 1.2, ls: 0 },
        { name: 'body-lg', step: 1, lh: 1.5, ls: 0 },
        { name: 'body', step: 0, lh: 1.5, ls: 0 },
        { name: 'caption', step: -1, lh: 1.4, ls: 0.01 },
        { name: 'xs', step: -2, lh: 1.4, ls: 0.02 },
    ];
    return levels.map(({ name, step, lh, ls }) => ({
        name,
        fontSize: Math.round(fontBase * Math.pow(ratio, step) / 4) * 4,
        lineHeight: lh,
        letterSpacing: ls,
    }));
}
const SPACING_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
function generateSpacingScale(base) {
    const scale = {};
    for (const m of SPACING_MULTIPLIERS)
        scale[String(base * m)] = base * m;
    return scale;
}
function generateRadiusScale(base) {
    return {
        none: 0,
        sm: Math.max(1, Math.round(base / 2)),
        md: base,
        lg: base * 2,
        xl: base * 4,
        '2xl': base * 6,
        full: 9999,
    };
}
function generateBorderWidthScale(base) {
    return { none: 0, sm: base, md: base * 2, lg: base * 4, xl: base * 8 };
}
// Names never overlap with the semantic reserved words: blue, green, red, amber, grey.
function getColorName(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const hDeg = h * 360;
    const sPct = s * 100;
    const lPct = l * 100;
    if (sPct < 8)
        return lPct >= 70 ? 'silver' : 'charcoal';
    let base;
    if (hDeg < 14 || hDeg >= 348)
        base = 'crimson';
    else if (hDeg < 24)
        base = 'scarlet';
    else if (hDeg < 36)
        base = 'coral';
    else if (hDeg < 47)
        base = 'orange';
    else if (hDeg < 57)
        base = 'gold';
    else if (hDeg < 69)
        base = 'saffron';
    else if (hDeg < 82)
        base = 'yellow';
    else if (hDeg < 94)
        base = 'lime';
    else if (hDeg < 130)
        base = 'emerald';
    else if (hDeg < 148)
        base = 'jade';
    else if (hDeg < 163)
        base = 'teal';
    else if (hDeg < 180)
        base = 'turquoise';
    else if (hDeg < 200)
        base = 'aqua';
    else if (hDeg < 218)
        base = 'sky';
    else if (hDeg < 244)
        base = 'cobalt';
    else if (hDeg < 262)
        base = 'indigo';
    else if (hDeg < 280)
        base = 'violet';
    else if (hDeg < 300)
        base = 'purple';
    else if (hDeg < 320)
        base = 'fuchsia';
    else if (hDeg < 336)
        base = 'rose';
    else
        base = 'ruby';
    if (lPct <= 22)
        return `deep-${base}`;
    else if (lPct >= 80)
        return `pale-${base}`;
    else if (sPct < 28)
        return `muted-${base}`;
    return base;
}
// ─── HELPERS ─────────────────────────────────────────────────────
function createColor(collection, name, r, g, b) {
    const v = figma.variables.createVariable(name, collection.id, 'COLOR');
    v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
    return v;
}
function createNumber(collection, name, value) {
    const v = figma.variables.createVariable(name, collection.id, 'FLOAT');
    v.setValueForMode(collection.modes[0].modeId, value);
    return v;
}
function alias(collection, name, ref) {
    if (!ref)
        return;
    const v = figma.variables.createVariable(name, collection.id, ref.resolvedType);
    v.setValueForMode(collection.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: ref.id });
    return v;
}
function deleteAllCollections() {
    const collections = figma.variables.getLocalVariableCollections();
    const vars = figma.variables.getLocalVariables();
    collections.forEach(col => {
        vars.forEach(v => {
            if (v.variableCollectionId === col.id) {
                try {
                    v.remove();
                }
                catch (_e) { }
            }
        });
        try {
            col.remove();
        }
        catch (_e) { }
    });
}
function tokensExist() {
    return figma.variables.getLocalVariableCollections().length > 0;
}
// ─── EXISTING GENERATION (unchanged) ─────────────────────────────
function createStarterSystem() {
    return __awaiter(this, void 0, void 0, function* () {
        return buildFromScratch(STARTER_COLORS, 4, 4, 1, 16, 'major-third', '3tier');
    });
}
function convertStylesToTokens() {
    const colorStyles = figma.getLocalPaintStyles();
    const textStyles = figma.getLocalTextStyles();
    if (colorStyles.length === 0 && textStyles.length === 0) {
        figma.notify('⚠️ No styles found');
        return;
    }
    const global = figma.variables.createVariableCollection('01 Global');
    const aliasCol = figma.variables.createVariableCollection('02 Alias');
    const component = figma.variables.createVariableCollection('03 Component');
    const brightnessMap = [];
    colorStyles.forEach(style => {
        const paint = style.paints[0];
        if (!paint || paint.type !== 'SOLID')
            return;
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        const v = figma.variables.createVariable(`color/${name}`, global.id, 'COLOR');
        v.setValueForMode(global.modes[0].modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
        brightnessMap.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
    });
    brightnessMap.sort((a, b) => a.brightness - b.brightness);
    const darkest = brightnessMap[0];
    const lightest = brightnessMap[brightnessMap.length - 1];
    const primary = brightnessMap[Math.floor(brightnessMap.length / 2)];
    if (primary)
        alias(aliasCol, 'surface/primary', primary.variable);
    if (darkest)
        alias(aliasCol, 'text/primary', darkest.variable);
    if (lightest)
        alias(aliasCol, 'text/inverse', lightest.variable);
    textStyles.forEach(style => {
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        const fs = createNumber(global, `typography/fontSize/${name}`, style.fontSize);
        const lhVal = style.lineHeight.unit === 'AUTO'
            ? style.fontSize * 1.4
            : style.lineHeight.value;
        const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
        const lsVal = style.letterSpacing.unit === 'PERCENT'
            ? style.fontSize * (style.letterSpacing.value / 100)
            : style.letterSpacing.value;
        const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
        const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
        alias(aliasCol, `text/${name}/fontSize`, fs);
        alias(aliasCol, `text/${name}/lineHeight`, lh);
        alias(aliasCol, `text/${name}/letterSpacing`, ls);
        alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
    });
    if (primary)
        alias(component, 'component/surface/primary', primary.variable);
    if (darkest) {
        alias(component, 'component/text/primary', darkest.variable);
        alias(component, 'component/icon/primary', darkest.variable);
        alias(component, 'component/border/default', darkest.variable);
    }
    if (lightest) {
        alias(component, 'component/text/inverse', lightest.variable);
        alias(component, 'component/icon/inverse', lightest.variable);
    }
    brightnessMap.forEach(item => alias(component, `component/surface/${item.name}`, item.variable));
    figma.notify('✅ Typography + color tokens created!');
}
function createStarterSystem2Tier() {
    return __awaiter(this, void 0, void 0, function* () {
        return buildFromScratch(STARTER_COLORS, 4, 4, 1, 16, 'major-third', '2tier');
    });
}
function convertStylesToTokens2Tier() {
    const colorStyles = figma.getLocalPaintStyles();
    const textStyles = figma.getLocalTextStyles();
    if (colorStyles.length === 0 && textStyles.length === 0) {
        figma.notify('⚠️ No styles found');
        return;
    }
    const global = figma.variables.createVariableCollection('01 Global');
    const aliasCol = figma.variables.createVariableCollection('02 Alias');
    const brightnessMap = [];
    colorStyles.forEach(style => {
        const paint = style.paints[0];
        if (!paint || paint.type !== 'SOLID')
            return;
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        const v = figma.variables.createVariable(`color/${name}`, global.id, 'COLOR');
        v.setValueForMode(global.modes[0].modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
        brightnessMap.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
    });
    brightnessMap.sort((a, b) => a.brightness - b.brightness);
    const darkest = brightnessMap[0];
    const lightest = brightnessMap[brightnessMap.length - 1];
    const primary = brightnessMap[Math.floor(brightnessMap.length / 2)];
    if (primary)
        alias(aliasCol, 'surface/primary', primary.variable);
    if (darkest)
        alias(aliasCol, 'text/primary', darkest.variable);
    if (lightest)
        alias(aliasCol, 'text/inverse', lightest.variable);
    textStyles.forEach(style => {
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        const fs = createNumber(global, `typography/fontSize/${name}`, style.fontSize);
        const lhVal = style.lineHeight.unit === 'AUTO'
            ? style.fontSize * 1.4
            : style.lineHeight.value;
        const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
        const lsVal = style.letterSpacing.unit === 'PERCENT'
            ? style.fontSize * (style.letterSpacing.value / 100)
            : style.letterSpacing.value;
        const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
        const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
        alias(aliasCol, `text/${name}/fontSize`, fs);
        alias(aliasCol, `text/${name}/lineHeight`, lh);
        alias(aliasCol, `text/${name}/letterSpacing`, ls);
        alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
    });
    figma.notify('✅ Typography + color tokens created!');
}
// ─── FROM SCRATCH ─────────────────────────────────────────────────
function buildFromScratch(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, tier) {
    const global = figma.variables.createVariableCollection('01 Global');
    // ── Color ramps — brand colors get hue-derived names; semantic colors get fixed color words
    const SEMANTIC_GLOBAL = {
        info: 'blue', success: 'green', error: 'red', warning: 'amber', neutral: 'grey',
    };
    const rv = {};
    const usedBrandNames = new Set();
    for (const key of ['primary', 'secondary', 'tertiary', 'accent']) {
        const hex = colors[key];
        if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex))
            continue;
        let colorName = getColorName(hex);
        if (usedBrandNames.has(colorName)) {
            let i = 2;
            while (usedBrandNames.has(`${colorName}-${i}`))
                i++;
            colorName = `${colorName}-${i}`;
        }
        usedBrandNames.add(colorName);
        const ramp = generateColorRamp(hex);
        rv[key] = {};
        for (const stop of RAMP_STOPS) {
            const { r, g, b } = ramp[stop];
            rv[key][stop] = createColor(global, `color/${colorName}/${stop}`, r, g, b);
        }
    }
    for (const key of ['info', 'success', 'error', 'warning', 'neutral']) {
        const hex = colors[key];
        if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex))
            continue;
        const colorName = SEMANTIC_GLOBAL[key];
        const ramp = generateColorRamp(hex);
        rv[key] = {};
        for (const stop of RAMP_STOPS) {
            const { r, g, b } = ramp[stop];
            rv[key][stop] = createColor(global, `color/${colorName}/${stop}`, r, g, b);
        }
    }
    // ── Spacing
    for (const [k, v] of Object.entries(generateSpacingScale(spacingBase))) {
        createNumber(global, `spacing/${k}`, v);
    }
    // ── Border Radius (named by pixel value)
    const radiusEntries = Object.entries(generateRadiusScale(radiusBase));
    const radiusGlobal = new Map();
    for (const [, v] of radiusEntries) {
        if (!radiusGlobal.has(v))
            radiusGlobal.set(v, createNumber(global, `borderRadius/${v}`, v));
    }
    // ── Border Width (named by pixel value)
    const widthEntries = Object.entries(generateBorderWidthScale(widthBase));
    const widthGlobal = new Map();
    for (const [, v] of widthEntries) {
        if (!widthGlobal.has(v))
            widthGlobal.set(v, createNumber(global, `borderWidth/${v}`, v));
    }
    // ── Typography
    const typo = generateTypographyScale(fontBase, ratioKey);
    const fsV = {};
    const lhV = {};
    const lsV = {};
    for (const t of typo) {
        fsV[t.name] = createNumber(global, `typography/font-size/${t.name}`, t.fontSize);
        lhV[t.name] = createNumber(global, `typography/line-height/${t.name}`, t.lineHeight);
        lsV[t.name] = createNumber(global, `typography/letter-spacing/${t.name}`, t.letterSpacing);
    }
    // ── 02 Alias
    const aliasCol = figma.variables.createVariableCollection('02 Alias');
    const P = rv['primary'], S = rv['secondary'], A = rv['accent'], T = rv['tertiary'], N = rv['neutral'];
    let intDefault, intHover, intPressed, intSubtle, intOn;
    if (P) {
        intDefault = alias(aliasCol, 'color/interactive/default', P[500]);
        intHover = alias(aliasCol, 'color/interactive/hover', P[600]);
        intPressed = alias(aliasCol, 'color/interactive/pressed', P[700]);
        intSubtle = alias(aliasCol, 'color/interactive/subtle', P[100]);
        intOn = alias(aliasCol, 'color/interactive/on', N ? N[50] : P[50]);
    }
    if (S) {
        alias(aliasCol, 'color/secondary/default', S[500]);
        alias(aliasCol, 'color/secondary/hover', S[600]);
        alias(aliasCol, 'color/secondary/subtle', S[100]);
    }
    if (A) {
        alias(aliasCol, 'color/accent/default', A[500]);
        alias(aliasCol, 'color/accent/subtle', A[100]);
    }
    if (T) {
        alias(aliasCol, 'color/tertiary/default', T[500]);
        alias(aliasCol, 'color/tertiary/subtle', T[100]);
    }
    for (const state of ['info', 'success', 'error', 'warning']) {
        const R = rv[state];
        if (R) {
            alias(aliasCol, `color/feedback/${state}/default`, R[500]);
            alias(aliasCol, `color/feedback/${state}/subtle`, R[100]);
            alias(aliasCol, `color/feedback/${state}/strong`, R[700]);
        }
    }
    for (const [k, v] of radiusEntries) {
        const gVar = radiusGlobal.get(v);
        if (gVar)
            alias(aliasCol, `borderRadius/${k}`, gVar);
    }
    for (const [k, v] of widthEntries) {
        const gVar = widthGlobal.get(v);
        if (gVar)
            alias(aliasCol, `borderWidth/${k}`, gVar);
    }
    for (const t of typo) {
        alias(aliasCol, `text/${t.name}/font-size`, fsV[t.name]);
        alias(aliasCol, `text/${t.name}/line-height`, lhV[t.name]);
        alias(aliasCol, `text/${t.name}/letter-spacing`, lsV[t.name]);
    }
    if (tier !== '3tier')
        return;
    // ── 03 Component
    const comp = figma.variables.createVariableCollection('03 Component');
    if (intDefault)
        alias(comp, 'button/bg/default', intDefault);
    if (intHover)
        alias(comp, 'button/bg/hover', intHover);
    if (intPressed)
        alias(comp, 'button/bg/pressed', intPressed);
    if (intOn)
        alias(comp, 'button/text/label', intOn);
    if (intSubtle)
        alias(comp, 'button/bg/ghost', intSubtle);
    if (intDefault)
        alias(comp, 'button/border/default', intDefault);
    if (N) {
        alias(comp, 'input/bg/default', N[50]);
        alias(comp, 'input/border/default', N[300]);
        if (intDefault)
            alias(comp, 'input/border/focus', intDefault);
        alias(comp, 'input/text/default', N[900]);
        alias(comp, 'input/text/placeholder', N[400]);
        alias(comp, 'surface/page', N[50]);
        alias(comp, 'surface/card', N[100]);
        alias(comp, 'surface/overlay', N[200]);
        alias(comp, 'text/default', N[900]);
        alias(comp, 'text/subtle', N[600]);
        alias(comp, 'text/disabled', N[400]);
        alias(comp, 'text/inverse', N[50]);
    }
}
// ─── JSON EXPORT (stub — implemented in Task 4) ───────────────────
function exportVariablesToJSON() {
    const collections = figma.variables.getLocalVariableCollections();
    const result = {};
    const colorToHex = (c) => {
        const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
    };
    const toCamelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    collections.forEach(col => {
        const vars = figma.variables.getLocalVariables().filter(v => v.variableCollectionId === col.id);
        vars.forEach(v => {
            const mode = col.modes[0];
            const val = v.valuesByMode[mode.modeId];
            const parts = v.name.split('/');
            let current = result;
            for (let i = 0; i < parts.length - 1; i++) {
                const key = toCamelCase(parts[i]);
                if (!current[key])
                    current[key] = {};
                current = current[key];
            }
            const lastKey = toCamelCase(parts[parts.length - 1]);
            let type = 'unknown';
            let value = val;
            if (v.resolvedType === 'COLOR' && val && val.r !== undefined) {
                value = colorToHex(val);
                type = 'color';
            }
            else if (v.resolvedType === 'FLOAT') {
                value = val;
                type = 'dimension';
            }
            else if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
                type = 'color';
                value = val;
            }
            current[lastKey] = { value, type };
        });
    });
    return JSON.stringify(result, null, 2);
}
// ─── ORCHESTRATION ────────────────────────────────────────────────
function runGeneration(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
    if (tokensExist()) {
        figma.ui.postMessage({ type: 'confirm-replace' });
        return;
    }
    generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey);
}
function generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
    return __awaiter(this, void 0, void 0, function* () {
        deleteAllCollections();
        if (mode === 'scratch') {
            buildFromScratch(colors, spacingBase, radiusBase, widthBase !== null && widthBase !== void 0 ? widthBase : 1, fontBase !== null && fontBase !== void 0 ? fontBase : 16, ratioKey !== null && ratioKey !== void 0 ? ratioKey : 'major-third', approach === '3tier' ? '3tier' : '2tier');
        }
        else if (approach === '3tier') {
            if (mode === 'starter')
                yield createStarterSystem();
            if (mode === 'convert')
                convertStylesToTokens();
        }
        else {
            if (mode === 'starter')
                yield createStarterSystem2Tier();
            if (mode === 'convert')
                convertStylesToTokens2Tier();
        }
        const json = exportVariablesToJSON();
        const total = figma.variables.getLocalVariables().length;
        const cols = figma.variables.getLocalVariableCollections().length;
        figma.notify('✅ Done!');
        figma.ui.postMessage({ type: 'generation-complete', json, total, cols });
    });
}
// ─── MESSAGES ────────────────────────────────────────────────────
figma.ui.onmessage = (msg) => {
    if (msg.type === 'generate') {
        runGeneration(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey);
    }
    if (msg.type === 'confirm-continue') {
        generate(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey);
    }
    if (msg.type === 'export-json') {
        if (!tokensExist()) {
            figma.notify('⚠️ No variables found — generate tokens first');
            return;
        }
        const json = exportVariablesToJSON();
        const total = figma.variables.getLocalVariables().length;
        const cols = figma.variables.getLocalVariableCollections().length;
        figma.ui.postMessage({ type: 'export-ready', json, total, cols });
    }
    if (msg.type === 'check-tokens') {
        const exists = tokensExist();
        const total = exists ? figma.variables.getLocalVariables().length : 0;
        const cols = exists ? figma.variables.getLocalVariableCollections().length : 0;
        figma.ui.postMessage({ type: 'tokens-status', exists, total, cols });
    }
};
