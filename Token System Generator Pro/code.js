"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // algorithms.ts
  function hexToRgb(hex) {
    const c = hex.replace("#", "");
    return {
      r: parseInt(c.slice(0, 2), 16) / 255,
      g: parseInt(c.slice(2, 4), 16) / 255,
      b: parseInt(c.slice(4, 6), 16) / 255
    };
  }
  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h, s, l };
  }
  function srgbToLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(v) {
    return v <= 31308e-7 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }
  function rgbToOklch(r, g, b) {
    const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const c = Math.sqrt(A * A + B * B);
    const h = c < 1e-6 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
    return { l: L, c, h };
  }
  function oklchToLinear(l, c, h) {
    const hr = h * Math.PI / 180;
    const A = c * Math.cos(hr), B = c * Math.sin(hr);
    const l_ = Math.pow(l + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m_ = Math.pow(l - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s_ = Math.pow(l - 0.0894841775 * A - 1.291485548 * B, 3);
    return [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
    ];
  }
  var GAMUT_EPS = 1e-4;
  function inSrgbGamut(rgb) {
    return rgb.every((v) => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS);
  }
  function oklchToRgb(l, c, h) {
    let lin = oklchToLinear(l, c, h);
    if (!inSrgbGamut(lin)) {
      let lo = 0, hi = c;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inSrgbGamut(oklchToLinear(l, mid, h))) lo = mid;
        else hi = mid;
      }
      lin = oklchToLinear(l, lo, h);
    }
    const clamp = (v) => Math.min(1, Math.max(0, linearToSrgb(Math.min(1, Math.max(0, v)))));
    return { r: clamp(lin[0]), g: clamp(lin[1]), b: clamp(lin[2]) };
  }
  var RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  var STARTER_COLORS = {
    primary: "#3D6BE8",
    secondary: "#7C3AED",
    tertiary: "#0891B2",
    accent: "#EA580C",
    info: "#3B82F6",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
    neutral: "#6B7280"
  };
  var LIGHT_SIDE = { 400: 0.25, 300: 0.5, 200: 0.72, 100: 0.88, 50: 1 };
  var DARK_SIDE = { 600: 0.22, 700: 0.45, 800: 0.7, 900: 1 };
  var RAMP_L_MAX = 0.97;
  var RAMP_L_MIN = 0.24;
  var CHROMA_CURVE = {
    50: 0.15,
    100: 0.3,
    200: 0.55,
    300: 0.78,
    400: 0.92,
    500: 1,
    600: 0.95,
    700: 0.82,
    800: 0.65,
    900: 0.5
  };
  function generateColorRamp(hex) {
    const rgb = hexToRgb(hex);
    const base = rgbToOklch(rgb.r, rgb.g, rgb.b);
    const achromatic = base.c < 4e-3;
    const top = Math.max(RAMP_L_MAX, base.l);
    const bottom = Math.min(RAMP_L_MIN, base.l);
    const result = {};
    for (const stop of RAMP_STOPS) {
      if (stop === 500) {
        result[stop] = rgb;
        continue;
      }
      const light = LIGHT_SIDE[stop];
      const l = light !== void 0 ? base.l + (top - base.l) * light : base.l - (base.l - bottom) * DARK_SIDE[stop];
      result[stop] = oklchToRgb(l, achromatic ? 0 : base.c * CHROMA_CURVE[stop], base.h);
    }
    return result;
  }
  var TS_RATIO = {
    "major-second": 1.125,
    "minor-third": 1.2,
    "major-third": 1.25,
    "perfect-fourth": 1.333,
    "aug-fourth": 1.414
  };
  function generateTypographyScale(fontBase, ratioKey) {
    const ratio = Object.prototype.hasOwnProperty.call(TS_RATIO, ratioKey) ? TS_RATIO[ratioKey] : 1.25;
    const levels = [
      { name: "display-lg", step: 10, lh: 1, ls: -0.05 },
      { name: "display-md", step: 9, lh: 1, ls: -0.05 },
      { name: "display-sm", step: 8, lh: 1.05, ls: -0.04 },
      { name: "h1", step: 7, lh: 1.1, ls: -0.03 },
      { name: "h2", step: 6, lh: 1.1, ls: -0.03 },
      { name: "h3", step: 5, lh: 1.2, ls: -0.02 },
      { name: "h4", step: 4, lh: 1.2, ls: -0.02 },
      { name: "h5", step: 3, lh: 1.2, ls: 0 },
      { name: "h6", step: 2, lh: 1.2, ls: 0 },
      { name: "body-lg", step: 1, lh: 1.5, ls: 0 },
      { name: "body", step: 0, lh: 1.5, ls: 0 },
      { name: "caption", step: -1, lh: 1.4, ls: 0.01 },
      { name: "xs", step: -2, lh: 1.4, ls: 0.02 }
    ];
    return levels.map(({ name, step, lh, ls }) => ({
      name,
      fontSize: Math.round(fontBase * Math.pow(ratio, step) / 4) * 4,
      lineHeight: lh,
      letterSpacing: ls
    }));
  }
  var SPACING_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
  function generateSpacingScale(base) {
    const scale = {};
    for (const m of SPACING_MULTIPLIERS) scale[String(base * m)] = base * m;
    return scale;
  }
  function generateRadiusScale(base) {
    return {
      none: 0,
      sm: Math.max(1, Math.round(base / 2)),
      md: base,
      lg: base * 2,
      xl: base * 4,
      "2xl": base * 6,
      full: 9999
    };
  }
  function generateBorderWidthScale(base) {
    return { none: 0, sm: base, md: base * 2, lg: base * 4, xl: base * 8 };
  }
  function getColorName(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const hDeg = h * 360;
    const sPct = s * 100;
    const lPct = l * 100;
    if (sPct < 8) return lPct >= 70 ? "silver" : "charcoal";
    let base;
    if (hDeg < 14 || hDeg >= 348) base = "crimson";
    else if (hDeg < 24) base = "scarlet";
    else if (hDeg < 36) base = "coral";
    else if (hDeg < 47) base = "orange";
    else if (hDeg < 57) base = "gold";
    else if (hDeg < 69) base = "saffron";
    else if (hDeg < 82) base = "yellow";
    else if (hDeg < 94) base = "lime";
    else if (hDeg < 130) base = "emerald";
    else if (hDeg < 148) base = "jade";
    else if (hDeg < 163) base = "teal";
    else if (hDeg < 180) base = "turquoise";
    else if (hDeg < 200) base = "aqua";
    else if (hDeg < 218) base = "sky";
    else if (hDeg < 244) base = "cobalt";
    else if (hDeg < 262) base = "indigo";
    else if (hDeg < 280) base = "violet";
    else if (hDeg < 300) base = "purple";
    else if (hDeg < 320) base = "fuchsia";
    else if (hDeg < 336) base = "rose";
    else base = "ruby";
    if (lPct <= 22) return `deep-${base}`;
    else if (lPct >= 80) return `pale-${base}`;
    else if (sPct < 28) return `muted-${base}`;
    return base;
  }

  // code.ts
  figma.showUI(__html__, { width: 560, height: 510 });
  var issues = /* @__PURE__ */ new Map();
  function warn(message) {
    var _a;
    issues.set(message, ((_a = issues.get(message)) != null ? _a : 0) + 1);
  }
  function collectIssues() {
    return Array.from(issues.entries()).map(([m, n]) => n > 1 ? `${m} (\xD7${n})` : m);
  }
  function createColor(collection, name, r, g, b) {
    const v = figma.variables.createVariable(name, collection, "COLOR");
    v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
    return v;
  }
  var PENDING_PREFIX = "(generating) ";
  var staged = {
    collections: [],
    styles: []
  };
  function stageCollection(name) {
    const collection = figma.variables.createVariableCollection(PENDING_PREFIX + name);
    staged.collections.push({ collection, finalName: name });
    return collection;
  }
  function stageStyle(style) {
    staged.styles.push(style);
    return style;
  }
  function rollbackStaged() {
    let failed = 0;
    for (const style of staged.styles) {
      try {
        style.remove();
      } catch (_e) {
        failed++;
      }
    }
    for (const { collection } of staged.collections) {
      try {
        collection.remove();
      } catch (_e) {
        failed++;
      }
    }
    staged.styles = [];
    staged.collections = [];
    return failed;
  }
  async function snapshotExisting(mode) {
    return {
      collections: await figma.variables.getLocalVariableCollectionsAsync(),
      variables: await figma.variables.getLocalVariablesAsync(),
      // Smart Convert reads the local styles, so they are kept.
      paintStyles: mode === "convert" ? [] : await figma.getLocalPaintStylesAsync(),
      textStyles: mode === "convert" ? [] : await figma.getLocalTextStylesAsync()
    };
  }
  function commitStaged(old) {
    for (const col of old.collections) {
      for (const v of old.variables) {
        if (v.variableCollectionId === col.id) {
          try {
            v.remove();
          } catch (_e) {
            warn(`Couldn't remove an old variable`);
          }
        }
      }
      try {
        col.remove();
      } catch (_e) {
        warn(`Couldn't remove old collection "${col.name}"`);
      }
    }
    for (const style of old.paintStyles) {
      try {
        style.remove();
      } catch (_e) {
        warn(`Couldn't remove an old color style`);
      }
    }
    for (const style of old.textStyles) {
      try {
        style.remove();
      } catch (_e) {
        warn(`Couldn't remove an old text style`);
      }
    }
    for (const { collection, finalName } of staged.collections) {
      try {
        collection.name = finalName;
      } catch (_e) {
        warn(`Couldn't rename "${finalName}"`);
      }
    }
    staged.collections = [];
    staged.styles = [];
  }
  function createLocalPaintStyle(path, r, g, b) {
    const style = stageStyle(figma.createPaintStyle());
    style.name = path;
    const paint = { type: "SOLID", color: { r, g, b }, opacity: 1 };
    style.paints = [paint];
  }
  async function createLocalTextStyle(path, fontSize, lineHeight, letterSpacing, fontFamily) {
    let family = fontFamily;
    try {
      await figma.loadFontAsync({ family, style: "Regular" });
    } catch (_e) {
      warn(`Font "${fontFamily}" unavailable, used Helvetica for text styles`);
      family = "Helvetica";
      await figma.loadFontAsync({ family, style: "Regular" });
    }
    const style = stageStyle(figma.createTextStyle());
    style.name = path;
    style.fontSize = fontSize;
    style.fontName = { family, style: "Regular" };
    style.lineHeight = { unit: "PIXELS", value: lineHeight };
    style.letterSpacing = { unit: "PIXELS", value: letterSpacing };
    return style;
  }
  function createNumber(collection, name, value) {
    const v = figma.variables.createVariable(name, collection, "FLOAT");
    v.setValueForMode(collection.modes[0].modeId, value);
    return v;
  }
  function alias(collection, name, ref) {
    if (!ref) return;
    const v = figma.variables.createVariable(name, collection, ref.resolvedType);
    v.setValueForMode(collection.modes[0].modeId, { type: "VARIABLE_ALIAS", id: ref.id });
    return v;
  }
  async function tokensExist() {
    return (await figma.variables.getLocalVariableCollectionsAsync()).length > 0;
  }
  async function describeExisting(mode) {
    const vars = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    return {
      collections: collections.map((c) => ({
        name: c.name,
        variables: vars.filter((v) => v.variableCollectionId === c.id).length
      })),
      // Smart Convert reads the local styles, so they are kept.
      paintStyles: mode === "convert" ? 0 : (await figma.getLocalPaintStylesAsync()).length,
      textStyles: mode === "convert" ? 0 : (await figma.getLocalTextStylesAsync()).length
    };
  }
  async function createStarterSystem(tier) {
    return buildFromScratch({
      colors: STARTER_COLORS,
      spacingBase: 4,
      radiusBase: 4,
      widthBase: 1,
      fontBase: 16,
      ratioKey: "major-third",
      tier
    });
  }
  async function convertStylesToTokens(tier) {
    const colorStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    if (colorStyles.length === 0 && textStyles.length === 0) {
      throw new Error("No local styles found to convert.");
    }
    const global = stageCollection("01 Global");
    const aliasCol = stageCollection("02 Alias");
    const component = tier === "3tier" ? stageCollection("03 Component") : void 0;
    const modeId = global.modes[0].modeId;
    const aliasModeId = aliasCol.modes[0].modeId;
    const aliasColorRoot = tier === "3tier" ? "colors" : "color";
    const globalColors = [];
    colorStyles.forEach((style) => {
      const paint = style.paints[0];
      if (!paint || paint.type !== "SOLID") return;
      const name = style.name.replace(/\s+/g, "-").toLowerCase();
      const match = name.match(/^(.+?)(-\d+)$/);
      const varName = match ? `color/${match[1]}/${match[2].substring(1)}` : `color/${name}`;
      const v = figma.variables.createVariable(varName, global, "COLOR");
      v.setValueForMode(modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
      globalColors.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
    });
    if (globalColors.length === 0) {
      throw new Error("No solid color styles found to convert.");
    }
    const allGlobalVars = globalColors.map((c) => c.variable);
    const colorFamilies = /* @__PURE__ */ new Map();
    allGlobalVars.forEach((gVar) => {
      const parts = gVar.name.split("/");
      if (parts.length >= 2) {
        const baseColor = parts[1];
        if (!colorFamilies.has(baseColor)) colorFamilies.set(baseColor, []);
        colorFamilies.get(baseColor).push(gVar);
      }
    });
    const sortedFamilies = Array.from(colorFamilies.entries()).sort((a, b) => {
      const aBrightness = a[1].reduce((sum, v) => sum + (v.name.endsWith("-500") ? 1 : 0), 0);
      const bBrightness = b[1].reduce((sum, v) => sum + (v.name.endsWith("-500") ? 1 : 0), 0);
      return aBrightness - bBrightness;
    });
    const primaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 2)];
    const secondaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 4)];
    const tertiaryFamily = sortedFamilies[Math.floor(sortedFamilies.length * 3 / 4)];
    const accentFamily = sortedFamilies[sortedFamilies.length - 1];
    const darkestFamily = sortedFamilies[0];
    const lightestFamily = sortedFamilies[sortedFamilies.length - 1];
    const aliasByName = /* @__PURE__ */ new Map();
    const aliasFamily = (family, role) => {
      if (!family) return;
      family[1].forEach((gVar) => {
        const suffix = gVar.name.substring(`color/${family[0]}`.length);
        const name = `${aliasColorRoot}/${role}${suffix}`;
        const a = figma.variables.createVariable(name, aliasCol, "COLOR");
        a.setValueForMode(aliasModeId, { type: "VARIABLE_ALIAS", id: gVar.id });
        if (!aliasByName.has(name)) aliasByName.set(name, a);
      });
    };
    aliasFamily(primaryFamily, "primary");
    aliasFamily(secondaryFamily, "secondary");
    aliasFamily(tertiaryFamily, "tertiary");
    aliasFamily(accentFamily, "accent");
    aliasFamily(darkestFamily, "feedback/info");
    aliasFamily(darkestFamily, "feedback/error");
    if (lightestFamily !== darkestFamily) aliasFamily(lightestFamily, "feedback/success");
    aliasFamily(primaryFamily, "feedback/warning");
    textStyles.forEach((style) => {
      const name = style.name.replace(/\s+/g, "-").toLowerCase();
      const fs = createNumber(global, `typography/fontSize/${name}`, style.fontSize);
      const lhVal = style.lineHeight.unit === "AUTO" ? style.fontSize * 1.4 : style.lineHeight.value;
      const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
      const lsVal = style.letterSpacing.unit === "PERCENT" ? style.fontSize * (style.letterSpacing.value / 100) : style.letterSpacing.value;
      const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
      const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
      alias(aliasCol, `text/${name}/fontSize`, fs);
      alias(aliasCol, `text/${name}/lineHeight`, lh);
      alias(aliasCol, `text/${name}/letterSpacing`, ls);
      alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
    });
    if (component) createComponentColorTokens(component, aliasByName, aliasColorRoot);
  }
  function createComponentColorTokens(component, aliasVars, root) {
    const modeId = component.modes[0].modeId;
    const stop500 = (role) => aliasVars.get(`${root}/${role}/500`);
    const make = (name, target) => {
      const v = figma.variables.createVariable(name, component, "COLOR");
      v.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: target.id });
    };
    const primary = stop500("primary"), secondary = stop500("secondary");
    const tertiary = stop500("tertiary"), accent = stop500("accent");
    if (primary) ["text/primary", "icon/primary", "surface/primary", "border/default"].forEach((n) => make(n, primary));
    if (secondary) make("surface/secondary", secondary);
    if (tertiary) make("surface/tertiary", tertiary);
    if (accent) ["surface/accent", "text/inverse", "icon/inverse"].forEach((n) => make(n, accent));
  }
  var BRAND_KEYS = ["primary", "secondary", "tertiary", "accent"];
  var SEMANTIC_KEYS = ["info", "success", "error", "warning", "neutral"];
  var SEMANTIC_GLOBAL = {
    info: "blue",
    success: "green",
    error: "red",
    warning: "amber",
    neutral: "grey"
  };
  var HEX_RE = /^#[0-9A-Fa-f]{6}$/;
  function lineHeightPx(t) {
    return Math.round(t.fontSize * t.lineHeight / 4) * 4;
  }
  function createRampVariables(global, hex, colorName) {
    const ramp = generateColorRamp(hex);
    const vars = {};
    for (const stop of RAMP_STOPS) {
      const { r, g, b } = ramp[stop];
      vars[stop] = createColor(global, `color/${colorName}/${stop}`, r, g, b);
    }
    return vars;
  }
  function createGlobalColors(global, colors) {
    const ramps = {};
    const brandNames = {};
    const used = /* @__PURE__ */ new Set();
    for (const key of BRAND_KEYS) {
      const hex = colors[key];
      if (!hex || !HEX_RE.test(hex)) continue;
      let name = getColorName(hex);
      if (used.has(name)) {
        let i = 2;
        while (used.has(`${name}-${i}`)) i++;
        name = `${name}-${i}`;
      }
      used.add(name);
      brandNames[key] = name;
      ramps[key] = createRampVariables(global, hex, name);
    }
    for (const key of SEMANTIC_KEYS) {
      const hex = colors[key];
      if (!hex || !HEX_RE.test(hex)) continue;
      ramps[key] = createRampVariables(global, hex, SEMANTIC_GLOBAL[key]);
    }
    return { ramps, brandNames };
  }
  function createSpacingVariables(global, base) {
    for (const [k, v] of Object.entries(generateSpacingScale(base))) {
      createNumber(global, `spacing/${k}`, v);
    }
  }
  function createScaleGlobals(global, prefix, scale) {
    const entries = Object.entries(scale);
    const byValue = /* @__PURE__ */ new Map();
    for (const [, v] of entries) {
      if (!byValue.has(v)) byValue.set(v, createNumber(global, `${prefix}/${v}`, v));
    }
    return { entries, byValue };
  }
  function createTypographyVariables(global, fontBase, ratioKey, font, bodyFont) {
    const levels = generateTypographyScale(fontBase, ratioKey);
    const modeId = global.modes[0].modeId;
    const split = !!bodyFont && bodyFont !== font;
    const makeFont = (name, value) => {
      const v = figma.variables.createVariable(name, global, "STRING");
      v.setValueForMode(modeId, value);
      return v;
    };
    const fontFamily = split ? { heading: makeFont("typography/font-family/heading", font), body: makeFont("typography/font-family/body", bodyFont) } : (() => {
      const v = makeFont("typography/font-family", font);
      return { heading: v, body: v };
    })();
    const fonts = { heading: font, body: split ? bodyFont : font };
    const fontSize = {};
    const lineHeight = {};
    const letterSpacing = {};
    for (const t of levels) {
      fontSize[t.name] = createNumber(global, `typography/font-size/${t.name}`, t.fontSize);
      lineHeight[t.name] = createNumber(global, `typography/line-height/${t.name}`, lineHeightPx(t));
      letterSpacing[t.name] = createNumber(global, `typography/letter-spacing/${t.name}`, t.letterSpacing);
    }
    return { levels, fontSize, lineHeight, letterSpacing, fontFamily, fonts };
  }
  function aliasScale(aliasCol, prefix, scale) {
    for (const [k, v] of scale.entries) {
      const gVar = scale.byValue.get(v);
      if (gVar) alias(aliasCol, `${prefix}/${k}`, gVar);
    }
  }
  function createAliasCollection(ramps, radius, width, typo) {
    const aliasCol = stageCollection("02 Alias");
    const colorAliases = {};
    const aliasRamp = (key, prefix) => {
      const R = ramps[key];
      if (!R) return;
      colorAliases[key] = {};
      for (const stop of RAMP_STOPS) colorAliases[key][stop] = alias(aliasCol, `${prefix}/${stop}`, R[stop]);
    };
    for (const key of BRAND_KEYS) aliasRamp(key, `color/${key}`);
    for (const key of SEMANTIC_KEYS) aliasRamp(key, `color/feedback/${key}`);
    aliasScale(aliasCol, "borderRadius", radius);
    aliasScale(aliasCol, "borderWidth", width);
    if (typo.fontFamily.heading === typo.fontFamily.body) {
      alias(aliasCol, "typography/font-family", typo.fontFamily.heading);
    } else {
      alias(aliasCol, "typography/font-family/heading", typo.fontFamily.heading);
      alias(aliasCol, "typography/font-family/body", typo.fontFamily.body);
    }
    for (const t of typo.levels) {
      alias(aliasCol, `text/${t.name}/font-size`, typo.fontSize[t.name]);
      alias(aliasCol, `text/${t.name}/line-height`, typo.lineHeight[t.name]);
      alias(aliasCol, `text/${t.name}/letter-spacing`, typo.letterSpacing[t.name]);
    }
    return { aliasCol, colorAliases };
  }
  function textStyleGroup(levelName) {
    if (["display-lg", "display-md", "display-sm"].includes(levelName)) return "Display";
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(levelName)) return "Heading";
    if (["body-lg", "body", "caption", "xs"].includes(levelName)) return "Body copy";
    return "";
  }
  async function createTextStyles(typo) {
    const created = [];
    for (const t of typo.levels) {
      const group = textStyleGroup(t.name);
      if (!group) continue;
      const role = group === "Body copy" ? "body" : "heading";
      const style = await createLocalTextStyle(
        `${group}/${t.name}`,
        t.fontSize,
        lineHeightPx(t),
        t.fontSize * t.letterSpacing,
        typo.fonts[role]
      );
      created.push({ style, level: t.name, role });
    }
    for (const { style, level, role } of created) {
      try {
        style.setBoundVariable("fontSize", typo.fontSize[level]);
        style.setBoundVariable("lineHeight", typo.lineHeight[level]);
        style.setBoundVariable("letterSpacing", typo.letterSpacing[level]);
        style.setBoundVariable("fontFamily", typo.fontFamily[role]);
      } catch (_e) {
        warn(`Couldn't link a text style to its variables`);
      }
    }
  }
  function createPaintStyles(global, ramps, brandNames) {
    const modeId = global.modes[0].modeId;
    const styleRamp = (key, name) => {
      const R = ramps[key];
      if (!R) return;
      for (const stop of RAMP_STOPS) {
        const val = R[stop].valuesByMode[modeId];
        if (val && typeof val === "object" && "r" in val) {
          const rgb = val;
          createLocalPaintStyle(`${name}/${stop}`, rgb.r, rgb.g, rgb.b);
        }
      }
    };
    for (const key of BRAND_KEYS) if (brandNames[key]) styleRamp(key, brandNames[key]);
    for (const key of SEMANTIC_KEYS) styleRamp(key, SEMANTIC_GLOBAL[key]);
  }
  function createComponentCollection(colorAliases) {
    const comp = stageCollection("03 Component");
    const primary = colorAliases["primary"];
    if (primary) {
      alias(comp, "text/default", primary[900]);
      alias(comp, "text/subtle", primary[600]);
      alias(comp, "text/disabled", primary[400]);
      alias(comp, "text/inverse", primary[50]);
      alias(comp, "icon/default", primary[900]);
      alias(comp, "icon/subtle", primary[600]);
      alias(comp, "icon/disabled", primary[400]);
      alias(comp, "icon/inverse", primary[50]);
    }
    const { secondary, tertiary, accent } = colorAliases;
    if (primary && secondary && tertiary && accent) {
      alias(comp, "surface/primary", primary[500]);
      alias(comp, "surface/secondary", secondary[500]);
      alias(comp, "surface/tertiary", tertiary[500]);
      alias(comp, "surface/accent", accent[500]);
    }
    if (primary) {
      alias(comp, "border/default", primary[500]);
      alias(comp, "border/subtle", primary[300]);
      alias(comp, "border/disabled", primary[100]);
      alias(comp, "border/inverse", primary[900]);
    }
  }
  async function buildFromScratch(o) {
    const global = stageCollection("01 Global");
    const { ramps, brandNames } = createGlobalColors(global, o.colors);
    createSpacingVariables(global, o.spacingBase);
    const radius = createScaleGlobals(global, "borderRadius", generateRadiusScale(o.radiusBase));
    const width = createScaleGlobals(global, "borderWidth", generateBorderWidthScale(o.widthBase));
    const typo = createTypographyVariables(global, o.fontBase, o.ratioKey, o.fontFamily || "Inter", o.bodyFontFamily);
    const { colorAliases } = createAliasCollection(ramps, radius, width, typo);
    await createTextStyles(typo);
    createPaintStyles(global, ramps, brandNames);
    if (o.tier === "3tier") createComponentCollection(colorAliases);
  }
  var newNode = () => /* @__PURE__ */ Object.create(null);
  var childNode = (parent, key) => {
    if (!Object.prototype.hasOwnProperty.call(parent, key)) parent[key] = newNode();
    return parent[key];
  };
  var TOKEN_TYPES = { COLOR: "color", FLOAT: "dimension", STRING: "fontFamily", BOOLEAN: "boolean" };
  async function exportVariablesToJSON() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const allVars = await figma.variables.getLocalVariablesAsync();
    const result = newNode();
    const toCamelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const colorToHex = (c) => {
      const h = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
      return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
    };
    const collectionById = /* @__PURE__ */ new Map();
    const collectionNames = /* @__PURE__ */ new Map();
    collections.forEach((col) => {
      collectionById.set(col.id, col);
      collectionNames.set(col.id, toCamelCase(col.name));
    });
    const varTokens = /* @__PURE__ */ new Map();
    allVars.forEach((v) => {
      const colName = collectionNames.get(v.variableCollectionId) || "unknown";
      varTokens.set(v.id, `${colName}.${v.name.split("/").map((p) => toCamelCase(p)).join(".")}`);
    });
    const isTypographyPart = (name) => name.includes("/fontSize/") || name.includes("/lineHeight/") || name.includes("/letterSpacing/");
    const typographyByCollection = /* @__PURE__ */ new Map();
    allVars.forEach((v) => {
      var _a;
      if (!isTypographyPart(v.name)) return;
      const match = v.name.match(/^text\/([^/]+)\/(fontSize|lineHeight|letterSpacing)$/);
      if (!match) return;
      const colName = collectionNames.get(v.variableCollectionId) || "unknown";
      if (!typographyByCollection.has(colName)) typographyByCollection.set(colName, /* @__PURE__ */ new Map());
      const groups = typographyByCollection.get(colName);
      if (!groups.has(match[1])) groups.set(match[1], {});
      const mode = (_a = collectionById.get(v.variableCollectionId)) == null ? void 0 : _a.modes[0];
      if (mode) groups.get(match[1])[match[2]] = v.valuesByMode[mode.modeId];
    });
    collections.forEach((col) => {
      var _a;
      const colName = toCamelCase(col.name);
      const colResult = childNode(result, colName);
      const mode = col.modes[0];
      allVars.filter((v) => v.variableCollectionId === col.id).forEach((v) => {
        var _a2;
        if (isTypographyPart(v.name)) return;
        const val = v.valuesByMode[mode.modeId];
        const parts = v.name.split("/");
        let current = colResult;
        for (let i = 0; i < parts.length - 1; i++) current = childNode(current, toCamelCase(parts[i]));
        const type = (_a2 = TOKEN_TYPES[v.resolvedType]) != null ? _a2 : "unknown";
        let value = val;
        if (v.resolvedType === "COLOR" && val && typeof val === "object" && "r" in val) {
          value = colorToHex(val);
        } else if (val && typeof val === "object" && val.type === "VARIABLE_ALIAS") {
          const token = varTokens.get(val.id);
          if (token) value = `{${token}}`;
        }
        current[toCamelCase(parts[parts.length - 1])] = { value, type };
      });
      (_a = typographyByCollection.get(colName)) == null ? void 0 : _a.forEach((group, name) => {
        var _a2, _b;
        if (group.fontSize === void 0) return;
        childNode(colResult, "text")[name] = {
          value: {
            fontSize: group.fontSize,
            lineHeight: (_a2 = group.lineHeight) != null ? _a2 : group.fontSize * 1.4,
            letterSpacing: (_b = group.letterSpacing) != null ? _b : 0
          },
          type: "typography"
        };
      });
    });
    return JSON.stringify(result, null, 2);
  }
  async function blockedReason(mode) {
    if (mode === "convert" && (await figma.getLocalPaintStylesAsync()).length === 0 && (await figma.getLocalTextStylesAsync()).length === 0) {
      return "No local color or text styles found. Smart Convert needs styles to convert, so nothing was changed.";
    }
    return null;
  }
  var GenerationError = class extends Error {
    constructor(message, leftover) {
      super(message);
      this.leftover = leftover;
    }
  };
  async function runSafely(run) {
    var _a, _b;
    try {
      await run();
    } catch (e) {
      const err = e;
      const message = (_a = err == null ? void 0 : err.message) != null ? _a : String(e);
      const leftover = (_b = err == null ? void 0 : err.leftover) != null ? _b : 0;
      figma.notify(`\u274C Generation failed: ${message}`, { error: true });
      figma.ui.postMessage({ type: "generation-failed", message, leftover });
    }
  }
  async function runGeneration(r) {
    const blocked = await blockedReason(r.mode);
    if (blocked) {
      figma.ui.postMessage({ type: "generation-blocked", reason: blocked });
      return;
    }
    if (await tokensExist()) {
      figma.ui.postMessage({ type: "confirm-replace", existing: await describeExisting(r.mode) });
      return;
    }
    await generate(r);
  }
  function scratchOptions(r) {
    if (!r.colors || r.spacingBase === void 0 || r.radiusBase === void 0 || r.widthBase === void 0 || r.fontBase === void 0 || !r.ratioKey) {
      throw new Error("From Scratch settings are incomplete.");
    }
    return {
      colors: r.colors,
      spacingBase: r.spacingBase,
      radiusBase: r.radiusBase,
      widthBase: r.widthBase,
      fontBase: r.fontBase,
      ratioKey: r.ratioKey,
      tier: r.approach,
      fontFamily: r.fontFamily,
      bodyFontFamily: r.bodyFontFamily
    };
  }
  async function generate(r) {
    var _a;
    const blocked = await blockedReason(r.mode);
    if (blocked) {
      figma.ui.postMessage({ type: "generation-blocked", reason: blocked });
      return;
    }
    issues.clear();
    const old = await snapshotExisting(r.mode);
    const tier = r.approach;
    try {
      if (r.mode === "scratch") await buildFromScratch(scratchOptions(r));
      else if (r.mode === "starter") await createStarterSystem(tier);
      else if (r.mode === "convert") await convertStylesToTokens(tier);
    } catch (e) {
      const leftover = rollbackStaged();
      const reason = (_a = e == null ? void 0 : e.message) != null ? _a : String(e);
      throw new GenerationError(reason, leftover);
    }
    commitStaged(old);
    let json = "";
    try {
      json = await exportVariablesToJSON();
    } catch (_e) {
      warn(`Tokens were created, but the JSON export failed. Use Refresh JSON to retry.`);
    }
    const total = (await figma.variables.getLocalVariablesAsync()).length;
    const cols = (await figma.variables.getLocalVariableCollectionsAsync()).length;
    const warnings = collectIssues();
    figma.notify(warnings.length ? `\u26A0\uFE0F Done with ${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "\u2705 Done!");
    figma.ui.postMessage({ type: "generation-complete", json, total, cols, warnings });
  }
  var LIMITS = {
    spacingBase: { min: 1, max: 32, label: "Spacing base unit" },
    radiusBase: { min: 0, max: 64, label: "Border radius base" },
    widthBase: { min: 1, max: 16, label: "Border width base" },
    fontBase: { min: 10, max: 24, label: "Base font size" }
  };
  function intInRange(value, key) {
    const { min, max, label } = LIMITS[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
    }
    return value;
  }
  function parseRequest(msg) {
    if (msg.approach !== "2tier" && msg.approach !== "3tier") throw new Error("Unknown architecture.");
    if (msg.mode !== "scratch" && msg.mode !== "starter" && msg.mode !== "convert") throw new Error("Unknown mode.");
    const request = { approach: msg.approach, mode: msg.mode };
    if (msg.mode !== "scratch") return request;
    const raw = msg.colors;
    if (!raw || typeof raw !== "object") throw new Error("Brand colors are missing.");
    const colors = {};
    for (const key of [...BRAND_KEYS, ...SEMANTIC_KEYS]) {
      const hex = raw[key];
      const required = key === "primary" || key === "secondary" || key === "accent";
      if (typeof hex === "string" && HEX_RE.test(hex)) colors[key] = hex;
      else if (!required && (hex === void 0 || hex === "" || hex === "#")) colors[key] = "";
      else throw new Error(`${key[0].toUpperCase()}${key.slice(1)} must be a 6-digit hex color like #3D6BE8.`);
    }
    if (typeof msg.ratioKey !== "string" || !Object.prototype.hasOwnProperty.call(TS_RATIO, msg.ratioKey)) {
      throw new Error("Unknown type scale ratio.");
    }
    if (typeof msg.fontFamily !== "string" || !msg.fontFamily || msg.fontFamily.length > 200) {
      throw new Error("Choose a font family.");
    }
    const body = msg.bodyFontFamily;
    if (body !== void 0 && body !== "" && (typeof body !== "string" || body.length > 200)) {
      throw new Error("Body font is not valid.");
    }
    return __spreadProps(__spreadValues({}, request), {
      bodyFontFamily: body || void 0,
      colors,
      spacingBase: intInRange(msg.spacingBase, "spacingBase"),
      radiusBase: intInRange(msg.radiusBase, "radiusBase"),
      widthBase: intInRange(msg.widthBase, "widthBase"),
      fontBase: intInRange(msg.fontBase, "fontBase"),
      ratioKey: msg.ratioKey,
      fontFamily: msg.fontFamily
    });
  }
  var generating = false;
  async function exclusive(run) {
    if (generating) {
      figma.notify("\u23F3 Still generating \u2014 please wait");
      return;
    }
    generating = true;
    figma.ui.postMessage({ type: "generation-started" });
    try {
      await run();
    } finally {
      generating = false;
    }
  }
  figma.on("close", () => {
    if (generating) rollbackStaged();
  });
  figma.ui.onmessage = async (msg) => {
    var _a;
    if (msg.type === "generate" || msg.type === "confirm-continue") {
      await exclusive(() => runSafely(async () => {
        const r = parseRequest(msg);
        if (msg.type === "generate") await runGeneration(r);
        else await generate(r);
      }));
    }
    if (msg.type === "export-json") {
      if (!await tokensExist()) {
        figma.notify("\u26A0\uFE0F No variables found \u2014 generate tokens first");
        return;
      }
      try {
        const json = await exportVariablesToJSON();
        const total = (await figma.variables.getLocalVariablesAsync()).length;
        const cols = (await figma.variables.getLocalVariableCollectionsAsync()).length;
        figma.ui.postMessage({ type: "export-ready", json, total, cols });
      } catch (e) {
        figma.notify(`\u274C Export failed: ${(_a = e == null ? void 0 : e.message) != null ? _a : String(e)}`, { error: true });
      }
    }
    if (msg.type === "check-tokens") {
      const exists = await tokensExist();
      const total = exists ? (await figma.variables.getLocalVariablesAsync()).length : 0;
      const cols = exists ? (await figma.variables.getLocalVariableCollectionsAsync()).length : 0;
      figma.ui.postMessage({ type: "tokens-status", exists, total, cols });
    }
    if (msg.type === "get-fonts") {
      const fonts = await figma.listAvailableFontsAsync();
      const fontNames = [...new Set(fonts.map((f) => f.fontName.family))].sort();
      figma.ui.postMessage({ type: "fonts-list", fonts: fontNames });
    }
  };
})();
