var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
  const DEFAULT_EXPORT_OPTIONS = {
    designMd: true,
    componentDocs: true,
    tokensJson: false,
    cssFile: false,
    componentsJson: false,
    includeText: true,
    includeVariantDiffs: true,
    includeInstanceInternals: true,
    includeVectorShapes: true,
    includeImages: true,
    splitComponentsJson: "auto",
    zip: true
  };
  function sanitizeSavedSettings(value) {
    if (typeof value !== "object" || value === null) return null;
    const stored = value.options;
    if (typeof stored !== "object" || stored === null) return null;
    const options = { ...DEFAULT_EXPORT_OPTIONS };
    for (const key of Object.keys(DEFAULT_EXPORT_OPTIONS)) {
      const candidate = stored[key];
      if (typeof candidate === "boolean" && typeof DEFAULT_EXPORT_OPTIONS[key] === "boolean") {
        options[key] = candidate;
      }
    }
    const split = stored.splitComponentsJson;
    if (split === "auto" || split === "always") options.splitComponentsJson = split;
    return { options };
  }
  const EMPTY_FILE_SETTINGS = { excludedPages: [], contrastPairs: [] };
  const isString = (v) => typeof v === "string";
  function sanitizeFileSettings(value) {
    if (typeof value !== "object" || value === null) return EMPTY_FILE_SETTINGS;
    const { excludedPages, contrastPairs } = value;
    return {
      excludedPages: Array.isArray(excludedPages) ? excludedPages.filter(isString) : [],
      contrastPairs: Array.isArray(contrastPairs) ? contrastPairs.flatMap((pair) => {
        const { foreground, background } = pair ?? {};
        return isString(foreground) && isString(background) ? [{ foreground, background }] : [];
      }) : []
    };
  }
  function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  function createTimeSlicer(intervalMs = 12, now = Date.now) {
    let last = now();
    return async () => {
      if (now() - last < intervalMs) return;
      await yieldToEventLoop();
      last = now();
    };
  }
  let cancelCheck = null;
  function isCancelled() {
    return (cancelCheck == null ? void 0 : cancelCheck()) === true;
  }
  async function withCancellation(check, fn) {
    const previous = cancelCheck;
    cancelCheck = check;
    try {
      return await fn();
    } finally {
      cancelCheck = previous;
    }
  }
  async function processInBatches(items, batchSize, fn, onBatch) {
    const results = new Array(items.length);
    for (let start = 0; start < items.length; start += batchSize) {
      if (isCancelled()) {
        results.length = start;
        return results;
      }
      const end = Math.min(start + batchSize, items.length);
      const batch = await Promise.all(
        items.slice(start, end).map((item, offset) => fn(item, start + offset))
      );
      batch.forEach((result, offset) => {
        results[start + offset] = result;
      });
      onBatch == null ? void 0 : onBatch(end, items.length);
      await yieldToEventLoop();
    }
    return results;
  }
  async function safely(fn, onError) {
    try {
      return await fn();
    } catch (err) {
      onError(err);
      return void 0;
    }
  }
  function toPathSegments(name) {
    return name.split("/").map((segment) => segment.trim()).filter(Boolean);
  }
  function kebabCase(input) {
    return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }
  function nameSegments(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  function nameHasHint(name, hints) {
    const segments = nameSegments(name);
    return hints.some((hint) => {
      const words2 = nameSegments(hint);
      for (let start = 0; start + words2.length <= segments.length; start++) {
        const matches = words2.every((word, i) => {
          const segment = segments[start + i];
          return segment === word || i === words2.length - 1 && segment === `${word}s`;
        });
        if (matches) return true;
      }
      return false;
    });
  }
  function toCssVarName(pathSegments) {
    const slug = pathSegments.map(kebabCase).filter(Boolean).join("-");
    return `--${slug}`;
  }
  function toFileSafeName(name) {
    const cleaned = name.replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, " ");
    const pascal = cleaned.replace(/^[.\s]+|[.\s]+$/g, "").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
    return pascal || "Component";
  }
  const FONT_WEIGHT_KEYWORDS = [
    [/thin|hairline/, 100],
    [/extra[\s-]?light|ultra[\s-]?light/, 200],
    [/light/, 300],
    [/medium/, 500],
    [/semi[\s-]?bold|demi[\s-]?bold/, 600],
    [/extra[\s-]?bold|ultra[\s-]?bold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700]
  ];
  function fontWeightFromStyle(style) {
    const lower = style.toLowerCase();
    for (const [pattern, weight] of FONT_WEIGHT_KEYWORDS) {
      if (pattern.test(lower)) return weight;
    }
    return 400;
  }
  function rgbaToHex(r, g, b, a) {
    const toByte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const toHexByte = (v) => toByte(v).toString(16).padStart(2, "0");
    const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return a < 1 ? `${base}${toHexByte(a)}` : base;
  }
  function cleanPropertyName(key) {
    return key.replace(/#\d+:\d+$/, "");
  }
  const UNKNOWN_FONT = "Unknown";
  const isKnownFont = (family) => !!family && family !== UNKNOWN_FONT;
  const STYLE_BATCH_SIZE = 200;
  function boundVariablesOf(node) {
    return collectBoundVariableIds(node.boundVariables);
  }
  function collectBoundVariableIds(boundVariables) {
    const ids = [];
    const visit = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value === "object") {
        const obj = value;
        if (obj.type === "VARIABLE_ALIAS" && typeof obj.id === "string") {
          ids.push(obj.id);
          return;
        }
        Object.values(obj).forEach(visit);
      }
    };
    visit(boundVariables);
    return Array.from(new Set(ids));
  }
  const tidy = (value) => Math.round(value * 100) / 100;
  function formatLineHeight(lineHeight) {
    if (lineHeight.unit === "AUTO") return "AUTO";
    return `${tidy(lineHeight.value)}${lineHeight.unit === "PERCENT" ? "%" : "px"}`;
  }
  function formatLetterSpacing(letterSpacing) {
    return `${tidy(letterSpacing.value)}${letterSpacing.unit === "PERCENT" ? "%" : "px"}`;
  }
  async function extractStyles(label, load, map, onProgress, onWarning) {
    const styles = await safely(
      load,
      (err) => (onWarning ?? (() => {
      }))(`Failed to load ${label}: ${String(err)}`)
    );
    return processInBatches(styles ?? [], STYLE_BATCH_SIZE, map, onProgress);
  }
  function mapTextStyle(s) {
    var _a, _b, _c;
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      fontFamily: ((_a = s.fontName) == null ? void 0 : _a.family) ?? UNKNOWN_FONT,
      fontStyle: ((_b = s.fontName) == null ? void 0 : _b.style) ?? "Regular",
      fontWeight: fontWeightFromStyle(((_c = s.fontName) == null ? void 0 : _c.style) ?? "Regular"),
      fontSize: tidy(s.fontSize ?? 0),
      lineHeight: s.lineHeight ? formatLineHeight(s.lineHeight) : "AUTO",
      letterSpacing: s.letterSpacing ? formatLetterSpacing(s.letterSpacing) : "0px",
      textCase: s.textCase ?? "ORIGINAL",
      textDecoration: s.textDecoration ?? "NONE",
      paragraphSpacing: tidy(s.paragraphSpacing ?? 0),
      boundVariableIds: boundVariablesOf(s)
    };
  }
  function extractTextStyles(onProgress, onWarning) {
    return extractStyles(
      "text styles",
      () => figma.getLocalTextStylesAsync(),
      mapTextStyle,
      onProgress,
      onWarning
    );
  }
  function mapPaintStyle(s) {
    {
      const paints = s.paints ?? [];
      const solid = paints.find((p) => p.type === "SOLID" && p.visible !== false);
      const hasNonSolid = paints.some((p) => p.type !== "SOLID");
      return {
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        color: solid ? { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 } : null,
        isGradientOrImage: hasNonSolid || !solid,
        boundVariableIds: boundVariablesOf(s)
      };
    }
  }
  function extractPaintStyles(onProgress, onWarning) {
    return extractStyles(
      "color styles",
      () => figma.getLocalPaintStylesAsync(),
      mapPaintStyle,
      onProgress,
      onWarning
    );
  }
  function mapEffect(e) {
    const base = { type: e.type, visible: e.visible };
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      base.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a };
      base.offsetX = e.offset.x;
      base.offsetY = e.offset.y;
      base.radius = e.radius;
      base.spread = e.spread ?? 0;
    } else if (e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR") {
      base.radius = e.radius;
    }
    return base;
  }
  function mapEffectStyle(s) {
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      effects: (s.effects ?? []).map(mapEffect),
      boundVariableIds: boundVariablesOf(s)
    };
  }
  function extractEffectStyles(onProgress, onWarning) {
    return extractStyles(
      "effect styles",
      () => figma.getLocalEffectStylesAsync(),
      mapEffectStyle,
      onProgress,
      onWarning
    );
  }
  function mapGrid(g) {
    return {
      pattern: g.pattern,
      sectionSize: "sectionSize" in g ? g.sectionSize : void 0,
      count: "count" in g ? g.count : void 0,
      gutterSize: "gutterSize" in g ? g.gutterSize : void 0,
      offset: "offset" in g ? g.offset : void 0,
      alignment: "alignment" in g ? g.alignment : void 0
    };
  }
  function mapGridStyle(s) {
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      grids: (s.layoutGrids ?? []).map(mapGrid)
    };
  }
  function extractGridStyles(onProgress, onWarning) {
    return extractStyles(
      "grid styles",
      () => figma.getLocalGridStylesAsync(),
      mapGridStyle,
      onProgress,
      onWarning
    );
  }
  async function fontOfTextLayer(nodeId) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type !== "TEXT") return {};
      let font = node.fontName;
      if (typeof font !== "object" || font === null) font = node.getRangeFontName(0, 1);
      const { family, style } = font;
      if (typeof family !== "string" || family === "") return {};
      const fontStyle = typeof style === "string" ? style : "Regular";
      return { fontFamily: family, fontStyle, fontWeight: fontWeightFromStyle(fontStyle) };
    } catch {
      return {};
    }
  }
  async function extractLibraryStyles(ids, textSamples = {}) {
    const found = {
      text: [],
      paint: [],
      effect: [],
      grid: [],
      unavailable: [],
      idMismatches: []
    };
    const results = await processInBatches([...ids], 20, async (id) => {
      const style = await safely(
        () => figma.getStyleByIdAsync(id),
        () => void 0
      );
      return { id, style: style ?? null };
    });
    for (const { id, style } of results) {
      if (!style) {
        found.unavailable.push(id);
        continue;
      }
      if (style.id !== id) found.idMismatches.push({ requested: id, returned: style.id });
      switch (style.type) {
        case "TEXT": {
          const mapped = { ...mapTextStyle(style), id, library: true };
          if (mapped.fontFamily === UNKNOWN_FONT && textSamples[id]) {
            Object.assign(mapped, await fontOfTextLayer(textSamples[id]));
          }
          found.text.push(mapped);
          break;
        }
        case "PAINT":
          found.paint.push({ ...mapPaintStyle(style), id, library: true });
          break;
        case "EFFECT":
          found.effect.push({ ...mapEffectStyle(style), id, library: true });
          break;
        case "GRID":
          found.grid.push({ ...mapGridStyle(style), id, library: true });
          break;
        default:
          found.unavailable.push(id);
      }
    }
    return found;
  }
  const COMPONENT_BATCH_SIZE = 20;
  const MAX_DESCENDANTS_SCANNED = 500;
  const MAX_DESCENDANT_DEPTH = 10;
  const STYLE_ID_KEYS = [
    "textStyleId",
    "fillStyleId",
    "strokeStyleId",
    "effectStyleId",
    "gridStyleId"
  ];
  function findPageName(node) {
    let current = node;
    while (current) {
      if (current.type === "PAGE") return current.name;
      current = current.parent;
    }
    return "Unknown Page";
  }
  function isHiddenFromPublishing(node) {
    let current = node;
    while (current) {
      if (current.name.trim().startsWith(".")) return true;
      if (current.type === "PAGE") return false;
      current = current.parent;
    }
    return false;
  }
  function readStyleIds(n, into, textSamples) {
    for (const key of STYLE_ID_KEYS) {
      try {
        const value = n[key];
        if (typeof value === "string" && value !== "") {
          into.add(value);
          if (key === "textStyleId" && textSamples && !(value in textSamples)) {
            textSamples[value] = n.id;
          }
        }
      } catch {
      }
    }
  }
  async function scanNodeBindings(node, yieldIfDue, counters) {
    const variableIds = /* @__PURE__ */ new Set();
    const styleIds = /* @__PURE__ */ new Set();
    const textStyleSamples = {};
    let scanned = 0;
    let truncated = false;
    const visit = async (n, depth) => {
      if (scanned >= MAX_DESCENDANTS_SCANNED || depth > MAX_DESCENDANT_DEPTH) {
        truncated = true;
        return;
      }
      scanned++;
      if (counters) counters.nodes++;
      await yieldIfDue();
      boundVariablesOf(n).forEach((id) => variableIds.add(id));
      readStyleIds(n, styleIds, textStyleSamples);
      if (n.type === "INSTANCE") return;
      if ("children" in n) {
        for (const child of n.children) {
          await visit(child, depth + 1);
        }
      }
    };
    await visit(node, 0);
    return {
      variableIds: Array.from(variableIds),
      styleIds: Array.from(styleIds),
      textStyleSamples,
      truncated
    };
  }
  function numberProp(n, key) {
    try {
      const value = n[key];
      return typeof value === "number" && Number.isFinite(value) ? value : void 0;
    } catch {
      return void 0;
    }
  }
  const round$1 = (value) => Math.round(value * 100) / 100;
  function readLayout$1(node) {
    const width = numberProp(node, "width");
    const height = numberProp(node, "height");
    if (width === void 0 || height === void 0) return void 0;
    const mode = node.layoutMode;
    const layoutMode = mode === "HORIZONTAL" || mode === "VERTICAL" ? mode : "NONE";
    const layout = {
      measuredFrom: node.name,
      width: round$1(width),
      height: round$1(height),
      layoutMode
    };
    if (layoutMode !== "NONE") {
      const gap = numberProp(node, "itemSpacing");
      if (gap !== void 0) layout.gap = round$1(gap);
      const [top, right, bottom, left] = [
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft"
      ].map((key) => numberProp(node, key));
      if ([top, right, bottom, left].every((p) => p !== void 0)) {
        layout.padding = {
          top: round$1(top),
          right: round$1(right),
          bottom: round$1(bottom),
          left: round$1(left)
        };
      }
    }
    const radius = numberProp(node, "cornerRadius");
    if (radius !== void 0 && radius > 0) layout.cornerRadius = round$1(radius);
    return layout;
  }
  async function resolveDefaultName(id) {
    var _a;
    if (typeof id !== "string" || id === "") return void 0;
    try {
      const target = await figma.getNodeByIdAsync(id);
      if (!target) return void 0;
      return ((_a = target.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? target.parent.name : target.name;
    } catch {
      return void 0;
    }
  }
  async function mapPropertyDefinitions(defs) {
    if (!defs) return [];
    return Promise.all(
      Object.entries(defs).map(async ([name, def]) => {
        const property = {
          name,
          type: def.type,
          defaultValue: String(def.defaultValue ?? ""),
          variantOptions: def.variantOptions
        };
        if (def.type === "INSTANCE_SWAP") {
          const resolved = await resolveDefaultName(def.defaultValue);
          if (resolved) property.defaultResolvedName = resolved;
        }
        return property;
      })
    );
  }
  async function mapVariant(node, yieldIfDue, counters) {
    const bindings = await scanNodeBindings(node, yieldIfDue, counters);
    return {
      variant: {
        id: node.id,
        name: node.name,
        description: node.description ?? "",
        variantProperties: node.variantProperties ?? {},
        boundVariableIds: bindings.variableIds
      },
      bindings
    };
  }
  function defaultVariantOf(set, members) {
    const declared = set.defaultVariant;
    return declared && members.some((m) => m.id === declared.id) ? declared : members[0];
  }
  function unionOf(lists) {
    return Array.from(new Set(lists.flat()));
  }
  const findComponentLike = (root) => root.findAllWithCriteria({
    types: ["COMPONENT", "COMPONENT_SET"]
  });
  async function findInDocument(warn, onPage) {
    const found = [];
    const pages = figma.root.children;
    let loadedAll = false;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (isCancelled()) break;
      onPage == null ? void 0 : onPage(i, pages.length, page.name);
      if (typeof page.loadAsync === "function") {
        await safely(
          () => page.loadAsync(),
          (err) => warn(`Failed to load page "${page.name}": ${String(err)}`)
        );
      } else if (!loadedAll) {
        loadedAll = true;
        await safely(
          () => figma.loadAllPagesAsync(),
          (err) => warn(`Failed to load all pages for component scan: ${String(err)}`)
        );
      }
      const hits = await safely(
        () => Promise.resolve(findComponentLike(page)),
        (err) => warn(`Failed to scan page "${page.name}" for components: ${String(err)}`)
      );
      found.push(...hits ?? []);
      await yieldToEventLoop();
    }
    onPage == null ? void 0 : onPage(pages.length, pages.length, "");
    return found;
  }
  function findComponentsWithin(roots) {
    const found = /* @__PURE__ */ new Map();
    const add = (n) => {
      var _a;
      const target = n.type === "COMPONENT" && ((_a = n.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? n.parent : n;
      found.set(target.id, target);
    };
    for (const root of roots) {
      if (root.type === "COMPONENT" || root.type === "COMPONENT_SET") add(root);
      if ("findAllWithCriteria" in root) {
        for (const n of findComponentLike(root)) add(n);
      }
    }
    return Array.from(found.values());
  }
  async function extractComponents(onProgress, onWarning, selection, onPage) {
    var _a;
    const warn = onWarning ?? (() => {
    });
    if (isCancelled()) return [];
    const scanStarted = Date.now();
    const nodes = selection ? await safely(
      () => Promise.resolve(findComponentsWithin(selection)),
      (err) => warn(`Failed to scan selection for components: ${String(err)}`)
    ) : await findInDocument(warn, onPage);
    const yieldIfDue = createTimeSlicer();
    const counters = { nodes: 0 };
    const searchedIn = Date.now() - scanStarted;
    const allNodes = nodes ?? [];
    const componentSetsAll = [];
    const standaloneComponentsAll = [];
    const componentSets = [];
    const standaloneComponents = [];
    for (const n of allNodes) {
      await yieldIfDue();
      if (n.type === "COMPONENT_SET") {
        componentSetsAll.push(n);
        if (!isHiddenFromPublishing(n)) componentSets.push(n);
      } else if (n.type === "COMPONENT" && ((_a = n.parent) == null ? void 0 : _a.type) !== "COMPONENT_SET") {
        standaloneComponentsAll.push(n);
        if (!isHiddenFromPublishing(n)) standaloneComponents.push(n);
      }
    }
    const hiddenCount = componentSetsAll.length - componentSets.length + (standaloneComponentsAll.length - standaloneComponents.length);
    if (hiddenCount > 0) {
      warn(
        `Skipped ${hiddenCount} component(s)/component set(s) hidden from publishing (name, or an ancestor frame/section/page, starts with ".").`
      );
    }
    let truncatedCount = 0;
    const fromSets = await processInBatches(
      componentSets,
      COMPONENT_BATCH_SIZE,
      async (set) => {
        const variantMembers = set.children.filter((c) => c.type === "COMPONENT");
        const mapped = await Promise.all(
          variantMembers.map((m) => mapVariant(m, yieldIfDue, counters))
        );
        if (mapped.some((m) => m.bindings.truncated)) truncatedCount++;
        return {
          id: set.id,
          key: set.key ?? set.id,
          name: set.name,
          description: set.description ?? "",
          isComponentSet: true,
          pageName: findPageName(set),
          properties: await mapPropertyDefinitions(set.componentPropertyDefinitions),
          variants: mapped.map((m) => m.variant),
          layout: variantMembers.length > 0 ? readLayout$1(defaultVariantOf(set, variantMembers)) : void 0,
          boundVariableIds: unionOf(mapped.map((m) => m.bindings.variableIds)),
          styleIds: unionOf(mapped.map((m) => m.bindings.styleIds)),
          textStyleSamples: Object.assign({}, ...mapped.map((m) => m.bindings.textStyleSamples))
        };
      },
      onProgress
    );
    const fromStandalone = await processInBatches(
      standaloneComponents,
      COMPONENT_BATCH_SIZE,
      async (node) => {
        const { variant, bindings } = await mapVariant(node, yieldIfDue, counters);
        if (bindings.truncated) truncatedCount++;
        return {
          id: node.id,
          key: node.key ?? node.id,
          name: node.name,
          description: node.description ?? "",
          isComponentSet: false,
          pageName: findPageName(node),
          properties: await mapPropertyDefinitions(node.componentPropertyDefinitions),
          variants: [variant],
          layout: readLayout$1(node),
          boundVariableIds: bindings.variableIds,
          styleIds: bindings.styleIds,
          textStyleSamples: bindings.textStyleSamples
        };
      },
      onProgress
    );
    if (truncatedCount > 0) {
      warn(
        `${truncatedCount} component(s) are larger than the scan budget (${MAX_DESCENDANTS_SCANNED} layers, ${MAX_DESCENDANT_DEPTH} levels deep), so their token usage may be under-reported.`
      );
    }
    const total = Date.now() - scanStarted;
    console.log(
      `[DesignMD] components: finding them took ${(searchedIn / 1e3).toFixed(1)}s (${allNodes.length} found), reading their bindings took ${((total - searchedIn) / 1e3).toFixed(1)}s (${counters.nodes} layers over ${fromSets.length + fromStandalone.length} components and sets)`
    );
    return [...fromSets, ...fromStandalone];
  }
  const VARIABLE_BATCH_SIZE = 200;
  function toRawValue(value) {
    if (value === null || value === void 0) return { kind: "unknown" };
    if (typeof value === "boolean") return { kind: "boolean", value };
    if (typeof value === "number") return { kind: "float", value };
    if (typeof value === "string") return { kind: "string", value };
    if (typeof value === "object") {
      if ("type" in value && value.type === "VARIABLE_ALIAS") {
        return { kind: "alias", variableId: value.id };
      }
      if ("r" in value && "g" in value && "b" in value) {
        const rgba2 = value;
        return {
          kind: "color",
          r: rgba2.r,
          g: rgba2.g,
          b: rgba2.b,
          a: "a" in rgba2 ? rgba2.a : 1
        };
      }
    }
    return { kind: "unknown" };
  }
  async function extractVariableCollections(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    const figmaCollections = await safely(
      () => figma.variables.getLocalVariableCollectionsAsync(),
      (err) => warn(`Failed to load variable collections: ${String(err)}`)
    );
    const collections = (figmaCollections ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      variableIds: c.variableIds,
      hiddenFromPublishing: Boolean(c.hiddenFromPublishing)
    }));
    const collectionById = new Map(collections.map((c) => [c.id, c]));
    const allVariableIds = Array.from(new Set(collections.flatMap((c) => c.variableIds)));
    const variables = (await processInBatches(
      allVariableIds,
      VARIABLE_BATCH_SIZE,
      async (id) => {
        const v = await safely(
          () => figma.variables.getVariableByIdAsync(id),
          (err) => warn(`Failed to load variable ${id}: ${String(err)}`)
        );
        if (!v) return null;
        const collection = collectionById.get(v.variableCollectionId);
        const valuesByMode = Object.entries(v.valuesByMode).map(([modeId, value]) => ({
          modeId,
          value: toRawValue(value)
        }));
        const raw = {
          id: v.id,
          name: v.name,
          variableCollectionId: v.variableCollectionId,
          resolvedType: v.resolvedType,
          description: v.description ?? "",
          scopes: v.scopes ?? [],
          codeSyntax: v.codeSyntax ?? {},
          valuesByMode,
          hiddenFromPublishing: Boolean(v.hiddenFromPublishing)
        };
        if (!collection) {
          warn(`Variable "${v.name}" references missing collection ${v.variableCollectionId}`);
        }
        return raw;
      },
      onProgress
    )).filter((v) => v !== null);
    return { collections, variables };
  }
  async function extractDesignSystem(onProgress, options = {}) {
    const warnings = [];
    const warn = (message) => warnings.push(message);
    const timings = [];
    const timed = async (label, run, count) => {
      const started = Date.now();
      const result = await run();
      timings.push(`${label} ${count(result)} in ${((Date.now() - started) / 1e3).toFixed(1)}s`);
      return result;
    };
    const { collections, variables } = await timed(
      "variables",
      () => extractVariableCollections(
        (done, total) => onProgress == null ? void 0 : onProgress({ stage: "variables", done, total }),
        warn
      ),
      (r) => r.variables.length
    );
    const textStyles = await timed(
      "text styles",
      () => extractTextStyles((done, total) => onProgress == null ? void 0 : onProgress({ stage: "text-styles", done, total }), warn),
      (r) => r.length
    );
    const paintStyles = await timed(
      "color styles",
      () => extractPaintStyles(
        (done, total) => onProgress == null ? void 0 : onProgress({ stage: "color-styles", done, total }),
        warn
      ),
      (r) => r.length
    );
    const effectStyles = await timed(
      "effect styles",
      () => extractEffectStyles(
        (done, total) => onProgress == null ? void 0 : onProgress({ stage: "effect-styles", done, total }),
        warn
      ),
      (r) => r.length
    );
    const gridStyles = await timed(
      "grid styles",
      () => extractGridStyles((done, total) => onProgress == null ? void 0 : onProgress({ stage: "grid-styles", done, total }), warn),
      (r) => r.length
    );
    const components = await timed(
      "components",
      () => extractComponents(
        (done, total) => onProgress == null ? void 0 : onProgress({ stage: "components", done, total }),
        warn,
        options.selection,
        (done, total, name) => onProgress == null ? void 0 : onProgress({ stage: "pages", done, total, detail: name })
      ),
      (r) => r.length
    );
    const localStyleIds = new Set(
      [...textStyles, ...paintStyles, ...effectStyles, ...gridStyles].map((s) => s.id)
    );
    const libraryIds = Array.from(
      new Set(components.flatMap((c) => c.styleIds ?? []).filter((id) => !localStyleIds.has(id)))
    );
    if (libraryIds.length > 0) {
      const library = await timed(
        "library styles",
        () => extractLibraryStyles(
          libraryIds,
          Object.assign({}, ...components.map((c) => c.textStyleSamples ?? {}))
        ),
        (r) => r.text.length + r.paint.length + r.effect.length + r.grid.length
      );
      if (library.idMismatches.length > 0) {
        const sample = library.idMismatches[0];
        console.log(
          `[DesignMD] ${library.idMismatches.length} library style(s) report a different id than the one layers use, e.g. asked for ${sample.requested}, got ${sample.returned}; they are kept under the id layers use`
        );
      }
      textStyles.push(...library.text);
      paintStyles.push(...library.paint);
      effectStyles.push(...library.effect);
      gridStyles.push(...library.grid);
      if (library.unavailable.length > 0 && !isCancelled()) {
        warn(
          `${library.unavailable.length} style(s) used by components could not be read (the library they come from may not be available to this file), so their token links are left out. Their values are kept.`
        );
      }
    }
    console.log(`[DesignMD] scan: ${timings.join(", ")}`);
    if (isCancelled()) {
      warn("The scan was cancelled before it finished, so these results are partial.");
    } else if (collections.length === 0 && variables.length === 0) {
      warn("No local variables found — falling back to styles as the token source of truth.");
    }
    if (components.length === 0 && !isCancelled()) {
      warn(
        options.selection ? "No components or component sets found in the selection." : "No components or component sets found in this file."
      );
    }
    return {
      collections,
      variables,
      textStyles,
      paintStyles,
      effectStyles,
      gridStyles,
      components,
      warnings
    };
  }
  const MAX_LAYERS = 2e3;
  const MAX_DEPTH = 16;
  const MAX_VECTOR_CHARS = 6e4;
  const MAX_OVERRIDES = 100;
  const CLIPPING_TYPES = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);
  const VECTOR_TYPES$1 = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"]);
  const newReadStats = () => ({
    layers: 0,
    trees: 0,
    instanceLookups: 0,
    instanceMs: 0
  });
  const round2 = (n) => Math.round(n * 100) / 100;
  const round3 = (n) => Math.round(n * 1e3) / 1e3;
  function read(n, key) {
    try {
      return n[key];
    } catch {
      return void 0;
    }
  }
  function num(n, key) {
    const v = read(n, key);
    return typeof v === "number" && Number.isFinite(v) ? v : void 0;
  }
  function str(n, key) {
    const v = read(n, key);
    return typeof v === "string" ? v : void 0;
  }
  function oneOf(v, allowed, fallback) {
    return typeof v === "string" && allowed.includes(v) ? v : fallback;
  }
  const hex2 = (c) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, "0");
  function hexOf(color) {
    const r = num(color, "r");
    const g = num(color, "g");
    const b = num(color, "b");
    return r === void 0 || g === void 0 || b === void 0 ? void 0 : `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  function rgba(color, alphaOverride) {
    const hex = hexOf(color);
    if (!hex) return void 0;
    const to255 = (k) => Math.round((num(color, k) ?? 0) * 255);
    return {
      hex,
      alpha: round3(num(color, "a") ?? 1),
      r: to255("r"),
      g: to255("g"),
      b: to255("b")
    };
  }
  class Tracker {
    constructor(resolve, images = false) {
      __publicField(this, "variables", /* @__PURE__ */ new Set());
      __publicField(this, "styles", /* @__PURE__ */ new Set());
      __publicField(this, "warnings", []);
      __publicField(this, "unresolved", /* @__PURE__ */ new Set());
      __publicField(this, "fonts", /* @__PURE__ */ new Map());
      __publicField(this, "gradientWarned", /* @__PURE__ */ new Set());
      this.resolve = resolve;
      this.images = images;
    }
    /** Whether token references are being looked up at all. */
    get resolves() {
      return !!this.resolve;
    }
    token(kind, id, layerId) {
      if (!id || !this.resolve) return void 0;
      const cssName = this.resolve(kind, id);
      if (cssName === void 0) {
        if (!this.unresolved.has(id)) {
          this.unresolved.add(id);
          this.warnings.push({
            code: "UNRESOLVED_REFERENCE",
            message: `The ${kind} ${id} is used by a layer but is not available (hidden from publishing or from another file), so its resolved value is used instead.`,
            layerId
          });
        }
        return void 0;
      }
      (kind === "variable" ? this.variables : this.styles).add(id);
      return kind === "variable" ? { variableId: id, cssName } : { styleId: id, cssName };
    }
  }
  function boundVariableId(holder, field) {
    const bound = read(holder, "boundVariables");
    const alias = bound && typeof bound === "object" ? bound[field] : void 0;
    const id = alias && typeof alias === "object" ? alias.id : void 0;
    return typeof id === "string" ? id : void 0;
  }
  const MAX_GRADIENT_STOPS = 32;
  function matrix2x3(v) {
    if (!Array.isArray(v) || v.length !== 2) return void 0;
    const rows = v.map(
      (row) => Array.isArray(row) && row.length === 3 && row.every((x) => typeof x === "number" && Number.isFinite(x)) ? row.map((x) => Math.round(x * 1e4) / 1e4) : void 0
    );
    return rows.every((r) => r) ? rows : void 0;
  }
  function readImage(p) {
    const hash = str(p, "imageHash");
    if (!hash) return void 0;
    const image = {
      hash,
      scaleMode: oneOf(read(p, "scaleMode"), ["FILL", "FIT", "CROP", "TILE"], "FILL")
    };
    const rotation = num(p, "rotation");
    if (rotation) image.rotation = round2(rotation);
    const scale = num(p, "scalingFactor");
    if (image.scaleMode === "TILE" && scale !== void 0) image.scalingFactor = round3(scale);
    const transform = read(p, "imageTransform");
    if (image.scaleMode === "CROP" && Array.isArray(transform)) {
      const rows = transform.map(
        (row) => Array.isArray(row) ? row.map((v) => typeof v === "number" ? round3(v) : 0) : []
      );
      if (rows.length === 2 && rows.every((r) => r.length === 3)) image.imageTransform = rows;
    }
    return image;
  }
  function inverse(m) {
    const [[a, b, c], [d, e, f]] = m;
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-9) return void 0;
    return (u, v) => ({
      x: (e * (u - c) - b * (v - f)) / det,
      y: (-d * (u - c) + a * (v - f)) / det
    });
  }
  function describeGradients(paints, size) {
    if (!paints || !size || size.width <= 0 || size.height <= 0) return;
    for (const paint of paints) {
      if (!paint.transform) continue;
      const at = inverse(paint.transform);
      if (!at) continue;
      if (paint.type === "GRADIENT_LINEAR") {
        const start = at(0, 0.5);
        const end = at(1, 0.5);
        const dx = (end.x - start.x) * size.width;
        const dy = (end.y - start.y) * size.height;
        const degrees = Math.atan2(dx, -dy) * 180 / Math.PI;
        paint.angle = round2((degrees + 360) % 360);
      } else if (paint.type === "GRADIENT_RADIAL") {
        const centre = at(0.5, 0.5);
        const right = at(1, 0.5);
        const bottom = at(0.5, 1);
        const length = (p) => Math.hypot((p.x - centre.x) * size.width, (p.y - centre.y) * size.height);
        const point = (x, y) => ({ x: round3(x), y: round3(y) });
        paint.center = point(centre.x, centre.y);
        paint.radii = point(length(right) / size.width, length(bottom) / size.height);
      }
    }
  }
  function readPaints(paints, styleId, layerId, t) {
    if (!Array.isArray(paints)) return void 0;
    return paints.map((p) => {
      const type = oneOf(
        read(p, "type"),
        [
          "SOLID",
          "GRADIENT_LINEAR",
          "GRADIENT_RADIAL",
          "GRADIENT_ANGULAR",
          "GRADIENT_DIAMOND",
          "IMAGE",
          "VIDEO",
          "PATTERN"
        ],
        "SOLID"
      );
      const paint = { type, visible: read(p, "visible") !== false };
      if (type === "SOLID") {
        const hex = hexOf(read(p, "color"));
        if (hex) paint.hex = hex;
        paint.alpha = round3(num(p, "opacity") ?? 1);
      } else if (type.startsWith("GRADIENT")) {
        const stops = read(p, "gradientStops");
        const count = Array.isArray(stops) ? stops.length : 0;
        paint.description = `${type.slice(9).toLowerCase()} gradient, ${count} stops`;
        const readStops = [];
        if (Array.isArray(stops)) {
          for (const stop of stops.slice(0, MAX_GRADIENT_STOPS)) {
            const color = rgba(read(stop, "color"));
            const position = num(stop, "position");
            if (color && position !== void 0) {
              readStops.push({ position: round3(position), hex: color.hex, alpha: color.alpha });
            }
          }
        }
        if (readStops.length > 0) paint.stops = readStops;
        const transform = matrix2x3(read(p, "gradientTransform"));
        if (transform) paint.transform = transform;
        paint.opacity = round3(num(p, "opacity") ?? 1);
        if ((type === "GRADIENT_ANGULAR" || type === "GRADIENT_DIAMOND") && !t.gradientWarned.has(type)) {
          t.gradientWarned.add(type);
          t.warnings.push({
            code: "UNSUPPORTED_GRADIENT",
            message: `A ${type.slice(9).toLowerCase()} gradient is used (first on layer ${layerId}). It has no CSS equivalent, so only its type, stops and transform are written.`,
            layerId
          });
        }
      } else if (type === "IMAGE") {
        paint.description = `image, scale mode ${str(p, "scaleMode") ?? "unknown"}`;
        const image = t.images ? readImage(p) : void 0;
        if (image) paint.image = image;
        const opacity = num(p, "opacity");
        if (opacity !== void 0 && opacity !== 1) paint.opacity = round3(opacity);
      }
      const blend = str(p, "blendMode");
      if (blend && blend !== "NORMAL") paint.blendMode = blend;
      const token = t.token("variable", boundVariableId(p, "color"), layerId) ?? t.token("style", styleId, layerId);
      if (token) paint.token = token;
      return paint;
    });
  }
  function readEffects(effects, styleId, layerId, t) {
    if (!Array.isArray(effects)) return void 0;
    const styleToken = t.token("style", styleId, layerId);
    return effects.map((e) => {
      const type = oneOf(
        read(e, "type"),
        ["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"],
        "DROP_SHADOW"
      );
      const effect = {
        type,
        visible: read(e, "visible") !== false,
        radius: round2(num(e, "radius") ?? 0)
      };
      const color = rgba(read(e, "color"));
      if (color) effect.color = color;
      const offset = read(e, "offset");
      if (offset && typeof offset === "object") {
        effect.offsetX = round2(num(offset, "x") ?? 0);
        effect.offsetY = round2(num(offset, "y") ?? 0);
      }
      if (num(e, "spread") !== void 0) effect.spread = round2(num(e, "spread"));
      if (styleToken) effect.token = styleToken;
      return effect;
    });
  }
  const hasItems = (v) => Array.isArray(v) && v.length > 0;
  function readStrokes(n, layerId, t) {
    const raw = read(n, "strokes");
    if (Array.isArray(raw) && raw.length === 0) return { paints: [], weight: 0, align: "INSIDE" };
    const paints = readPaints(raw, str(n, "strokeStyleId"), layerId, t);
    if (!paints) return void 0;
    const sides = {
      top: num(n, "strokeTopWeight"),
      right: num(n, "strokeRightWeight"),
      bottom: num(n, "strokeBottomWeight"),
      left: num(n, "strokeLeftWeight")
    };
    const sideValues = Object.values(sides).map((v) => v ?? 0);
    const strokes = {
      paints,
      // strokeWeight is figma.mixed when sides differ; use the largest side then.
      weight: round2(num(n, "strokeWeight") ?? Math.max(0, ...sideValues)),
      align: oneOf(read(n, "strokeAlign"), ["INSIDE", "CENTER", "OUTSIDE"], "INSIDE")
    };
    if (paints.length > 0 && Object.values(sides).every((v) => v !== void 0) && new Set(sideValues).size > 1) {
      strokes.sides = {
        top: round2(sides.top),
        right: round2(sides.right),
        bottom: round2(sides.bottom),
        left: round2(sides.left)
      };
    }
    if (paints.length > 0) {
      const dashes = read(n, "dashPattern");
      if (Array.isArray(dashes) && dashes.length > 0 && dashes.every((d) => typeof d === "number")) {
        strokes.dash = dashes.map(round2);
      }
      const cap = str(n, "strokeCap");
      if (cap && cap !== "NONE") strokes.cap = cap;
      const join = str(n, "strokeJoin");
      if (join && join !== "MITER") strokes.join = join;
      const miter = num(n, "strokeMiterLimit");
      if (join === "MITER" && miter !== void 0 && miter !== 4) strokes.miterLimit = round2(miter);
    }
    return strokes;
  }
  function readRadius(n) {
    const uniform = num(n, "cornerRadius");
    if (uniform !== void 0) return uniform > 0 ? round2(uniform) : void 0;
    const corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"].map(
      (k) => num(n, k)
    );
    if (corners.some((c) => c === void 0)) return void 0;
    const [tl, tr, br, bl] = corners.map((c) => round2(c));
    if (tl === tr && tr === br && br === bl) return tl > 0 ? tl : void 0;
    return { tl, tr, br, bl };
  }
  function readLayout(n) {
    const mode = read(n, "layoutMode");
    if (mode !== "HORIZONTAL" && mode !== "VERTICAL") return void 0;
    const pad = (k) => round2(num(n, k) ?? 0);
    return {
      mode,
      gap: round2(num(n, "itemSpacing") ?? 0),
      padding: {
        top: pad("paddingTop"),
        right: pad("paddingRight"),
        bottom: pad("paddingBottom"),
        left: pad("paddingLeft")
      },
      primaryAlign: oneOf(
        read(n, "primaryAxisAlignItems"),
        ["MIN", "CENTER", "MAX", "SPACE_BETWEEN"],
        "MIN"
      ),
      counterAlign: oneOf(
        read(n, "counterAxisAlignItems"),
        ["MIN", "CENTER", "MAX", "BASELINE"],
        "MIN"
      ),
      sizingH: oneOf(read(n, "layoutSizingHorizontal"), ["FIXED", "HUG", "FILL"], "FIXED"),
      sizingV: oneOf(read(n, "layoutSizingVertical"), ["FIXED", "HUG", "FILL"], "FIXED"),
      wrap: read(n, "layoutWrap") === "WRAP",
      ...layoutExtras(n)
    };
  }
  function layoutExtras(n) {
    const out = {};
    if (read(n, "layoutWrap") === "WRAP") {
      const gap = num(n, "counterAxisSpacing");
      if (gap !== void 0) out.counterGap = round2(gap);
      const content = read(n, "counterAxisAlignContent");
      if (content === "AUTO" || content === "SPACE_BETWEEN") out.counterAlignContent = content;
    }
    if (read(n, "itemReverseZIndex") === true) out.reverseZIndex = true;
    if (read(n, "strokesIncludedInLayout") === true) out.strokesIncludedInLayout = true;
    return out;
  }
  const AUTO_LAYOUT_MODES = ["HORIZONTAL", "VERTICAL"];
  const isAutoLayout = (n) => AUTO_LAYOUT_MODES.includes(read(n, "layoutMode"));
  function readPlacement(n) {
    return {
      positioning: read(n, "layoutPositioning") === "ABSOLUTE" ? "ABSOLUTE" : "AUTO",
      grow: num(n, "layoutGrow") ?? 0,
      align: oneOf(
        read(n, "layoutAlign"),
        ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"],
        "INHERIT"
      ),
      sizingH: oneOf(read(n, "layoutSizingHorizontal"), ["FIXED", "HUG", "FILL"], "FIXED"),
      sizingV: oneOf(read(n, "layoutSizingVertical"), ["FIXED", "HUG", "FILL"], "FIXED")
    };
  }
  function readConstraints(n) {
    const c = read(n, "constraints");
    const kinds = ["MIN", "CENTER", "MAX", "STRETCH", "SCALE"];
    const h = read(c, "horizontal");
    const v = read(c, "vertical");
    if (!kinds.includes(h) || !kinds.includes(v)) return void 0;
    return {
      horizontal: h,
      vertical: v
    };
  }
  function readSizeLimits(n) {
    const out = {};
    for (const key of ["minWidth", "maxWidth", "minHeight", "maxHeight"]) {
      const v = num(n, key);
      if (v !== void 0) out[key] = round2(v);
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function readGrids(n) {
    const raw = read(n, "layoutGrids");
    if (!Array.isArray(raw) || raw.length === 0) return void 0;
    return raw.flatMap((g) => {
      const pattern = read(g, "pattern");
      if (pattern !== "GRID" && pattern !== "COLUMNS" && pattern !== "ROWS") return [];
      const grid = { pattern, visible: read(g, "visible") !== false };
      const section = num(g, "sectionSize");
      if (section !== void 0) grid.sectionSize = round2(section);
      const count = num(g, "count");
      if (count !== void 0 && count > 0 && count < 1e6) grid.count = count;
      const gutter = num(g, "gutterSize");
      if (gutter !== void 0) grid.gutterSize = round2(gutter);
      const offset = num(g, "offset");
      if (offset !== void 0) grid.offset = round2(offset);
      const alignment = read(g, "alignment");
      if (alignment === "MIN" || alignment === "CENTER" || alignment === "MAX" || alignment === "STRETCH") {
        grid.alignment = alignment;
      }
      return [grid];
    });
  }
  const NON_NUMERIC_BINDINGS = /* @__PURE__ */ new Set([
    "fills",
    "strokes",
    "effects",
    "textRangeFills",
    "componentProperties"
  ]);
  function takeLayoutTokens(bindings) {
    const out = {};
    const take = (field) => {
      const token = bindings[field];
      delete bindings[field];
      return token;
    };
    const gap = take("itemSpacing");
    if (gap) out.gap = gap;
    const counter = take("counterAxisSpacing");
    if (counter) out.counterGap = counter;
    const padding = {};
    for (const [side, field] of [
      ["top", "paddingTop"],
      ["right", "paddingRight"],
      ["bottom", "paddingBottom"],
      ["left", "paddingLeft"]
    ]) {
      const token = take(field);
      if (token) padding[side] = token;
    }
    if (Object.keys(padding).length > 0) out.padding = padding;
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function readBindings(n, layerId, t) {
    if (!t.resolves) return void 0;
    const bound = read(n, "boundVariables");
    if (!bound || typeof bound !== "object") return void 0;
    const out = {};
    for (const field of Object.keys(bound).sort()) {
      if (NON_NUMERIC_BINDINGS.has(field)) continue;
      const alias = bound[field];
      const id = typeof alias === "object" && alias !== null && !Array.isArray(alias) ? alias.id : void 0;
      const token = typeof id === "string" ? t.token("variable", id, layerId) : void 0;
      if (token) out[field] = token;
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function unitValue(v) {
    const unit = read(v, "unit");
    const value = num(v, "value") ?? 0;
    if (unit === "AUTO") return { value: 0, unit: "auto" };
    if (unit === "PERCENT") return { value: round2(value), unit: "percent" };
    return { value: round2(value), unit: "px" };
  }
  function textFields(src, layerId, t, styleIdKey) {
    const fontName = read(src, "fontName");
    const family = str(fontName, "family");
    const fontSize = num(src, "fontSize");
    const fontWeight = num(src, "fontWeight");
    const lineHeight = read(src, "lineHeight");
    const letterSpacing = read(src, "letterSpacing");
    if (family === void 0 || fontSize === void 0 || typeof lineHeight !== "object" || typeof letterSpacing !== "object") {
      return void 0;
    }
    const fields = {
      fontFamily: family,
      fontWeight: fontWeight ?? 400,
      fontSize: round2(fontSize),
      lineHeight: unitValue(lineHeight),
      letterSpacing: unitValue(letterSpacing),
      textCase: oneOf(
        read(src, "textCase"),
        ["ORIGINAL", "UPPER", "LOWER", "TITLE", "SMALL_CAPS", "SMALL_CAPS_FORCED"],
        "ORIGINAL"
      ),
      textDecoration: oneOf(
        read(src, "textDecoration"),
        ["NONE", "UNDERLINE", "STRIKETHROUGH"],
        "NONE"
      )
    };
    const style = str(fontName, "style") ?? "";
    const italic = /italic|oblique/i.test(style);
    if (italic) fields.italic = true;
    t.fonts.set(`${family}\0${style}`, {
      family,
      style,
      weight: fields.fontWeight,
      italic
    });
    const styleId = str(src, styleIdKey);
    if (styleId) {
      const token = t.token("style", styleId, layerId);
      if (token) {
        fields.styleId = styleId;
        fields.token = token;
      } else if (!t.resolves) {
        fields.styleId = styleId;
      }
    }
    return fields;
  }
  const SEGMENT_FIELDS = [
    "fontName",
    "fontWeight",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "textStyleId",
    "fills",
    "hyperlink",
    "listOptions"
  ];
  function hyperlinkOf(v) {
    return read(v, "type") === "URL" ? str(v, "value") : void 0;
  }
  function listTypeOf(v) {
    const type = read(v, "type");
    return type === "ORDERED" || type === "UNORDERED" ? type : void 0;
  }
  function textBox(n, includeText) {
    const out = {};
    const auto = read(n, "textAutoResize");
    if (auto === "NONE" || auto === "WIDTH_AND_HEIGHT" || auto === "HEIGHT" || auto === "TRUNCATE") {
      out.autoResize = auto;
    }
    out.truncation = read(n, "textTruncation") === "ENDING" ? "ENDING" : "NONE";
    const maxLines = num(n, "maxLines");
    out.maxLines = maxLines !== void 0 && maxLines > 0 ? maxLines : null;
    const trim = read(n, "leadingTrim");
    if (trim === "CAP_HEIGHT" || trim === "NONE") out.leadingTrim = trim;
    const vertical = read(n, "textAlignVertical");
    if (vertical === "CENTER" || vertical === "BOTTOM") out.alignVertical = vertical;
    const spacing = num(n, "paragraphSpacing");
    if (spacing) out.paragraphSpacing = round2(spacing);
    const indent = num(n, "paragraphIndent");
    if (indent) out.paragraphIndent = round2(indent);
    const link = hyperlinkOf(read(n, "hyperlink"));
    if (link) out.hyperlink = link;
    if (includeText) {
      const length = (str(n, "characters") ?? "").length;
      const getter = read(n, "getRangeListOptions");
      if (length > 0 && typeof getter === "function") {
        try {
          const list = listTypeOf(getter.call(n, 0, length));
          if (list) out.listType = list;
        } catch {
        }
      }
    }
    return out;
  }
  function readText(n, layerId, includeText, t, fillsMixed) {
    const align = oneOf(
      read(n, "textAlignHorizontal"),
      ["LEFT", "CENTER", "RIGHT", "JUSTIFIED"],
      "LEFT"
    );
    const characters = includeText ? str(n, "characters") : void 0;
    const box = textBox(n, includeText);
    const whole = fillsMixed ? void 0 : textFields(n, layerId, t, "textStyleId");
    if (whole) {
      const text2 = { ...whole, align, ...box };
      if (characters !== void 0) text2.characters = characters;
      return text2;
    }
    let segments = [];
    try {
      const getter = read(n, "getStyledTextSegments");
      if (typeof getter === "function") {
        const result = getter.call(n, SEGMENT_FIELDS);
        if (Array.isArray(result)) segments = result;
      }
    } catch {
      segments = [];
    }
    const runs = [];
    for (const seg of segments) {
      const fields = textFields(seg, layerId, t, "textStyleId");
      if (!fields) continue;
      const run = {
        ...fields,
        characters: includeText ? str(seg, "characters") ?? "" : ""
      };
      const fills = readPaints(read(seg, "fills"), void 0, layerId, t);
      if (fills) run.fills = fills;
      const link = hyperlinkOf(read(seg, "hyperlink"));
      if (link) run.hyperlink = link;
      const list = listTypeOf(read(seg, "listOptions"));
      if (list) run.listType = list;
      runs.push(run);
    }
    if (runs.length === 0) {
      return {
        fontFamily: "",
        fontWeight: 400,
        fontSize: 0,
        lineHeight: { value: 0, unit: "auto" },
        letterSpacing: { value: 0, unit: "px" },
        textCase: "ORIGINAL",
        textDecoration: "NONE",
        align,
        ...box,
        mixed: true,
        runs: []
      };
    }
    const { characters: _c, fills: _f, hyperlink: _h, listType: _l, ...first } = runs[0];
    const text = { ...first, align, ...box, mixed: true, runs };
    if (characters !== void 0) text.characters = characters;
    return text;
  }
  function readPropertyRefs(n) {
    const refs = read(n, "componentPropertyReferences");
    if (!refs || typeof refs !== "object") return void 0;
    const out = {};
    for (const key of ["characters", "visible", "mainComponent"]) {
      const v = refs[key];
      if (typeof v === "string") out[key] = v;
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  async function readInstance(n) {
    if (read(n, "type") !== "INSTANCE") return void 0;
    let main;
    try {
      const getter = read(n, "getMainComponentAsync");
      main = typeof getter === "function" ? await getter.call(n) : read(n, "mainComponent");
    } catch {
      return void 0;
    }
    const componentId = str(main, "id");
    if (!componentId) return void 0;
    const parent = read(main, "parent");
    const componentName = read(parent, "type") === "COMPONENT_SET" ? str(parent, "name") ?? "" : str(main, "name") ?? "";
    const instance = { componentId, componentName };
    const properties = readInstanceProperties(n);
    if (properties) instance.properties = properties;
    return instance;
  }
  function readOrigin(n) {
    const t = read(n, "absoluteTransform");
    if (!Array.isArray(t) || t.length < 2) return void 0;
    const x = Array.isArray(t[0]) ? t[0][2] : void 0;
    const y = Array.isArray(t[1]) ? t[1][2] : void 0;
    return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y) ? { x, y } : void 0;
  }
  function readPaths(n, key) {
    const raw = read(n, key);
    if (!Array.isArray(raw)) return void 0;
    const out = [];
    for (const p of raw) {
      const data = str(p, "data");
      if (data)
        out.push({
          windingRule: oneOf(
            read(p, "windingRule"),
            ["NONZERO", "EVENODD", "NONE"],
            "NONZERO"
          ),
          data
        });
    }
    return out;
  }
  function readVector(n, layer, t) {
    var _a;
    const fill = hasItems(layer.fills) ? readPaths(n, "fillGeometry") : [];
    const stroke = hasItems((_a = layer.strokes) == null ? void 0 : _a.paints) ? readPaths(n, "strokeGeometry") : [];
    if (!fill || !stroke) return void 0;
    const size = [...fill, ...stroke].reduce((sum, p) => sum + p.data.length, 0);
    if (size === 0) return void 0;
    if (size > MAX_VECTOR_CHARS) {
      t.warnings.push({
        code: "VECTOR_OMITTED",
        message: `The shape of "${layer.name}" is ${Math.round(size / 1024)} KB of path data (limit ${Math.round(MAX_VECTOR_CHARS / 1024)} KB), so it is left out.`,
        layerId: layer.id
      });
      return void 0;
    }
    return { fill, stroke };
  }
  function attributeOfField(field) {
    if (field === "visible") return "visible";
    if (field === "opacity") return "opacity";
    if (field === "mainComponent" || field === "componentProperties") return "instanceOf";
    if (/^(characters|font|lineHeight|letterSpacing|text)/.test(field)) return "text";
    if (/^(fills|fillStyleId)/.test(field)) return "fills";
    if (/^(strokes|strokeStyleId|strokeWeight|stroke(Top|Right|Bottom|Left)Weight|strokeAlign)/.test(
      field
    ))
      return "strokes";
    if (/^(effects|effectStyleId)/.test(field)) return "effects";
    if (/Radius$|^cornerRadius$/.test(field)) return "radius";
    if (/^(width|height|size)$/.test(field)) return "size";
    if (field === "x" || field === "y" || field === "relativeTransform") return "position";
    if (field === "rotation") return "rotation";
    if (/^(layoutPositioning|layoutGrow|layoutAlign|layoutSizing)/.test(field)) return "placement";
    if (field === "constraints") return "constraints";
    if (field === "clipsContent") return "clipsContent";
    if (field === "blendMode") return "blendMode";
    if (/^(layoutMode|layoutWrap|padding|itemSpacing|primaryAxis|counterAxis|itemReverse|strokesIncluded)/.test(
      field
    ))
      return "layout";
    return void 0;
  }
  function readInstanceProperties(n) {
    const props = read(n, "componentProperties");
    if (!props || typeof props !== "object") return void 0;
    const out = {};
    for (const key of Object.keys(props).sort()) {
      const entry = props[key];
      const type = read(entry, "type");
      const value = read(entry, "value");
      if ((type === "BOOLEAN" || type === "TEXT" || type === "INSTANCE_SWAP" || type === "VARIANT") && (typeof value === "string" || typeof value === "boolean")) {
        out[key] = { type, value };
      }
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function childrenOf(n) {
    const kids = read(n, "children");
    return Array.isArray(kids) ? kids : [];
  }
  async function readLayerTree(root, options = {}) {
    const includeText = options.includeText !== false;
    const maxLayers = options.maxLayers ?? MAX_LAYERS;
    const maxDepth = options.maxDepth ?? MAX_DEPTH;
    const t = new Tracker(options.resolveToken, !!options.resolveImage);
    let count = 0;
    let truncated = false;
    const imageOmissions = /* @__PURE__ */ new Set();
    const origin = readOrigin(root);
    const readAttributes = async (n, insideBoolean, parent) => {
      var _a;
      const id = str(n, "id") ?? "";
      const type = str(n, "type") ?? "UNKNOWN";
      const layer = {
        id,
        name: str(n, "name") ?? "",
        type,
        visible: read(n, "visible") !== false,
        children: []
      };
      const width = num(n, "width");
      const height = num(n, "height");
      if (width !== void 0 && height !== void 0) {
        layer.size = { width: round2(width), height: round2(height) };
      }
      if (origin && layer.size) {
        const at = readOrigin(n);
        if (at) {
          layer.box = {
            x: round2(at.x - origin.x),
            y: round2(at.y - origin.y),
            width: layer.size.width,
            height: layer.size.height
          };
        }
      }
      const layout = readLayout(n);
      if (layout) layer.layout = layout;
      const radius = readRadius(n);
      if (radius !== void 0) layer.radius = radius;
      const opacity = num(n, "opacity");
      if (opacity !== void 0) layer.opacity = round3(opacity);
      const drawnOpacity = round3(((parent == null ? void 0 : parent.opacity) ?? 1) * (opacity ?? 1));
      if (drawnOpacity !== 1) layer.effectiveOpacity = drawnOpacity;
      const placement = (parent == null ? void 0 : parent.auto) ? readPlacement(n) : void 0;
      if (placement) layer.placement = placement;
      if (parent && (!parent.auto || (placement == null ? void 0 : placement.positioning) === "ABSOLUTE")) {
        const x = num(n, "x");
        const y = num(n, "y");
        if (x !== void 0 && y !== void 0) layer.position = { x: round2(x), y: round2(y) };
        const constraints = readConstraints(n);
        if (constraints) layer.constraints = constraints;
      }
      const rotation = num(n, "rotation");
      if (rotation) layer.rotation = round2(rotation);
      if (layout || placement) {
        const limits = readSizeLimits(n);
        if (limits) layer.sizeLimits = limits;
      }
      if (CLIPPING_TYPES.has(type)) {
        const clips = read(n, "clipsContent");
        if (typeof clips === "boolean") layer.clipsContent = clips;
        const grids = readGrids(n);
        if (grids) layer.layoutGrids = grids;
      }
      if (read(n, "isMask") === true) layer.isMask = true;
      const blend = str(n, "blendMode");
      if (blend && blend !== "NORMAL" && blend !== "PASS_THROUGH") layer.blendMode = blend;
      const smoothing = num(n, "cornerSmoothing");
      if (smoothing) layer.cornerSmoothing = round3(smoothing);
      const bindings = readBindings(n, id, t);
      if (bindings) {
        const tokens = layer.layout ? takeLayoutTokens(bindings) : void 0;
        if (tokens && layer.layout) layer.layout.token = tokens;
        if (Object.keys(bindings).length > 0) layer.bindings = bindings;
      }
      const rawFills = read(n, "fills");
      const fills = readPaints(
        rawFills,
        hasItems(rawFills) ? str(n, "fillStyleId") : void 0,
        id,
        t
      );
      if (fills) {
        layer.fills = fills;
        if (options.resolveImage) {
          for (const paint of fills) {
            if (!paint.image) continue;
            const found = await options.resolveImage(paint.image.hash);
            if ("file" in found) {
              paint.image.file = found.file;
              if (found.width !== void 0) paint.image.width = found.width;
              if (found.height !== void 0) paint.image.height = found.height;
            } else if (!imageOmissions.has(paint.image.hash)) {
              imageOmissions.add(paint.image.hash);
              t.warnings.push({
                code: "IMAGE_OMITTED",
                message: `The picture used by "${layer.name}" was not exported: ${found.omitted}`,
                layerId: id
              });
            }
          }
        }
      }
      const strokes = readStrokes(n, id, t);
      if (strokes) layer.strokes = strokes;
      describeGradients(layer.fills, layer.size);
      describeGradients((_a = layer.strokes) == null ? void 0 : _a.paints, layer.size);
      const rawEffects = read(n, "effects");
      const effects = readEffects(
        rawEffects,
        hasItems(rawEffects) ? str(n, "effectStyleId") : void 0,
        id,
        t
      );
      if (effects) layer.effects = effects;
      if (type === "TEXT") layer.text = readText(n, id, includeText, t, !Array.isArray(rawFills));
      if (options.includeVectorShapes && VECTOR_TYPES$1.has(type) && !insideBoolean) {
        const vector = readVector(n, layer, t);
        if (vector) layer.vector = vector;
      }
      return layer;
    };
    const readOverrides = async (instance, instanceId) => {
      var _a;
      const lookup = options.getNodeById;
      const list = read(instance, "overrides");
      if (!lookup || !Array.isArray(list)) return void 0;
      const overrides = [];
      let truncated2 = false;
      for (const entry of list) {
        const layerId = str(entry, "id");
        const fields = read(entry, "overriddenFields");
        if (!layerId || layerId === instanceId || !Array.isArray(fields)) continue;
        const wanted = /* @__PURE__ */ new Set();
        for (const f of fields) {
          const attribute = typeof f === "string" ? attributeOfField(f) : void 0;
          if (attribute) wanted.add(attribute);
        }
        if (wanted.size === 0) continue;
        if (overrides.length >= (options.maxOverrides ?? MAX_OVERRIDES)) {
          truncated2 = true;
          break;
        }
        if ((_a = options.shouldStop) == null ? void 0 : _a.call(options)) {
          truncated2 = true;
          break;
        }
        if (options.yieldIfDue) await options.yieldIfDue();
        let node;
        try {
          node = await lookup(layerId);
        } catch {
          node = void 0;
        }
        if (!node) continue;
        const layer = await readAttributes(node, true, {
          auto: isAutoLayout(read(node, "parent")),
          opacity: 1
        });
        const changes = {};
        for (const attribute of wanted) {
          if (attribute === "instanceOf") {
            const inst = await readInstance(node);
            if (inst) changes.instanceOf = inst;
          } else if (layer[attribute] !== void 0) {
            changes[attribute] = layer[attribute];
          }
        }
        if (Object.keys(changes).length > 0) {
          overrides.push({ layerId, name: layer.name, changes });
        }
      }
      return overrides.length > 0 || truncated2 ? { overrides, truncated: truncated2 } : void 0;
    };
    const visit = async (n, depth, insideInstance, insideBoolean = false, parent) => {
      var _a;
      count++;
      if (options.yieldIfDue) await options.yieldIfDue();
      if (options.stats) options.stats.layers++;
      const layer = await readAttributes(n, insideBoolean, parent);
      const { id, type } = layer;
      const stats = options.stats;
      const lookupStart = stats ? Date.now() : 0;
      const instanceOf = await readInstance(n);
      if (stats && type === "INSTANCE") {
        stats.instanceLookups++;
        stats.instanceMs += Date.now() - lookupStart;
      }
      if (instanceOf) {
        if (options.includeInstanceInternals === false) {
          const found = await readOverrides(n, id);
          if (found) {
            if (found.overrides.length > 0) instanceOf.overrides = found.overrides;
            if (found.truncated) instanceOf.overridesTruncated = true;
          }
        }
        layer.instanceOf = instanceOf;
      }
      const propertyRefs = insideInstance ? void 0 : readPropertyRefs(n);
      if (propertyRefs) layer.propertyRefs = propertyRefs;
      const kids = type === "INSTANCE" && options.includeInstanceInternals === false ? [] : childrenOf(n);
      if (kids.length > 0) {
        if (depth >= maxDepth) {
          truncated = true;
        } else {
          for (const child of kids) {
            if (count >= maxLayers || ((_a = options.shouldStop) == null ? void 0 : _a.call(options))) {
              truncated = true;
              break;
            }
            layer.children.push(
              await visit(
                child,
                depth + 1,
                insideInstance || type === "INSTANCE",
                insideBoolean || type === "BOOLEAN_OPERATION",
                { auto: !!layer.layout, opacity: layer.effectiveOpacity ?? layer.opacity ?? 1 }
              )
            );
          }
        }
      }
      return layer;
    };
    const tree = await visit(root, 0, false);
    if (options.stats) options.stats.trees++;
    const warnings = t.warnings;
    if (truncated) {
      warnings.push({
        code: "TREE_TRUNCATED",
        message: `The layer tree of "${tree.name}" is larger than the budget (${maxLayers} layers, ${maxDepth} levels deep), so it is incomplete.`,
        layerId: tree.id
      });
    }
    return {
      tree,
      truncated,
      usedVariableIds: Array.from(t.variables),
      usedStyleIds: Array.from(t.styles),
      usedFonts: Array.from(t.fonts.values()),
      warnings
    };
  }
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_IMAGE_BYTES = 96 * 1024 * 1024;
  const IMAGE_DIR = "assets/images";
  function sniffImageExtension(bytes) {
    const at = (i) => bytes[i] ?? 0;
    if (at(0) === 137 && at(1) === 80 && at(2) === 78 && at(3) === 71) return "png";
    if (at(0) === 255 && at(1) === 216) return "jpg";
    if (at(0) === 71 && at(1) === 73 && at(2) === 70) return "gif";
    if (at(0) === 82 && at(1) === 73 && at(2) === 70 && at(3) === 70 && at(8) === 87 && at(9) === 69 && at(10) === 66 && at(11) === 80) {
      return "webp";
    }
    return "bin";
  }
  function createImageResolver(send, api = figma, limits = {}) {
    const perImage = limits.perImage ?? MAX_IMAGE_BYTES;
    const total = limits.total ?? MAX_TOTAL_IMAGE_BYTES;
    const done = /* @__PURE__ */ new Map();
    let used = 0;
    const load = async (hash) => {
      try {
        const image = api.getImageByHash(hash);
        if (!image)
          return { omitted: "Figma has no picture for this fill (it may come from a library)." };
        const bytes = await image.getBytesAsync();
        if (bytes.length > perImage) {
          return {
            omitted: `it is ${(bytes.length / 1048576).toFixed(1)} MB (limit ${(perImage / 1048576).toFixed(0)} MB per picture).`
          };
        }
        if (used + bytes.length > total) {
          return {
            omitted: `the pictures already exported reached the total limit of ${(total / 1048576).toFixed(0)} MB.`
          };
        }
        used += bytes.length;
        const file = `${IMAGE_DIR}/${hash}.${sniffImageExtension(bytes)}`;
        send(file, bytes);
        let size;
        try {
          size = await image.getSizeAsync();
        } catch {
          size = void 0;
        }
        return size ? { file, width: size.width, height: size.height } : { file };
      } catch (err) {
        return {
          omitted: `it could not be read (${err instanceof Error ? err.message : String(err)}).`
        };
      }
    };
    return (hash) => {
      let pending = done.get(hash);
      if (!pending) {
        pending = load(hash);
        done.set(hash, pending);
      }
      return pending;
    };
  }
  const ICON_MAX_SIZE = 64;
  const LABEL_MAX_CHARS = 40;
  const VECTOR_TYPES = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "ELLIPSE"]);
  const CONTAINER_TYPES = /* @__PURE__ */ new Set([
    "FRAME",
    "GROUP",
    "COMPONENT",
    "COMPONENT_SET",
    "INSTANCE",
    "SECTION"
  ]);
  const NAME_RULES = [
    ["heading", /\b(heading|headline|title|h[1-6])\b/i],
    ["button", /\b(button|btn|cta)\b/i],
    ["link", /\b(link|anchor)\b/i],
    ["input", /\b(input|field|textfield|textarea)\b/i],
    ["divider", /\b(divider|separator|hr|rule)\b/i],
    ["icon", /\b(icon|glyph|chevron|caret|arrow)\b/i],
    ["image", /\b(image|img|photo|picture|avatar|thumbnail|illustration)\b/i],
    ["slot", /\b(slot|placeholder)\b/i],
    ["label", /\b(label|caption)\b/i]
  ];
  const words = (name) => name.replace(/[_\-/.]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  function isSmall(layer) {
    return layer.size !== void 0 && layer.size.width <= ICON_MAX_SIZE && layer.size.height <= ICON_MAX_SIZE;
  }
  function fromProperty(layer) {
    var _a;
    const refs = layer.propertyRefs;
    if (refs == null ? void 0 : refs.characters) {
      const chars = (_a = layer.text) == null ? void 0 : _a.characters;
      const short = chars === void 0 || chars.length <= LABEL_MAX_CHARS && !chars.includes("\n");
      return { role: short ? "label" : "text", roleSource: "property" };
    }
    if (refs == null ? void 0 : refs.mainComponent) {
      return { role: isSmall(layer) ? "icon" : "slot", roleSource: "property" };
    }
    return void 0;
  }
  function fromType(layer) {
    var _a;
    if ((_a = layer.fills) == null ? void 0 : _a.some((p) => p.visible && p.type === "IMAGE")) {
      return { role: "image", roleSource: "type" };
    }
    if (layer.type === "LINE") return { role: "divider", roleSource: "type" };
    if (layer.type === "RECTANGLE" && layer.children.length === 0 && layer.size !== void 0 && Math.min(layer.size.width, layer.size.height) <= 2 && Math.max(layer.size.width, layer.size.height) > 8) {
      return { role: "divider", roleSource: "type" };
    }
    if (VECTOR_TYPES.has(layer.type) && isSmall(layer)) return { role: "icon", roleSource: "type" };
    return void 0;
  }
  function matchName(raw) {
    const name = words(raw);
    for (const [role, pattern] of NAME_RULES) {
      if (pattern.test(name)) return role;
    }
    return void 0;
  }
  function fromName(layer) {
    const role = matchName(layer.name) ?? (layer.instanceOf ? matchName(layer.instanceOf.componentName) : void 0);
    return role ? { role, roleSource: "name" } : void 0;
  }
  function inferRole(layer, isRoot = false) {
    if (isRoot) return { role: "root", roleSource: "type" };
    const found = fromProperty(layer) ?? fromType(layer) ?? fromName(layer);
    if (found) return found;
    if (layer.type === "TEXT") return { role: "text", roleSource: "type" };
    if (CONTAINER_TYPES.has(layer.type) && layer.children.length > 0) {
      return { role: "container", roleSource: "type" };
    }
    return { role: "unknown", roleSource: "none" };
  }
  function assignRoles(layer, isRoot = true) {
    const { role, roleSource } = inferRole(layer, isRoot);
    return {
      ...layer,
      role,
      roleSource,
      children: layer.children.map((child) => assignRoles(child, false))
    };
  }
  const ATTRIBUTES = [
    "visible",
    "size",
    "box",
    "effectiveOpacity",
    "position",
    "rotation",
    "constraints",
    "placement",
    "sizeLimits",
    "clipsContent",
    "isMask",
    "blendMode",
    "cornerSmoothing",
    "layoutGrids",
    "bindings",
    "layout",
    "radius",
    "opacity",
    "fills",
    "strokes",
    "effects",
    "text",
    "vector",
    "instanceOf",
    "propertyRefs"
  ];
  function indexTree(root, warnings, componentId) {
    const out = /* @__PURE__ */ new Map();
    const visit = (layer, path, parentPath, index) => {
      out.set(path, { layer, parentPath, index });
      const counts = /* @__PURE__ */ new Map();
      for (const child of layer.children) counts.set(child.name, (counts.get(child.name) ?? 0) + 1);
      const seen = /* @__PURE__ */ new Map();
      for (const [childIndex, child] of layer.children.entries()) {
        const total = counts.get(child.name);
        const n = seen.get(child.name) ?? 0;
        seen.set(child.name, n + 1);
        const segment = total > 1 ? `${child.name}[${n}]` : child.name;
        if (total > 1 && n === 0) {
          warnings.push({
            code: "DUPLICATE_SIBLING_NAME",
            message: `Layers inside "${path}" share the name "${child.name}", so they are told apart by index.`,
            ...componentId ? { componentId } : {},
            layerId: child.id
          });
        }
        visit(child, `${path}/${segment}`, path, childIndex);
      }
    };
    visit(root, root.name, void 0, 0);
    return out;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function changesBetween(base, other) {
    const changes = {};
    for (const key of ATTRIBUTES) {
      const before = base[key];
      const after = other[key];
      if (after === void 0) {
        if (key === "radius" && before !== void 0) changes.radius = 0;
        continue;
      }
      if (!same(before, after)) changes[key] = after;
    }
    return changes;
  }
  function diffVariant(base, variant, info) {
    const warnings = [];
    const baseIndex = indexTree(base, [], void 0);
    const variantIndex = indexTree(variant, warnings, info.componentId);
    const layers = [];
    const added = [];
    const removed = [];
    const reordered = [];
    const isMatch = (path) => {
      const a = baseIndex.get(path);
      const b = variantIndex.get(path);
      return !!a && !!b && a.layer.type === b.layer.type;
    };
    for (const [path, entry] of variantIndex) {
      if (isMatch(path)) {
        const changes = changesBetween(baseIndex.get(path).layer, entry.layer);
        if (Object.keys(changes).length > 0) {
          layers.push({ path, layerId: baseIndex.get(path).layer.id, changes });
        }
      } else if (entry.parentPath === void 0 || isMatch(entry.parentPath)) {
        added.push({
          parentPath: entry.parentPath ?? "",
          index: entry.index,
          layer: entry.layer
        });
      }
    }
    for (const [path, entry] of baseIndex) {
      if (!isMatch(path) && (entry.parentPath === void 0 || isMatch(entry.parentPath))) {
        removed.push(path);
      }
    }
    for (const [path, entry] of variantIndex) {
      if (!isMatch(path)) continue;
      const baseKids = baseIndex.get(path).layer.children;
      const variantKids = entry.layer.children;
      if (baseKids.length === 0 && variantKids.length === 0) continue;
      const pathsOf = (parent, kids) => {
        const counts = /* @__PURE__ */ new Map();
        for (const k of kids) counts.set(k.name, (counts.get(k.name) ?? 0) + 1);
        const seen = /* @__PURE__ */ new Map();
        return kids.map((k) => {
          const n = seen.get(k.name) ?? 0;
          seen.set(k.name, n + 1);
          return `${parent}/${counts.get(k.name) > 1 ? `${k.name}[${n}]` : k.name}`;
        });
      };
      const basePaths = pathsOf(path, baseKids);
      const variantPaths = pathsOf(path, variantKids);
      const inVariant = new Set(variantPaths);
      const inBase = new Set(basePaths);
      const commonBase = basePaths.filter((p) => inVariant.has(p));
      const commonVariant = variantPaths.filter((p) => inBase.has(p));
      if (commonBase.some((p, i) => p !== commonVariant[i])) {
        reordered.push({ parentPath: path, order: variantPaths });
      }
      const count = (kids) => {
        const m = /* @__PURE__ */ new Map();
        for (const k of kids) m.set(k.name, (m.get(k.name) ?? 0) + 1);
        return m;
      };
      const a = count(baseKids);
      const b = count(variantKids);
      const unsure = [.../* @__PURE__ */ new Set([...a.keys(), ...b.keys()])].filter(
        (name) => (a.get(name) ?? 0) !== (b.get(name) ?? 0) && Math.max(a.get(name) ?? 0, b.get(name) ?? 0) > 1
      );
      if (unsure.length > 0) {
        warnings.push({
          code: "AMBIGUOUS_SIBLINGS",
          message: `Inside "${path}" the default variant and this variant have a different number of layers named ${unsure.map((n) => `"${n}"`).join(", ")}, so matching them by position is a guess. Use layerId.`,
          ...info.componentId ? { componentId: info.componentId } : {},
          variantId: info.variantId,
          layerId: baseIndex.get(path).layer.id
        });
      }
    }
    return {
      diff: {
        variantId: info.variantId,
        variantProperties: info.variantProperties,
        layers,
        added,
        removed,
        reordered
      },
      warnings
    };
  }
  const MAX_VARIANTS_FOR_DIFFS = 512;
  const COMPONENT_TIME_BUDGET_MS = 2e4;
  const TOTAL_TIME_BUDGET_MS = 10 * 60 * 1e3;
  const COMPONENT_MEMORY_BUDGET_BYTES = 4 * 1024 * 1024;
  const BATCH_SIZE = 4;
  async function nodeById(id) {
    var _a;
    try {
      const n = await figma.getNodeByIdAsync(id);
      if (!n) return void 0;
      const name = ((_a = n.parent) == null ? void 0 : _a.type) === "COMPONENT_SET" ? n.parent.name : n.name;
      return { id: n.id, name };
    } catch {
      return void 0;
    }
  }
  async function readProperties(defs) {
    if (!defs) return [];
    const out = [];
    for (const [key, def] of Object.entries(defs)) {
      const type = def.type;
      const prop = {
        key,
        name: cleanPropertyName(key),
        type,
        defaultValue: String(def.defaultValue ?? "")
      };
      if (type === "INSTANCE_SWAP" && typeof def.defaultValue === "string") {
        const resolved = await nodeById(def.defaultValue);
        if (resolved) prop.defaultResolved = resolved;
      }
      if (def.variantOptions) prop.variantOptions = [...def.variantOptions];
      const preferred = (def.preferredValues ?? []).flatMap(
        (p) => (p.type === "COMPONENT" || p.type === "COMPONENT_SET") && typeof p.key === "string" ? [{ type: p.type, key: p.key }] : []
      );
      if (preferred.length > 0) prop.preferredValues = preferred;
      out.push(prop);
    }
    return out;
  }
  async function extractComponentStructure(node, options = {}) {
    const now = options.now ?? Date.now;
    const started = now();
    const budget = options.timeBudgetMs ?? COMPONENT_TIME_BUDGET_MS;
    const memoryBudget = options.memoryBudgetBytes ?? COMPONENT_MEMORY_BUDGET_BYTES;
    let diffBytes = 0;
    const shouldStop = () => isCancelled() || options.deadline !== void 0 && now() > options.deadline || now() - started > budget;
    const readOptions = {
      includeText: options.includeText,
      resolveToken: options.resolveToken,
      includeInstanceInternals: options.includeInstanceInternals === true,
      includeVectorShapes: options.includeVectorShapes === true,
      resolveImage: options.resolveImage,
      getNodeById: options.getNodeById ?? (typeof figma !== "undefined" ? (id) => figma.getNodeByIdAsync(id) : void 0),
      shouldStop,
      stats: options.stats,
      yieldIfDue: options.yieldIfDue ?? createTimeSlicer()
    };
    const warnings = [];
    const members = node.type === "COMPONENT_SET" ? node.children.filter((c) => c.type === "COMPONENT") : [node];
    if (members.length === 0) throw new Error("The component set has no variants.");
    const defaultNode = node.type === "COMPONENT_SET" ? defaultVariantOf(node, members) : node;
    const named = (tree) => ({ ...tree, name: node.name });
    const base = await readLayerTree(defaultNode, readOptions);
    base.tree = named(base.tree);
    warnings.push(...base.warnings);
    let truncated = base.truncated;
    const variables = new Set(base.usedVariableIds);
    const styles = new Set(base.usedStyleIds);
    const fonts = new Map(base.usedFonts.map((f) => [`${f.family}\0${f.style}`, f]));
    const diffs = [];
    const duplicateGroups = /* @__PURE__ */ new Map();
    const others = members.filter((m) => m.id !== defaultNode.id);
    const wantDiffs = options.includeVariantDiffs !== false && others.length > 0;
    if (wantDiffs && members.length > MAX_VARIANTS_FOR_DIFFS) {
      warnings.push({
        code: "VARIANT_DIFFS_SKIPPED",
        message: `"${node.name}" has ${members.length} variants (more than ${MAX_VARIANTS_FOR_DIFFS}), so variant diffs were skipped.`,
        componentId: node.id
      });
    } else if (wantDiffs) {
      for (const variant of others) {
        if (isCancelled()) {
          truncated = true;
          warnings.push({
            code: "SCAN_CANCELLED",
            message: `Generation was cancelled while reading "${node.name}", so its variant diffs stop after ${diffs.length} of ${others.length} variants.`,
            componentId: node.id
          });
          break;
        }
        if (options.deadline !== void 0 && now() > options.deadline) {
          truncated = true;
          warnings.push({
            code: "TIME_BUDGET_EXCEEDED",
            message: `The overall time limit was reached while reading "${node.name}", so its variant diffs stop after ${diffs.length} of ${others.length} variants.`,
            componentId: node.id
          });
          break;
        }
        if (now() - started > budget) {
          truncated = true;
          warnings.push({
            code: "TREE_TRUNCATED",
            message: `"${node.name}" took longer than ${budget} ms, so variant diffs stop after ${diffs.length} of ${others.length} variants.`,
            componentId: node.id
          });
          break;
        }
        const read2 = await readLayerTree(variant, readOptions);
        if (read2.truncated) truncated = true;
        read2.usedVariableIds.forEach((id) => variables.add(id));
        read2.usedStyleIds.forEach((id) => styles.add(id));
        read2.usedFonts.forEach((f) => fonts.set(`${f.family}\0${f.style}`, f));
        const { diff, warnings: diffWarnings } = diffVariant(base.tree, named(read2.tree), {
          variantId: variant.id,
          variantProperties: { ...variant.variantProperties ?? {} },
          componentId: node.id
        });
        diff.added = diff.added.map((a) => ({ ...a, layer: assignRoles(a.layer, false) }));
        diffBytes += JSON.stringify(diff).length;
        if (diffBytes > memoryBudget) {
          truncated = true;
          warnings.push({
            code: "TREE_TRUNCATED",
            message: `"${node.name}" has more variant differences than the size budget (${Math.round(memoryBudget / 1024)} KB), so diffs stop after ${diffs.length} of ${others.length} variants.`,
            componentId: node.id
          });
          break;
        }
        diffs.push(diff);
        for (const w of diffWarnings) {
          if (w.code === "DUPLICATE_SIBLING_NAME" && w.layerId) duplicateGroups.set(w.layerId, w);
          else warnings.push(w);
        }
        for (const w of read2.warnings) {
          if (w.code === "UNRESOLVED_REFERENCE") {
            if (!warnings.some((x) => x.message === w.message)) warnings.push(w);
          }
        }
      }
    }
    if (duplicateGroups.size > 0) {
      const first = [...duplicateGroups.values()][0];
      warnings.push({
        code: "DUPLICATE_SIBLING_NAME",
        message: `${duplicateGroups.size} group${duplicateGroups.size === 1 ? "" : "s"} of sibling layers in "${node.name}" share a name, so variant differences tell them apart by index (for example: ${first.message}).`,
        componentId: node.id,
        layerId: first.layerId
      });
    }
    let properties = [];
    try {
      properties = await readProperties(
        node.componentPropertyDefinitions
      );
    } catch (err) {
      warnings.push({
        code: "PROPERTIES_UNREADABLE",
        message: `The component properties of "${node.name}" could not be read: ${err instanceof Error ? err.message : String(err)}.`,
        componentId: node.id
      });
    }
    return {
      properties,
      defaultVariantId: defaultNode.id,
      tree: assignRoles(base.tree),
      variantDiffs: diffs,
      treeTruncated: truncated,
      usedVariableIds: Array.from(variables),
      usedStyleIds: Array.from(styles),
      usedFonts: Array.from(fonts.values()),
      warnings: warnings.map((w) => w.componentId ? w : { ...w, componentId: node.id })
    };
  }
  async function extractStructures(components, options = {}, onProgress, onResults, retain = true) {
    const now = options.now ?? Date.now;
    const deadline = options.deadline ?? now() + (options.totalBudgetMs ?? TOTAL_TIME_BUDGET_MS);
    const yieldIfDue = options.yieldIfDue ?? createTimeSlicer();
    const kept = /* @__PURE__ */ new Map();
    let pending = [];
    const record = (id, result) => {
      if (retain) kept.set(id, result);
      pending.push([id, result]);
    };
    const flush = () => {
      if (pending.length > 0 && onResults) onResults(pending);
      pending = [];
    };
    await processInBatches(
      [...components],
      BATCH_SIZE,
      async (doc) => {
        if (now() > deadline) {
          record(doc.id, { error: "The overall time limit was reached.", timedOut: true });
          return;
        }
        try {
          const node = await figma.getNodeByIdAsync(doc.id);
          if (!node || node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
            record(doc.id, { error: "The component could not be found in the file." });
            return;
          }
          record(doc.id, await extractComponentStructure(node, { ...options, deadline, yieldIfDue }));
        } catch (err) {
          record(doc.id, { error: err instanceof Error ? err.message : String(err) });
        }
      },
      (done, total) => {
        flush();
        onProgress == null ? void 0 : onProgress(done, total);
      }
    );
    flush();
    for (const doc of components) {
      if (!kept.has(doc.id) && retain) {
        kept.set(doc.id, { error: "Generation was cancelled.", cancelled: true });
      }
    }
    return kept;
  }
  function escapeCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  }
  function mdTable(headers, rows) {
    if (rows.length === 0) return "_None_\n";
    const headerRow = `| ${headers.map(escapeCell).join(" | ")} |`;
    const divider = `| ${headers.map(() => "---").join(" | ")} |`;
    const bodyRows = rows.map(
      (row) => `| ${row.map((cell) => escapeCell(String(cell))).join(" | ")} |`
    );
    return [headerRow, divider, ...bodyRows].join("\n") + "\n";
  }
  function mdHeading(level, text) {
    return `${"#".repeat(level)} ${text}
`;
  }
  function mdList(items) {
    if (items.length === 0) return "_None_\n";
    return items.map((item) => `- ${item}`).join("\n") + "\n";
  }
  function joinSections(sections) {
    return sections.filter(Boolean).join("\n");
  }
  const MAX_VARIANT_ROWS = 40;
  const MAX_TOKEN_ROWS = 60;
  function variantsSection(c) {
    if (c.variants.length === 0 || c.variants.length === 1 && Object.keys(c.variants[0].variantProperties).length === 0) {
      return joinSections([
        mdHeading(2, "Variants"),
        "_This component has no variant properties._\n"
      ]);
    }
    const propertyNames = Array.from(
      new Set(c.variants.flatMap((v) => Object.keys(v.variantProperties)))
    );
    const shown = c.variants.slice(0, MAX_VARIANT_ROWS);
    const rows = shown.map((v) => [
      v.name,
      ...propertyNames.map((p) => v.variantProperties[p] ?? "—")
    ]);
    const note = c.variants.length > shown.length ? `_Showing the first ${shown.length} of ${c.variants.length} variants. The Properties table below lists every option of each variant property; components.json lists all variants when it is exported._
` : "";
    return joinSections([
      mdHeading(2, "Variants"),
      mdTable(["Variant", ...propertyNames], rows),
      note
    ]);
  }
  function layoutSection(c) {
    const layout = c.layout;
    if (!layout) return "";
    const rows = [["Size", `${layout.width} × ${layout.height}`]];
    if (layout.layoutMode === "NONE") {
      rows.push(["Auto layout", "None (fixed layout)"]);
    } else {
      rows.push(["Auto layout", layout.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical"]);
      if (layout.gap !== void 0) rows.push(["Gap", String(layout.gap)]);
      if (layout.padding) {
        const { top, right, bottom, left } = layout.padding;
        rows.push(["Padding (top, right, bottom, left)", `${top}, ${right}, ${bottom}, ${left}`]);
      }
    }
    if (layout.cornerRadius !== void 0) rows.push(["Corner radius", String(layout.cornerRadius)]);
    return joinSections([
      mdHeading(2, "Layout"),
      `_Measured from the "${layout.measuredFrom}" ${c.isComponentSet ? "variant" : "component"}, in px._
`,
      mdTable(["Property", "Value"], rows)
    ]);
  }
  function defaultLabel(p) {
    if (p.type === "INSTANCE_SWAP") return p.defaultResolvedName || "—";
    return p.defaultValue || "—";
  }
  function propertiesSection(c) {
    if (c.properties.length === 0) {
      return joinSections([mdHeading(2, "Properties"), "_No component properties defined._\n"]);
    }
    const rows = c.properties.map((p) => {
      var _a;
      return [
        p.name,
        p.type,
        defaultLabel(p),
        ((_a = p.variantOptions) == null ? void 0 : _a.join(", ")) ?? "—"
      ];
    });
    return joinSections([
      mdHeading(2, "Properties"),
      mdTable(["Property", "Type", "Default", "Options"], rows)
    ]);
  }
  function sizesAndStatesSection(c) {
    return joinSections([
      mdHeading(2, "Sizes"),
      mdList(c.sizes),
      mdHeading(2, "States"),
      mdList(c.states)
    ]);
  }
  function accessibilitySection$1(c) {
    const notes = [];
    if (c.states.length === 0) {
      notes.push(
        "No interaction states (hover/focus/disabled/etc.) were detected — verify keyboard focus and state styling are implemented in code even if not modeled in Figma."
      );
    } else {
      notes.push(
        `Detected states: ${c.states.join(", ")}. Ensure each has a corresponding accessible implementation (e.g. :focus-visible, :disabled, aria-pressed).`
      );
    }
    notes.push(
      "Confirm this component has an accessible name (visible label, aria-label, or aria-labelledby) in its code implementation."
    );
    return joinSections([mdHeading(2, "Accessibility Notes"), mdList(notes)]);
  }
  function usageGuidelinesSection(c) {
    return joinSections([
      mdHeading(2, "Usage Guidelines"),
      c.description ? `${c.description}
` : "_No usage guidance was provided in Figma. Add a description to the component or component set to populate this section._\n"
    ]);
  }
  function tokenReferencesSection(c, ds) {
    const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
    const stylesById = new Map(
      [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid].map((s) => [
        s.id,
        s
      ])
    );
    const variableRows = c.boundVariableIds.map((id) => {
      const v = variablesById.get(id);
      return v ? [v.name, v.cssName, v.category] : [id, "—", "unresolved"];
    });
    const styleRows = (c.styleIds ?? []).flatMap((id) => {
      const s = stylesById.get(id);
      return s ? [[s.library ? `${s.name} (library)` : s.name, s.cssName, `${s.type.toLowerCase()} style`]] : [];
    });
    const all = [...variableRows, ...styleRows];
    if (all.length === 0) {
      return joinSections([
        mdHeading(2, "Token References"),
        "_No bound variables or styles were detected on this component._\n"
      ]);
    }
    const shown = all.slice(0, MAX_TOKEN_ROWS);
    return joinSections([
      mdHeading(2, "Token References"),
      mdTable(["Token", "CSS Variable", "Category"], shown),
      all.length > shown.length ? `_Showing ${shown.length} of ${all.length} tokens this component uses._
` : ""
    ]);
  }
  function relatedComponentsSection(c) {
    return joinSections([mdHeading(2, "Related Components"), mdList(c.relatedComponentNames)]);
  }
  function assignComponentDocPaths(components) {
    const paths = /* @__PURE__ */ new Map();
    const taken = /* @__PURE__ */ new Set();
    for (const c of components) {
      const base = toFileSafeName(c.name);
      let candidate = base;
      for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}`;
      taken.add(candidate.toLowerCase());
      paths.set(c.id, `components/${candidate}.md`);
    }
    return paths;
  }
  function generateComponentMd(c, ds, path = `components/${toFileSafeName(c.name)}.md`) {
    const content = joinSections([
      mdHeading(1, c.name),
      c.isComponentSet ? "_Component Set_\n" : "_Component_\n",
      mdHeading(2, "Description"),
      c.description ? `${c.description}
` : "_No description provided in Figma._\n",
      variantsSection(c),
      sizesAndStatesSection(c),
      layoutSection(c),
      propertiesSection(c),
      accessibilitySection$1(c),
      usageGuidelinesSection(c),
      tokenReferencesSection(c, ds),
      relatedComponentsSection(c)
    ]);
    return { path, content };
  }
  function generateComponentDocs(ds) {
    const paths = assignComponentDocPaths(ds.components);
    return ds.components.map((c) => generateComponentMd(c, ds, paths.get(c.id)));
  }
  function defaultModeEntry(variable) {
    return variable.valuesByMode[0];
  }
  function defaultModeValue(variable) {
    var _a;
    return (_a = defaultModeEntry(variable)) == null ? void 0 : _a.value;
  }
  function primitiveValue(value) {
    switch (value.kind) {
      case "color":
        return value.color.hex;
      case "float":
      case "string":
      case "boolean":
        return value.value;
      default:
        return null;
    }
  }
  function aliasCssName(variableName) {
    return toCssVarName(toPathSegments(variableName));
  }
  function unitFor(category) {
    return category === "spacing" || category === "typography" ? "px" : "";
  }
  function cssFontFamily(family) {
    return /^[A-Za-z_-][\w-]*$/.test(family) ? family : JSON.stringify(family);
  }
  function valueToCss(value, variable) {
    if (value.kind === "alias") return `var(${aliasCssName(value.variableName)})`;
    const primitive = primitiveValue(value);
    if (primitive === null) return null;
    if (value.kind === "float") return `${primitive}${unitFor(variable.category)}`;
    if (value.kind === "string" && variable.scopes.includes("FONT_FAMILY")) {
      return cssFontFamily(value.value);
    }
    return String(primitive);
  }
  function effectToBoxShadowSegment(e) {
    var _a;
    if (!e.visible) return null;
    if (e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW") return null;
    const inset = e.type === "INNER_SHADOW" ? "inset " : "";
    const x = e.offsetX ?? 0;
    const y = e.offsetY ?? 0;
    const blur = e.radius ?? 0;
    const spread = e.spread ?? 0;
    const color = ((_a = e.color) == null ? void 0 : _a.hex) ?? "#000000";
    return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
  }
  function textStyleToCssVars(style) {
    const props = style.textProperties;
    if (!props) return {};
    return {
      // An unknown family is left out: "Unknown" is not a font, and would break the cascade.
      ...isKnownFont(props.fontFamily) ? { [`${style.cssName}-font-family`]: cssFontFamily(props.fontFamily) } : {},
      [`${style.cssName}-font-weight`]: String(props.fontWeight),
      [`${style.cssName}-font-size`]: `${props.fontSize}px`,
      [`${style.cssName}-line-height`]: props.lineHeight === "AUTO" ? "normal" : props.lineHeight,
      [`${style.cssName}-letter-spacing`]: props.letterSpacing
    };
  }
  function gridStyleToCssVars(style) {
    const out = {};
    (style.grids ?? []).forEach((g, i) => {
      const suffix = style.grids.length > 1 ? `-${i}` : "";
      if (g.count !== void 0) out[`${style.cssName}${suffix}-count`] = String(g.count);
      if (g.gutterSize !== void 0) out[`${style.cssName}${suffix}-gutter`] = `${g.gutterSize}px`;
      if (g.offset !== void 0) out[`${style.cssName}${suffix}-offset`] = `${g.offset}px`;
      if (g.sectionSize !== void 0)
        out[`${style.cssName}${suffix}-section`] = `${g.sectionSize}px`;
    });
    return out;
  }
  function addVariableVars(target, variables) {
    for (const v of variables) {
      const defaultValue = defaultModeValue(v);
      if (!defaultValue) continue;
      const css = valueToCss(defaultValue, v);
      if (css !== null) target[v.cssName] = css;
    }
  }
  function addVariableModeVars(modes, variables) {
    for (const v of variables) {
      for (const vbm of v.valuesByMode) {
        const css = valueToCss(vbm.value, v);
        if (css === null) continue;
        const modeKey = vbm.modeName;
        (modes[modeKey] ?? (modes[modeKey] = {}))[v.cssName] = css;
      }
    }
  }
  function buildCssVariableMaps(ds) {
    const root = {};
    const modes = {};
    addVariableVars(root, ds.variables);
    addVariableModeVars(modes, ds.variables);
    const wanted = (hasVariables, s) => {
      var _a;
      return !hasVariables || (((_a = s.usedByComponents) == null ? void 0 : _a.length) ?? 0) > 0 || !!s.library;
    };
    const hasColorVariables = ds.variables.some((v) => v.category === "color");
    for (const s of ds.styles.color) {
      if (s.paint && wanted(hasColorVariables, s)) root[s.cssName] = s.paint.hex;
    }
    const hasTypographyVariables = ds.variables.some((v) => v.category === "typography");
    for (const s of ds.styles.text) {
      if (wanted(hasTypographyVariables, s)) Object.assign(root, textStyleToCssVars(s));
    }
    for (const s of ds.styles.effect) {
      const shadowSegments = (s.effects ?? []).map(effectToBoxShadowSegment).filter((v) => !!v);
      if (shadowSegments.length > 0) root[s.cssName] = shadowSegments.join(", ");
      const blur = (s.effects ?? []).find((e) => e.type === "LAYER_BLUR" && e.visible);
      if ((blur == null ? void 0 : blur.radius) !== void 0) root[`${s.cssName}-blur`] = `${blur.radius}px`;
    }
    for (const s of ds.styles.grid) {
      Object.assign(root, gridStyleToCssVars(s));
    }
    return { root, modes };
  }
  function modeOverrides({ root, modes }) {
    const overrides = [];
    for (const [modeName, values] of Object.entries(modes)) {
      const vars = Object.fromEntries(Object.entries(values).filter(([name, v]) => root[name] !== v));
      if (Object.keys(vars).length > 0) {
        overrides.push({ modeName, slug: kebabCase(modeName) || "mode", vars });
      }
    }
    return overrides;
  }
  function block(selector, vars, indent = "") {
    const lines = Object.entries(vars).map(([name, value]) => `${indent}  ${name}: ${value};`);
    return `${indent}${selector} {
${lines.join("\n")}
${indent}}`;
  }
  function generateCssFile(ds) {
    const maps = buildCssVariableMaps(ds);
    const sections = [
      `/* Generated by DesignMD from "${ds.metadata.fileName.replace(/\*\//g, "* /")}" — do not edit by hand. */`
    ];
    if (Object.keys(maps.root).length > 0) sections.push(block(":root", maps.root));
    for (const { modeName, slug, vars } of modeOverrides(maps)) {
      sections.push(
        `/* Mode: ${modeName.replace(/\*\//g, "* /")} */
${block(`[data-theme="${slug}"]`, vars)}`
      );
      if (slug === "dark") {
        sections.push(
          `@media (prefers-color-scheme: dark) {
${block(':root:not([data-theme="light"])', vars, "  ")}
}`
        );
      }
    }
    return { path: "tokens.css", content: sections.join("\n\n") + "\n" };
  }
  const MAX_UNSCOPED_PAIRS = 400;
  const groupOf = (name) => name.split("/").slice(0, -1).join("/");
  const STATE_WORDS = {
    default: "default",
    normal: "default",
    rest: "default",
    hover: "hover",
    hovered: "hover",
    press: "press",
    pressed: "press",
    active: "active",
    selected: "selected",
    checked: "checked",
    focus: "focus",
    focused: "focus",
    disabled: "disabled"
  };
  function stateOf(name) {
    const last = name.split("/").pop() ?? "";
    for (const word of last.toLowerCase().split(/[^a-z]+/)) {
      if (STATE_WORDS[word]) return STATE_WORDS[word];
    }
    return void 0;
  }
  function sameGroupBackgrounds(f, groupBackgrounds) {
    const state = stateOf(f.name);
    if (!state) return groupBackgrounds;
    const matching = groupBackgrounds.filter((b) => stateOf(b.name) === state);
    return matching.length > 0 ? matching : groupBackgrounds;
  }
  const MAX_REPORTED_PAIRS = 500;
  const AA_NORMAL_MIN_RATIO = 4.5;
  const AA_LARGE_MIN_RATIO = 3;
  const WHITE = { r: 1, g: 1, b: 1 };
  const BLACK = { r: 0, g: 0, b: 0 };
  const FOREGROUND_HINTS = ["text", "content", "foreground", "fg", "label", "icon", "on"];
  const BACKGROUND_HINTS = ["background", "surface", "bg", "fill", "container", "canvas", "backdrop"];
  const FOREGROUND_SCOPES = ["TEXT_FILL"];
  const BACKGROUND_SCOPES = ["FRAME_FILL", "SHAPE_FILL"];
  function classifyColorRole(name, scopes) {
    if (scopes.some((s) => FOREGROUND_SCOPES.includes(s)) || nameHasHint(name, FOREGROUND_HINTS)) {
      return "foreground";
    }
    if (scopes.some((s) => BACKGROUND_SCOPES.includes(s)) || nameHasHint(name, BACKGROUND_HINTS)) {
      return "background";
    }
    return "unknown";
  }
  function relativeLuminance(color) {
    const linearize = (channel) => channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    const r = linearize(color.r);
    const g = linearize(color.g);
    const b = linearize(color.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function valueForMode(variable, modeName) {
    if (modeName !== void 0) {
      const match = variable.valuesByMode.find((m) => m.modeName === modeName);
      if (match) return match.value;
    }
    return defaultModeValue(variable);
  }
  function resolveVariableColor(variable, variablesById, modeName, depth = 0) {
    if (depth > 10) return null;
    const value = valueForMode(variable, modeName);
    if (!value) return null;
    if (value.kind === "color") return value.color;
    if (value.kind === "alias") {
      const next = variablesById.get(value.variableId);
      if (!next) return null;
      return resolveVariableColor(next, variablesById, modeName, depth + 1);
    }
    return null;
  }
  function collectColorTokens(ds, modeName) {
    const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
    const tokens = [];
    let skippedTranslucentCount = 0;
    const seenNames = /* @__PURE__ */ new Set();
    for (const v of ds.variables) {
      if (v.category !== "color" && v.category !== "semantic") continue;
      if (v.resolvedType !== "COLOR") continue;
      const color = resolveVariableColor(v, variablesById, modeName);
      if (!color) continue;
      if (color.a < 0.999) {
        skippedTranslucentCount += 1;
        continue;
      }
      if (seenNames.has(v.name)) continue;
      seenNames.add(v.name);
      tokens.push({
        name: v.name,
        cssName: v.cssName,
        color,
        role: classifyColorRole(v.name, v.scopes)
      });
    }
    for (const s of ds.styles.color) {
      if (!s.paint || s.paintIsGradientOrImage) continue;
      if (seenNames.has(s.name)) continue;
      if (s.paint.a < 0.999) {
        skippedTranslucentCount += 1;
        continue;
      }
      seenNames.add(s.name);
      tokens.push({
        name: s.name,
        cssName: s.cssName,
        color: s.paint,
        role: classifyColorRole(s.name, [])
      });
    }
    return { tokens, skippedTranslucentCount };
  }
  function colorModeNames(ds) {
    const names = [];
    for (const v of ds.variables) {
      if (v.resolvedType !== "COLOR") continue;
      if (v.category !== "color" && v.category !== "semantic") continue;
      for (const m of v.valuesByMode) {
        if (!names.includes(m.modeName)) names.push(m.modeName);
      }
    }
    return names;
  }
  function computeContrastReportsByMode(ds) {
    const modes = colorModeNames(ds);
    if (modes.length <= 1) {
      return [{ modeName: modes[0] ?? null, report: computeContrastReport(ds, modes[0]) }];
    }
    return modes.map((modeName) => ({ modeName, report: computeContrastReport(ds, modeName) }));
  }
  function computeContrastReport(ds, modeName) {
    const { tokens, skippedTranslucentCount } = collectColorTokens(ds, modeName);
    const foregrounds = tokens.filter((t) => t.role === "foreground");
    const backgrounds = tokens.filter((t) => t.role === "background");
    const pairing = foregrounds.length * backgrounds.length > MAX_UNSCOPED_PAIRS ? "same-group" : "all";
    const counts = {
      pairing,
      foregroundCount: foregrounds.length,
      backgroundCount: backgrounds.length
    };
    const candidates = pairing === "same-group" ? foregrounds.flatMap(
      (f) => sameGroupBackgrounds(
        f,
        backgrounds.filter((b) => groupOf(b.name) === groupOf(f.name))
      ).map((b) => [f, b])
    ) : foregrounds.flatMap((f) => backgrounds.map((b) => [f, b]));
    if (candidates.length > 0) {
      let kept = [];
      let cutoff = Infinity;
      let totalPairs = 0;
      let passingNormalCount = 0;
      let failingLargeCount = 0;
      {
        for (const [foreground, background] of candidates) {
          if (foreground.name === background.name) continue;
          const ratio = contrastRatio(foreground.color, background.color);
          totalPairs += 1;
          if (ratio >= AA_NORMAL_MIN_RATIO) passingNormalCount += 1;
          if (ratio < AA_LARGE_MIN_RATIO) failingLargeCount += 1;
          if (ratio >= cutoff) continue;
          kept.push({
            foreground,
            background,
            ratio,
            passesAANormal: ratio >= AA_NORMAL_MIN_RATIO,
            passesAALarge: ratio >= AA_LARGE_MIN_RATIO
          });
          if (kept.length >= MAX_REPORTED_PAIRS * 4) {
            kept.sort((a, b) => a.ratio - b.ratio);
            kept = kept.slice(0, MAX_REPORTED_PAIRS);
            cutoff = kept[kept.length - 1].ratio;
          }
        }
      }
      kept.sort((a, b) => a.ratio - b.ratio);
      return {
        ...counts,
        pairs: kept.slice(0, MAX_REPORTED_PAIRS),
        totalPairs,
        passingNormalCount,
        failingLargeCount,
        fallbackChecks: [],
        totalColorTokensChecked: tokens.length,
        skippedTranslucentCount
      };
    }
    const fallbackChecks = tokens.map((token) => {
      const ratioOnWhite = contrastRatio(token.color, WHITE);
      const ratioOnBlack = contrastRatio(token.color, BLACK);
      return {
        token,
        ratioOnWhite,
        ratioOnBlack,
        passesOnWhite: ratioOnWhite >= AA_NORMAL_MIN_RATIO,
        passesOnBlack: ratioOnBlack >= AA_NORMAL_MIN_RATIO
      };
    }).sort(
      (a, b) => Math.max(b.ratioOnWhite, b.ratioOnBlack) - Math.max(a.ratioOnWhite, a.ratioOnBlack)
    );
    return {
      ...counts,
      pairs: [],
      totalPairs: 0,
      passingNormalCount: 0,
      failingLargeCount: 0,
      fallbackChecks,
      totalColorTokensChecked: tokens.length,
      skippedTranslucentCount
    };
  }
  function computeDefinedPairs(ds, specs, modeName) {
    const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
    const colors = /* @__PURE__ */ new Map();
    for (const s of ds.styles.color) {
      if (s.paint && !s.paintIsGradientOrImage) colors.set(s.name, s.paint);
    }
    for (const v of ds.variables) {
      if (v.resolvedType !== "COLOR") continue;
      const color = resolveVariableColor(v, variablesById, modeName);
      if (color) colors.set(v.name, color);
    }
    return specs.map((spec) => {
      const foreground = colors.get(spec.foreground);
      const background = colors.get(spec.background);
      if (!foreground || !background) return { spec, status: "missing" };
      if (foreground.a < 0.999 || background.a < 0.999) return { spec, status: "translucent" };
      const ratio = contrastRatio(foreground, background);
      return {
        spec,
        status: "ok",
        ratio,
        passesAANormal: ratio >= AA_NORMAL_MIN_RATIO,
        passesAALarge: ratio >= AA_LARGE_MIN_RATIO
      };
    });
  }
  const MAX_FAILING_ROWS = 100;
  function formatRatio(ratio) {
    return `${ratio.toFixed(2)}:1`;
  }
  function contrastPairsTable(pairs) {
    const rows = pairs.map((p) => [
      p.foreground.name,
      p.background.name,
      formatRatio(p.ratio),
      p.passesAANormal ? "Pass" : "Fail",
      p.passesAALarge ? "Pass" : "Fail"
    ]);
    return mdTable(
      ["Foreground", "Background", "Ratio", "AA Normal (4.5:1)", "AA Large (3:1)"],
      rows
    );
  }
  function fallbackChecksTable(checks) {
    const rows = checks.map((c) => [
      c.token.name,
      c.token.cssName,
      `${formatRatio(c.ratioOnWhite)} (${c.passesOnWhite ? "Pass" : "Fail"})`,
      `${formatRatio(c.ratioOnBlack)} (${c.passesOnBlack ? "Pass" : "Fail"})`
    ]);
    return mdTable(["Token", "CSS Variable", "On White", "On Black"], rows);
  }
  function contrastBody(report, level) {
    const notes = [];
    if (report.skippedTranslucentCount > 0) {
      notes.push(
        `${report.skippedTranslucentCount} color token(s) were skipped — partial opacity makes their effective contrast depend on whatever they end up composited over.`
      );
    }
    if (report.totalColorTokensChecked === 0) {
      return "_No opaque color tokens available to check._\n";
    }
    if (report.pairs.length > 0) {
      const failing = report.pairs.filter((p) => !p.passesAALarge).slice(0, MAX_FAILING_ROWS);
      const largeOnly = report.pairs.filter((p) => p.passesAALarge && !p.passesAANormal).slice(0, MAX_FAILING_ROWS);
      const largeOnlyCount = report.totalPairs - report.passingNormalCount - report.failingLargeCount;
      if (report.pairing === "same-group") {
        notes.push(
          `This file has ${report.foregroundCount} foreground-like and ${report.backgroundCount} background-like color tokens, too many to pair every combination meaningfully. Pairs are only inferred between tokens in the same group (the same name up to the last "/", for example "Components/Alert/Primary/Text" and "Components/Alert/Primary/Background"), and when names carry a state (Default, Hover, Pressed, Active, Disabled, Focus) only within the same state. Combinations across groups are not checked; add them in the plugin's Contrast tab.`
        );
      }
      notes.unshift(
        `Checked ${report.totalPairs} foreground/background token pair(s), inferred from naming conventions and variable scopes (e.g. "Text/*" vs "Surface/*" names, or TEXT_FILL vs FRAME_FILL/SHAPE_FILL scopes). ${report.passingNormalCount} of ${report.totalPairs} pair(s) meet WCAG AA for normal text (4.5:1).`
      );
      if (report.failingLargeCount > failing.length) {
        notes.push(
          `Showing the ${failing.length} lowest-contrast of ${report.failingLargeCount} failing pairs.`
        );
      }
      return joinSections([
        mdList(notes),
        mdHeading(level, "Pairs Failing AA Large (below 3:1)"),
        failing.length > 0 ? contrastPairsTable(failing) : "_Every inferred foreground/background pair meets at least AA Large contrast (3:1)._\n",
        mdHeading(level, "Pairs Passing AA Large Only (3:1 to below 4.5:1)"),
        largeOnly.length > 0 ? joinSections([
          "_Fine for large text (18pt, or 14pt bold) and UI components, but below AA for normal text._\n",
          largeOnlyCount > largeOnly.length ? `Showing the ${largeOnly.length} lowest-contrast of ${largeOnlyCount} such pairs.
` : "",
          contrastPairsTable(largeOnly)
        ]) : "_No inferred pair falls between AA Large and AA Normal contrast._\n"
      ]);
    }
    notes.unshift(
      report.pairing === "same-group" ? `No foreground-like token shares a group with a background-like one (${report.foregroundCount} and ${report.backgroundCount} tokens), so every opaque color token (${report.totalColorTokensChecked}) was checked against pure white and pure black instead.` : `No foreground/background roles could be inferred from token names or scopes, so every opaque color token (${report.totalColorTokensChecked}) was checked against pure white and pure black instead.`
    );
    return joinSections([
      mdList(notes),
      mdHeading(level, "All Tokens vs. White / Black"),
      fallbackChecksTable(report.fallbackChecks)
    ]);
  }
  function definedPairsBlock(ds, modeName, level) {
    const specs = ds.contrastPairs ?? [];
    if (specs.length === 0) return "";
    const results = computeDefinedPairs(ds, specs, modeName ?? void 0);
    const rows = results.map((r) => {
      const names = [r.spec.foreground, r.spec.background];
      if (r.status === "missing") return [...names, "—", "Token not found", "Token not found"];
      if (r.status === "translucent") return [...names, "—", "Translucent", "Translucent"];
      return [
        ...names,
        formatRatio(r.ratio),
        r.passesAANormal ? "Pass" : "Fail",
        r.passesAALarge ? "Pass" : "Fail"
      ];
    });
    return joinSections([
      mdHeading(level, "Defined Pairs"),
      "Pairs chosen explicitly in the plugin, checked in addition to the inferred ones.\n",
      mdTable(["Foreground", "Background", "Ratio", "AA Normal (4.5:1)", "AA Large (3:1)"], rows)
    ]);
  }
  function colorContrastSection(ds) {
    const reports = computeContrastReportsByMode(ds);
    if (reports.length === 1) {
      return joinSections([
        mdHeading(3, "Color Contrast"),
        contrastBody(reports[0].report, 4),
        definedPairsBlock(ds, reports[0].modeName, 4)
      ]);
    }
    return joinSections([
      mdHeading(3, "Color Contrast"),
      `Checked separately for each of the ${reports.length} color modes: ${reports.map((r) => r.modeName).join(", ")}.
`,
      ...reports.flatMap(({ modeName, report }) => [
        mdHeading(4, `Mode: ${modeName}`),
        contrastBody(report, 5),
        definedPairsBlock(ds, modeName, 5)
      ])
    ]);
  }
  function accessibilitySection(ds) {
    const smallTextStyles = ds.styles.text.filter(
      (s) => {
        var _a, _b;
        return (((_a = s.textProperties) == null ? void 0 : _a.fontSize) ?? 0) > 0 && (((_b = s.textProperties) == null ? void 0 : _b.fontSize) ?? 100) < 12;
      }
    );
    const undocumentedColors = [
      ...ds.variables.filter((v) => v.category === "color" && !v.description),
      ...ds.styles.color.filter((s) => !s.description)
    ];
    const notes = [
      "This section lists deterministic, rule-based checks only — no AI is involved. The Color Contrast subsection below computes real WCAG 2.1 contrast ratios from token color values."
    ];
    if (smallTextStyles.length > 0) {
      notes.push(
        `${smallTextStyles.length} text style(s) are set below 12px, which may fail legibility guidelines: ${smallTextStyles.map((s) => s.name).join(", ")}.`
      );
    }
    if (undocumentedColors.length > 0) {
      notes.push(
        `${undocumentedColors.length} color token(s) have no description — consider documenting intended usage and contrast pairing.`
      );
    }
    notes.push(
      "Contrast ratios are computed only for token pairs (or white/black substitutes) inferred from naming — always confirm against the actual foreground/background combinations used in your UI before shipping."
    );
    return joinSections([
      mdHeading(2, "Accessibility Notes"),
      mdList(notes),
      colorContrastSection(ds)
    ]);
  }
  function componentsByPageSection(ds) {
    const countsByPage = /* @__PURE__ */ new Map();
    for (const c of ds.components) {
      const count = c.isComponentSet ? c.variants.length : 1;
      const page = c.pageName.trim();
      countsByPage.set(page, (countsByPage.get(page) ?? 0) + count);
    }
    const rows = Array.from(countsByPage.entries()).sort((a, b) => b[1] - a[1]).map(([page, count]) => [page, String(count)]);
    return joinSections([
      mdHeading(3, "Components by Page"),
      "Full document scan, including any draft, playground, or example pages — not just pages intended for publishing. Compare against Figma's own library/publish count if this total looks higher than expected.\n",
      mdTable(["Page", "Component Count"], rows)
    ]);
  }
  function markdownLinkTarget(path) {
    return encodeURI(path).replace(/\(/g, "%28").replace(/\)/g, "%29");
  }
  function componentsSection(ds) {
    if (ds.components.length === 0) {
      return joinSections([
        mdHeading(2, "Components"),
        "_No components or component sets found in this file._\n"
      ]);
    }
    const docPaths = assignComponentDocPaths(ds.components);
    const rows = ds.components.map((c) => {
      var _a;
      return [
        c.name,
        c.isComponentSet ? "Component Set" : "Component",
        c.pageName.trim(),
        String(c.variants.length),
        c.states.join(", ") || "—",
        c.sizes.join(", ") || "—",
        `[${(_a = docPaths.get(c.id)) == null ? void 0 : _a.replace(/^components\//, "")}](./${markdownLinkTarget(docPaths.get(c.id) ?? "")})`
      ];
    });
    return joinSections([
      mdHeading(2, "Components"),
      "Full per-component documentation lives in `/components`. See individual files for variants, properties, and token references.\n",
      componentsByPageSection(ds),
      mdHeading(3, "All Components"),
      mdTable(["Component", "Type", "Page", "Variants", "States", "Sizes", "Docs"], rows)
    ]);
  }
  function namingConventionsSection(ds) {
    const allNames = [
      ...ds.variables.map((v) => v.name),
      ...Object.values(ds.styles).flat().map((s) => s.name)
    ];
    const slashDelimited = allNames.filter((n) => n.includes("/")).length;
    const dashDelimited = allNames.filter((n) => n.includes("-")).length;
    const camelCase = allNames.filter((n) => /[a-z][A-Z]/.test(n)).length;
    const dominant = slashDelimited >= dashDelimited && slashDelimited >= camelCase ? "slash-delimited hierarchical naming (e.g. `Color/Primary/500`)" : dashDelimited >= camelCase ? "kebab-case naming (e.g. `color-primary-500`)" : "camelCase naming (e.g. `colorPrimary500`)";
    return joinSections([
      mdHeading(2, "Naming Conventions"),
      `Detected source naming pattern: **${dominant}** (${allNames.length} names scanned).
`,
      "All generated CSS custom properties are normalized to kebab-case with a `--` prefix (e.g. `--color-primary-500`), regardless of the source naming style, so downstream code has one consistent convention.\n"
    ]);
  }
  function designPrinciplesSection() {
    return joinSections([
      mdHeading(2, "Design Principles"),
      "_DesignMD does not invent design principles — this file only documents what already exists in Figma. Add your team's principles here (e.g. consistency, accessibility, clarity, scalability) so this file stays the single source of truth for both design intent and tokens._\n"
    ]);
  }
  function overviewSection(ds) {
    const { summary, metadata } = ds;
    const rows = [
      ["Source File", metadata.fileName],
      [
        "Scope",
        metadata.scope === "selection" ? "Selected layers only (components within the selection; variables and styles are file-wide)" : "Whole file"
      ],
      ["Generated", metadata.generatedAt],
      ["Variable Collections", String(summary.variableCollectionsCount)],
      ["Variables", String(summary.variablesCount)],
      ["Modes", String(summary.modesCount)],
      ["Components", String(summary.componentsCount)],
      ["Component Sets", String(summary.componentSetsCount)],
      ["Text Styles", String(summary.textStylesCount)],
      ["Color Styles", String(summary.colorStylesCount)],
      ["Effect Styles", String(summary.effectStylesCount)],
      ["Grid Styles", String(summary.gridStylesCount)]
    ];
    return joinSections([
      mdHeading(2, "Overview"),
      "This document was generated automatically by **DesignMD** from a Figma design system. It is derived entirely from the file's Variables and Styles — no content below was generated or altered by AI.\n",
      mdTable(["Metric", "Value"], rows)
    ]);
  }
  function collectionsSection(ds) {
    const rows = ds.collections.map((c) => [
      c.name,
      c.modes.map((m) => m.name).join(", ") || "—",
      String(c.variableIds.length)
    ]);
    return joinSections([
      mdHeading(2, "Variable Collections"),
      mdTable(["Collection", "Modes", "Variable Count"], rows)
    ]);
  }
  const styleLabel = (s) => s.library ? `${s.name} (library)` : s.name;
  function defaultValueLabel(v) {
    const first = defaultModeValue(v);
    if (!first) return "—";
    if (first.kind === "alias") return `→ ${first.variableName}`;
    const primitive = primitiveValue(first);
    return primitive === null ? "—" : String(primitive);
  }
  function tokenSection(title, ds, category, fallbackNote) {
    const variables = ds.variables.filter((v) => v.category === category);
    if (variables.length > 0) {
      const rows = variables.map((v) => [
        v.name,
        v.cssName,
        defaultValueLabel(v),
        v.collectionName,
        v.description || "—"
      ]);
      return joinSections([
        mdHeading(2, title),
        mdTable(["Token", "CSS Variable", "Value", "Collection", "Description"], rows)
      ]);
    }
    return joinSections([mdHeading(2, title), `_No ${category} variables found. ${fallbackNote}_
`]);
  }
  function colorTokensSection(ds) {
    const variables = ds.variables.filter((v) => v.category === "color");
    if (variables.length > 0) return tokenSection("Color Tokens", ds, "color", "");
    const styles = ds.styles.color;
    if (styles.length === 0) {
      return joinSections([
        mdHeading(2, "Color Tokens"),
        "_No color variables or color styles found._\n"
      ]);
    }
    const rows = styles.map((s) => {
      var _a;
      return [
        styleLabel(s),
        s.cssName,
        ((_a = s.paint) == null ? void 0 : _a.hex) ?? (s.paintIsGradientOrImage ? "gradient/image" : "—"),
        s.description || "—"
      ];
    });
    return joinSections([
      mdHeading(2, "Color Tokens"),
      "_Falling back to Color Styles — no Color Variables were found in this file._\n",
      mdTable(["Style", "CSS Variable", "Value", "Description"], rows)
    ]);
  }
  function typographyTokensSection(ds) {
    const variables = ds.variables.filter((v) => v.category === "typography");
    if (variables.length > 0) return tokenSection("Typography Tokens", ds, "typography", "");
    const styles = ds.styles.text;
    if (styles.length === 0) {
      return joinSections([
        mdHeading(2, "Typography Tokens"),
        "_No typography variables or text styles found._\n"
      ]);
    }
    const rows = styles.map((s) => {
      const p = s.textProperties;
      return [
        styleLabel(s),
        s.cssName,
        isKnownFont(p == null ? void 0 : p.fontFamily) ? p.fontFamily : "—",
        p ? String(p.fontSize) : "—",
        (p == null ? void 0 : p.fontWeight) !== void 0 ? String(p.fontWeight) : "—",
        (p == null ? void 0 : p.lineHeight) ?? "—"
      ];
    });
    return joinSections([
      mdHeading(2, "Typography Tokens"),
      "_Falling back to Text Styles — no Typography Variables were found in this file._\n",
      mdTable(["Style", "CSS Variable", "Font", "Size", "Weight", "Line Height"], rows)
    ]);
  }
  function spacingTokensSection(ds) {
    return tokenSection(
      "Spacing Tokens",
      ds,
      "spacing",
      "Spacing has no style-based fallback in Figma — define Spacing as Variables to document it here."
    );
  }
  function effectTokensSection(ds) {
    const variables = ds.variables.filter((v) => v.category === "effect");
    if (variables.length > 0) return tokenSection("Effect Tokens", ds, "effect", "");
    const styles = ds.styles.effect;
    if (styles.length === 0) {
      return joinSections([
        mdHeading(2, "Effect Tokens"),
        "_No effect variables or effect styles found._\n"
      ]);
    }
    const rows = styles.map((s) => [
      styleLabel(s),
      s.cssName,
      (s.effects ?? []).map((e) => e.type).join(", ") || "—",
      s.description || "—"
    ]);
    return joinSections([
      mdHeading(2, "Effect Tokens"),
      "_Falling back to Effect Styles — no Effect Variables were found in this file._\n",
      mdTable(["Style", "CSS Variable", "Effects", "Description"], rows)
    ]);
  }
  function gridTokensSection(ds) {
    const styles = ds.styles.grid;
    if (styles.length === 0) {
      return joinSections([mdHeading(2, "Grid Tokens"), "_No grid styles found._\n"]);
    }
    const rows = styles.map((s) => [
      styleLabel(s),
      s.cssName,
      (s.grids ?? []).map((g) => g.pattern).join(", ") || "—",
      s.description || "—"
    ]);
    return joinSections([
      mdHeading(2, "Grid Tokens"),
      mdTable(["Style", "CSS Variable", "Pattern", "Description"], rows)
    ]);
  }
  function formatUsedBy(names, max = 5) {
    if (names.length === 0) return "—";
    if (names.length <= max) return names.join(", ");
    return `${names.slice(0, max).join(", ")}, +${names.length - max} more`;
  }
  function tokenUsageSection(ds) {
    if (ds.variables.length === 0) {
      return joinSections([
        mdHeading(2, "Token Usage"),
        "_No variables to cross-reference against components._\n"
      ]);
    }
    const used = ds.variables.filter((v) => v.usedByComponents.length > 0);
    const unused = ds.variables.filter((v) => v.usedByComponents.length === 0);
    const percent = Math.round(used.length / ds.variables.length * 100);
    const usedRows = [...used].sort((a, b) => b.usedByComponents.length - a.usedByComponents.length).map((v) => [
      v.name,
      v.cssName,
      String(v.usedByComponents.length),
      formatUsedBy(v.usedByComponents)
    ]);
    const unusedTable = unused.length === 0 ? "_Every variable is referenced by at least one component._\n" : mdTable(
      ["Token", "CSS Variable", "Category", "Collection"],
      unused.map((v) => [v.name, v.cssName, v.category, v.collectionName])
    );
    return joinSections([
      mdHeading(2, "Token Usage"),
      `${used.length} of ${ds.variables.length} variables (${percent}%) are referenced by at least one component in this file. Usage is derived from bound variables detected in each component's node tree, including variables bound inside the text, color, and effect styles those components apply. Very large components are scanned only up to a layer/depth budget, so usage can be under-reported for them.
`,
      mdHeading(3, "Referenced Variables"),
      mdTable(["Token", "CSS Variable", "Used By", "Components"], usedRows),
      mdHeading(3, "Unused Variables"),
      unusedTable
    ]);
  }
  const STYLE_KINDS = [
    ["text", "Text"],
    ["color", "Color"],
    ["effect", "Effect"],
    ["grid", "Grid"]
  ];
  function styleUsageSection(ds) {
    const all = STYLE_KINDS.flatMap(
      ([key, label]) => ds.styles[key].map((s) => ({ style: s, label }))
    );
    if (all.length === 0) {
      return joinSections([
        mdHeading(2, "Style Usage"),
        "_No styles to cross-reference against components._\n"
      ]);
    }
    const used = all.filter(({ style }) => {
      var _a;
      return (((_a = style.usedByComponents) == null ? void 0 : _a.length) ?? 0) > 0;
    });
    const unused = all.filter(({ style }) => {
      var _a;
      return (((_a = style.usedByComponents) == null ? void 0 : _a.length) ?? 0) === 0;
    });
    const percent = Math.round(used.length / all.length * 100);
    const unusedTable = unused.length === 0 ? "_Every style is applied inside at least one component._\n" : mdTable(
      ["Style", "Type", "CSS Variable"],
      unused.map(({ style, label }) => [style.name, label, style.cssName])
    );
    return joinSections([
      mdHeading(2, "Style Usage"),
      `${used.length} of ${all.length} styles (${percent}%) are applied inside at least one component. A style marked unused here may still be used on frames outside components, so treat the list below as candidates to review, not as safe to delete. Grid styles live on frames and are rarely applied inside components.
`,
      mdHeading(3, "Styles Not Applied In Any Component"),
      unusedTable
    ]);
  }
  function generateDesignMd(ds) {
    const content = joinSections([
      mdHeading(1, "Design System"),
      overviewSection(ds),
      collectionsSection(ds),
      colorTokensSection(ds),
      typographyTokensSection(ds),
      spacingTokensSection(ds),
      effectTokensSection(ds),
      gridTokensSection(ds),
      componentsSection(ds),
      tokenUsageSection(ds),
      styleUsageSection(ds),
      accessibilitySection(ds),
      namingConventionsSection(ds),
      designPrinciplesSection()
    ]);
    return { path: "design.md", content };
  }
  function isLeaf(node, leafTag) {
    return leafTag(node);
  }
  function buildTokenTree(entries, leafTag = (v) => typeof v === "object" && v !== null && ("$value" in v || "$type" in v)) {
    var _a;
    const root = {};
    for (const { path, leaf } of entries) {
      if (path.length === 0) continue;
      let cursor = root;
      for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        const existing = cursor[segment];
        if (existing === void 0) {
          const next = {};
          cursor[segment] = next;
          cursor = next;
        } else if (isLeaf(existing, leafTag)) {
          const next = cursor[_a = `${segment}_`] ?? (cursor[_a] = {});
          cursor = next;
        } else {
          cursor = existing;
        }
      }
      const lastSegment = path[path.length - 1];
      if (cursor[lastSegment] !== void 0 && !isLeaf(cursor[lastSegment], leafTag)) {
        cursor[`${lastSegment}_`] = leaf;
      } else {
        cursor[lastSegment] = leaf;
      }
    }
    return root;
  }
  function stripRedundantCategoryPrefix(path, category) {
    if (path.length > 1 && path[0].toLowerCase() === category.toLowerCase()) {
      return path.slice(1);
    }
    return path;
  }
  const CATEGORIES = [
    "color",
    "typography",
    "spacing",
    "effect",
    "grid",
    "semantic",
    "component"
  ];
  function isJsonLeaf(v) {
    return typeof v === "object" && v !== null && "$value" in v;
  }
  function safeSegment(segment) {
    return segment.replace(/[.{}]/g, "-").replace(/^\$/, "_");
  }
  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
  const DIMENSION_SCOPES = [
    "CORNER_RADIUS",
    "WIDTH_HEIGHT",
    "GAP",
    "FONT_SIZE",
    "LETTER_SPACING",
    "LINE_HEIGHT",
    "PARAGRAPH_SPACING",
    "PARAGRAPH_INDENT"
  ];
  function dtcgTypeForVariable(variable) {
    switch (variable.resolvedType) {
      case "COLOR":
        return "color";
      case "FLOAT":
        if (variable.scopes.includes("FONT_WEIGHT")) return "fontWeight";
        if (variable.category === "spacing") return "dimension";
        if (variable.scopes.some((s) => DIMENSION_SCOPES.includes(s))) return "dimension";
        return "number";
      case "STRING":
        return variable.scopes.includes("FONT_FAMILY") ? "fontFamily" : "string";
      case "BOOLEAN":
        return "boolean";
      default:
        return "string";
    }
  }
  function valueToJson(value, type, ctx) {
    switch (value.kind) {
      case "float":
        return type === "dimension" ? `${value.value}px` : value.value;
      case "alias": {
        const path = ctx.pathsById.get(value.variableId) ?? toPathSegments(value.variableName).map(safeSegment);
        return `{${path.join(".")}}`;
      }
      default:
        return primitiveValue(value);
    }
  }
  function variableSection(category) {
    return CATEGORIES.includes(category) ? category : "other";
  }
  function variableTreePath(variable) {
    return stripRedundantCategoryPrefix(variable.path, variable.category).map(safeSegment);
  }
  function variableToLeaf(variable, ctx) {
    const type = dtcgTypeForVariable(variable);
    const defaultValue = defaultModeValue(variable);
    const modes = {};
    for (const vbm of variable.valuesByMode) {
      modes[vbm.modeName] = valueToJson(vbm.value, type, ctx);
    }
    return {
      path: variableTreePath(variable),
      leaf: {
        $type: type,
        $value: defaultValue ? valueToJson(defaultValue, type, ctx) : null,
        $description: variable.description || void 0,
        $extensions: {
          figma: {
            id: variable.id,
            source: "variable",
            collection: variable.collectionName,
            cssName: variable.cssName,
            scopes: variable.scopes,
            modes,
            usedBy: variable.usedByComponents
          }
        }
      }
    };
  }
  function lineHeightToMultiplier(lineHeight, fontSize) {
    if (lineHeight.endsWith("%")) return round(parseFloat(lineHeight) / 100);
    if (lineHeight.endsWith("px") && fontSize > 0) return round(parseFloat(lineHeight) / fontSize);
    return void 0;
  }
  function letterSpacingToPx(letterSpacing, fontSize) {
    if (letterSpacing.endsWith("%"))
      return `${round(parseFloat(letterSpacing) / 100 * fontSize, 2)}px`;
    return letterSpacing;
  }
  function shadowToJson(e) {
    var _a;
    const shadow = {
      color: ((_a = e.color) == null ? void 0 : _a.hex) ?? "#000000",
      offsetX: `${e.offsetX ?? 0}px`,
      offsetY: `${e.offsetY ?? 0}px`,
      blur: `${e.radius ?? 0}px`,
      spread: `${e.spread ?? 0}px`
    };
    if (e.type === "INNER_SHADOW") shadow.inset = true;
    return shadow;
  }
  function styleToLeaf(style, category) {
    const figma2 = {
      id: style.id,
      source: "style",
      cssName: style.cssName,
      usedBy: style.usedByComponents ?? [],
      // A style from a library the file uses: it is not defined here.
      ...style.library ? { library: true } : {}
    };
    let type;
    let value;
    if (style.type === "PAINT") {
      if (!style.paint) return null;
      type = "color";
      value = style.paint.hex;
    } else if (style.type === "TEXT") {
      const p = style.textProperties;
      if (!p) return null;
      type = "typography";
      const typography = {
        ...isKnownFont(p.fontFamily) ? { fontFamily: p.fontFamily } : {},
        fontSize: `${p.fontSize}px`,
        fontWeight: p.fontWeight,
        letterSpacing: letterSpacingToPx(p.letterSpacing, p.fontSize)
      };
      const lineHeight = lineHeightToMultiplier(p.lineHeight, p.fontSize);
      if (lineHeight !== void 0) typography.lineHeight = lineHeight;
      value = typography;
      figma2.fontStyle = p.fontStyle;
      figma2.textCase = p.textCase;
      figma2.textDecoration = p.textDecoration;
      figma2.paragraphSpacing = p.paragraphSpacing;
    } else if (style.type === "EFFECT") {
      const visible = (style.effects ?? []).filter((e) => e.visible);
      const shadows = visible.filter((e) => e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW");
      const blur = visible.find((e) => e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR");
      if (shadows.length > 0) {
        type = "shadow";
        value = shadows.length === 1 ? shadowToJson(shadows[0]) : shadows.map(shadowToJson);
      } else if ((blur == null ? void 0 : blur.radius) !== void 0) {
        type = "dimension";
        value = `${blur.radius}px`;
        figma2.effectType = blur.type;
      } else {
        return null;
      }
    } else {
      type = "grid";
      value = (style.grids ?? []).map((g) => {
        const grid = { pattern: g.pattern };
        if (g.count !== void 0) grid.count = g.count;
        if (g.gutterSize !== void 0) grid.gutter = `${g.gutterSize}px`;
        if (g.offset !== void 0) grid.offset = `${g.offset}px`;
        if (g.sectionSize !== void 0) grid.sectionSize = `${g.sectionSize}px`;
        if (g.alignment !== void 0) grid.alignment = g.alignment;
        return grid;
      });
    }
    return {
      path: stripRedundantCategoryPrefix(style.path, category).map(safeSegment),
      leaf: {
        $type: type,
        $value: value,
        $description: style.description || void 0,
        $extensions: { figma: figma2 }
      }
    };
  }
  const CATEGORY_STYLE_FALLBACK = {
    color: "color",
    typography: "text",
    effect: "effect",
    grid: "grid"
  };
  function buildCategorySection(ds, category, ctx) {
    const variables = ds.variables.filter((v) => v.category === category);
    const fallbackKey = CATEGORY_STYLE_FALLBACK[category];
    const styles = fallbackKey ? ds.styles[fallbackKey] : [];
    const toLeaves = (list) => list.map((s) => styleToLeaf(s, category)).filter((e) => e !== null);
    const local = styles.filter((s) => !s.library);
    const library = styles.filter((s) => s.library);
    const underLibrary = (list) => toLeaves(list).map((e) => ({ ...e, path: ["library", ...e.path] }));
    let entries;
    if (variables.length > 0) {
      entries = variables.map((v) => variableToLeaf(v, ctx));
      entries.push(
        ...toLeaves(local.filter((s) => {
          var _a;
          return (((_a = s.usedByComponents) == null ? void 0 : _a.length) ?? 0) > 0;
        })).map((e) => ({
          ...e,
          path: ["styles", ...e.path]
        })),
        ...underLibrary(library).map((e) => ({ ...e, path: ["styles", ...e.path] }))
      );
    } else {
      entries = [...toLeaves(local), ...underLibrary(library)];
    }
    return buildTokenTree(entries, isJsonLeaf);
  }
  function generateTokensJson(ds) {
    const output = {
      metadata: {
        fileName: ds.metadata.fileName,
        generatedAt: ds.metadata.generatedAt,
        pluginVersion: ds.metadata.pluginVersion
      }
    };
    const ctx = {
      pathsById: new Map(
        ds.variables.map((v) => [v.id, [variableSection(v.category), ...variableTreePath(v)]])
      )
    };
    for (const category of CATEGORIES) {
      output[category] = buildCategorySection(ds, category, ctx);
    }
    const otherVariables = ds.variables.filter((v) => !CATEGORIES.includes(v.category));
    if (otherVariables.length > 0) {
      output.other = buildTokenTree(
        otherVariables.map((v) => variableToLeaf(v, ctx)),
        isJsonLeaf
      );
    }
    return {
      path: "tokens.json",
      content: JSON.stringify(output, null, 2)
    };
  }
  function generateOutputsDetailed(ds, options, extras = {}) {
    const files = [];
    const failures = [];
    const run = (output, make) => {
      try {
        const made = make();
        files.push(...Array.isArray(made) ? made : [made]);
      } catch (err) {
        failures.push({ output, reason: err instanceof Error ? err.message : String(err) });
      }
    };
    if (options.designMd) run("design.md", () => generateDesignMd(ds));
    if (options.componentDocs) run("Component docs", () => generateComponentDocs(ds));
    if (options.tokensJson) run("tokens.json", () => generateTokensJson(ds));
    if (options.cssFile) run("tokens.css", () => generateCssFile(ds));
    return { files, failures };
  }
  function collectVariantPropertyValues(variants, propertyNamePattern) {
    const values = /* @__PURE__ */ new Set();
    for (const variant of variants) {
      for (const [propName, propValue] of Object.entries(variant.variantProperties)) {
        if (propertyNamePattern.test(propName)) values.add(propValue);
      }
    }
    return Array.from(values);
  }
  const MIN_COMMON_TOKEN_USERS = 20;
  const COMMON_TOKEN_FRACTION = 0.25;
  const MAX_RELATED = 10;
  const STATE_PATTERN = /state/i;
  const SIZE_PATTERN = /size/i;
  function transformComponents(raw) {
    const docs = raw.map((c) => {
      const variants = c.variants.map((v) => ({
        id: v.id,
        name: v.name,
        variantProperties: v.variantProperties,
        description: v.description
      }));
      const properties = c.properties.map((p) => ({
        name: cleanPropertyName(p.name),
        key: p.name,
        type: p.type,
        defaultValue: p.defaultValue,
        variantOptions: p.variantOptions,
        ...p.defaultResolvedName ? { defaultResolvedName: p.defaultResolvedName } : {}
      }));
      return {
        id: c.id,
        key: c.key,
        name: c.name,
        description: c.description,
        isComponentSet: c.isComponentSet,
        variants,
        properties,
        states: collectVariantPropertyValues(variants, STATE_PATTERN),
        sizes: collectVariantPropertyValues(variants, SIZE_PATTERN),
        boundVariableIds: c.boundVariableIds,
        relatedComponentNames: [],
        pageName: c.pageName,
        layout: c.layout,
        styleIds: c.styleIds ?? []
      };
    });
    const docsByVariableId = /* @__PURE__ */ new Map();
    docs.forEach((doc, index) => {
      for (const variableId of doc.boundVariableIds) {
        const list = docsByVariableId.get(variableId);
        if (list) list.push(index);
        else docsByVariableId.set(variableId, [index]);
      }
    });
    const commonThreshold = Math.max(MIN_COMMON_TOKEN_USERS, docs.length * COMMON_TOKEN_FRACTION);
    docs.forEach((doc, index) => {
      const scores = /* @__PURE__ */ new Map();
      for (const variableId of doc.boundVariableIds) {
        const sharers = docsByVariableId.get(variableId) ?? [];
        if (sharers.length > commonThreshold) continue;
        const weight = 1 / sharers.length;
        for (const otherIndex of sharers) {
          if (otherIndex !== index) scores.set(otherIndex, (scores.get(otherIndex) ?? 0) + weight);
        }
      }
      doc.relatedComponentNames = Array.from(scores.entries()).sort((a, b) => b[1] - a[1] || docs[a[0]].name.localeCompare(docs[b[0]].name)).slice(0, MAX_RELATED).map(([i]) => docs[i].name);
    });
    return docs;
  }
  function transformTextStyles(raw) {
    return raw.map((s) => {
      const path = toPathSegments(s.name);
      return {
        id: s.id,
        name: s.name,
        path,
        type: "TEXT",
        description: s.description,
        cssName: toCssVarName(path),
        ...s.library ? { library: true } : {},
        textProperties: {
          fontFamily: s.fontFamily,
          fontStyle: s.fontStyle,
          fontWeight: s.fontWeight,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          textCase: s.textCase,
          textDecoration: s.textDecoration,
          paragraphSpacing: s.paragraphSpacing
        }
      };
    });
  }
  function transformPaintStyles(raw) {
    return raw.map((s) => {
      const path = toPathSegments(s.name);
      return {
        id: s.id,
        name: s.name,
        path,
        type: "PAINT",
        description: s.description,
        cssName: toCssVarName(path),
        ...s.library ? { library: true } : {},
        paint: s.color ? { ...s.color, hex: rgbaToHex(s.color.r, s.color.g, s.color.b, s.color.a) } : void 0,
        paintIsGradientOrImage: s.isGradientOrImage
      };
    });
  }
  function transformEffectStyles(raw) {
    return raw.map((s) => {
      const path = toPathSegments(s.name);
      return {
        id: s.id,
        name: s.name,
        path,
        type: "EFFECT",
        description: s.description,
        cssName: toCssVarName(path),
        ...s.library ? { library: true } : {},
        effects: s.effects.map((e) => ({
          type: e.type,
          color: e.color ? { ...e.color, hex: rgbaToHex(e.color.r, e.color.g, e.color.b, e.color.a) } : void 0,
          offsetX: e.offsetX,
          offsetY: e.offsetY,
          radius: e.radius,
          spread: e.spread,
          visible: e.visible
        }))
      };
    });
  }
  function transformGridStyles(raw) {
    return raw.map((s) => {
      const path = toPathSegments(s.name);
      return {
        id: s.id,
        name: s.name,
        path,
        type: "GRID",
        description: s.description,
        cssName: toCssVarName(path),
        ...s.library ? { library: true } : {},
        grids: s.grids.map((g) => ({ ...g }))
      };
    });
  }
  const SPACING_HINTS = ["spacing", "space", "gap", "padding", "margin", "radius", "size", "sizing"];
  const TYPOGRAPHY_HINTS = ["font", "typography", "type", "line-height", "letter-spacing", "text"];
  const SEMANTIC_HINTS = ["semantic"];
  const COMPONENT_HINTS = ["component"];
  function classifyVariable(fullName, resolvedType, scopes) {
    if (nameHasHint(fullName, SEMANTIC_HINTS)) return "semantic";
    if (nameHasHint(fullName, COMPONENT_HINTS)) return "component";
    if (resolvedType === "COLOR") return "color";
    if (resolvedType === "BOOLEAN") return "boolean";
    if (resolvedType === "FLOAT") {
      const typographyScopes = ["FONT_SIZE", "LINE_HEIGHT", "LETTER_SPACING", "PARAGRAPH_SPACING"];
      if (scopes.some((s) => typographyScopes.includes(s))) return "typography";
      if (nameHasHint(fullName, TYPOGRAPHY_HINTS)) return "typography";
      if (scopes.includes("GAP") || nameHasHint(fullName, SPACING_HINTS)) return "spacing";
      return "number";
    }
    if (resolvedType === "STRING") {
      if (nameHasHint(fullName, TYPOGRAPHY_HINTS)) return "typography";
      return "string";
    }
    return "other";
  }
  function toTokenValue(raw, variableNamesById) {
    switch (raw.kind) {
      case "color":
        return { kind: "color", color: { ...raw, hex: rgbaToHex(raw.r, raw.g, raw.b, raw.a) } };
      case "float":
        return { kind: "float", value: raw.value };
      case "string":
        return { kind: "string", value: raw.value };
      case "boolean":
        return { kind: "boolean", value: raw.value };
      case "alias":
        return {
          kind: "alias",
          variableId: raw.variableId,
          variableName: variableNamesById.get(raw.variableId) ?? raw.variableId
        };
      default:
        return { kind: "unknown" };
    }
  }
  function orderDefaultModeFirst(values, defaultModeId) {
    const index = values.findIndex((v) => v.modeId === defaultModeId);
    if (index <= 0) return values;
    return [values[index], ...values.slice(0, index), ...values.slice(index + 1)];
  }
  function isCollectionHidden(c) {
    return c.hiddenFromPublishing || c.name.trim().startsWith(".");
  }
  function isVariableHidden(v, collection) {
    if (v.hiddenFromPublishing) return true;
    if (collection && isCollectionHidden(collection)) return true;
    return toPathSegments(v.name).some((segment) => segment.startsWith("."));
  }
  function inlineHiddenAliases(variables, hiddenIds) {
    if (hiddenIds.size === 0) return variables;
    const byId = new Map(variables.map((v) => [v.id, v]));
    const resolve = (value, modeId, depth = 0) => {
      if (value.kind !== "alias" || !hiddenIds.has(value.variableId) || depth > 10) return value;
      const target = byId.get(value.variableId);
      if (!target) return value;
      const next = target.valuesByMode.find((m) => m.modeId === modeId) ?? target.valuesByMode[0];
      return next ? resolve(next.value, modeId, depth + 1) : { kind: "unknown" };
    };
    return variables.map((v) => ({
      ...v,
      valuesByMode: v.valuesByMode.map((m) => ({ ...m, value: resolve(m.value, m.modeId) }))
    }));
  }
  function transformVariableCollections(raw) {
    return raw.map((c) => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      variableIds: c.variableIds,
      hiddenFromPublishing: c.hiddenFromPublishing
    }));
  }
  function transformVariables(rawVariables, collections) {
    const collectionsById = new Map(collections.map((c) => [c.id, c]));
    const modeNamesByCollection = new Map(
      collections.map((c) => [c.id, new Map(c.modes.map((m) => [m.modeId, m.name]))])
    );
    const variableNamesById = new Map(rawVariables.map((v) => [v.id, v.name]));
    return rawVariables.map((v) => {
      const collection = collectionsById.get(v.variableCollectionId);
      const path = toPathSegments(v.name);
      const modeNames = modeNamesByCollection.get(v.variableCollectionId) ?? /* @__PURE__ */ new Map();
      const resolvedType = v.resolvedType;
      return {
        id: v.id,
        name: v.name,
        path,
        collectionId: v.variableCollectionId,
        collectionName: (collection == null ? void 0 : collection.name) ?? "Unknown Collection",
        resolvedType,
        category: classifyVariable(v.name, resolvedType, v.scopes),
        description: v.description,
        scopes: v.scopes,
        // Default mode first: generators treat valuesByMode[0] as the default value.
        valuesByMode: orderDefaultModeFirst(v.valuesByMode, collection == null ? void 0 : collection.defaultModeId).map((vbm) => ({
          modeId: vbm.modeId,
          modeName: modeNames.get(vbm.modeId) ?? vbm.modeId,
          value: toTokenValue(vbm.value, variableNamesById)
        })),
        codeSyntax: v.codeSyntax,
        cssName: toCssVarName(path),
        usedByComponents: []
      };
    });
  }
  function computeVariableUsage(variables, components) {
    const namesByVariableId = /* @__PURE__ */ new Map();
    for (const component of components) {
      for (const variableId of component.boundVariableIds) {
        const names = namesByVariableId.get(variableId);
        if (names) names.add(component.name);
        else namesByVariableId.set(variableId, /* @__PURE__ */ new Set([component.name]));
      }
    }
    return variables.map((variable) => ({
      ...variable,
      usedByComponents: Array.from(namesByVariableId.get(variable.id) ?? []).sort(
        (a, b) => a.localeCompare(b)
      )
    }));
  }
  function mergeStyleBoundVariables(components, styles) {
    const variableIdsByStyleId = new Map(
      styles.filter((s) => s.boundVariableIds.length > 0).map((s) => [s.id, s.boundVariableIds])
    );
    if (variableIdsByStyleId.size === 0) return components;
    return components.map((component) => {
      const extra = (component.styleIds ?? []).flatMap((id) => variableIdsByStyleId.get(id) ?? []);
      if (extra.length === 0) return component;
      return {
        ...component,
        boundVariableIds: Array.from(/* @__PURE__ */ new Set([...component.boundVariableIds, ...extra]))
      };
    });
  }
  function computeStyleUsage(styles, components) {
    const namesByStyleId = /* @__PURE__ */ new Map();
    for (const component of components) {
      for (const styleId of component.styleIds ?? []) {
        const names = namesByStyleId.get(styleId);
        if (names) names.add(component.name);
        else namesByStyleId.set(styleId, /* @__PURE__ */ new Set([component.name]));
      }
    }
    const withUsage = (list) => list.map((style) => ({
      ...style,
      usedByComponents: Array.from(namesByStyleId.get(style.id) ?? []).sort(
        (a, b) => a.localeCompare(b)
      )
    }));
    return {
      text: withUsage(styles.text),
      color: withUsage(styles.color),
      effect: withUsage(styles.effect),
      grid: withUsage(styles.grid)
    };
  }
  function buildSummary(system) {
    const modeIds = new Set(system.collections.flatMap((c) => c.modes.map((m) => m.modeId)));
    return {
      variableCollectionsCount: system.collections.length,
      variablesCount: system.variables.length,
      componentsCount: system.components.reduce(
        (sum, c) => sum + (c.isComponentSet ? c.variants.length : 1),
        0
      ),
      componentSetsCount: system.components.filter((c) => c.isComponentSet).length,
      textStylesCount: system.styles.text.filter((s) => !s.library).length,
      colorStylesCount: system.styles.color.filter((s) => !s.library).length,
      effectStylesCount: system.styles.effect.filter((s) => !s.library).length,
      gridStylesCount: system.styles.grid.filter((s) => !s.library).length,
      modesCount: modeIds.size
    };
  }
  function makeCssNamesUnique(variables, styles) {
    const taken = /* @__PURE__ */ new Set();
    let renamed = 0;
    const claim = (token) => {
      if (!taken.has(token.cssName)) {
        taken.add(token.cssName);
        return;
      }
      const base = token.cssName;
      let n = 2;
      while (taken.has(`${base}-${n}`)) n++;
      token.cssName = `${base}-${n}`;
      taken.add(token.cssName);
      renamed++;
    };
    variables.forEach(claim);
    [...styles.text, ...styles.color, ...styles.effect, ...styles.grid].forEach(claim);
    return { renamed };
  }
  const PLUGIN_VERSION = "1.3.0";
  function transformToDesignSystem(raw, fileName, scope = "file") {
    const allCollections = transformVariableCollections(raw.collections);
    const collectionsById = new Map(raw.collections.map((c) => [c.id, c]));
    const hiddenVariableIds = new Set(
      raw.variables.filter((v) => isVariableHidden(v, collectionsById.get(v.variableCollectionId))).map((v) => v.id)
    );
    const warnings = [...raw.warnings];
    if (hiddenVariableIds.size > 0) {
      warnings.push(
        `Skipped ${hiddenVariableIds.size} variable(s) hidden from publishing (hidden flag, or a name/group/collection starting with ".").`
      );
    }
    const collections = allCollections.filter((c) => !isCollectionHidden(c)).map((c) => ({ ...c, variableIds: c.variableIds.filter((id) => !hiddenVariableIds.has(id)) }));
    const rawStyles = {
      text: transformTextStyles(raw.textStyles),
      color: transformPaintStyles(raw.paintStyles),
      effect: transformEffectStyles(raw.effectStyles),
      grid: transformGridStyles(raw.gridStyles)
    };
    const rawComponents = mergeStyleBoundVariables(raw.components, [
      ...raw.textStyles,
      ...raw.paintStyles,
      ...raw.effectStyles
    ]).map((c) => ({
      ...c,
      boundVariableIds: c.boundVariableIds.filter((id) => !hiddenVariableIds.has(id))
    }));
    const components = transformComponents(rawComponents);
    const variables = computeVariableUsage(
      inlineHiddenAliases(
        transformVariables(raw.variables, allCollections),
        hiddenVariableIds
      ).filter((v) => !hiddenVariableIds.has(v.id)),
      components
    );
    const styles = computeStyleUsage(rawStyles, components);
    const { renamed } = makeCssNamesUnique(variables, styles);
    if (renamed > 0) {
      warnings.push(
        `${renamed} token(s) had a CSS name another token already had (names differ only in characters that CSS names drop), so a numeric suffix was added to keep every CSS variable distinct.`
      );
    }
    const base = { collections, variables, styles, components };
    return {
      metadata: {
        fileName,
        scope,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pluginVersion: PLUGIN_VERSION
      },
      ...base,
      summary: buildSummary(base),
      warnings
    };
  }
  function filterDesignSystemByPages(ds, excludedPages) {
    const excluded = excludedPages instanceof Set ? excludedPages : new Set(excludedPages);
    if (excluded.size === 0) return ds;
    const components = ds.components.filter((c) => !excluded.has(c.pageName));
    if (components.length === ds.components.length) return ds;
    const variables = computeVariableUsage(ds.variables, components);
    const styles = computeStyleUsage(ds.styles, components);
    const base = { collections: ds.collections, variables, styles, components };
    return {
      ...ds,
      variables,
      styles,
      components,
      summary: buildSummary(base)
    };
  }
  const CHUNK_CHARS = 512 * 1024;
  const CHUNK_TOTAL_THRESHOLD = 2 * 1024 * 1024;
  function needsChunking(files) {
    let total = 0;
    for (const f of files) {
      total += f.content.length;
      if (total > CHUNK_TOTAL_THRESHOLD) return true;
    }
    return false;
  }
  function chunkFile(file, size = CHUNK_CHARS) {
    const pieces = [];
    let start = 0;
    while (start < file.content.length) {
      let end = Math.min(start + size, file.content.length);
      const last = file.content.charCodeAt(end - 1);
      if (end < file.content.length && last >= 55296 && last <= 56319) end--;
      pieces.push(file.content.slice(start, end));
      start = end;
    }
    if (pieces.length === 0) pieces.push("");
    return pieces.map((data, part) => ({
      type: "file-chunk",
      path: file.path,
      part,
      parts: pieces.length,
      data
    }));
  }
  figma.showUI(__html__, { width: 480, height: 700, themeColors: true });
  let cachedDesignSystem;
  let cancelRequested = false;
  function post(message) {
    figma.ui.postMessage(message);
  }
  const SETTINGS_KEY = "designmd.settings.v1";
  async function loadSettings() {
    try {
      return sanitizeSavedSettings(await figma.clientStorage.getAsync(SETTINGS_KEY));
    } catch {
      return null;
    }
  }
  const fileSettingsKey = () => `designmd.file.v1:${figma.root.name}`;
  async function loadFileSettings() {
    try {
      return sanitizeFileSettings(await figma.clientStorage.getAsync(fileSettingsKey()));
    } catch {
      return sanitizeFileSettings(null);
    }
  }
  async function saveFileSettings(fileSettings) {
    try {
      await figma.clientStorage.setAsync(fileSettingsKey(), fileSettings);
    } catch {
    }
  }
  async function saveSettings(settings) {
    try {
      await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
    } catch {
    }
  }
  function postSelection() {
    post({ type: "selection", count: figma.currentPage.selection.length });
  }
  async function handleReady() {
    postSelection();
    post({
      type: "settings",
      settings: await loadSettings(),
      fileSettings: await loadFileSettings()
    });
  }
  async function handleExtract(scope) {
    try {
      const selection = scope === "selection" ? figma.currentPage.selection : void 0;
      if (selection && selection.length === 0) {
        post({
          type: "error",
          stage: "extraction",
          message: "Select at least one layer in Figma to scan only the selection."
        });
        return;
      }
      cancelRequested = false;
      const raw = await withCancellation(
        () => cancelRequested,
        () => extractDesignSystem(
          (progress) => {
            const percent = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 100;
            post({
              type: "progress",
              stage: progress.stage,
              percent,
              done: progress.done,
              total: progress.total,
              ...progress.detail ? { message: progress.detail } : {}
            });
          },
          { selection }
        )
      );
      const transformStarted = Date.now();
      const designSystem = transformToDesignSystem(raw, figma.root.name, scope);
      cachedDesignSystem = designSystem;
      console.log(
        `[DesignMD] transform: ${designSystem.summary.variablesCount} variables, ${designSystem.summary.componentSetsCount} sets in ${((Date.now() - transformStarted) / 1e3).toFixed(1)}s; sending the result to the UI`
      );
      post({ type: "extraction-complete", designSystem });
    } catch (err) {
      post({
        type: "error",
        stage: "extraction",
        message: `Failed to extract the design system: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }
  function tokenResolver(ds) {
    const names = /* @__PURE__ */ new Map();
    for (const v of ds.variables) names.set(`variable:${v.id}`, v.cssName);
    for (const s of [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid]) {
      names.set(`style:${s.id}`, s.cssName);
    }
    return (kind, id) => names.get(`${kind}:${id}`);
  }
  async function handleGenerate(options) {
    try {
      if (!cachedDesignSystem) {
        post({
          type: "error",
          stage: "generation",
          message: "Nothing to generate yet — extract the design system first."
        });
        return;
      }
      const designSystem = {
        ...filterDesignSystemByPages(cachedDesignSystem, options.excludedPages),
        contrastPairs: options.contrastPairs ?? []
      };
      const { files, failures } = generateOutputsDetailed(designSystem, {
        ...options.options,
        componentsJson: false
      });
      if (files.length === 0 && failures.length > 0) {
        post({
          type: "error",
          stage: "generation",
          message: `Failed to generate output files: ${failures.map((f) => `${f.output} (${f.reason})`).join("; ")}`
        });
        return;
      }
      if (files.length === 0) {
        post({
          type: "error",
          stage: "generation",
          message: "No output types were selected. Choose at least one export option and try again."
        });
        return;
      }
      const failureField = failures.length > 0 ? { failures } : {};
      if (needsChunking(files)) {
        for (const file of files) {
          for (const chunk of chunkFile(file)) {
            post(chunk);
            await yieldToEventLoop();
          }
        }
        post({
          type: "generation-complete",
          files: [],
          chunked: files.map((f) => f.path),
          ...failureField
        });
      } else {
        post({ type: "generation-complete", files, ...failureField });
      }
    } catch (err) {
      post({
        type: "error",
        stage: "generation",
        message: `Failed to generate output files: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }
  async function handleReadStructures(message) {
    try {
      if (!cachedDesignSystem) {
        post({
          type: "error",
          stage: "generation",
          message: "Nothing to generate yet — extract the design system first."
        });
        return;
      }
      const designSystem = filterDesignSystemByPages(cachedDesignSystem, message.excludedPages);
      cancelRequested = false;
      const stats = newReadStats();
      const started = Date.now();
      const prefix = [0];
      for (const c of designSystem.components) {
        const trees = message.includeVariantDiffs && c.isComponentSet ? Math.max(1, c.variants.length) : 1;
        prefix.push(prefix[prefix.length - 1] + trees);
      }
      await withCancellation(
        () => cancelRequested,
        () => extractStructures(
          designSystem.components,
          {
            includeText: message.includeText,
            includeVariantDiffs: message.includeVariantDiffs,
            includeInstanceInternals: message.includeInstanceInternals,
            includeVectorShapes: message.includeVectorShapes,
            resolveImage: message.includeImages ? createImageResolver((path, bytes) => post({ type: "image", path, bytes })) : void 0,
            resolveToken: tokenResolver(designSystem),
            stats
          },
          (done, total) => post({
            type: "progress",
            stage: "structure",
            percent: prefix[total] > 0 ? Math.round(prefix[Math.min(done, total)] / prefix[total] * 100) : 100,
            done,
            total
          }),
          (items) => post({ type: "structures", items }),
          false
        )
      );
      const seconds = Math.round((Date.now() - started) / 1e3);
      const perLayer = stats.layers > 0 ? ((Date.now() - started) / stats.layers).toFixed(2) : "0";
      console.log(
        `[DesignMD] read ${stats.trees} layer trees (${stats.layers} layers) in ${seconds}s, ${perLayer} ms per layer; ${stats.instanceLookups} instance lookups took ${Math.round(stats.instanceMs / 1e3)}s`
      );
      post({ type: "structures-complete", cancelled: cancelRequested });
    } catch (err) {
      post({
        type: "error",
        stage: "generation",
        message: `Failed to read the component layers: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }
  figma.ui.onmessage = async (message) => {
    switch (message.type) {
      case "ready":
        await handleReady();
        break;
      case "extract":
        await handleExtract(message.scope ?? "file");
        break;
      case "save-settings":
        await saveSettings(message.settings);
        break;
      case "save-file-settings":
        await saveFileSettings(message.fileSettings);
        break;
      case "generate":
        await handleGenerate(message);
        break;
      case "read-structures":
        await handleReadStructures(message);
        break;
      case "cancel":
        cancelRequested = true;
        break;
    }
  };
  figma.on("selectionchange", postSelection);
})();
