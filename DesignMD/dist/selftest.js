(function() {
  "use strict";
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
  async function processInBatches(items, batchSize, fn, onBatch) {
    const results = new Array(items.length);
    for (let start = 0; start < items.length; start += batchSize) {
      const end = Math.min(start + batchSize, items.length);
      const batch = await Promise.all(
        items.slice(start, end).map((item, offset) => fn(item, start + offset))
      );
      batch.forEach((result, offset) => {
        results[start + offset] = result;
      });
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
  function readStyleIds(n, into) {
    for (const key of STYLE_ID_KEYS) {
      try {
        const value = n[key];
        if (typeof value === "string" && value !== "") into.add(value);
      } catch {
      }
    }
  }
  async function scanNodeBindings(node, yieldIfDue, counters) {
    const variableIds = /* @__PURE__ */ new Set();
    const styleIds = /* @__PURE__ */ new Set();
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
      readStyleIds(n, styleIds);
      if ("children" in n) {
        for (const child of n.children) {
          await visit(child, depth + 1);
        }
      }
    };
    await visit(node, 0);
    return { variableIds: Array.from(variableIds), styleIds: Array.from(styleIds), truncated };
  }
  function numberProp(n, key) {
    try {
      const value = n[key];
      return typeof value === "number" && Number.isFinite(value) ? value : void 0;
    } catch {
      return void 0;
    }
  }
  const round = (value) => Math.round(value * 100) / 100;
  function readLayout(node) {
    const width = numberProp(node, "width");
    const height = numberProp(node, "height");
    if (width === void 0 || height === void 0) return void 0;
    const mode = node.layoutMode;
    const layoutMode = mode === "HORIZONTAL" || mode === "VERTICAL" ? mode : "NONE";
    const layout = {
      measuredFrom: node.name,
      width: round(width),
      height: round(height),
      layoutMode
    };
    if (layoutMode !== "NONE") {
      const gap = numberProp(node, "itemSpacing");
      if (gap !== void 0) layout.gap = round(gap);
      const [top, right, bottom, left] = [
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft"
      ].map((key) => numberProp(node, key));
      if ([top, right, bottom, left].every((p) => p !== void 0)) {
        layout.padding = {
          top: round(top),
          right: round(right),
          bottom: round(bottom),
          left: round(left)
        };
      }
    }
    const radius = numberProp(node, "cornerRadius");
    if (radius !== void 0 && radius > 0) layout.cornerRadius = round(radius);
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
    const scanStarted = Date.now();
    const nodes = selection ? await safely(
      () => Promise.resolve(findComponentsWithin(selection)),
      (err) => warn(`Failed to scan selection for components: ${String(err)}`)
    ) : await findInDocument(warn);
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
          layout: variantMembers.length > 0 ? readLayout(defaultVariantOf(set, variantMembers)) : void 0,
          boundVariableIds: unionOf(mapped.map((m) => m.bindings.variableIds)),
          styleIds: unionOf(mapped.map((m) => m.bindings.styleIds))
        };
      }
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
          layout: readLayout(node),
          boundVariableIds: bindings.variableIds,
          styleIds: bindings.styleIds
        };
      }
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
  const sorted = (names) => [...names].sort((a, b) => a.localeCompare(b));
  const fmt = (names) => `[${sorted(names).join(", ")}]`;
  function expectNames(name, actual, expected) {
    const ok = fmt(actual) === fmt(expected);
    return { name, ok, detail: ok ? void 0 : `expected ${fmt(expected)}, got ${fmt(actual)}` };
  }
  function component(name, parent, width = 100, height = 40) {
    const node = figma.createComponent();
    node.name = name;
    node.resize(width, height);
    parent.appendChild(node);
    return node;
  }
  function buildFixture(page) {
    const group = figma.createFrame();
    group.name = "Group";
    page.appendChild(group);
    const button = component("Button", group, 120, 40);
    button.layoutMode = "HORIZONTAL";
    button.itemSpacing = 8;
    button.paddingTop = button.paddingBottom = 12;
    button.paddingLeft = button.paddingRight = 16;
    button.cornerRadius = 6;
    const nested = figma.createFrame();
    nested.name = "Nested";
    group.appendChild(nested);
    component("Icon", nested, 24, 24);
    component(".Hidden", group);
    const outside = component("Outside", page);
    const small = figma.createComponent();
    small.name = "Size=Small";
    const large = figma.createComponent();
    large.name = "Size=Large";
    page.appendChild(small);
    page.appendChild(large);
    const chip = figma.combineAsVariants([small, large], page);
    chip.name = "Chip";
    const rect = figma.createRectangle();
    page.appendChild(rect);
    return { group, button, nested, outside, chip, variant: chip.children[0], rect };
  }
  async function scan(selection) {
    figma.currentPage.selection = selection;
    const warnings = [];
    const result = await extractComponents(void 0, (m) => warnings.push(m), [
      ...figma.currentPage.selection
    ]);
    return { result, warnings };
  }
  async function runSelectionSelfTest() {
    var _a, _b, _c, _d, _e;
    const previousPage = figma.currentPage;
    const page = figma.createPage();
    page.name = "DesignMD self-test (temporary)";
    const checks = [];
    try {
      await figma.setCurrentPageAsync(page);
      const f = buildFixture(page);
      const names = (r) => r.map((c) => c.name);
      let { result } = await scan([f.group]);
      checks.push(
        expectNames("frame selection finds nested components", names(result), ["Button", "Icon"])
      );
      checks.push({
        name: 'components hidden with a "." name are skipped',
        ok: !names(result).includes(".Hidden")
      });
      ({ result } = await scan([f.button]));
      checks.push(expectNames("component selection", names(result), ["Button"]));
      ({ result } = await scan([f.variant]));
      checks.push(expectNames("variant selection resolves to its set", names(result), ["Chip"]));
      checks.push({
        name: "resolved set keeps every variant",
        ok: ((_a = result[0]) == null ? void 0 : _a.isComponentSet) === true && result[0].variants.length === 2,
        detail: `isComponentSet=${(_b = result[0]) == null ? void 0 : _b.isComponentSet}, variants=${(_c = result[0]) == null ? void 0 : _c.variants.length}`
      });
      ({ result } = await scan([f.rect]));
      checks.push(expectNames("non-container selection finds nothing", names(result), []));
      ({ result } = await scan([f.group, f.outside, f.variant, f.chip]));
      checks.push(
        expectNames("mixed selection, no duplicates", names(result), [
          "Button",
          "Icon",
          "Outside",
          "Chip"
        ])
      );
      ({ result } = await scan([f.button]));
      const layout = (_d = result[0]) == null ? void 0 : _d.layout;
      checks.push({
        name: "layout reads size, auto layout, gap, padding and radius",
        ok: (layout == null ? void 0 : layout.width) === 120 && layout.height === 40 && layout.layoutMode === "HORIZONTAL" && layout.gap === 8 && ((_e = layout.padding) == null ? void 0 : _e.left) === 16 && layout.padding.top === 12 && layout.cornerRadius === 6,
        detail: JSON.stringify(layout)
      });
      const whole = await extractComponents();
      const wholeNames = names(whole);
      checks.push({
        name: "whole-file scan still finds the scratch components",
        ok: ["Button", "Icon", "Outside", "Chip"].every((n) => wholeNames.includes(n)),
        detail: fmt(wholeNames)
      });
    } catch (err) {
      checks.push({ name: "self-test ran without throwing", ok: false, detail: String(err) });
    } finally {
      try {
        await figma.setCurrentPageAsync(previousPage);
        page.remove();
      } catch (err) {
        checks.push({ name: "scratch page cleaned up", ok: false, detail: String(err) });
      }
    }
    return checks;
  }
  async function main() {
    const checks = await runSelectionSelfTest();
    const failed = checks.filter((c) => !c.ok);
    for (const c of checks) {
      console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    }
    figma.closePlugin(
      failed.length === 0 ? `DesignMD self-test: all ${checks.length} checks passed` : `DesignMD self-test: ${failed.length} of ${checks.length} FAILED — open the console (Plugins › Development › Open console)`
    );
  }
  void main();
})();
