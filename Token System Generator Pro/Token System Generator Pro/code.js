"use strict";
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
function createLocalPaintStyle(path, r, g, b) {
    try {
        const style = figma.createPaintStyle();
        style.name = path;
        const paint = { type: 'SOLID', color: { r, g, b }, opacity: 1 };
        style.paints = [paint];
    }
    catch (_e) {
        // Style may already exist or other error
    }
}
async function createLocalTextStyle(path, fontSize, lineHeight, letterSpacing, fontFamily) {
    try {
        await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
        const style = figma.createTextStyle();
        style.name = path;
        style.fontSize = fontSize;
        style.fontName = { family: fontFamily, style: 'Regular' };
        style.lineHeight = { unit: 'PIXELS', value: lineHeight };
        style.letterSpacing = { unit: 'PIXELS', value: letterSpacing };
    }
    catch (_e) {
        // Font not available, try system fallback
        try {
            await figma.loadFontAsync({ family: 'Helvetica', style: 'Regular' });
            const style = figma.createTextStyle();
            style.name = path;
            style.fontSize = fontSize;
            style.fontName = { family: 'Helvetica', style: 'Regular' };
            style.lineHeight = { unit: 'PIXELS', value: lineHeight };
            style.letterSpacing = { unit: 'PIXELS', value: letterSpacing };
        }
        catch (_e2) {
            // Skip this style if no fonts work
        }
    }
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
function deleteAllLocalStyles() {
    const paintStyles = figma.getLocalPaintStyles();
    const textStyles = figma.getLocalTextStyles();
    paintStyles.forEach(style => { try {
        style.remove();
    }
    catch (_e) { } });
    textStyles.forEach(style => { try {
        style.remove();
    }
    catch (_e) { } });
}
function tokensExist() {
    return figma.variables.getLocalVariableCollections().length > 0;
}
// ─── EXISTING GENERATION (unchanged) ─────────────────────────────
async function createStarterSystem() {
    return buildFromScratch(STARTER_COLORS, 4, 4, 1, 16, 'major-third', '3tier');
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
    const globalColors = [];
    const modeId = global.modes[0].modeId;
    const aliasModeId = aliasCol.modes[0].modeId;
    const componentModeId = component.modes[0].modeId;
    colorStyles.forEach(style => {
        const paint = style.paints[0];
        if (!paint || paint.type !== 'SOLID')
            return;
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        // Parse "color-50" into "color" and "50" to create "color/color/50"
        const match = name.match(/^(.+?)(-\d+)$/);
        const varName = match ? `color/${match[1]}/${match[2].substring(1)}` : `color/${name}`;
        const v = figma.variables.createVariable(varName, global.id, 'COLOR');
        v.setValueForMode(modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
        globalColors.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
    });
    if (globalColors.length === 0) {
        figma.notify('⚠️ No paint styles found');
        return;
    }
    globalColors.sort((a, b) => a.brightness - b.brightness);
    const allGlobalVars = figma.variables.getLocalVariables().filter(v => v.variableCollectionId === global.id && v.name.startsWith('color/'));
    // Extract base color names: group "color/red/50", "color/red/100", etc. → "red"
    const colorFamilies = new Map();
    allGlobalVars.forEach(gVar => {
        const parts = gVar.name.split('/');
        if (parts.length >= 2) {
            const baseColor = parts[1];
            if (!colorFamilies.has(baseColor)) {
                colorFamilies.set(baseColor, []);
            }
            colorFamilies.get(baseColor).push(gVar);
        }
    });
    // Pick primary, secondary, tertiary, accent by sorted order
    const sortedFamilies = Array.from(colorFamilies.entries()).sort((a, b) => {
        const aBrightness = a[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
        const bBrightness = b[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
        return aBrightness - bBrightness;
    });
    const primaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 2)];
    const secondaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 4)];
    const tertiaryFamily = sortedFamilies[Math.floor(sortedFamilies.length * 3 / 4)];
    const accentFamily = sortedFamilies[sortedFamilies.length - 1];
    try {
        // Primary
        if (primaryFamily) {
            primaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${primaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`colors/primary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Secondary
        if (secondaryFamily) {
            secondaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${secondaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`colors/secondary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Tertiary
        if (tertiaryFamily) {
            tertiaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${tertiaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`colors/tertiary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Accent
        if (accentFamily) {
            accentFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${accentFamily[0]}`.length);
                const a = figma.variables.createVariable(`colors/accent${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Feedback: use darkest and lightest for semantic colors
        const darkestFamily = sortedFamilies[0];
        const lightestFamily = sortedFamilies[sortedFamilies.length - 1];
        if (darkestFamily) {
            darkestFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${darkestFamily[0]}`.length);
                const info = figma.variables.createVariable(`colors/feedback/info${suffix}`, aliasCol.id, 'COLOR');
                info.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
                const err = figma.variables.createVariable(`colors/feedback/error${suffix}`, aliasCol.id, 'COLOR');
                err.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        if (lightestFamily && lightestFamily !== darkestFamily) {
            lightestFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${lightestFamily[0]}`.length);
                const succ = figma.variables.createVariable(`colors/feedback/success${suffix}`, aliasCol.id, 'COLOR');
                succ.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        if (primaryFamily) {
            primaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${primaryFamily[0]}`.length);
                const warn = figma.variables.createVariable(`colors/feedback/warning${suffix}`, aliasCol.id, 'COLOR');
                warn.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
    }
    catch (e) {
        figma.notify(`❌ Color aliases: ${e}`);
        return;
    }
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
    try {
        const allAliasVars = figma.variables.getLocalVariables().filter(v => v.variableCollectionId === aliasCol.id);
        const cp = allAliasVars.find(v => v.name === 'colors/primary/500');
        const cs = allAliasVars.find(v => v.name === 'colors/secondary/500');
        const ct = allAliasVars.find(v => v.name === 'colors/tertiary/500');
        const ca = allAliasVars.find(v => v.name === 'colors/accent/500');
        if (cp) {
            const t1 = figma.variables.createVariable('text/primary', component.id, 'COLOR');
            t1.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: cp.id });
            const i1 = figma.variables.createVariable('icon/primary', component.id, 'COLOR');
            i1.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: cp.id });
            const s1 = figma.variables.createVariable('surface/primary', component.id, 'COLOR');
            s1.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: cp.id });
            const b1 = figma.variables.createVariable('border/default', component.id, 'COLOR');
            b1.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: cp.id });
        }
        if (cs) {
            const s2 = figma.variables.createVariable('surface/secondary', component.id, 'COLOR');
            s2.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: cs.id });
        }
        if (ct) {
            const s3 = figma.variables.createVariable('surface/tertiary', component.id, 'COLOR');
            s3.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: ct.id });
        }
        if (ca) {
            const s4 = figma.variables.createVariable('surface/accent', component.id, 'COLOR');
            s4.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: ca.id });
            const t2 = figma.variables.createVariable('text/inverse', component.id, 'COLOR');
            t2.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: ca.id });
            const i2 = figma.variables.createVariable('icon/inverse', component.id, 'COLOR');
            i2.setValueForMode(componentModeId, { type: 'VARIABLE_ALIAS', id: ca.id });
        }
    }
    catch (e) {
        figma.notify(`❌ Component vars: ${e}`);
        return;
    }
    figma.notify('✅ Typography + color tokens created!');
}
async function createStarterSystem2Tier() {
    return buildFromScratch(STARTER_COLORS, 4, 4, 1, 16, 'major-third', '2tier');
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
    const globalColors = [];
    const modeId = global.modes[0].modeId;
    const aliasModeId = aliasCol.modes[0].modeId;
    colorStyles.forEach(style => {
        const paint = style.paints[0];
        if (!paint || paint.type !== 'SOLID')
            return;
        const name = style.name.replace(/\s+/g, '-').toLowerCase();
        // Parse "color-50" into "color" and "50" to create "color/color/50"
        const match = name.match(/^(.+?)(-\d+)$/);
        const varName = match ? `color/${match[1]}/${match[2].substring(1)}` : `color/${name}`;
        const v = figma.variables.createVariable(varName, global.id, 'COLOR');
        v.setValueForMode(modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
        globalColors.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
    });
    if (globalColors.length === 0) {
        figma.notify('⚠️ No paint styles found');
        return;
    }
    globalColors.sort((a, b) => a.brightness - b.brightness);
    const allGlobalVars = figma.variables.getLocalVariables().filter(v => v.variableCollectionId === global.id && v.name.startsWith('color/'));
    // Extract base color names: group "color/red/50", "color/red/100", etc. → "red"
    const colorFamilies = new Map();
    allGlobalVars.forEach(gVar => {
        const parts = gVar.name.split('/');
        if (parts.length >= 2) {
            const baseColor = parts[1];
            if (!colorFamilies.has(baseColor)) {
                colorFamilies.set(baseColor, []);
            }
            colorFamilies.get(baseColor).push(gVar);
        }
    });
    // Pick primary, secondary, tertiary, accent by sorted order
    const sortedFamilies = Array.from(colorFamilies.entries()).sort((a, b) => {
        const aBrightness = a[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
        const bBrightness = b[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
        return aBrightness - bBrightness;
    });
    const primaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 2)];
    const secondaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 4)];
    const tertiaryFamily = sortedFamilies[Math.floor(sortedFamilies.length * 3 / 4)];
    const accentFamily = sortedFamilies[sortedFamilies.length - 1];
    try {
        // Primary
        if (primaryFamily) {
            primaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${primaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`color/primary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Secondary
        if (secondaryFamily) {
            secondaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${secondaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`color/secondary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Tertiary
        if (tertiaryFamily) {
            tertiaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${tertiaryFamily[0]}`.length);
                const a = figma.variables.createVariable(`color/tertiary${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Accent
        if (accentFamily) {
            accentFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${accentFamily[0]}`.length);
                const a = figma.variables.createVariable(`color/accent${suffix}`, aliasCol.id, 'COLOR');
                a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        // Feedback: use darkest and lightest for semantic colors
        const darkestFamily = sortedFamilies[0];
        const lightestFamily = sortedFamilies[sortedFamilies.length - 1];
        if (darkestFamily) {
            darkestFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${darkestFamily[0]}`.length);
                const info = figma.variables.createVariable(`color/feedback/info${suffix}`, aliasCol.id, 'COLOR');
                info.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
                const err = figma.variables.createVariable(`color/feedback/error${suffix}`, aliasCol.id, 'COLOR');
                err.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        if (lightestFamily && lightestFamily !== darkestFamily) {
            lightestFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${lightestFamily[0]}`.length);
                const succ = figma.variables.createVariable(`color/feedback/success${suffix}`, aliasCol.id, 'COLOR');
                succ.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
        if (primaryFamily) {
            primaryFamily[1].forEach(gVar => {
                const suffix = gVar.name.substring(`color/${primaryFamily[0]}`.length);
                const warn = figma.variables.createVariable(`color/feedback/warning${suffix}`, aliasCol.id, 'COLOR');
                warn.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
            });
        }
    }
    catch (e) {
        figma.notify(`❌ Color aliases: ${e}`);
        return;
    }
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
async function buildFromScratch(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, tier, fontFamily) {
    const global = figma.variables.createVariableCollection('01 Global');
    const selectedFont = fontFamily || 'Inter';
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
    const ffV = figma.variables.createVariable('typography/font-family', global.id, 'STRING');
    ffV.setValueForMode(global.modes[0].modeId, selectedFont);
    for (const t of typo) {
        fsV[t.name] = createNumber(global, `typography/font-size/${t.name}`, t.fontSize);
        const lineHeightPx = Math.round(t.fontSize * t.lineHeight / 4) * 4;
        lhV[t.name] = createNumber(global, `typography/line-height/${t.name}`, lineHeightPx);
        lsV[t.name] = createNumber(global, `typography/letter-spacing/${t.name}`, t.letterSpacing);
    }
    // ── 02 Alias
    const aliasCol = figma.variables.createVariableCollection('02 Alias');
    const P = rv['primary'], S = rv['secondary'], A = rv['accent'], T = rv['tertiary'], N = rv['neutral'];
    // ── Color aliases: expose all stops for each color ──
    const colorAliases = {};
    for (const key of ['primary', 'secondary', 'tertiary', 'accent']) {
        const R = rv[key];
        if (R) {
            colorAliases[key] = {};
            for (const stop of RAMP_STOPS) {
                colorAliases[key][stop] = alias(aliasCol, `color/${key}/${stop}`, R[stop]);
            }
        }
    }
    // ── Feedback (semantic) color aliases ──
    for (const state of ['info', 'success', 'error', 'warning', 'neutral']) {
        const R = rv[state];
        if (R) {
            colorAliases[state] = {};
            for (const stop of RAMP_STOPS) {
                colorAliases[state][stop] = alias(aliasCol, `color/feedback/${state}/${stop}`, R[stop]);
            }
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
    alias(aliasCol, 'typography/font-family', ffV);
    for (const t of typo) {
        alias(aliasCol, `text/${t.name}/font-size`, fsV[t.name]);
        alias(aliasCol, `text/${t.name}/line-height`, lhV[t.name]);
        alias(aliasCol, `text/${t.name}/letter-spacing`, lsV[t.name]);
    }
    // ── Create local text styles ──
    const displayLevels = ['display-lg', 'display-md', 'display-sm'];
    const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const bodyLevels = ['body-lg', 'body', 'caption', 'xs'];
    for (const t of typo) {
        let group = '';
        if (displayLevels.includes(t.name))
            group = 'Display';
        else if (headingLevels.includes(t.name))
            group = 'Heading';
        else if (bodyLevels.includes(t.name))
            group = 'Body copy';
        if (group) {
            const lineHeightPx = Math.round(t.fontSize * t.lineHeight / 4) * 4;
            const letterSpacingPx = t.fontSize * t.letterSpacing;
            await createLocalTextStyle(`${group}/${t.name}`, t.fontSize, lineHeightPx, letterSpacingPx, selectedFont);
        }
    }
    // ── Bind variables to text styles ──
    const textStyles = figma.getLocalTextStyles();
    for (const style of textStyles) {
        const levelName = style.name.split('/').pop();
        if (levelName && fsV[levelName]) {
            try {
                style.setBoundVariable('fontSize', fsV[levelName]);
                style.setBoundVariable('lineHeight', lhV[levelName]);
                style.setBoundVariable('letterSpacing', lsV[levelName]);
                style.setBoundVariable('fontFamily', ffV);
            }
            catch (_e) {
                // Binding may fail in some cases
            }
        }
    }
    // ── Create local paint styles for color ramps ──
    const brandColorNames = {};
    for (const key of ['primary', 'secondary', 'tertiary', 'accent']) {
        const R = rv[key];
        if (R) {
            let colorName = getColorName(colors[key]);
            const usedNames = Object.values(brandColorNames);
            if (usedNames.includes(colorName)) {
                let suffix = 2;
                while (usedNames.includes(`${colorName}-${suffix}`))
                    suffix++;
                colorName = `${colorName}-${suffix}`;
            }
            brandColorNames[key] = colorName;
            for (const stop of RAMP_STOPS) {
                const val = R[stop].valuesByMode[global.modes[0].modeId];
                if (val && typeof val === 'object' && 'r' in val) {
                    const rgb = val;
                    createLocalPaintStyle(`${colorName}/${stop}`, rgb.r, rgb.g, rgb.b);
                }
            }
        }
    }
    // ── Create local paint styles for semantic colors (fixed names) ──
    const semanticMap = {
        info: 'blue',
        success: 'green',
        error: 'red',
        warning: 'amber',
        neutral: 'grey',
    };
    for (const [key, fixedName] of Object.entries(semanticMap)) {
        const R = rv[key];
        if (R) {
            for (const stop of RAMP_STOPS) {
                const val = R[stop].valuesByMode[global.modes[0].modeId];
                if (val && typeof val === 'object' && 'r' in val) {
                    const rgb = val;
                    createLocalPaintStyle(`${fixedName}/${stop}`, rgb.r, rgb.g, rgb.b);
                }
            }
        }
    }
    if (tier !== '3tier')
        return;
    // ── 03 Component
    const comp = figma.variables.createVariableCollection('03 Component');
    // Text tokens
    if (colorAliases['primary']) {
        alias(comp, 'text/default', colorAliases['primary'][900]);
        alias(comp, 'text/subtle', colorAliases['primary'][600]);
        alias(comp, 'text/disabled', colorAliases['primary'][400]);
        alias(comp, 'text/inverse', colorAliases['primary'][50]);
    }
    // Icon tokens
    if (colorAliases['primary']) {
        alias(comp, 'icon/default', colorAliases['primary'][900]);
        alias(comp, 'icon/subtle', colorAliases['primary'][600]);
        alias(comp, 'icon/disabled', colorAliases['primary'][400]);
        alias(comp, 'icon/inverse', colorAliases['primary'][50]);
    }
    // Surface tokens - map to different colors
    if (colorAliases['primary'] && colorAliases['secondary'] && colorAliases['tertiary'] && colorAliases['accent']) {
        alias(comp, 'surface/primary', colorAliases['primary'][500]);
        alias(comp, 'surface/secondary', colorAliases['secondary'][500]);
        alias(comp, 'surface/tertiary', colorAliases['tertiary'][500]);
        alias(comp, 'surface/accent', colorAliases['accent'][500]);
    }
    // Border tokens
    if (colorAliases['primary']) {
        alias(comp, 'border/default', colorAliases['primary'][500]);
        alias(comp, 'border/subtle', colorAliases['primary'][300]);
        alias(comp, 'border/disabled', colorAliases['primary'][100]);
        alias(comp, 'border/inverse', colorAliases['primary'][900]);
    }
}
// ─── JSON EXPORT (stub — implemented in Task 4) ───────────────────
function exportVariablesToJSON() {
    const collections = figma.variables.getLocalVariableCollections();
    const allVars = figma.variables.getLocalVariables();
    const result = {};
    const toCamelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const colorToHex = (c) => {
        const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
        return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
    };
    // Build lookup map: varId -> { name, collectionName, token }
    const varLookup = new Map();
    const collectionNames = new Map();
    collections.forEach(col => {
        collectionNames.set(col.id, toCamelCase(col.name));
    });
    allVars.forEach(v => {
        const colName = collectionNames.get(v.variableCollectionId) || 'unknown';
        const token = v.name.split('/').map(p => toCamelCase(p)).join('.');
        varLookup.set(v.id, { name: v.name, collectionName: colName, token: `${colName}.${token}` });
    });
    // Process typography groups per collection
    const typographyGroupsByCollection = new Map();
    allVars.forEach(v => {
        var _a;
        if (v.name.includes('/fontSize/') || v.name.includes('/lineHeight/') || v.name.includes('/letterSpacing/')) {
            const match = v.name.match(/^text\/([^/]+)\/(fontSize|lineHeight|letterSpacing)$/);
            if (match) {
                const colId = v.variableCollectionId;
                const colName = collectionNames.get(colId) || 'unknown';
                const baseKey = match[1];
                if (!typographyGroupsByCollection.has(colName)) {
                    typographyGroupsByCollection.set(colName, new Map());
                }
                const groupMap = typographyGroupsByCollection.get(colName);
                if (!groupMap.has(baseKey))
                    groupMap.set(baseKey, {});
                const mode = (_a = figma.variables.getLocalVariableCollections().find(c => c.id === colId)) === null || _a === void 0 ? void 0 : _a.modes[0];
                if (mode) {
                    const val = v.valuesByMode[mode.modeId];
                    const group = groupMap.get(baseKey);
                    if (match[2] === 'fontSize')
                        group.fontSize = val;
                    else if (match[2] === 'lineHeight')
                        group.lineHeight = val;
                    else if (match[2] === 'letterSpacing')
                        group.letterSpacing = val;
                }
            }
        }
    });
    // Process collections
    collections.forEach(col => {
        const colName = toCamelCase(col.name);
        const colResult = {};
        const vars = allVars.filter(v => v.variableCollectionId === col.id);
        const mode = col.modes[0];
        vars.forEach(v => {
            // Skip individual typography components (handled as groups)
            if (v.name.includes('/fontSize/') || v.name.includes('/lineHeight/') || v.name.includes('/letterSpacing/')) {
                return;
            }
            const val = v.valuesByMode[mode.modeId];
            const parts = v.name.split('/');
            let current = colResult;
            // Navigate/create nested structure within collection
            for (let i = 0; i < parts.length - 1; i++) {
                const key = toCamelCase(parts[i]);
                if (!current[key])
                    current[key] = {};
                current = current[key];
            }
            const lastKey = toCamelCase(parts[parts.length - 1]);
            let type = 'unknown';
            let value = val;
            if (v.resolvedType === 'COLOR' && val && typeof val === 'object' && val.r !== undefined) {
                value = colorToHex(val);
                type = 'color';
            }
            else if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
                // Resolve alias to {collection.path.to.token} format
                const aliasId = val.id;
                const aliasVar = varLookup.get(aliasId);
                if (aliasVar) {
                    value = `{${aliasVar.token}}`;
                    type = 'color';
                }
            }
            else if (v.resolvedType === 'FLOAT') {
                value = val;
                type = 'dimension';
            }
            current[lastKey] = { value, type };
        });
        // Add typography composite tokens for this collection
        const typographyGroups = typographyGroupsByCollection.get(colName);
        if (typographyGroups) {
            typographyGroups.forEach((group, name) => {
                var _a, _b;
                if (group.fontSize !== undefined) {
                    if (!colResult['text'])
                        colResult['text'] = {};
                    const textObj = colResult['text'];
                    textObj[name] = {
                        value: {
                            fontSize: group.fontSize,
                            lineHeight: (_a = group.lineHeight) !== null && _a !== void 0 ? _a : group.fontSize * 1.4,
                            letterSpacing: (_b = group.letterSpacing) !== null && _b !== void 0 ? _b : 0,
                        },
                        type: 'typography',
                    };
                }
            });
        }
        result[colName] = colResult;
    });
    return JSON.stringify(result, null, 2);
}
// ─── ORCHESTRATION ────────────────────────────────────────────────
function runGeneration(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, fontFamily) {
    if (tokensExist()) {
        figma.ui.postMessage({ type: 'confirm-replace' });
        return;
    }
    generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, fontFamily);
}
async function generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, fontFamily) {
    deleteAllCollections();
    if (mode !== 'convert') {
        deleteAllLocalStyles();
    }
    if (mode === 'scratch') {
        await buildFromScratch(colors, spacingBase, radiusBase, widthBase !== null && widthBase !== void 0 ? widthBase : 1, fontBase !== null && fontBase !== void 0 ? fontBase : 16, ratioKey !== null && ratioKey !== void 0 ? ratioKey : 'major-third', approach === '3tier' ? '3tier' : '2tier', fontFamily);
    }
    else if (approach === '3tier') {
        if (mode === 'starter')
            await createStarterSystem();
        if (mode === 'convert')
            convertStylesToTokens();
    }
    else {
        if (mode === 'starter')
            await createStarterSystem2Tier();
        if (mode === 'convert')
            convertStylesToTokens2Tier();
    }
    const json = exportVariablesToJSON();
    const total = figma.variables.getLocalVariables().length;
    const cols = figma.variables.getLocalVariableCollections().length;
    figma.notify('✅ Done!');
    figma.ui.postMessage({ type: 'generation-complete', json, total, cols });
}
// ─── MESSAGES ────────────────────────────────────────────────────
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'generate') {
        runGeneration(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey, msg.fontFamily);
    }
    if (msg.type === 'confirm-continue') {
        generate(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey, msg.fontFamily);
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
    if (msg.type === 'get-fonts') {
        const fonts = await figma.listAvailableFontsAsync();
        const fontNames = [...new Set(fonts.map((f) => f.fontName.family))].sort();
        figma.ui.postMessage({ type: 'fonts-list', fonts: fontNames });
    }
};
