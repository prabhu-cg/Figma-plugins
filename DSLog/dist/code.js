(function() {
  "use strict";
  let counter = 0;
  function generateId(prefix) {
    counter += 1;
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
  }
  function getLatestChangeSetForBaseline(project2, baselineId) {
    const sets = project2.changeSets.filter((cs) => cs.baselineId === baselineId);
    if (sets.length === 0) return void 0;
    return sets.reduce((latest, cs) => cs.createdAt > latest.createdAt ? cs : latest);
  }
  const STORAGE_SCHEMA_VERSION = 2;
  const STORAGE_CHUNK_SIZE_CLIENT = 8e5;
  const STORAGE_CHUNK_SIZE_PLUGIN_DATA = 4e4;
  const SCAN_BATCH_SIZE = 25;
  const DEFAULT_SETTINGS = {
    tracking: { components: true, tokens: true },
    detection: { structural: true, tokens: true, properties: true, styles: true }
  };
  function createEmptyProject(schemaVersion) {
    return {
      schemaVersion,
      baselines: [],
      releases: [],
      changeSets: [],
      trackedEntities: [],
      settings: DEFAULT_SETTINGS
    };
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isArray(value) {
    return Array.isArray(value);
  }
  function migrateReviewState(change) {
    if (change.reviewState === "unreviewed" || change.reviewState === "reviewed" || change.reviewState === "accepted" || change.reviewState === "rejected") {
      return change.reviewState;
    }
    return change.reviewed === true ? "reviewed" : "unreviewed";
  }
  function migrateChangeSets(value) {
    if (!isArray(value)) return [];
    return value.map((raw) => {
      if (!isRecord(raw) || !isArray(raw.changes)) return raw;
      return {
        ...raw,
        changes: raw.changes.map(
          (c) => isRecord(c) ? { ...c, reviewState: migrateReviewState(c) } : c
        )
      };
    });
  }
  function migrateProject(value) {
    const empty = createEmptyProject(STORAGE_SCHEMA_VERSION);
    if (!isRecord(value)) return empty;
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      currentBaselineId: typeof value.currentBaselineId === "string" ? value.currentBaselineId : void 0,
      baselines: isArray(value.baselines) ? value.baselines : empty.baselines,
      releases: isArray(value.releases) ? value.releases : empty.releases,
      changeSets: migrateChangeSets(value.changeSets),
      trackedEntities: isArray(value.trackedEntities) ? value.trackedEntities : empty.trackedEntities,
      instanceIndex: isRecord(value.instanceIndex) ? value.instanceIndex : void 0,
      settings: isRecord(value.settings) ? value.settings : empty.settings
    };
  }
  const clientStorageAdapter = {
    async get(key) {
      const value = await figma.clientStorage.getAsync(key);
      return typeof value === "string" ? value : void 0;
    },
    async set(key, value) {
      await figma.clientStorage.setAsync(key, value);
    },
    async delete(key) {
      await figma.clientStorage.deleteAsync(key);
    },
    async keys() {
      return figma.clientStorage.keysAsync();
    }
  };
  const pluginDataAdapter = {
    async get(key) {
      const value = figma.root.getPluginData(key);
      return value === "" ? void 0 : value;
    },
    async set(key, value) {
      figma.root.setPluginData(key, value);
    },
    async delete(key) {
      figma.root.setPluginData(key, "");
    },
    async keys() {
      return figma.root.getPluginDataKeys();
    }
  };
  function utf8Encode(input) {
    const bytes = [];
    for (let i = 0; i < input.length; i++) {
      let codePoint = input.codePointAt(i);
      if (codePoint === void 0) continue;
      if (codePoint > 65535) i++;
      if (codePoint < 128) {
        bytes.push(codePoint);
      } else if (codePoint < 2048) {
        bytes.push(192 | codePoint >> 6, 128 | codePoint & 63);
      } else if (codePoint < 65536) {
        bytes.push(224 | codePoint >> 12, 128 | codePoint >> 6 & 63, 128 | codePoint & 63);
      } else {
        bytes.push(
          240 | codePoint >> 18,
          128 | codePoint >> 12 & 63,
          128 | codePoint >> 6 & 63,
          128 | codePoint & 63
        );
      }
    }
    return new Uint8Array(bytes);
  }
  function utf8Decode(bytes) {
    let result = "";
    let i = 0;
    while (i < bytes.length) {
      const byte1 = bytes[i] ?? 0;
      if (byte1 < 128) {
        result += String.fromCharCode(byte1);
        i += 1;
      } else if ((byte1 & 224) === 192 && i + 1 < bytes.length) {
        const byte2 = bytes[i + 1] ?? 0;
        result += String.fromCharCode((byte1 & 31) << 6 | byte2 & 63);
        i += 2;
      } else if ((byte1 & 240) === 224 && i + 2 < bytes.length) {
        const byte2 = bytes[i + 1] ?? 0;
        const byte3 = bytes[i + 2] ?? 0;
        result += String.fromCharCode((byte1 & 15) << 12 | (byte2 & 63) << 6 | byte3 & 63);
        i += 3;
      } else if ((byte1 & 248) === 240 && i + 3 < bytes.length) {
        const byte2 = bytes[i + 1] ?? 0;
        const byte3 = bytes[i + 2] ?? 0;
        const byte4 = bytes[i + 3] ?? 0;
        const codePoint = (byte1 & 7) << 18 | (byte2 & 63) << 12 | (byte3 & 63) << 6 | byte4 & 63;
        result += String.fromCodePoint(codePoint);
        i += 4;
      } else {
        i += 1;
      }
    }
    return result;
  }
  function isUtf8ContinuationByte(byte) {
    return (byte & 192) === 128;
  }
  function splitUtf8Bytes(bytes, chunkSizeBytes) {
    const chunks = [];
    let start = 0;
    while (start < bytes.length) {
      let end = Math.min(start + chunkSizeBytes, bytes.length);
      while (end > start && end < bytes.length && isUtf8ContinuationByte(bytes[end] ?? 0)) {
        end--;
      }
      if (end <= start) {
        end = start + 1;
        while (end < bytes.length && isUtf8ContinuationByte(bytes[end] ?? 0)) {
          end++;
        }
      }
      chunks.push(utf8Decode(bytes.subarray(start, end)));
      start = end;
    }
    return chunks;
  }
  async function writeChunked(store, prefix, data, chunkSizeBytes) {
    const serialized = JSON.stringify(data);
    const bytes = utf8Encode(serialized);
    const chunks = splitUtf8Bytes(bytes, chunkSizeBytes);
    if (chunks.length === 0) chunks.push("");
    const existingKeys = await store.keys();
    const staleChunkKeys = existingKeys.filter(
      (k) => k.startsWith(`${prefix}:chunk:`) && Number(k.slice(`${prefix}:chunk:`.length)) >= chunks.length
    );
    await Promise.all(staleChunkKeys.map((k) => store.delete(k)));
    await Promise.all(chunks.map((chunk, i) => store.set(`${prefix}:chunk:${i}`, chunk)));
    const index = { count: chunks.length };
    await store.set(`${prefix}:index`, JSON.stringify(index));
  }
  async function readChunked(store, prefix) {
    const indexRaw = await store.get(`${prefix}:index`);
    if (indexRaw === void 0) return void 0;
    let index;
    try {
      index = JSON.parse(indexRaw);
    } catch {
      return void 0;
    }
    if (typeof index.count !== "number" || index.count < 0) return void 0;
    const parts = [];
    for (let i = 0; i < index.count; i++) {
      const part = await store.get(`${prefix}:chunk:${i}`);
      if (part === void 0) return void 0;
      parts.push(part);
    }
    const serialized = parts.join("");
    if (serialized === "") return void 0;
    try {
      return JSON.parse(serialized);
    } catch {
      return void 0;
    }
  }
  const META_PREFIX = "dslog:meta";
  const HEAVY_PREFIX = "dslog:heavy";
  function isStoredMeta(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return typeof v.schemaVersion === "number" && Array.isArray(v.baselines) && Array.isArray(v.releases) && typeof v.settings === "object" && v.settings !== null;
  }
  function isHeavyData(value) {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return typeof v.snapshots === "object" && v.snapshots !== null && Array.isArray(v.changeSets);
  }
  const EMPTY_SNAPSHOT = { components: [], tokens: [], collections: [] };
  async function loadProject() {
    const metaRaw = await readChunked(clientStorageAdapter, META_PREFIX);
    const heavyRaw = await readChunked(pluginDataAdapter, HEAVY_PREFIX);
    if (!isStoredMeta(metaRaw)) {
      return createEmptyProject(STORAGE_SCHEMA_VERSION);
    }
    const heavy = isHeavyData(heavyRaw) ? heavyRaw : { snapshots: {}, changeSets: [] };
    const baselines = metaRaw.baselines.map((b) => ({
      ...b,
      snapshot: heavy.snapshots[b.id] ?? EMPTY_SNAPSHOT
    }));
    return migrateProject({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      currentBaselineId: metaRaw.currentBaselineId,
      baselines,
      releases: metaRaw.releases ?? [],
      changeSets: heavy.changeSets,
      trackedEntities: metaRaw.trackedEntities ?? [],
      instanceIndex: heavy.instanceIndex,
      settings: { ...DEFAULT_SETTINGS, ...metaRaw.settings }
    });
  }
  async function saveProject(project2) {
    const snapshots = {};
    const baselinesWithoutSnapshot = project2.baselines.map((baseline) => {
      snapshots[baseline.id] = baseline.snapshot;
      const { snapshot: _snapshot, ...rest } = baseline;
      return rest;
    });
    const meta = {
      schemaVersion: project2.schemaVersion,
      currentBaselineId: project2.currentBaselineId,
      baselines: baselinesWithoutSnapshot,
      releases: project2.releases,
      trackedEntities: project2.trackedEntities,
      settings: project2.settings
    };
    const heavy = {
      snapshots,
      changeSets: project2.changeSets,
      instanceIndex: project2.instanceIndex
    };
    await Promise.all([
      writeChunked(clientStorageAdapter, META_PREFIX, meta, STORAGE_CHUNK_SIZE_CLIENT),
      writeChunked(pluginDataAdapter, HEAVY_PREFIX, heavy, STORAGE_CHUNK_SIZE_PLUGIN_DATA)
    ]);
  }
  function isTrackableRoot(node) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") return false;
    if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") return false;
    return true;
  }
  async function collectFromPage(page) {
    await page.loadAsync();
    const nodes = page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
    return nodes.filter((node) => isTrackableRoot(node)).map((node) => ({
      id: node.id,
      name: node.name,
      componentSetName: node.type === "COMPONENT" ? node.parent?.name : void 0,
      pageId: page.id,
      pageName: page.name
    }));
  }
  async function discoverComponents(scope, pageIds) {
    const results = [];
    if (scope === "selection") {
      for (const node of figma.currentPage.selection) {
        if (isTrackableRoot(node)) {
          results.push({
            id: node.id,
            name: node.name,
            pageId: figma.currentPage.id,
            pageName: figma.currentPage.name
          });
        } else if ("findAllWithCriteria" in node) {
          const nested = node.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
          for (const n of nested) {
            if (isTrackableRoot(n)) {
              results.push({
                id: n.id,
                name: n.name,
                pageId: figma.currentPage.id,
                pageName: figma.currentPage.name
              });
            }
          }
        }
      }
      return results;
    }
    if (scope === "current-page") {
      return collectFromPage(figma.currentPage);
    }
    if (scope === "selected-pages") {
      for (const pageId of pageIds) {
        const node = await figma.getNodeByIdAsync(pageId);
        if (node && node.type === "PAGE") {
          results.push(...await collectFromPage(node));
        }
      }
      return results;
    }
    await figma.loadAllPagesAsync();
    for (const page of figma.root.children) {
      results.push(...await collectFromPage(page));
    }
    return results;
  }
  function fnv1aHash(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function stableStringify(value) {
    return JSON.stringify(sortKeysDeep(value));
  }
  function sortKeysDeep(value) {
    if (Array.isArray(value)) {
      return value.map(sortKeysDeep);
    }
    if (value !== null && typeof value === "object") {
      const sorted = {};
      for (const key of Object.keys(value).sort()) {
        sorted[key] = sortKeysDeep(value[key]);
      }
      return sorted;
    }
    return value;
  }
  function hashObject(value) {
    return fnv1aHash(stableStringify(value));
  }
  function isMixed(value) {
    return typeof value === "symbol";
  }
  function normalizePaint(paint) {
    return {
      type: paint.type,
      color: paint.color ? `${Math.round(paint.color.r * 255)},${Math.round(paint.color.g * 255)},${Math.round(paint.color.b * 255)}` : void 0,
      opacity: paint.opacity,
      visible: paint.visible ?? true,
      boundVariableId: paint.boundVariables?.color?.id
    };
  }
  function normalizeEffect(effect) {
    return {
      type: effect.type,
      visible: effect.visible ?? true,
      radius: effect.radius,
      color: effect.color ? `${Math.round(effect.color.r * 255)},${Math.round(effect.color.g * 255)},${Math.round(effect.color.b * 255)},${effect.color.a ?? 1}` : void 0,
      offsetX: effect.offset?.x,
      offsetY: effect.offset?.y
    };
  }
  function normalizeLayout(node) {
    if (!node.layoutMode || node.layoutMode === "NONE") return void 0;
    return {
      mode: node.layoutMode,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      itemSpacing: node.itemSpacing,
      primaryAxisAlign: node.primaryAxisAlignItems,
      counterAxisAlign: node.counterAxisAlignItems,
      primaryAxisSizing: node.primaryAxisSizingMode,
      counterAxisSizing: node.counterAxisSizingMode
    };
  }
  function normalizeTypography(node) {
    if (node.type !== "TEXT") return void 0;
    const boundVariableIds = {};
    const bound = node.boundVariables ?? {};
    for (const field of ["fontFamily", "fontSize", "lineHeight", "letterSpacing"]) {
      const entry = bound[field];
      if (entry && !Array.isArray(entry)) boundVariableIds[field] = entry.id;
    }
    const fontName = !isMixed(node.fontName) ? node.fontName : void 0;
    const lineHeight = !isMixed(node.lineHeight) ? node.lineHeight : void 0;
    const letterSpacing = !isMixed(node.letterSpacing) ? node.letterSpacing : void 0;
    return {
      fontFamily: fontName?.family,
      fontStyle: fontName?.style,
      fontSize: !isMixed(node.fontSize) ? node.fontSize : void 0,
      lineHeight: lineHeight ? "value" in lineHeight ? `${lineHeight.value}${lineHeight.unit}` : "AUTO" : void 0,
      letterSpacing: letterSpacing ? `${letterSpacing.value}${letterSpacing.unit}` : void 0,
      boundVariableIds: Object.keys(boundVariableIds).length > 0 ? boundVariableIds : void 0
    };
  }
  function extractTokenBindings(node) {
    const bound = node.boundVariables ?? {};
    const bindings = [];
    for (const [field, entry] of Object.entries(bound)) {
      if (!entry) continue;
      if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          bindings.push({ field: `${field}[${index}]`, variableId: item.id });
        });
      } else {
        bindings.push({ field, variableId: entry.id });
      }
    }
    return bindings.sort((a, b) => a.field.localeCompare(b.field));
  }
  function extractStyleBindings(node) {
    const bindings = [];
    if (node.fillStyleId) bindings.push({ field: "fills", styleId: node.fillStyleId, styleType: "PAINT" });
    if (node.strokeStyleId) bindings.push({ field: "strokes", styleId: node.strokeStyleId, styleType: "PAINT" });
    if (node.effectStyleId) bindings.push({ field: "effects", styleId: node.effectStyleId, styleType: "EFFECT" });
    if (node.textStyleId) bindings.push({ field: "text", styleId: node.textStyleId, styleType: "TEXT" });
    return bindings;
  }
  function normalizeNode(node, keyPrefix, index) {
    const key = `${keyPrefix}/${index}:${node.name}`;
    return {
      key,
      name: node.name,
      type: node.type,
      visible: node.visible ?? true,
      width: node.width,
      height: node.height,
      cornerRadius: !isMixed(node.cornerRadius) ? node.cornerRadius : void 0,
      fills: !isMixed(node.fills) ? node.fills?.map(normalizePaint) : void 0,
      strokes: node.strokes?.map(normalizePaint),
      effects: node.effects?.map(normalizeEffect),
      layout: normalizeLayout(node),
      typography: normalizeTypography(node),
      tokenBindings: extractTokenBindings(node),
      styleBindings: extractStyleBindings(node),
      children: (node.children ?? []).map((child, childIndex) => normalizeNode(child, key, childIndex))
    };
  }
  function normalizeProperty(name, def) {
    return {
      name,
      type: def.type,
      defaultValue: def.defaultValue ?? null,
      variantOptions: def.variantOptions,
      preferredValues: def.preferredValues,
      boundVariableId: def.boundVariables?.id
    };
  }
  function normalizeVariant(variant) {
    return {
      name: variant.name,
      properties: variant.variantProperties ?? {}
    };
  }
  function normalizeComponent(input) {
    const properties = Object.entries(
      input.componentPropertyDefinitions ?? {}
    ).map(([rawName, def]) => normalizeProperty(rawName.split("#")[0] ?? rawName, def)).sort((a, b) => a.name.localeCompare(b.name));
    const variants = [...input.variants].map(normalizeVariant).sort((a, b) => a.name.localeCompare(b.name));
    const structure = normalizeNode(input.representative, "root", 0);
    const snapshot = {
      identity: {
        id: input.id,
        key: input.key,
        name: input.name,
        componentSetId: input.componentSetId,
        componentSetName: input.componentSetName,
        remote: input.remote
      },
      metadata: {
        description: input.description,
        documentationLink: input.documentationLinks?.[0]?.uri
      },
      properties,
      variants,
      structure,
      tokens: structure.tokenBindings ?? [],
      styles: structure.styleBindings ?? [],
      dimensions: {
        width: input.representative.width,
        height: input.representative.height
      },
      layout: normalizeLayout(input.representative),
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const hash = hashObject({ ...snapshot, capturedAt: void 0 });
    return { ...snapshot, hash };
  }
  const MAX_DEPTH$1 = 32;
  function adaptPaints(paints) {
    if (typeof paints === "symbol") return void 0;
    if (!Array.isArray(paints)) return void 0;
    return paints.map((p) => ({
      type: p.type,
      visible: p.visible,
      opacity: p.opacity,
      color: p.color,
      boundVariables: p.boundVariables
    }));
  }
  function adaptEffects(effects) {
    if (!Array.isArray(effects)) return void 0;
    return effects.map((e) => ({
      type: e.type,
      visible: e.visible,
      radius: e.radius,
      color: e.color,
      offset: e.offset
    }));
  }
  function adaptNode(node, depth = 0) {
    const result = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: "visible" in node ? node.visible : true
    };
    if ("width" in node) result.width = node.width;
    if ("height" in node) result.height = node.height;
    if ("cornerRadius" in node) result.cornerRadius = node.cornerRadius;
    if ("fills" in node) result.fills = adaptPaints(node.fills);
    if ("strokes" in node) result.strokes = adaptPaints(node.strokes);
    if ("effects" in node) result.effects = adaptEffects(node.effects);
    if ("layoutMode" in node) {
      result.layoutMode = node.layoutMode;
      result.paddingTop = node.paddingTop;
      result.paddingRight = node.paddingRight;
      result.paddingBottom = node.paddingBottom;
      result.paddingLeft = node.paddingLeft;
      result.itemSpacing = node.itemSpacing;
      result.primaryAxisAlignItems = node.primaryAxisAlignItems;
      result.counterAxisAlignItems = node.counterAxisAlignItems;
      result.primaryAxisSizingMode = node.primaryAxisSizingMode;
      result.counterAxisSizingMode = node.counterAxisSizingMode;
    }
    if (node.type === "TEXT") {
      result.fontName = node.fontName;
      result.fontSize = node.fontSize;
      result.lineHeight = node.lineHeight;
      result.letterSpacing = node.letterSpacing;
    }
    if ("fillStyleId" in node && node.fillStyleId) result.fillStyleId = node.fillStyleId;
    if ("strokeStyleId" in node && node.strokeStyleId) result.strokeStyleId = node.strokeStyleId;
    if ("effectStyleId" in node && node.effectStyleId) result.effectStyleId = node.effectStyleId;
    if ("textStyleId" in node && node.textStyleId) result.textStyleId = node.textStyleId;
    if ("boundVariables" in node && node.boundVariables) result.boundVariables = node.boundVariables;
    if ("children" in node && depth < MAX_DEPTH$1) {
      result.children = node.children.map((child) => adaptNode(child, depth + 1));
    }
    return result;
  }
  function buildInputFromComponent(node) {
    const parentSet = node.parent && node.parent.type === "COMPONENT_SET" ? node.parent : void 0;
    return {
      id: node.id,
      key: node.key,
      name: node.name,
      type: "COMPONENT",
      description: node.description || void 0,
      documentationLinks: node.documentationLinks,
      remote: Boolean(node.remote),
      componentSetId: parentSet?.id,
      componentSetName: parentSet?.name,
      componentPropertyDefinitions: (parentSet ?? node).componentPropertyDefinitions,
      variants: [
        {
          id: node.id,
          name: node.name,
          variantProperties: node.variantProperties ?? void 0,
          node: adaptNode(node)
        }
      ],
      representative: adaptNode(node)
    };
  }
  function buildInputFromComponentSet(node) {
    const variantNodes = node.children ?? [];
    const variants = variantNodes.map((child) => ({
      id: child.id,
      name: child.name,
      variantProperties: child.variantProperties ?? void 0,
      node: adaptNode(child)
    }));
    const representative = variantNodes[0] ? adaptNode(variantNodes[0]) : adaptNode(node);
    return {
      id: node.id,
      key: node.key,
      name: node.name,
      type: "COMPONENT_SET",
      description: node.description || void 0,
      documentationLinks: node.documentationLinks,
      remote: Boolean(node.remote),
      componentPropertyDefinitions: node.componentPropertyDefinitions,
      variants,
      representative
    };
  }
  async function scanComponents(componentIds, onProgress) {
    const components = [];
    const skipped = [];
    for (let i = 0; i < componentIds.length; i += SCAN_BATCH_SIZE) {
      const batch = componentIds.slice(i, i + SCAN_BATCH_SIZE);
      await Promise.all(
        batch.map(async (id) => {
          try {
            const node = await figma.getNodeByIdAsync(id);
            if (!node) {
              skipped.push({ id, name: id, reason: "Node not found (deleted or moved out of scope)" });
              return;
            }
            if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
              skipped.push({ id, name: node.name, reason: `Unsupported node type ${node.type}` });
              return;
            }
            const input = node.type === "COMPONENT_SET" ? buildInputFromComponentSet(node) : buildInputFromComponent(node);
            components.push(normalizeComponent(input));
          } catch (error) {
            skipped.push({ id, name: id, reason: error instanceof Error ? error.message : "Unknown scan error" });
          }
        })
      );
      onProgress?.(Math.min(i + SCAN_BATCH_SIZE, componentIds.length), componentIds.length);
    }
    return { components, scanned: components.length, skipped };
  }
  function toByte(channel) {
    return Math.round(Math.min(1, Math.max(0, channel)) * 255);
  }
  function rgbToHex(color) {
    const r = toByte(color.r).toString(16).padStart(2, "0");
    const g = toByte(color.g).toString(16).padStart(2, "0");
    const b = toByte(color.b).toString(16).padStart(2, "0");
    if (color.a !== void 0 && color.a < 1) {
      const a = toByte(color.a).toString(16).padStart(2, "0");
      return `#${r}${g}${b}${a}`.toUpperCase();
    }
    return `#${r}${g}${b}`.toUpperCase();
  }
  function normalizeRawValue(raw, type) {
    if (raw !== null && typeof raw === "object" && "type" in raw && raw.type === "VARIABLE_ALIAS") {
      return { value: null, aliasTo: { variableId: raw.id } };
    }
    if (type === "COLOR" && raw !== null && typeof raw === "object") {
      return { value: rgbToHex(raw) };
    }
    return { value: raw };
  }
  function normalizeToken(input) {
    const valuesByMode = input.valuesByMode.map((entry) => {
      const { value, aliasTo } = normalizeRawValue(entry.value, input.resolvedType);
      const aliasName = aliasTo ? input.variableNamesById?.[aliasTo.variableId] : void 0;
      return {
        modeId: entry.modeId,
        modeName: entry.modeName,
        value,
        aliasTo: aliasTo ? { ...aliasTo, variableName: aliasName } : void 0,
        resolvedValue: aliasTo ? void 0 : value
      };
    }).sort((a, b) => a.modeName.localeCompare(b.modeName));
    const snapshot = {
      id: input.id,
      key: input.key,
      name: input.name,
      collectionId: input.collectionId,
      collectionName: input.collectionName,
      type: input.resolvedType,
      scopes: [...input.scopes].sort(),
      description: input.description,
      remote: input.remote,
      libraryKey: input.libraryKey,
      valuesByMode,
      capturedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const hash = hashObject({ ...snapshot, capturedAt: void 0 });
    return { ...snapshot, hash };
  }
  const SUPPORTED_TYPES = /* @__PURE__ */ new Set(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);
  async function scanTokens(includedCollectionIds, onProgress) {
    const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const targetCollections = includedCollectionIds.length ? allCollections.filter((c) => includedCollectionIds.includes(c.id)) : allCollections;
    const targetCollectionIds = new Set(targetCollections.map((c) => c.id));
    const collectionSnapshots = targetCollections.map((c) => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      remote: c.remote
    }));
    const allVariables = await figma.variables.getLocalVariablesAsync();
    const variableNamesById = {};
    for (const v of allVariables) variableNamesById[v.id] = v.name;
    const targetVariables = allVariables.filter((v) => targetCollectionIds.has(v.variableCollectionId));
    const tokens = [];
    const skipped = [];
    let done = 0;
    for (const variable of targetVariables) {
      try {
        if (!SUPPORTED_TYPES.has(variable.resolvedType)) {
          skipped.push({
            id: variable.id,
            name: variable.name,
            reason: `Unsupported variable type ${variable.resolvedType}`
          });
          continue;
        }
        const collection = targetCollections.find((c) => c.id === variable.variableCollectionId);
        if (!collection) {
          skipped.push({ id: variable.id, name: variable.name, reason: "Owning collection not found" });
          continue;
        }
        const valuesByMode = collection.modes.map((mode) => ({
          modeId: mode.modeId,
          modeName: mode.name,
          value: variable.valuesByMode[mode.modeId] ?? null
        }));
        const input = {
          id: variable.id,
          key: variable.key,
          name: variable.name,
          collectionId: collection.id,
          collectionName: collection.name,
          resolvedType: variable.resolvedType,
          scopes: variable.scopes,
          description: variable.description || void 0,
          remote: variable.remote,
          libraryKey: variable.remote ? variable.key : void 0,
          valuesByMode,
          variableNamesById
        };
        tokens.push(normalizeToken(input));
      } catch (error) {
        skipped.push({
          id: variable.id,
          name: variable.name,
          reason: error instanceof Error ? error.message : "Unknown scan error"
        });
      }
      done += 1;
      if (done % 25 === 0 || done === targetVariables.length) {
        onProgress?.(done, targetVariables.length);
      }
    }
    return { tokens, collections: collectionSnapshots, scanned: tokens.length, skipped };
  }
  const INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT = 30;
  const INSTANCE_INDEX_MAX_SAMPLE_IDS_PER_COMPONENT = 20;
  function findContainerName(node) {
    let current = node;
    while (current.parent && current.parent.type !== "PAGE") {
      current = current.parent;
    }
    return current.name;
  }
  function findContainingComponentId(node) {
    let current = node.parent;
    while (current && current.type !== "PAGE") {
      if (current.type === "COMPONENT") return current.id;
      current = current.parent;
    }
    return void 0;
  }
  async function scanInstances(onProgress) {
    await figma.loadAllPagesAsync();
    const pages = figma.root.children;
    const byComponentId = /* @__PURE__ */ new Map();
    let totalScanned = 0;
    let totalSkipped = 0;
    let instancesFound = 0;
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      await page.loadAsync();
      const instances = page.findAllWithCriteria({ types: ["INSTANCE"] });
      instancesFound += instances.length;
      onProgress?.({ pagesTotal: pages.length, pagesDone: pageIndex, instancesFound });
      for (let i = 0; i < instances.length; i += SCAN_BATCH_SIZE) {
        const batch = instances.slice(i, i + SCAN_BATCH_SIZE);
        await Promise.all(
          batch.map(async (instance) => {
            try {
              const main = await instance.getMainComponentAsync();
              if (!main) {
                totalSkipped += 1;
                return;
              }
              let entry = byComponentId.get(main.id);
              if (!entry) {
                entry = {
                  componentId: main.id,
                  count: 0,
                  containerNames: [],
                  sampleInstanceIds: [],
                  containingComponentIds: [],
                  containerNameSet: /* @__PURE__ */ new Set(),
                  containingComponentIdSet: /* @__PURE__ */ new Set()
                };
                byComponentId.set(main.id, entry);
              }
              entry.count += 1;
              const containerName = findContainerName(instance);
              if (entry.containerNameSet.size < INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT && !entry.containerNameSet.has(containerName)) {
                entry.containerNameSet.add(containerName);
                entry.containerNames.push(containerName);
              }
              if (entry.sampleInstanceIds.length < INSTANCE_INDEX_MAX_SAMPLE_IDS_PER_COMPONENT) {
                entry.sampleInstanceIds.push(instance.id);
              }
              const containingComponentId = findContainingComponentId(instance);
              if (containingComponentId && entry.containingComponentIdSet.size < INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT && !entry.containingComponentIdSet.has(containingComponentId)) {
                entry.containingComponentIdSet.add(containingComponentId);
                entry.containingComponentIds.push(containingComponentId);
              }
              totalScanned += 1;
            } catch {
              totalSkipped += 1;
            }
          })
        );
      }
      onProgress?.({ pagesTotal: pages.length, pagesDone: pageIndex + 1, instancesFound });
    }
    const byComponentIdResult = {};
    for (const [id, entry] of byComponentId) {
      byComponentIdResult[id] = {
        componentId: entry.componentId,
        count: entry.count,
        containerNames: entry.containerNames,
        sampleInstanceIds: entry.sampleInstanceIds,
        containingComponentIds: entry.containingComponentIds
      };
    }
    return {
      builtAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalInstancesScanned: totalScanned,
      totalInstancesSkipped: totalSkipped,
      byComponentId: byComponentIdResult
    };
  }
  function valuesEqual(a, b) {
    if (a === b) return true;
    if (a === void 0 || b === void 0) return a === b;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  const MAX_DEPTH = 12;
  function matchChildren(before, after) {
    const afterByName = /* @__PURE__ */ new Map();
    for (const node of after) {
      const list = afterByName.get(node.name) ?? [];
      list.push(node);
      afterByName.set(node.name, list);
    }
    const pairs = [];
    const usedAfter = /* @__PURE__ */ new Set();
    for (const b of before) {
      const candidates = afterByName.get(b.name);
      const match = candidates?.find((a) => !usedAfter.has(a));
      if (match) {
        usedAfter.add(match);
        pairs.push({ before: b, after: match });
      } else {
        pairs.push({ before: b, after: void 0 });
      }
    }
    for (const a of after) {
      if (!usedAfter.has(a)) {
        pairs.push({ before: void 0, after: a });
      }
    }
    return pairs;
  }
  function pushVisualChanges(entityId, entityName, path, before, after, changes) {
    if (before.type !== after.type) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "structure-child-type-changed",
        field: path,
        before: before.type,
        after: after.type
      });
    }
    if (before.visible !== after.visible) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "visibility-changed",
        field: path,
        before: before.visible,
        after: after.visible
      });
    }
    if (before.width !== after.width || before.height !== after.height) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "dimensions-changed",
        field: path,
        before: { width: before.width, height: before.height },
        after: { width: after.width, height: after.height }
      });
    }
    if (before.cornerRadius !== after.cornerRadius) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "corner-radius-changed",
        field: path,
        before: before.cornerRadius,
        after: after.cornerRadius
      });
    }
    if (!valuesEqual(before.fills, after.fills)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "fills-changed",
        field: path,
        before: before.fills,
        after: after.fills
      });
    }
    if (!valuesEqual(before.strokes, after.strokes)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "strokes-changed",
        field: path,
        before: before.strokes,
        after: after.strokes
      });
    }
    if (!valuesEqual(before.effects, after.effects)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "effects-changed",
        field: path,
        before: before.effects,
        after: after.effects
      });
    }
    if (!valuesEqual(before.typography, after.typography)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "typography-changed",
        field: path,
        before: before.typography,
        after: after.typography
      });
    }
    if (!valuesEqual(before.tokenBindings, after.tokenBindings)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "token-binding-changed",
        field: path,
        before: before.tokenBindings,
        after: after.tokenBindings
      });
    }
    if (!valuesEqual(before.styleBindings, after.styleBindings)) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "style-binding-changed",
        field: path,
        before: before.styleBindings,
        after: after.styleBindings
      });
    }
    const beforeLayout = before.layout;
    const afterLayout = after.layout;
    if (beforeLayout?.mode !== afterLayout?.mode) {
      changes.push({
        entityType: "component",
        entityId,
        entityName,
        changeType: "layout-mode-changed",
        field: path,
        before: beforeLayout?.mode,
        after: afterLayout?.mode
      });
    } else if (beforeLayout && afterLayout) {
      if (beforeLayout.paddingTop !== afterLayout.paddingTop || beforeLayout.paddingRight !== afterLayout.paddingRight || beforeLayout.paddingBottom !== afterLayout.paddingBottom || beforeLayout.paddingLeft !== afterLayout.paddingLeft) {
        changes.push({
          entityType: "component",
          entityId,
          entityName,
          changeType: "padding-changed",
          field: `${path}.padding`,
          before: {
            top: beforeLayout.paddingTop,
            right: beforeLayout.paddingRight,
            bottom: beforeLayout.paddingBottom,
            left: beforeLayout.paddingLeft
          },
          after: {
            top: afterLayout.paddingTop,
            right: afterLayout.paddingRight,
            bottom: afterLayout.paddingBottom,
            left: afterLayout.paddingLeft
          }
        });
      }
      if (beforeLayout.itemSpacing !== afterLayout.itemSpacing) {
        changes.push({
          entityType: "component",
          entityId,
          entityName,
          changeType: "gap-changed",
          field: `${path}.gap`,
          before: beforeLayout.itemSpacing,
          after: afterLayout.itemSpacing
        });
      }
      if (beforeLayout.primaryAxisAlign !== afterLayout.primaryAxisAlign || beforeLayout.counterAxisAlign !== afterLayout.counterAxisAlign) {
        changes.push({
          entityType: "component",
          entityId,
          entityName,
          changeType: "alignment-changed",
          field: `${path}.alignment`,
          before: { primary: beforeLayout.primaryAxisAlign, counter: beforeLayout.counterAxisAlign },
          after: { primary: afterLayout.primaryAxisAlign, counter: afterLayout.counterAxisAlign }
        });
      }
    }
  }
  function diffStructure(entityId, entityName, before, after) {
    const changes = [];
    function walk(b, a, path, depth) {
      pushVisualChanges(entityId, entityName, path, b, a, changes);
      if (depth >= MAX_DEPTH) return;
      const pairs = matchChildren(b.children, a.children);
      for (const pair of pairs) {
        if (pair.before && !pair.after) {
          changes.push({
            entityType: "component",
            entityId,
            entityName,
            changeType: "structure-child-removed",
            field: `${path}/${pair.before.name}`,
            before: pair.before.name
          });
        } else if (!pair.before && pair.after) {
          changes.push({
            entityType: "component",
            entityId,
            entityName,
            changeType: "structure-child-added",
            field: `${path}/${pair.after.name}`,
            after: pair.after.name
          });
        } else if (pair.before && pair.after) {
          walk(pair.before, pair.after, `${path}/${pair.after.name}`, depth + 1);
        }
      }
    }
    walk(before, after, "root", 0);
    return changes;
  }
  function byId$1(components) {
    return new Map(components.map((c) => [c.identity.id, c]));
  }
  function diffProperties(before, after) {
    const changes = [];
    const beforeByName = new Map(before.properties.map((p) => [p.name, p]));
    const afterByName = new Map(after.properties.map((p) => [p.name, p]));
    const id = after.identity.id;
    const name = after.identity.name;
    for (const [propName, prop] of afterByName) {
      if (!beforeByName.has(propName)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "property-added",
          field: propName,
          after: prop
        });
      }
    }
    for (const [propName, prop] of beforeByName) {
      if (!afterByName.has(propName)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "property-removed",
          field: propName,
          before: prop
        });
      }
    }
    for (const [propName, beforeProp] of beforeByName) {
      const afterProp = afterByName.get(propName);
      if (!afterProp) continue;
      if (beforeProp.type !== afterProp.type) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "property-type-changed",
          field: propName,
          before: beforeProp,
          after: afterProp
        });
      } else if (!valuesEqual(beforeProp, afterProp)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "property-changed",
          field: propName,
          before: beforeProp,
          after: afterProp
        });
      }
    }
    return changes;
  }
  function diffVariants(before, after) {
    const changes = [];
    const beforeByName = new Map(before.variants.map((v) => [v.name, v]));
    const afterByName = new Map(after.variants.map((v) => [v.name, v]));
    const id = after.identity.id;
    const name = after.identity.name;
    for (const [variantName, variant] of afterByName) {
      if (!beforeByName.has(variantName)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "variant-added",
          field: variantName,
          after: variant
        });
      }
    }
    for (const [variantName, variant] of beforeByName) {
      if (!afterByName.has(variantName)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: name,
          changeType: "variant-removed",
          field: variantName,
          before: variant
        });
      }
    }
    return changes;
  }
  function diffComponents(baseline, current) {
    const changes = [];
    const baselineMap = byId$1(baseline);
    const currentMap = byId$1(current);
    for (const [id, component] of currentMap) {
      if (!baselineMap.has(id)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: component.identity.name,
          changeType: "component-added",
          after: { name: component.identity.name, componentSetName: component.identity.componentSetName }
        });
      }
    }
    for (const [id, component] of baselineMap) {
      if (!currentMap.has(id)) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: component.identity.name,
          changeType: "component-removed",
          before: { name: component.identity.name, componentSetName: component.identity.componentSetName }
        });
      }
    }
    for (const [id, before] of baselineMap) {
      const after = currentMap.get(id);
      if (!after) continue;
      if (before.hash === after.hash) continue;
      if (before.identity.name !== after.identity.name) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: after.identity.name,
          changeType: "component-renamed",
          before: before.identity.name,
          after: after.identity.name
        });
      }
      if (before.metadata.description !== after.metadata.description) {
        changes.push({
          entityType: "component",
          entityId: id,
          entityName: after.identity.name,
          changeType: "component-description-changed",
          before: before.metadata.description,
          after: after.metadata.description
        });
      }
      changes.push(...diffProperties(before, after));
      changes.push(...diffVariants(before, after));
      changes.push(...diffStructure(id, after.identity.name, before.structure, after.structure));
    }
    return changes;
  }
  function byId(tokens) {
    return new Map(tokens.map((t) => [t.id, t]));
  }
  function diffModes(before, after) {
    const changes = [];
    const id = after.id;
    const name = after.name;
    const beforeByMode = new Map(before.valuesByMode.map((m) => [m.modeId, m]));
    const afterByMode = new Map(after.valuesByMode.map((m) => [m.modeId, m]));
    for (const [modeId, mode] of afterByMode) {
      if (!beforeByMode.has(modeId)) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: name,
          changeType: "token-mode-added",
          field: mode.modeName,
          after: mode.value
        });
      }
    }
    for (const [modeId, mode] of beforeByMode) {
      if (!afterByMode.has(modeId)) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: name,
          changeType: "token-mode-removed",
          field: mode.modeName,
          before: mode.value
        });
      }
    }
    const modeDetails = [];
    let anyValueChanged = false;
    let anyAliasChanged = false;
    let anyAliasRemoved = false;
    for (const [modeId, beforeMode] of beforeByMode) {
      const afterMode = afterByMode.get(modeId);
      if (!afterMode) continue;
      const aliasChanged = !valuesEqual(beforeMode.aliasTo, afterMode.aliasTo);
      const valueChanged = !valuesEqual(beforeMode.value, afterMode.value);
      const aliasRemoved = aliasChanged && Boolean(beforeMode.aliasTo) && !afterMode.aliasTo;
      modeDetails.push({
        modeName: afterMode.modeName,
        before: beforeMode.aliasTo ? `-> ${beforeMode.aliasTo.variableName ?? beforeMode.aliasTo.variableId}` : beforeMode.value,
        after: afterMode.aliasTo ? `-> ${afterMode.aliasTo.variableName ?? afterMode.aliasTo.variableId}` : afterMode.value,
        changed: aliasChanged || valueChanged
      });
      if (aliasRemoved) anyAliasRemoved = true;
      else if (aliasChanged) anyAliasChanged = true;
      else if (valueChanged) anyValueChanged = true;
    }
    if (anyAliasRemoved) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: name,
        changeType: "token-alias-removed",
        modeDetails
      });
    } else if (anyAliasChanged) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: name,
        changeType: "token-alias-changed",
        modeDetails
      });
    } else if (anyValueChanged) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: name,
        changeType: "token-value-changed",
        modeDetails
      });
    }
    return changes;
  }
  function diffTokens(baseline, current) {
    const changes = [];
    const baselineMap = byId(baseline);
    const currentMap = byId(current);
    for (const [id, token] of currentMap) {
      if (!baselineMap.has(id)) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: token.name,
          changeType: "token-added",
          after: { name: token.name, collection: token.collectionName, type: token.type }
        });
      }
    }
    for (const [id, token] of baselineMap) {
      if (!currentMap.has(id)) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: token.name,
          changeType: "token-removed",
          before: { name: token.name, collection: token.collectionName, type: token.type }
        });
      }
    }
    for (const [id, before] of baselineMap) {
      const after = currentMap.get(id);
      if (!after) continue;
      if (before.hash === after.hash) continue;
      if (before.name !== after.name) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: after.name,
          changeType: "token-renamed",
          before: before.name,
          after: after.name
        });
      }
      if (before.type !== after.type) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: after.name,
          changeType: "token-type-changed",
          before: before.type,
          after: after.type
        });
      }
      if (before.description !== after.description) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: after.name,
          changeType: "token-description-changed",
          before: before.description,
          after: after.description
        });
      }
      if (!valuesEqual(before.scopes, after.scopes)) {
        changes.push({
          entityType: "token",
          entityId: id,
          entityName: after.name,
          changeType: "token-scopes-changed",
          before: before.scopes,
          after: after.scopes
        });
      }
      changes.push(...diffModes(before, after));
    }
    return changes;
  }
  const CLASSIFICATION_RULES = {
    // --- BREAKING ---
    "component-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
    "property-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
    "variant-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
    "token-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
    "token-type-changed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },
    "token-alias-removed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },
    "property-type-changed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },
    // --- POTENTIALLY BREAKING ---
    "component-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "property-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "structure-child-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
    "structure-child-type-changed": {
      category: "modified",
      severity: "minor",
      breaking: false,
      potentialBreaking: true
    },
    "visibility-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "dimensions-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "typography-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "token-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "style-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "layout-mode-changed": { category: "modified", severity: "major", breaking: false, potentialBreaking: true },
    "padding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "gap-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "alignment-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "token-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "token-mode-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
    "token-value-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    "token-scopes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
    // --- NON-BREAKING / INFORMATIONAL ---
    "component-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
    "component-description-changed": {
      category: "modified",
      severity: "info",
      breaking: false,
      potentialBreaking: false
    },
    "property-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
    "variant-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
    "structure-child-added": { category: "added", severity: "minor", breaking: false, potentialBreaking: false },
    "corner-radius-changed": { category: "modified", severity: "info", breaking: false, potentialBreaking: false },
    "fills-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
    "strokes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
    "effects-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
    "token-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
    "token-mode-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
    "token-alias-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
    "token-description-changed": {
      category: "modified",
      severity: "info",
      breaking: false,
      potentialBreaking: false
    }
  };
  const DEFAULT_RULE = {
    category: "modified",
    severity: "minor",
    breaking: false,
    potentialBreaking: true
  };
  function fieldLabel(change) {
    return change.field ? change.field.split("/").pop() ?? change.field : "";
  }
  const SUMMARY_BUILDERS = {
    "component-added": () => "Component added",
    "component-removed": () => "Component removed",
    "component-renamed": (c) => `Renamed from "${c.before}" to "${c.after}"`,
    "component-description-changed": () => "Description changed",
    "property-added": (c) => `Added property ${fieldLabel(c)}`,
    "property-removed": (c) => `Removed property ${fieldLabel(c)}`,
    "property-changed": (c) => `Changed property ${fieldLabel(c)}`,
    "property-type-changed": (c) => `Property type changed for ${fieldLabel(c)}`,
    "variant-added": (c) => `Added variant ${fieldLabel(c)}`,
    "variant-removed": (c) => `Removed variant ${fieldLabel(c)}`,
    "structure-child-added": (c) => `Added layer ${fieldLabel(c)}`,
    "structure-child-removed": (c) => `Removed layer ${fieldLabel(c)}`,
    "structure-child-type-changed": (c) => `Layer type changed at ${fieldLabel(c)}`,
    "visibility-changed": (c) => `Visibility changed at ${fieldLabel(c)}`,
    "dimensions-changed": (c) => `Dimensions changed at ${fieldLabel(c)}`,
    "corner-radius-changed": (c) => `Corner radius changed at ${fieldLabel(c)}`,
    "fills-changed": (c) => `Fills changed at ${fieldLabel(c)}`,
    "strokes-changed": (c) => `Strokes changed at ${fieldLabel(c)}`,
    "effects-changed": (c) => `Effects changed at ${fieldLabel(c)}`,
    "typography-changed": (c) => `Typography changed at ${fieldLabel(c)}`,
    "token-binding-changed": (c) => `Variable binding changed at ${fieldLabel(c)}`,
    "style-binding-changed": (c) => `Style binding changed at ${fieldLabel(c)}`,
    "layout-mode-changed": () => "Layout mode changed",
    "padding-changed": () => "Padding changed",
    "gap-changed": () => "Gap changed",
    "alignment-changed": () => "Alignment changed",
    "token-added": () => "Token added",
    "token-removed": () => "Token removed",
    "token-renamed": (c) => `Renamed from "${c.before}" to "${c.after}"`,
    "token-type-changed": (c) => `Type changed from ${c.before} to ${c.after}`,
    "token-mode-added": (c) => `Added mode ${c.field}`,
    "token-mode-removed": (c) => `Removed mode ${c.field}`,
    "token-value-changed": () => "Token value changed",
    "token-alias-changed": () => "Token alias changed",
    "token-alias-removed": () => "Token alias removed",
    "token-description-changed": () => "Description changed",
    "token-scopes-changed": () => "Scopes changed"
  };
  function summarize(change) {
    const builder = SUMMARY_BUILDERS[change.changeType];
    return builder ? builder(change) : change.changeType;
  }
  function classify(raw) {
    const rule = CLASSIFICATION_RULES[raw.changeType] ?? DEFAULT_RULE;
    return {
      id: generateId("change"),
      entityType: raw.entityType,
      entityId: raw.entityId,
      entityName: raw.entityName,
      category: rule.category,
      severity: rule.severity,
      changeType: raw.changeType,
      summary: summarize(raw),
      field: raw.field,
      before: raw.before,
      after: raw.after,
      breaking: rule.breaking,
      potentialBreaking: rule.potentialBreaking,
      modeDetails: raw.modeDetails,
      reviewState: "unreviewed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function classifyAll(raws) {
    return raws.map(classify);
  }
  function componentStructuralSignature(component) {
    return hashObject({
      properties: [...component.properties].map((p) => ({ name: p.name, type: p.type })).sort((a, b) => a.name.localeCompare(b.name)),
      variants: [...component.variants].map((v) => v.properties).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      structureShape: structureShape(component.structure),
      dimensions: component.dimensions,
      layout: component.layout
    });
  }
  function structureShape(node) {
    return { type: node.type, children: node.children.map(structureShape) };
  }
  function tokenStructuralSignature(token) {
    return hashObject({
      type: token.type,
      scopes: [...token.scopes].sort(),
      modeCount: token.valuesByMode.length,
      modeValueKinds: token.valuesByMode.map((m) => m.aliasTo ? "alias" : typeof m.value).sort()
    });
  }
  function detectPossibleRenames(changes, baseline, current) {
    detectComponentRenames(changes, baseline.components, current.components);
    detectTokenRenames(changes, baseline.tokens, current.tokens);
  }
  function detectComponentRenames(changes, baseline, current) {
    const removedChanges = changes.filter((c) => c.changeType === "component-removed");
    const addedChanges = changes.filter((c) => c.changeType === "component-added");
    if (removedChanges.length === 0 || addedChanges.length === 0) return;
    const baselineById = new Map(baseline.map((c) => [c.identity.id, c]));
    const currentById = new Map(current.map((c) => [c.identity.id, c]));
    const usedAddedIds = /* @__PURE__ */ new Set();
    for (const removedChange of removedChanges) {
      const removedEntity = baselineById.get(removedChange.entityId);
      if (!removedEntity) continue;
      const keyMatch = removedEntity.identity.key ? addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return entity?.identity.key !== void 0 && entity.identity.key === removedEntity.identity.key;
      }) : void 0;
      const match = keyMatch ?? addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return entity !== void 0 && componentStructuralSignature(entity) === componentStructuralSignature(removedEntity);
      });
      if (match) {
        usedAddedIds.add(match.id);
        match.possibleRenameOf = removedChange.id;
      }
    }
  }
  function detectTokenRenames(changes, baseline, current) {
    const removedChanges = changes.filter((c) => c.changeType === "token-removed");
    const addedChanges = changes.filter((c) => c.changeType === "token-added");
    if (removedChanges.length === 0 || addedChanges.length === 0) return;
    const baselineById = new Map(baseline.map((t) => [t.id, t]));
    const currentById = new Map(current.map((t) => [t.id, t]));
    const usedAddedIds = /* @__PURE__ */ new Set();
    for (const removedChange of removedChanges) {
      const removedEntity = baselineById.get(removedChange.entityId);
      if (!removedEntity) continue;
      const keyMatch = removedEntity.key ? addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return entity?.key !== void 0 && entity.key === removedEntity.key;
      }) : void 0;
      const match = keyMatch ?? addedChanges.find((c) => {
        if (usedAddedIds.has(c.id)) return false;
        const entity = currentById.get(c.entityId);
        return entity !== void 0 && entity.type === removedEntity.type && tokenStructuralSignature(entity) === tokenStructuralSignature(removedEntity);
      });
      if (match) {
        usedAddedIds.add(match.id);
        match.possibleRenameOf = removedChange.id;
      }
    }
  }
  function diffSnapshots(baselineId, baseline, current, scanSummary) {
    const rawComponentChanges = diffComponents(baseline.components, current.components);
    const rawTokenChanges = diffTokens(baseline.tokens, current.tokens);
    const changes = classifyAll([...rawComponentChanges, ...rawTokenChanges]);
    detectPossibleRenames(changes, baseline, current);
    return {
      id: generateId("changeset"),
      baselineId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      changes,
      scanSummary
    };
  }
  function getEffectiveClassification(change) {
    const override = change.manualClassification;
    return {
      category: override?.category ?? change.category,
      severity: override?.severity ?? change.severity,
      breaking: override?.breaking ?? change.breaking,
      potentialBreaking: override?.potentialBreaking ?? change.potentialBreaking,
      overridden: Boolean(override)
    };
  }
  function isBreakingSection(change) {
    const effective = getEffectiveClassification(change);
    return effective.category === "removed" || effective.breaking || effective.potentialBreaking;
  }
  function filterByInclude(changes, include) {
    return changes.filter((change) => {
      if (change.entityType === "component" && !include.components) return false;
      if (change.entityType === "token" && !include.tokens) return false;
      return true;
    });
  }
  function groupByEntity(changes) {
    const groups = /* @__PURE__ */ new Map();
    for (const change of changes) {
      const key = change.entityType === "token" ? "Tokens" : change.entityName;
      const list = groups.get(key) ?? [];
      list.push(change);
      groups.set(key, list);
    }
    return groups;
  }
  function renderBullet(change) {
    const effective = getEffectiveClassification(change);
    const prefix = change.entityType === "token" ? `\`${change.entityName}\` — ` : "";
    const suffix = effective.potentialBreaking && !effective.breaking ? " (potential breaking change)" : "";
    return `- ${prefix}${change.summary}${suffix}`;
  }
  function renderSection(heading, changes) {
    if (changes.length === 0) return "";
    const groups = groupByEntity(changes);
    const lines = [`## ${heading}`, ""];
    for (const [entity, entityChanges] of groups) {
      lines.push(`### ${entity}`);
      for (const change of entityChanges) {
        lines.push(renderBullet(change));
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd() + "\n";
  }
  function generateMarkdown(input) {
    const filtered = filterByInclude(input.changes, input.include);
    const breaking = input.include.breakingChanges ? filtered.filter(isBreakingSection) : [];
    const breakingIds = new Set(breaking.map((c) => c.id));
    const added = filtered.filter((c) => getEffectiveClassification(c).category === "added" && !breakingIds.has(c.id));
    const changed = filtered.filter(
      (c) => getEffectiveClassification(c).category === "modified" && !breakingIds.has(c.id)
    );
    const parts = [`# Design System v${input.version}`, ""];
    if (input.title) parts.push(`**${input.title}**`, "");
    if (input.description) parts.push(input.description, "");
    parts.push(renderSection("Added", added));
    parts.push(renderSection("Changed", changed));
    parts.push(renderSection("Breaking Changes", breaking));
    if (input.include.migrationNotes) {
      const migrationNotes = filtered.filter((c) => c.migrationNote);
      if (migrationNotes.length > 0) {
        parts.push(`## Migration`, "");
        for (const change of migrationNotes) {
          parts.push(`- ${change.migrationNote}`);
        }
        parts.push("");
      }
    }
    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd().concat("\n");
  }
  function generateJson(input) {
    const filtered = filterByInclude(input.changes, input.include);
    const breaking = input.include.breakingChanges ? filtered.filter(isBreakingSection) : [];
    const breakingIds = new Set(breaking.map((c) => c.id));
    const added = filtered.filter((c) => getEffectiveClassification(c).category === "added" && !breakingIds.has(c.id));
    const changed = filtered.filter(
      (c) => getEffectiveClassification(c).category === "modified" && !breakingIds.has(c.id)
    );
    const migration = input.include.migrationNotes ? filtered.filter((c) => c.migrationNote).map((c) => ({ entityName: c.entityName, note: c.migrationNote })) : [];
    return {
      version: input.version,
      title: input.title,
      description: input.description,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: { added: added.length, changed: changed.length, breaking: breaking.length },
      added,
      changed,
      breaking,
      migration
    };
  }
  function postToUi(message) {
    figma.ui.postMessage(message);
  }
  figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });
  let project;
  let latestScannedSnapshot;
  let latestScanSummary;
  async function ensureProject() {
    if (!project) {
      project = await loadProject();
    }
    return project;
  }
  async function persist() {
    await saveProject(project);
  }
  function findCurrentBaseline() {
    return project.baselines.find((b) => b.id === project.currentBaselineId);
  }
  async function resolveComponentIds(baseline) {
    const tracking = baseline.tracking.components;
    if (tracking.scope === "selection") return tracking.includedIds;
    const discovered = await discoverComponents(tracking.scope, tracking.pageIds);
    return discovered.map((d) => d.id);
  }
  function appendSyntheticChange(baselineId, change) {
    let changeSet = getLatestChangeSetForBaseline(project, baselineId);
    if (!changeSet) {
      changeSet = {
        id: generateId("changeset"),
        baselineId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        changes: [],
        scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] }
      };
      project.changeSets.push(changeSet);
    }
    changeSet.changes.push(change);
  }
  async function captureSnapshot(componentIds, tokenCollectionIds, tokensEnabled) {
    const componentResult = await scanComponents(componentIds, (done, total) => {
      postToUi({
        type: "scan-progress",
        progress: { phase: "components", componentsTotal: total, componentsDone: done, tokensTotal: 0, tokensDone: 0 }
      });
    });
    const tokenResult = tokensEnabled ? await scanTokens(tokenCollectionIds, (done, total) => {
      postToUi({
        type: "scan-progress",
        progress: {
          phase: "tokens",
          componentsTotal: componentResult.scanned,
          componentsDone: componentResult.scanned,
          tokensTotal: total,
          tokensDone: done
        }
      });
    }) : { tokens: [], collections: [], scanned: 0, skipped: [] };
    postToUi({
      type: "scan-progress",
      progress: {
        phase: "done",
        componentsTotal: componentResult.scanned,
        componentsDone: componentResult.scanned,
        tokensTotal: tokenResult.scanned,
        tokensDone: tokenResult.scanned
      }
    });
    return {
      snapshot: {
        components: componentResult.components,
        tokens: tokenResult.tokens,
        collections: tokenResult.collections
      },
      scanSummary: {
        componentsScanned: componentResult.scanned,
        componentsSkipped: componentResult.skipped.length,
        tokensScanned: tokenResult.scanned,
        tokensSkipped: tokenResult.skipped.length,
        skippedItems: [...componentResult.skipped, ...tokenResult.skipped]
      }
    };
  }
  async function handleMessage(message) {
    await ensureProject();
    switch (message.type) {
      case "ui-ready":
      case "get-state": {
        postToUi({ type: "state", project });
        return;
      }
      case "discover-components": {
        const components = await discoverComponents(message.scope, message.pageIds);
        postToUi({ type: "discovered-components", components });
        return;
      }
      case "create-baseline": {
        const { snapshot, scanSummary } = await captureSnapshot(
          message.tracking.components.includedIds,
          message.tracking.tokens.includedCollectionIds,
          message.tracking.tokens.enabled
        );
        const baseline = {
          id: generateId("baseline"),
          name: message.name,
          version: message.version,
          description: message.description,
          tracking: message.tracking,
          snapshot,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        project.baselines.push(baseline);
        project.currentBaselineId = baseline.id;
        const changeSet = diffSnapshots(
          baseline.id,
          { components: [], tokens: [] },
          snapshot,
          scanSummary
        );
        project.changeSets.push(changeSet);
        await persist();
        postToUi({ type: "baseline-created", baseline });
        postToUi({ type: "state", project });
        return;
      }
      case "scan": {
        const baseline = findCurrentBaseline();
        if (!baseline) {
          postToUi({ type: "error", message: "No baseline exists yet. Create a baseline first." });
          return;
        }
        const { snapshot, scanSummary } = await captureSnapshot(
          await resolveComponentIds(baseline),
          baseline.tracking.tokens.includedCollectionIds,
          baseline.tracking.tokens.enabled
        );
        const changeSet = diffSnapshots(baseline.id, baseline.snapshot, snapshot, scanSummary);
        project.changeSets.push(changeSet);
        latestScannedSnapshot = snapshot;
        latestScanSummary = scanSummary;
        await persist();
        postToUi({ type: "scan-complete", changeSet });
        postToUi({ type: "state", project });
        return;
      }
      case "create-release": {
        const baseline = findCurrentBaseline();
        if (!baseline) {
          postToUi({ type: "error", message: "No baseline exists yet. Create a baseline first." });
          return;
        }
        const snapshot = latestScannedSnapshot ?? (await captureSnapshot(
          await resolveComponentIds(baseline),
          baseline.tracking.tokens.includedCollectionIds,
          baseline.tracking.tokens.enabled
        )).snapshot;
        const changeSet = diffSnapshots(
          baseline.id,
          baseline.snapshot,
          snapshot,
          latestScanSummary ?? {
            componentsScanned: snapshot.components.length,
            componentsSkipped: 0,
            tokensScanned: snapshot.tokens.length,
            tokensSkipped: 0,
            skippedItems: []
          }
        );
        project.changeSets.push(changeSet);
        const newBaseline = {
          id: generateId("baseline"),
          name: baseline.name,
          version: message.version,
          description: baseline.description,
          tracking: baseline.tracking,
          snapshot,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        project.baselines.push(newBaseline);
        const changelogInput = {
          version: message.version,
          title: message.title,
          description: message.description,
          changes: changeSet.changes,
          include: message.include
        };
        const release = {
          id: generateId("release"),
          version: message.version,
          title: message.title,
          description: message.description,
          baselineId: newBaseline.id,
          previousBaselineId: baseline.id,
          changeSetId: changeSet.id,
          include: message.include,
          changelogMarkdown: generateMarkdown(changelogInput),
          changelogJson: JSON.stringify(generateJson(changelogInput), null, 2),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        project.releases.push(release);
        project.currentBaselineId = newBaseline.id;
        latestScannedSnapshot = void 0;
        latestScanSummary = void 0;
        await persist();
        postToUi({ type: "release-created", release });
        postToUi({ type: "state", project });
        return;
      }
      case "export": {
        const release = project.releases.find((r) => r.id === message.releaseId);
        if (!release) {
          postToUi({ type: "error", message: "Release not found." });
          return;
        }
        const content = message.format === "markdown" ? release.changelogMarkdown : release.changelogJson;
        postToUi({ type: "export-result", format: message.format, content, releaseId: release.id });
        return;
      }
      case "update-change": {
        const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
        const change = changeSet?.changes.find((c) => c.id === message.changeId);
        if (!change) {
          postToUi({ type: "error", message: "Change not found." });
          return;
        }
        if (message.reviewState !== void 0) change.reviewState = message.reviewState;
        if (message.reviewNote !== void 0) change.reviewNote = message.reviewNote;
        if (message.migrationNote !== void 0) change.migrationNote = message.migrationNote;
        if (message.manualClassification !== void 0) {
          change.manualClassification = message.manualClassification ?? void 0;
        }
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "bulk-update-review": {
        const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
        if (!changeSet) {
          postToUi({ type: "error", message: "Change set not found." });
          return;
        }
        const ids = new Set(message.changeIds);
        for (const change of changeSet.changes) {
          if (ids.has(change.id)) change.reviewState = message.reviewState;
        }
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "confirm-rename": {
        const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
        const addedChange = changeSet?.changes.find((c) => c.id === message.addedChangeId);
        const removedChange = changeSet?.changes.find((c) => c.id === message.removedChangeId);
        if (!changeSet || !addedChange || !removedChange) {
          postToUi({ type: "error", message: "Rename suggestion not found." });
          return;
        }
        const kind = addedChange.entityType === "token" ? "token" : "component";
        const renameEntry = {
          fromId: removedChange.entityId,
          fromName: removedChange.entityName,
          toId: addedChange.entityId,
          toName: addedChange.entityName,
          confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const existing = project.trackedEntities.find((e) => e.id === removedChange.entityId);
        if (existing) {
          existing.id = addedChange.entityId;
          existing.displayName = addedChange.entityName;
          existing.renameHistory.push(renameEntry);
        } else {
          const entity = {
            id: addedChange.entityId,
            kind,
            displayName: addedChange.entityName,
            deprecated: false,
            renameHistory: [renameEntry]
          };
          project.trackedEntities.push(entity);
        }
        addedChange.changeType = kind === "token" ? "token-renamed" : "component-renamed";
        addedChange.category = "modified";
        addedChange.before = removedChange.entityName;
        addedChange.after = addedChange.entityName;
        addedChange.summary = `Renamed from "${removedChange.entityName}" to "${addedChange.entityName}" (id changed)`;
        addedChange.renameResolution = "confirmed";
        changeSet.changes = changeSet.changes.filter((c) => c.id !== removedChange.id);
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "dismiss-rename": {
        const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
        const addedChange = changeSet?.changes.find((c) => c.id === message.addedChangeId);
        const removedChange = changeSet?.changes.find((c) => c.id === message.removedChangeId);
        if (!changeSet || !addedChange || !removedChange) {
          postToUi({ type: "error", message: "Rename suggestion not found." });
          return;
        }
        addedChange.renameResolution = "dismissed";
        removedChange.renameResolution = "dismissed";
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "mark-deprecated": {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existing = project.trackedEntities.find((e) => e.id === message.entityId);
        if (existing) {
          existing.deprecated = true;
          existing.deprecatedAt = existing.deprecatedAt ?? now;
          existing.displayName = message.displayName;
          existing.replacement = message.replacement;
          existing.migrationNote = message.migrationNote;
        } else {
          const entity = {
            id: message.entityId,
            kind: message.kind,
            displayName: message.displayName,
            parentId: message.parentId,
            deprecated: true,
            deprecatedAt: now,
            replacement: message.replacement,
            migrationNote: message.migrationNote,
            renameHistory: []
          };
          project.trackedEntities.push(entity);
        }
        const baseline = findCurrentBaseline();
        if (baseline) {
          const suffix = message.replacement ? ` — replaced by ${message.replacement}` : "";
          appendSyntheticChange(baseline.id, {
            id: generateId("change"),
            entityType: message.kind === "token" ? "token" : "component",
            entityId: message.entityId,
            entityName: message.displayName,
            category: "deprecated",
            severity: "info",
            changeType: `${message.kind}-deprecated`,
            summary: `Marked deprecated${suffix}`,
            breaking: false,
            potentialBreaking: false,
            reviewState: "unreviewed",
            migrationNote: message.migrationNote,
            createdAt: now
          });
        }
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "unmark-deprecated": {
        const entity = project.trackedEntities.find((e) => e.id === message.entityId);
        if (!entity) {
          postToUi({ type: "error", message: "Tracked entity not found." });
          return;
        }
        entity.deprecated = false;
        entity.deprecatedAt = void 0;
        entity.replacement = void 0;
        entity.migrationNote = void 0;
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "build-impact-index": {
        const index = await scanInstances((progress) => {
          postToUi({ type: "impact-index-progress", progress });
        });
        project.instanceIndex = index;
        await persist();
        postToUi({ type: "impact-index-complete", index });
        postToUi({ type: "state", project });
        return;
      }
      case "update-settings": {
        project.settings = message.settings;
        await persist();
        postToUi({ type: "state", project });
        return;
      }
      case "focus-node": {
        try {
          const node = await figma.getNodeByIdAsync(message.nodeId);
          if (node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
            const sceneNode = node;
            const page = sceneNode.parent ? (function findPage(n) {
              let current = n;
              while (current) {
                if (current.type === "PAGE") return current;
                current = current.parent;
              }
              return void 0;
            })(sceneNode) : void 0;
            if (page) {
              await figma.setCurrentPageAsync(page);
            }
            figma.currentPage.selection = [sceneNode];
            figma.viewport.scrollAndZoomIntoView([sceneNode]);
          }
        } catch {
          postToUi({ type: "error", message: "Could not locate that node — it may have been deleted." });
        }
        return;
      }
      default:
        return;
    }
  }
  figma.ui.onmessage = (message) => {
    handleMessage(message).catch((error) => {
      postToUi({
        type: "error",
        message: error instanceof Error ? error.message : "Unexpected error in DSLog plugin."
      });
    });
  };
})();
