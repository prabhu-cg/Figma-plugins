figma.showUI(__html__, { width: 560, height: 420 });

// -----------------------------
// HELPERS
// -----------------------------
function createColor(collection, name, r, g, b) {
  const v = figma.variables.createVariable(name, collection.id, "COLOR");
  v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
  return v;
}

function createNumber(collection, name, value) {
  const v = figma.variables.createVariable(name, collection.id, "FLOAT");
  v.setValueForMode(collection.modes[0].modeId, value);
  return v;
}

function alias(collection, name, ref) {
  if (!ref) return;

  const v = figma.variables.createVariable(name, collection.id, ref.resolvedType);

  v.setValueForMode(collection.modes[0].modeId, {
    type: "VARIABLE_ALIAS",
    id: ref.id
  });

  return v;
}

// -----------------------------
// DELETE ALL TOKENS
// -----------------------------
function deleteAllCollections() {
  const collections = figma.variables.getLocalVariableCollections();
  const vars = figma.variables.getLocalVariables();

  collections.forEach(col => {
    vars.forEach(v => {
      if (v.variableCollectionId === col.id) {
        try { v.remove(); } catch (e) {}
      }
    });

    try { col.remove(); } catch (e) {}
  });
}

// -----------------------------
// CHECK EXISTING
// -----------------------------
function tokensExist() {
  return figma.variables.getLocalVariableCollections().length > 0;
}

// ============================================================
// 3 TIER APPROACH
// A full three-layer token system: Global → Alias → Component.
// Designed for scalable design systems that need component-level
// semantic mapping built on top of foundational and alias layers.
// ============================================================

// -----------------------------
// STARTER SYSTEM
// -----------------------------
function createStarterSystem() {

  const global = figma.variables.createVariableCollection("01 Global");
  const aliasCol = figma.variables.createVariableCollection("02 Alias");
  const component = figma.variables.createVariableCollection("03 Component");

  // Colors
  const brand = createColor(global, "color/brand", 0.6, 0, 1);
  const white = createColor(global, "color/white", 1, 1, 1);
  const black = createColor(global, "color/black", 0.1, 0.1, 0.1);

  // Spacing / Radius
  const space16 = createNumber(global, "spacing/16", 16);
  const radius8 = createNumber(global, "radius/8", 8);

  // Typography (NEW 🔥)
  const fontSize = createNumber(global, "typography/fontSize/body", 16);
  const lineHeight = createNumber(global, "typography/lineHeight/body", 24);
  const letterSpacing = createNumber(global, "typography/letterSpacing/body", 0);
  const paragraphSpacing = createNumber(global, "typography/paragraphSpacing/body", 8);

  // Alias
  const surfacePrimary = alias(aliasCol, "surface/primary", brand);
  const textPrimary = alias(aliasCol, "text/primary", black);
  const textInverse = alias(aliasCol, "text/inverse", white);

  alias(aliasCol, "text/body/fontSize", fontSize);
  alias(aliasCol, "text/body/lineHeight", lineHeight);
  alias(aliasCol, "text/body/letterSpacing", letterSpacing);
  alias(aliasCol, "text/body/paragraphSpacing", paragraphSpacing);

 // -----------------------------
// COMPONENT (GROUPED 🔥)
// -----------------------------

// TEXT
alias(component, "component/text/primary", textPrimary);
alias(component, "component/text/inverse", textInverse);

// SURFACE
alias(component, "component/surface/primary", surfacePrimary);

// ICON
alias(component, "component/icon/primary", textPrimary);
alias(component, "component/icon/inverse", textInverse);

// BORDER
alias(component, "component/border/default", textPrimary);
}

// -----------------------------
// SMART CONVERT
// -----------------------------
function convertStylesToTokens() {

  const colorStyles = figma.getLocalPaintStyles();
  const textStyles = figma.getLocalTextStyles();

  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify("⚠️ No styles found");
    return;
  }

  const global = figma.variables.createVariableCollection("01 Global");
  const aliasCol = figma.variables.createVariableCollection("02 Alias");
  const component = figma.variables.createVariableCollection("03 Component");

  const brightnessMap = [];

  // 🎨 COLORS
  colorStyles.forEach(style => {
    const paint = style.paints[0];
    if (!paint || paint.type !== "SOLID") return;

    const name = style.name.replace(/\s+/g, "-").toLowerCase();

    const v = figma.variables.createVariable(`color/${name}`, global.id, "COLOR");

    v.setValueForMode(global.modes[0].modeId, {
      r: paint.color.r,
      g: paint.color.g,
      b: paint.color.b,
      a: 1
    });

    brightnessMap.push({
      name,
      brightness: paint.color.r + paint.color.g + paint.color.b,
      variable: v
    });
  });

  brightnessMap.sort((a, b) => a.brightness - b.brightness);

  const darkest = brightnessMap[0];
  const lightest = brightnessMap[brightnessMap.length - 1];
  const primary = brightnessMap[Math.floor(brightnessMap.length / 2)];

  if (primary) alias(aliasCol, "surface/primary", primary.variable);
  if (darkest) alias(aliasCol, "text/primary", darkest.variable);
  if (lightest) alias(aliasCol, "text/inverse", lightest.variable);

  // 🔤 TYPOGRAPHY (NEW 🔥)
  textStyles.forEach(style => {

    const name = style.name.replace(/\s+/g, "-").toLowerCase();

    const fontSize = createNumber(global, `typography/fontSize/${name}`, style.fontSize);

    const lineHeightValue =
      style.lineHeight.unit === "AUTO"
        ? style.fontSize * 1.4
        : style.lineHeight.value;

    const lineHeight = createNumber(global, `typography/lineHeight/${name}`, lineHeightValue);

    const letterSpacingValue =
      style.letterSpacing.unit === "PERCENT"
        ? style.fontSize * (style.letterSpacing.value / 100)
        : style.letterSpacing.value;

    const letterSpacing = createNumber(global, `typography/letterSpacing/${name}`, letterSpacingValue);

    const paragraphSpacing = createNumber(
      global,
      `typography/paragraphSpacing/${name}`,
      style.paragraphSpacing || 0
    );

    // Alias layer
    alias(aliasCol, `text/${name}/fontSize`, fontSize);
    alias(aliasCol, `text/${name}/lineHeight`, lineHeight);
    alias(aliasCol, `text/${name}/letterSpacing`, letterSpacing);
    alias(aliasCol, `text/${name}/paragraphSpacing`, paragraphSpacing);
  });

  // -----------------------------
// COMPONENT GROUPS (SMART 🔥)
// -----------------------------

if (primary) {
  alias(component, "component/surface/primary", primary.variable);
}

if (darkest) {
  alias(component, "component/text/primary", darkest.variable);
  alias(component, "component/icon/primary", darkest.variable);
  alias(component, "component/border/default", darkest.variable);
}

if (lightest) {
  alias(component, "component/text/inverse", lightest.variable);
  alias(component, "component/icon/inverse", lightest.variable);
}

brightnessMap.forEach(item => {
  alias(component, `component/surface/${item.name}`, item.variable);
});

  figma.notify("✅ Typography + color tokens created!");
}

// ============================================================
// 2 TIER APPROACH
// A streamlined two-layer token system: Global → Alias.
// Ideal for smaller projects or teams beginning their token
// journey, without the overhead of a component mapping layer.
// ============================================================

// -----------------------------
// STARTER SYSTEM (2 TIER)
// -----------------------------
function createStarterSystem2Tier() {

  const global = figma.variables.createVariableCollection("01 Global");
  const aliasCol = figma.variables.createVariableCollection("02 Alias");

  // Colors
  const brand = createColor(global, "color/brand", 0.6, 0, 1);
  const white = createColor(global, "color/white", 1, 1, 1);
  const black = createColor(global, "color/black", 0.1, 0.1, 0.1);

  // Spacing / Radius
  const space16 = createNumber(global, "spacing/16", 16);
  const radius8 = createNumber(global, "radius/8", 8);

  // Typography
  const fontSize = createNumber(global, "typography/fontSize/body", 16);
  const lineHeight = createNumber(global, "typography/lineHeight/body", 24);
  const letterSpacing = createNumber(global, "typography/letterSpacing/body", 0);
  const paragraphSpacing = createNumber(global, "typography/paragraphSpacing/body", 8);

  // Alias
  alias(aliasCol, "surface/primary", brand);
  alias(aliasCol, "text/primary", black);
  alias(aliasCol, "text/inverse", white);
  alias(aliasCol, "text/body/fontSize", fontSize);
  alias(aliasCol, "text/body/lineHeight", lineHeight);
  alias(aliasCol, "text/body/letterSpacing", letterSpacing);
  alias(aliasCol, "text/body/paragraphSpacing", paragraphSpacing);
}

// -----------------------------
// SMART CONVERT (2 TIER)
// -----------------------------
function convertStylesToTokens2Tier() {

  const colorStyles = figma.getLocalPaintStyles();
  const textStyles = figma.getLocalTextStyles();

  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify("⚠️ No styles found");
    return;
  }

  const global = figma.variables.createVariableCollection("01 Global");
  const aliasCol = figma.variables.createVariableCollection("02 Alias");

  const brightnessMap = [];

  // 🎨 COLORS
  colorStyles.forEach(style => {
    const paint = style.paints[0];
    if (!paint || paint.type !== "SOLID") return;

    const name = style.name.replace(/\s+/g, "-").toLowerCase();

    const v = figma.variables.createVariable(`color/${name}`, global.id, "COLOR");

    v.setValueForMode(global.modes[0].modeId, {
      r: paint.color.r,
      g: paint.color.g,
      b: paint.color.b,
      a: 1
    });

    brightnessMap.push({
      name,
      brightness: paint.color.r + paint.color.g + paint.color.b,
      variable: v
    });
  });

  brightnessMap.sort((a, b) => a.brightness - b.brightness);

  const darkest = brightnessMap[0];
  const lightest = brightnessMap[brightnessMap.length - 1];
  const primary = brightnessMap[Math.floor(brightnessMap.length / 2)];

  if (primary) alias(aliasCol, "surface/primary", primary.variable);
  if (darkest) alias(aliasCol, "text/primary", darkest.variable);
  if (lightest) alias(aliasCol, "text/inverse", lightest.variable);

  // 🔤 TYPOGRAPHY
  textStyles.forEach(style => {

    const name = style.name.replace(/\s+/g, "-").toLowerCase();

    const fontSize = createNumber(global, `typography/fontSize/${name}`, style.fontSize);

    const lineHeightValue =
      style.lineHeight.unit === "AUTO"
        ? style.fontSize * 1.4
        : style.lineHeight.value;

    const lineHeight = createNumber(global, `typography/lineHeight/${name}`, lineHeightValue);

    const letterSpacingValue =
      style.letterSpacing.unit === "PERCENT"
        ? style.fontSize * (style.letterSpacing.value / 100)
        : style.letterSpacing.value;

    const letterSpacing = createNumber(global, `typography/letterSpacing/${name}`, letterSpacingValue);

    const paragraphSpacing = createNumber(
      global,
      `typography/paragraphSpacing/${name}`,
      style.paragraphSpacing || 0
    );

    alias(aliasCol, `text/${name}/fontSize`, fontSize);
    alias(aliasCol, `text/${name}/lineHeight`, lineHeight);
    alias(aliasCol, `text/${name}/letterSpacing`, letterSpacing);
    alias(aliasCol, `text/${name}/paragraphSpacing`, paragraphSpacing);
  });

  figma.notify("✅ Typography + color tokens created!");
}

// -----------------------------
// MAIN
// -----------------------------
async function runGeneration(approach, mode) {

  if (tokensExist()) {
    figma.ui.postMessage({ type: "confirm-replace" });
    return;
  }

  generate(approach, mode);
}

function generate(approach, mode) {

  deleteAllCollections();

  if (approach === "3tier") {
    if (mode === "starter") createStarterSystem();
    if (mode === "convert") convertStylesToTokens();
  } else if (approach === "2tier") {
    if (mode === "starter") createStarterSystem2Tier();
    if (mode === "convert") convertStylesToTokens2Tier();
  }

  figma.notify("✅ Done!");
}

// -----------------------------
// MESSAGES
// -----------------------------
figma.ui.onmessage = (msg) => {

  if (msg.type === "generate") {
    runGeneration(msg.approach, msg.mode);
  }

  if (msg.type === "confirm-continue") {
    generate(msg.approach, msg.mode);
  }
};
