(function() {
  "use strict";
  function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  async function processInBatches(items, batchSize, fn, onBatch) {
    const results = new Array(items.length);
    for (let start = 0; start < items.length; start += batchSize) {
      const end = Math.min(start + batchSize, items.length);
      for (let i = start; i < end; i++) {
        results[i] = await fn(items[i], i);
      }
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
  const STYLE_BATCH_SIZE = 200;
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
  function formatLineHeight(lineHeight) {
    if (lineHeight.unit === "AUTO") return "AUTO";
    return `${lineHeight.value}${lineHeight.unit === "PERCENT" ? "%" : "px"}`;
  }
  function formatLetterSpacing(letterSpacing) {
    return `${letterSpacing.value}${letterSpacing.unit === "PERCENT" ? "%" : "px"}`;
  }
  async function extractTextStyles(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    const styles = await safely(
      () => figma.getLocalTextStylesAsync(),
      (err) => warn(`Failed to load text styles: ${String(err)}`)
    );
    return processInBatches(
      styles ?? [],
      STYLE_BATCH_SIZE,
      (s) => {
        var _a, _b;
        return {
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          fontFamily: ((_a = s.fontName) == null ? void 0 : _a.family) ?? "Unknown",
          fontStyle: ((_b = s.fontName) == null ? void 0 : _b.style) ?? "Regular",
          fontWeight: s.fontWeight ?? 400,
          fontSize: s.fontSize ?? 0,
          lineHeight: s.lineHeight ? formatLineHeight(s.lineHeight) : "AUTO",
          letterSpacing: s.letterSpacing ? formatLetterSpacing(s.letterSpacing) : "0px",
          textCase: s.textCase ?? "ORIGINAL",
          textDecoration: s.textDecoration ?? "NONE",
          paragraphSpacing: s.paragraphSpacing ?? 0,
          boundVariableIds: collectBoundVariableIds(
            s.boundVariables
          )
        };
      },
      onProgress
    );
  }
  async function extractPaintStyles(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    const styles = await safely(
      () => figma.getLocalPaintStylesAsync(),
      (err) => warn(`Failed to load color styles: ${String(err)}`)
    );
    return processInBatches(
      styles ?? [],
      STYLE_BATCH_SIZE,
      (s) => {
        const paints = s.paints ?? [];
        const solid = paints.find((p) => p.type === "SOLID" && p.visible !== false);
        const hasNonSolid = paints.some((p) => p.type !== "SOLID");
        return {
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          color: solid ? {
            r: solid.color.r,
            g: solid.color.g,
            b: solid.color.b,
            a: solid.opacity ?? 1
          } : null,
          isGradientOrImage: hasNonSolid || !solid,
          boundVariableIds: collectBoundVariableIds(
            s.boundVariables
          )
        };
      },
      onProgress
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
  async function extractEffectStyles(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    const styles = await safely(
      () => figma.getLocalEffectStylesAsync(),
      (err) => warn(`Failed to load effect styles: ${String(err)}`)
    );
    return processInBatches(
      styles ?? [],
      STYLE_BATCH_SIZE,
      (s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        effects: (s.effects ?? []).map(mapEffect),
        boundVariableIds: collectBoundVariableIds(
          s.boundVariables
        )
      }),
      onProgress
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
  async function extractGridStyles(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    const styles = await safely(
      () => figma.getLocalGridStylesAsync(),
      (err) => warn(`Failed to load grid styles: ${String(err)}`)
    );
    return processInBatches(
      styles ?? [],
      STYLE_BATCH_SIZE,
      (s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        grids: (s.layoutGrids ?? []).map(mapGrid)
      }),
      onProgress
    );
  }
  const COMPONENT_BATCH_SIZE = 100;
  const MAX_DESCENDANTS_SCANNED = 60;
  const MAX_DESCENDANT_DEPTH = 4;
  function findPageName(node) {
    let current = node;
    while (current) {
      if (current.type === "PAGE") return current.name;
      current = current.parent;
    }
    return "Unknown Page";
  }
  function scanDescendantBoundVariableIds(node) {
    const ids = /* @__PURE__ */ new Set();
    let scanned = 0;
    const visit = (n, depth) => {
      if (scanned >= MAX_DESCENDANTS_SCANNED || depth > MAX_DESCENDANT_DEPTH) return;
      scanned++;
      const bound = n.boundVariables;
      collectBoundVariableIds(bound).forEach((id) => ids.add(id));
      if ("children" in n) {
        for (const child of n.children) {
          if (scanned >= MAX_DESCENDANTS_SCANNED) break;
          visit(child, depth + 1);
        }
      }
    };
    visit(node, 0);
    return Array.from(ids);
  }
  function mapPropertyDefinitions(defs) {
    if (!defs) return [];
    return Object.entries(defs).map(([name, def]) => ({
      name,
      type: def.type,
      defaultValue: String(def.defaultValue ?? ""),
      variantOptions: def.variantOptions
    }));
  }
  function mapVariant(node) {
    return {
      id: node.id,
      name: node.name,
      description: node.description ?? "",
      variantProperties: node.variantProperties ?? {},
      boundVariableIds: scanDescendantBoundVariableIds(node)
    };
  }
  async function extractComponents(onProgress, onWarning) {
    const warn = onWarning ?? (() => {
    });
    await safely(
      () => figma.loadAllPagesAsync(),
      (err) => warn(`Failed to load all pages for component scan: ${String(err)}`)
    );
    const nodes = await safely(
      () => Promise.resolve(figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })),
      (err) => warn(`Failed to scan document for components: ${String(err)}`)
    );
    const allNodes = nodes ?? [];
    const componentSets = allNodes.filter((n) => n.type === "COMPONENT_SET");
    const standaloneComponents = allNodes.filter(
      (n) => {
        var _a;
        return n.type === "COMPONENT" && ((_a = n.parent) == null ? void 0 : _a.type) !== "COMPONENT_SET";
      }
    );
    const fromSets = await processInBatches(
      componentSets,
      COMPONENT_BATCH_SIZE,
      (set) => {
        const variantMembers = set.children.filter((c) => c.type === "COMPONENT");
        return {
          id: set.id,
          key: set.key ?? set.id,
          name: set.name,
          description: set.description ?? "",
          isComponentSet: true,
          pageName: findPageName(set),
          properties: mapPropertyDefinitions(set.componentPropertyDefinitions),
          variants: variantMembers.map(mapVariant),
          boundVariableIds: Array.from(
            new Set(variantMembers.flatMap((v) => scanDescendantBoundVariableIds(v)))
          )
        };
      },
      onProgress
    );
    const fromStandalone = await processInBatches(
      standaloneComponents,
      COMPONENT_BATCH_SIZE,
      (node) => ({
        id: node.id,
        key: node.key ?? node.id,
        name: node.name,
        description: node.description ?? "",
        isComponentSet: false,
        pageName: findPageName(node),
        properties: mapPropertyDefinitions(node.componentPropertyDefinitions),
        variants: [mapVariant(node)],
        boundVariableIds: scanDescendantBoundVariableIds(node)
      }),
      onProgress
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
        const rgba = value;
        return {
          kind: "color",
          r: rgba.r,
          g: rgba.g,
          b: rgba.b,
          a: "a" in rgba ? rgba.a : 1
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
          valuesByMode
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
  async function extractDesignSystem(onProgress) {
    const warnings = [];
    const warn = (message) => warnings.push(message);
    const { collections, variables } = await extractVariableCollections(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "variables", done, total }),
      warn
    );
    const textStyles = await extractTextStyles(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "text-styles", done, total }),
      warn
    );
    const paintStyles = await extractPaintStyles(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "color-styles", done, total }),
      warn
    );
    const effectStyles = await extractEffectStyles(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "effect-styles", done, total }),
      warn
    );
    const gridStyles = await extractGridStyles(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "grid-styles", done, total }),
      warn
    );
    const components = await extractComponents(
      (done, total) => onProgress == null ? void 0 : onProgress({ stage: "components", done, total }),
      warn
    );
    if (collections.length === 0 && variables.length === 0) {
      warn("No local variables found — falling back to styles as the token source of truth.");
    }
    if (components.length === 0) {
      warn("No components or component sets found in this file.");
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
  function toPathSegments(name) {
    return name.split("/").map((segment) => segment.trim()).filter(Boolean);
  }
  function kebabCase(input) {
    return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }
  function toCssVarName(pathSegments) {
    const slug = pathSegments.map(kebabCase).filter(Boolean).join("-");
    return `--${slug}`;
  }
  function toFileSafeName(name) {
    const cleaned = name.replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, " ");
    return cleaned.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  }
  function rgbaToHex(r, g, b, a) {
    const toByte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const toHexByte = (v) => toByte(v).toString(16).padStart(2, "0");
    const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return a < 1 ? `${base}${toHexByte(a)}` : base;
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
    const rows = c.variants.map((v) => [
      v.name,
      ...propertyNames.map((p) => v.variantProperties[p] ?? "—")
    ]);
    return joinSections([mdHeading(2, "Variants"), mdTable(["Variant", ...propertyNames], rows)]);
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
        p.defaultValue || "—",
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
    if (c.boundVariableIds.length === 0) {
      return joinSections([
        mdHeading(2, "Token References"),
        "_No bound variables were detected on this component._\n"
      ]);
    }
    const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
    const rows = c.boundVariableIds.map((id) => {
      const v = variablesById.get(id);
      return v ? [v.name, v.cssName, v.category] : [id, "—", "unresolved"];
    });
    return joinSections([
      mdHeading(2, "Token References"),
      mdTable(["Token", "CSS Variable", "Category"], rows)
    ]);
  }
  function relatedComponentsSection(c) {
    return joinSections([mdHeading(2, "Related Components"), mdList(c.relatedComponentNames)]);
  }
  function generateComponentMd(c, ds) {
    const content = joinSections([
      mdHeading(1, c.name),
      c.isComponentSet ? "_Component Set_\n" : "_Component_\n",
      mdHeading(2, "Description"),
      c.description ? `${c.description}
` : "_No description provided in Figma._\n",
      variantsSection(c),
      sizesAndStatesSection(c),
      propertiesSection(c),
      accessibilitySection$1(c),
      usageGuidelinesSection(c),
      tokenReferencesSection(c, ds),
      relatedComponentsSection(c)
    ]);
    return { path: `components/${toFileSafeName(c.name)}.md`, content };
  }
  function generateComponentDocs(ds) {
    const usedPaths = /* @__PURE__ */ new Map();
    return ds.components.map((c) => {
      const file = generateComponentMd(c, ds);
      const count = usedPaths.get(file.path) ?? 0;
      usedPaths.set(file.path, count + 1);
      if (count === 0) return file;
      const deduped = file.path.replace(/\.md$/, `-${count + 1}.md`);
      return { ...file, path: deduped };
    });
  }
  function unitFor(category) {
    return category === "spacing" || category === "typography" ? "px" : "";
  }
  function valueToCss(value, category) {
    switch (value.kind) {
      case "color":
        return value.color.hex;
      case "float":
        return `${value.value}${unitFor(category)}`;
      case "string":
        return value.value;
      case "boolean":
        return String(value.value);
      case "alias": {
        const segments = value.variableName.split("/").map((s) => s.trim()).filter(Boolean);
        const cssName = `--${segments.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-")}`;
        return `var(${cssName})`;
      }
      default:
        return null;
    }
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
      [`${style.cssName}-font-family`]: props.fontFamily,
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
      const defaultValue = v.valuesByMode[0];
      if (!defaultValue) continue;
      const css = valueToCss(defaultValue.value, v.category);
      if (css !== null) target[v.cssName] = css;
    }
  }
  function addVariableModeVars(modes, variables) {
    for (const v of variables) {
      for (const vbm of v.valuesByMode) {
        const css = valueToCss(vbm.value, v.category);
        if (css === null) continue;
        const modeKey = vbm.modeName;
        (modes[modeKey] ?? (modes[modeKey] = {}))[v.cssName] = css;
      }
    }
  }
  function generateCssTokensJson(ds) {
    const root = {};
    const modes = {};
    addVariableVars(root, ds.variables);
    addVariableModeVars(modes, ds.variables);
    if (!ds.variables.some((v) => v.category === "color")) {
      for (const s of ds.styles.color) {
        if (s.paint) root[s.cssName] = s.paint.hex;
      }
    }
    if (!ds.variables.some((v) => v.category === "typography")) {
      for (const s of ds.styles.text) Object.assign(root, textStyleToCssVars(s));
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
    const output = {
      $schema: "https://designmd.dev/schema/css-tokens.json",
      metadata: {
        fileName: ds.metadata.fileName,
        generatedAt: ds.metadata.generatedAt
      },
      root,
      modes
    };
    return {
      path: "css-tokens.json",
      content: JSON.stringify(output, null, 2)
    };
  }
  function defaultValueLabel(v) {
    var _a;
    const first = (_a = v.valuesByMode[0]) == null ? void 0 : _a.value;
    if (!first) return "—";
    switch (first.kind) {
      case "color":
        return first.color.hex;
      case "float":
        return String(first.value);
      case "string":
        return first.value;
      case "boolean":
        return String(first.value);
      case "alias":
        return `→ ${first.variableName}`;
      default:
        return "—";
    }
  }
  function overviewSection(ds) {
    const { summary, metadata } = ds;
    const rows = [
      ["Source File", metadata.fileName],
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
        s.name,
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
        s.name,
        s.cssName,
        (p == null ? void 0 : p.fontFamily) ?? "—",
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
      s.name,
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
      s.name,
      s.cssName,
      (s.grids ?? []).map((g) => g.pattern).join(", ") || "—",
      s.description || "—"
    ]);
    return joinSections([
      mdHeading(2, "Grid Tokens"),
      mdTable(["Style", "CSS Variable", "Pattern", "Description"], rows)
    ]);
  }
  function componentsSection(ds) {
    if (ds.components.length === 0) {
      return joinSections([
        mdHeading(2, "Components"),
        "_No components or component sets found in this file._\n"
      ]);
    }
    const rows = ds.components.map((c) => [
      c.name,
      c.isComponentSet ? "Component Set" : "Component",
      String(c.variants.length),
      c.states.join(", ") || "—",
      c.sizes.join(", ") || "—",
      `[${c.name}.md](./components/${c.name.replace(/[\\/:*?"<>|]+/g, "-")}.md)`
    ]);
    return joinSections([
      mdHeading(2, "Components"),
      "Full per-component documentation lives in `/components`. See individual files for variants, properties, and token references.\n",
      mdTable(["Component", "Type", "Variants", "States", "Sizes", "Docs"], rows)
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
      "This section lists deterministic, rule-based checks only — it does not perform AI or contrast-ratio analysis."
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
      "Verify color contrast against WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text) using your own contrast tooling before shipping."
    );
    return joinSections([mdHeading(2, "Accessibility Notes"), mdList(notes)]);
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
  function isJsonLeaf(v) {
    return typeof v === "object" && v !== null && "$value" in v;
  }
  function valueToJson(value) {
    switch (value.kind) {
      case "color":
        return value.color.hex;
      case "float":
        return value.value;
      case "string":
        return value.value;
      case "boolean":
        return value.value;
      case "alias":
        return `{${toPathSegments(value.variableName).join(".")}}`;
      default:
        return null;
    }
  }
  function variableToLeaf(variable, category) {
    const defaultValue = variable.valuesByMode[0];
    const modes = {};
    for (const vbm of variable.valuesByMode) {
      modes[vbm.modeName] = valueToJson(vbm.value);
    }
    return {
      path: stripRedundantCategoryPrefix(variable.path, category),
      leaf: {
        $type: category,
        $value: defaultValue ? valueToJson(defaultValue.value) : null,
        $description: variable.description || void 0,
        $extensions: {
          figma: {
            source: "variable",
            collection: variable.collectionName,
            cssName: variable.cssName,
            scopes: variable.scopes,
            modes
          }
        }
      }
    };
  }
  function styleToLeaf(style, category) {
    var _a;
    let value = null;
    if (style.type === "PAINT") value = ((_a = style.paint) == null ? void 0 : _a.hex) ?? null;
    else if (style.type === "TEXT") value = JSON.stringify(style.textProperties);
    else if (style.type === "EFFECT") value = JSON.stringify(style.effects);
    else if (style.type === "GRID") value = JSON.stringify(style.grids);
    return {
      path: stripRedundantCategoryPrefix(style.path, category),
      leaf: {
        $type: category,
        $value: value,
        $description: style.description || void 0,
        $extensions: {
          figma: { source: "style", cssName: style.cssName }
        }
      }
    };
  }
  const CATEGORY_STYLE_FALLBACK = {
    color: "color",
    typography: "text",
    effect: "effect",
    grid: "grid"
  };
  function buildCategorySection(ds, category) {
    const variables = ds.variables.filter((v) => v.category === category);
    let entries;
    if (variables.length > 0) {
      entries = variables.map((v) => variableToLeaf(v, category));
    } else {
      const fallbackKey = CATEGORY_STYLE_FALLBACK[category];
      const fallbackStyles = fallbackKey ? ds.styles[fallbackKey] : [];
      entries = fallbackStyles.map((s) => styleToLeaf(s, category));
    }
    return buildTokenTree(entries, isJsonLeaf);
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
  function generateTokensJson(ds) {
    const output = {
      $schema: "https://designmd.dev/schema/tokens.json",
      metadata: {
        fileName: ds.metadata.fileName,
        generatedAt: ds.metadata.generatedAt,
        pluginVersion: ds.metadata.pluginVersion
      }
    };
    for (const category of CATEGORIES) {
      output[category] = buildCategorySection(ds, category);
    }
    const otherVariables = ds.variables.filter((v) => !CATEGORIES.includes(v.category));
    if (otherVariables.length > 0) {
      output.other = buildTokenTree(
        otherVariables.map((v) => variableToLeaf(v, v.category)),
        isJsonLeaf
      );
    }
    return {
      path: "tokens.json",
      content: JSON.stringify(output, null, 2)
    };
  }
  function generateOutputs(ds, options) {
    const files = [];
    if (options.designMd) files.push(generateDesignMd(ds));
    if (options.componentDocs) files.push(...generateComponentDocs(ds));
    if (options.tokensJson) files.push(generateTokensJson(ds));
    if (options.cssTokensJson) files.push(generateCssTokensJson(ds));
    return files;
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
        name: p.name,
        type: p.type,
        defaultValue: p.defaultValue,
        variantOptions: p.variantOptions
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
        pageName: c.pageName
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
    docs.forEach((doc, index) => {
      if (doc.boundVariableIds.length === 0) return;
      const relatedIndices = /* @__PURE__ */ new Set();
      for (const variableId of doc.boundVariableIds) {
        for (const otherIndex of docsByVariableId.get(variableId) ?? []) {
          if (otherIndex !== index) relatedIndices.add(otherIndex);
          if (relatedIndices.size >= 10) break;
        }
        if (relatedIndices.size >= 10) break;
      }
      doc.relatedComponentNames = Array.from(relatedIndices).slice(0, 10).map((i) => docs[i].name);
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
        grids: s.grids.map((g) => ({ ...g }))
      };
    });
  }
  const SPACING_HINTS = ["spacing", "space", "gap", "padding", "margin", "radius", "size", "sizing"];
  const TYPOGRAPHY_HINTS = ["font", "typography", "type", "line-height", "letter-spacing", "text"];
  const SEMANTIC_HINTS = ["semantic"];
  const COMPONENT_HINTS = ["component"];
  function nameHasHint(name, hints) {
    const lower = name.toLowerCase();
    return hints.some((hint) => lower.includes(hint));
  }
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
        valuesByMode: v.valuesByMode.map((vbm) => ({
          modeId: vbm.modeId,
          modeName: modeNames.get(vbm.modeId) ?? vbm.modeId,
          value: toTokenValue(vbm.value, variableNamesById)
        })),
        codeSyntax: v.codeSyntax,
        cssName: toCssVarName(path)
      };
    });
  }
  const PLUGIN_VERSION = "1.0.0";
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
      textStylesCount: system.styles.text.length,
      colorStylesCount: system.styles.color.length,
      effectStylesCount: system.styles.effect.length,
      gridStylesCount: system.styles.grid.length,
      modesCount: modeIds.size
    };
  }
  function transformToDesignSystem(raw, fileName) {
    const collections = transformVariableCollections(raw.collections);
    const variables = transformVariables(raw.variables, collections);
    const styles = {
      text: transformTextStyles(raw.textStyles),
      color: transformPaintStyles(raw.paintStyles),
      effect: transformEffectStyles(raw.effectStyles),
      grid: transformGridStyles(raw.gridStyles)
    };
    const components = transformComponents(raw.components);
    const base = { collections, variables, styles, components };
    return {
      metadata: {
        fileName,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        pluginVersion: PLUGIN_VERSION
      },
      ...base,
      summary: buildSummary(base),
      warnings: raw.warnings
    };
  }
  figma.showUI(__html__, { width: 480, height: 700, themeColors: true });
  let cachedDesignSystem;
  function post(message) {
    figma.ui.postMessage(message);
  }
  async function handleExtract() {
    try {
      const raw = await extractDesignSystem((progress) => {
        const percent = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 100;
        post({ type: "progress", stage: progress.stage, percent });
      });
      const designSystem = transformToDesignSystem(raw, figma.root.name);
      cachedDesignSystem = designSystem;
      post({ type: "extraction-complete", designSystem });
    } catch (err) {
      post({
        type: "error",
        stage: "extraction",
        message: `Failed to extract the design system: ${err instanceof Error ? err.message : String(err)}`
      });
    }
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
      const files = generateOutputs(cachedDesignSystem, options.options);
      if (files.length === 0) {
        post({
          type: "error",
          stage: "generation",
          message: "No output types were selected. Choose at least one export option and try again."
        });
        return;
      }
      post({ type: "generation-complete", files });
    } catch (err) {
      post({
        type: "error",
        stage: "generation",
        message: `Failed to generate output files: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  }
  figma.ui.onmessage = async (message) => {
    switch (message.type) {
      case "extract":
        await handleExtract();
        break;
      case "generate":
        await handleGenerate(message);
        break;
    }
  };
})();
