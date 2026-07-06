(function() {
  "use strict";
  function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
  }
  function nameMatches(node, patterns) {
    const normalized = normalizeName(node.name);
    return patterns.some(
      (pattern) => typeof pattern === "string" ? normalized.includes(pattern) : pattern.test(normalized)
    );
  }
  function walk(node, visit) {
    visit(node);
    for (const child of node.children ?? []) walk(child, visit);
  }
  function findAll(node, predicate) {
    const matches = [];
    walk(node, (n) => {
      if (predicate(n)) matches.push(n);
    });
    return matches;
  }
  function hasDescendant(node, predicate) {
    if (predicate(node)) return true;
    return (node.children ?? []).some((child) => hasDescendant(child, predicate));
  }
  function countNodes(node) {
    let count = 1;
    for (const child of node.children ?? []) count += countNodes(child);
    return count;
  }
  function extractLabel(node, maxLength = 60) {
    const textNode = findAll(node, (n) => n.type === "TEXT" && !!n.characters?.trim()).at(0);
    const text = node.type === "TEXT" ? node.characters : textNode?.characters;
    if (!text) return void 0;
    const trimmed = text.trim().replace(/\s+/g, " ");
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
  }
  function collectAllText(node) {
    return findAll(node, (n) => n.type === "TEXT" && !!n.characters).map((n) => n.characters ?? "").join(" ").toLowerCase();
  }
  function directChildren(node) {
    return node.children ?? [];
  }
  function shapeSignature(node) {
    const childTypes = directChildren(node).map((c) => c.type).join(",");
    return `${node.type}:${directChildren(node).length}:${childTypes}`;
  }
  function findRepeatingGroups(root, minRepeats = 3) {
    const groups = [];
    function visit(node) {
      const children = directChildren(node);
      if (children.length >= minRepeats) {
        const bySignature = /* @__PURE__ */ new Map();
        for (const child of children) {
          if (child.type === "TEXT") continue;
          const sig = shapeSignature(child);
          const list = bySignature.get(sig) ?? [];
          list.push(child);
          bySignature.set(sig, list);
        }
        for (const items of bySignature.values()) {
          if (items.length >= minRepeats) groups.push({ parent: node, items });
        }
      }
      for (const child of children) visit(child);
    }
    visit(root);
    return groups;
  }
  function averageAspectRatio(items) {
    if (items.length === 0) return 1;
    const ratios = items.map((item) => item.height > 0 ? item.width / item.height : 1);
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }
  function makeDetection(category, node, ctx, init) {
    return {
      id: `${ctx.frameId}:${node.id}:${category}`,
      category,
      nodeId: node.id,
      nodeName: node.name,
      frameId: ctx.frameId,
      frameName: ctx.frameName,
      label: init.label,
      variant: init.variant,
      confidence: Math.max(0, Math.min(1, init.confidence)),
      evidence: init.evidence,
      metadata: init.metadata
    };
  }
  const NAME_PATTERN$a = /\b(accordion|collapsible|disclosure|expander)\b/;
  const CHEVRON_PATTERN = /\b(chevron|caret|expand|collapse)\b/;
  const CANDIDATE_TYPES$8 = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE", "GROUP"]);
  const accordionAnalyzer = {
    category: "accordion",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      const detectedParents = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$8.has(node.type) && nameMatches(node, [NAME_PATTERN$a])) {
          detectedParents.add(node.id);
          detections.push(
            makeDetection("accordion", node, ctx, {
              confidence: 0.7,
              evidence: [`Layer name matches accordion naming convention ("${node.name}")`],
              metadata: { sectionCount: (node.children ?? []).length }
            })
          );
          for (const child of node.children ?? []) claimed.add(child.id);
          return;
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      const groups = findRepeatingGroups(root, 2);
      for (const group of groups) {
        if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
        const allHaveChevronAndText = group.items.every(
          (item) => hasDescendant(item, (n) => n.type === "TEXT") && hasDescendant(item, (n) => n.type !== "TEXT" && nameMatches(n, [CHEVRON_PATTERN]))
        );
        if (allHaveChevronAndText) {
          detections.push(
            makeDetection("accordion", group.parent, ctx, {
              confidence: 0.5,
              evidence: [
                `${group.items.length} repeated rows pairing a label with an expand/chevron icon detected under "${group.parent.name}"`
              ],
              metadata: { sectionCount: group.items.length }
            })
          );
        }
      }
      return detections;
    }
  };
  const NAME_PATTERN$9 = /\b(button|btn|cta)\b/;
  const CANDIDATE_TYPES$7 = /* @__PURE__ */ new Set(["COMPONENT", "INSTANCE", "FRAME", "GROUP"]);
  function detectVariant(node) {
    const name = normalizeName(`${node.name} ${node.mainComponentName ?? ""}`);
    if (/\b(tertiary|ghost|link|text ?only)\b/.test(name)) return "tertiary";
    if (/\b(secondary|outline|outlined|stroke)\b/.test(name)) return "secondary";
    if (/\b(primary|filled|solid)\b/.test(name)) return "primary";
    return "unknown";
  }
  function looksButtonShaped(node) {
    if (node.width <= 0 || node.height <= 0) return false;
    return node.height >= 20 && node.height <= 72 && node.width >= 32 && node.width <= 480 && node.width >= node.height;
  }
  const buttonAnalyzer = {
    category: "button",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$7.has(node.type)) {
          const nameHit = nameMatches(node, [NAME_PATTERN$9]) || nameMatches({ ...node, name: node.mainComponentName ?? "" }, [NAME_PATTERN$9]);
          const shapeHit = looksButtonShaped(node);
          if (nameHit || node.type === "INSTANCE" && shapeHit) {
            const variant = detectVariant(node);
            const evidence = [];
            if (nameHit) evidence.push(`Layer name matches button naming convention ("${node.name}")`);
            if (shapeHit) evidence.push("Dimensions are consistent with a clickable button");
            if (node.type === "INSTANCE") evidence.push("Node is a component instance, suggesting a reusable button component");
            if (variant !== "unknown") evidence.push(`Variant keyword detected: "${variant}"`);
            const confidence = (nameHit ? 0.55 : 0.3) + (shapeHit ? 0.2 : 0) + (variant !== "unknown" ? 0.15 : 0) + (node.type === "INSTANCE" ? 0.1 : 0);
            detections.push(
              makeDetection("button", node, ctx, {
                confidence,
                evidence,
                variant,
                label: extractLabel(node)
              })
            );
            for (const child of node.children ?? []) claimed.add(child.id);
            return;
          }
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$8 = /\bcard\b/;
  const IMAGE_LIKE_TYPES = /* @__PURE__ */ new Set(["RECTANGLE", "ELLIPSE", "VECTOR"]);
  const cardAnalyzer = {
    category: "card",
    detect(root, ctx) {
      const detections = [];
      const detectedParents = /* @__PURE__ */ new Set();
      function visitNamed(node) {
        if (nameMatches(node, [NAME_PATTERN$8]) && node.type !== "TEXT") {
          detectedParents.add(node.id);
          detections.push(
            makeDetection("card", node, ctx, {
              confidence: 0.65,
              evidence: [`Layer name matches card naming convention ("${node.name}")`]
            })
          );
          return;
        }
        for (const child of node.children ?? []) visitNamed(child);
      }
      visitNamed(root);
      const groups = findRepeatingGroups(root, 2);
      for (const group of groups) {
        if (detectedParents.has(group.parent.id)) continue;
        const aspect = averageAspectRatio(group.items);
        const hasImageAndText = group.items.every(
          (item) => hasDescendant(item, (n) => IMAGE_LIKE_TYPES.has(n.type)) && hasDescendant(item, (n) => n.type === "TEXT")
        );
        const looksLikeCards = aspect < 2 && hasImageAndText;
        if (looksLikeCards) {
          detectedParents.add(group.parent.id);
          detections.push(
            makeDetection("card", group.parent, ctx, {
              confidence: 0.5,
              evidence: [
                `${group.items.length} structurally identical tiles with media + text detected under "${group.parent.name}"`
              ],
              metadata: { cardCount: group.items.length }
            })
          );
        }
      }
      return detections;
    }
  };
  const NAME_PATTERN$7 = /\b(chart|graph|plot|sparkline|histogram)\b/;
  const TYPE_PATTERNS = [
    [/\bbar ?chart\b/, "bar"],
    [/\bline ?chart\b/, "line"],
    [/\bpie ?chart\b/, "pie"],
    [/\bdonut ?chart\b/, "donut"],
    [/\barea ?chart\b/, "area"],
    [/\bsparkline\b/, "sparkline"],
    [/\bhistogram\b/, "histogram"]
  ];
  const CANDIDATE_TYPES$6 = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE", "GROUP", "VECTOR"]);
  const chartAnalyzer = {
    category: "chart",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$6.has(node.type) && nameMatches(node, [NAME_PATTERN$7])) {
          const normalized = node.name.toLowerCase();
          const matchedType = TYPE_PATTERNS.find(([pattern]) => pattern.test(normalized));
          detections.push(
            makeDetection("chart", node, ctx, {
              confidence: matchedType ? 0.75 : 0.55,
              evidence: [`Layer name matches chart naming convention ("${node.name}")`],
              variant: matchedType?.[1] ?? "unspecified",
              label: extractLabel(node)
            })
          );
          for (const child of node.children ?? []) claimed.add(child.id);
          return;
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$6 = /\b(dropdown|drop ?down|select|combo ?box|picker)\b/;
  const ICON_PATTERN$1 = /\b(chevron|caret|arrow[- ]?down)\b/;
  const CANDIDATE_TYPES$5 = /* @__PURE__ */ new Set(["COMPONENT", "INSTANCE", "FRAME", "GROUP"]);
  const dropdownAnalyzer = {
    category: "dropdown",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$5.has(node.type)) {
          const nameHit = nameMatches(node, [NAME_PATTERN$6]);
          const hasChevron = hasDescendant(node, (n) => nameMatches(n, [ICON_PATTERN$1]));
          if (nameHit || node.type === "INSTANCE" && hasChevron) {
            const evidence = [];
            if (nameHit) evidence.push(`Layer name matches dropdown/select naming convention ("${node.name}")`);
            if (hasChevron) evidence.push("Contains a chevron/caret icon indicating an expandable selector");
            const confidence = (nameHit ? 0.6 : 0.35) + (hasChevron ? 0.25 : 0);
            detections.push(
              makeDetection("dropdown", node, ctx, {
                confidence,
                evidence,
                label: extractLabel(node)
              })
            );
            for (const child of node.children ?? []) claimed.add(child.id);
            return;
          }
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$5 = /\b(input|text ?field|textfield|text ?box|form ?field)\b/;
  const CANDIDATE_TYPES$4 = /* @__PURE__ */ new Set(["COMPONENT", "INSTANCE", "FRAME", "GROUP"]);
  function looksInputShaped(node) {
    if (node.width <= 0 || node.height <= 0) return false;
    return node.height >= 28 && node.height <= 64 && node.width >= 80 && node.width / node.height >= 2;
  }
  const inputAnalyzer = {
    category: "input",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$4.has(node.type)) {
          const nameHit = nameMatches(node, [NAME_PATTERN$5]);
          const shapeHit = looksInputShaped(node);
          const hasSingleTextChild = hasDescendant(node, (n) => n.type === "TEXT");
          if (nameHit || shapeHit && hasSingleTextChild && node.type === "INSTANCE") {
            const evidence = [];
            if (nameHit) evidence.push(`Layer name matches input field naming convention ("${node.name}")`);
            if (shapeHit) evidence.push("Wide, short shape consistent with a single-line text field");
            if (hasSingleTextChild) evidence.push("Contains placeholder/label text");
            const confidence = (nameHit ? 0.55 : 0.3) + (shapeHit ? 0.2 : 0) + (hasSingleTextChild ? 0.15 : 0);
            detections.push(
              makeDetection("input", node, ctx, {
                confidence,
                evidence,
                label: extractLabel(node)
              })
            );
            for (const child of node.children ?? []) claimed.add(child.id);
            return;
          }
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$4 = /\b(modal|dialog|popup|pop-up|overlay|lightbox)\b/;
  const CLOSE_ICON_PATTERN = /\b(close|dismiss|x)\b/;
  const CANDIDATE_TYPES$3 = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE", "GROUP"]);
  const modalAnalyzer = {
    category: "modal",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$3.has(node.type)) {
          const nameHit = nameMatches(node, [NAME_PATTERN$4]);
          const hasCloseIcon = hasDescendant(node, (n) => n.type !== "TEXT" && nameMatches(n, [CLOSE_ICON_PATTERN]));
          if (nameHit) {
            const evidence = [`Layer name matches modal/dialog naming convention ("${node.name}")`];
            if (hasCloseIcon) evidence.push("Contains a close/dismiss control");
            detections.push(
              makeDetection("modal", node, ctx, {
                confidence: 0.6 + (hasCloseIcon ? 0.25 : 0),
                evidence,
                label: extractLabel(node)
              })
            );
            for (const child of node.children ?? []) claimed.add(child.id);
            return;
          }
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$3 = /\b(navbar|nav ?bar|navigation|sidebar|side ?nav|top ?bar|header ?bar|menu ?bar|breadcrumbs?)\b/;
  const CANDIDATE_TYPES$2 = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE", "GROUP"]);
  const navigationAnalyzer = {
    category: "navigation",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      const detectedParents = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$2.has(node.type) && nameMatches(node, [NAME_PATTERN$3])) {
          detectedParents.add(node.id);
          const variant = /sidebar|side ?nav/.test(node.name.toLowerCase()) ? "sidebar" : "top-nav";
          detections.push(
            makeDetection("navigation", node, ctx, {
              confidence: 0.7,
              evidence: [`Layer name matches navigation naming convention ("${node.name}")`],
              variant,
              label: extractLabel(node)
            })
          );
          for (const child of node.children ?? []) claimed.add(child.id);
          return;
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      const groups = findRepeatingGroups(root, 3);
      for (const group of groups) {
        if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
        const looksLikeNavItems = group.items.every((item) => (item.children ?? []).length <= 3 && item.height <= 80);
        const parentNameHints = /menu|nav|tabs?/.test(group.parent.name.toLowerCase());
        if (looksLikeNavItems && parentNameHints) {
          detections.push(
            makeDetection("navigation", group.parent, ctx, {
              confidence: 0.4,
              evidence: [`${group.items.length} repeated nav-item-like children detected under "${group.parent.name}"`]
            })
          );
        }
      }
      return detections;
    }
  };
  const NAME_PATTERN$2 = /\bsearch\b/;
  const ICON_PATTERN = /\b(search|magnif(y|ier)|loupe)\b/;
  const CANDIDATE_TYPES$1 = /* @__PURE__ */ new Set(["COMPONENT", "INSTANCE", "FRAME", "GROUP"]);
  const searchAnalyzer = {
    category: "search",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES$1.has(node.type)) {
          const nameHit = nameMatches(node, [NAME_PATTERN$2]);
          const hasSearchIcon = hasDescendant(node, (n) => n.type !== "TEXT" && nameMatches(n, [ICON_PATTERN]));
          const placeholderHit = collectAllText(node).includes("search");
          if (nameHit || hasSearchIcon || node.type === "INSTANCE" && placeholderHit) {
            const evidence = [];
            if (nameHit) evidence.push(`Layer name matches search naming convention ("${node.name}")`);
            if (hasSearchIcon) evidence.push("Contains a search/magnifier icon");
            if (placeholderHit) evidence.push('Placeholder or label text references "search"');
            const confidence = (nameHit ? 0.55 : 0.25) + (hasSearchIcon ? 0.25 : 0) + (placeholderHit ? 0.15 : 0);
            detections.push(
              makeDetection("search", node, ctx, {
                confidence,
                evidence,
                label: extractLabel(node)
              })
            );
            for (const child of node.children ?? []) claimed.add(child.id);
            return;
          }
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      return detections;
    }
  };
  const NAME_PATTERN$1 = /\b(table|data ?grid|grid|list ?view)\b/;
  const tableAnalyzer = {
    category: "table",
    detect(root, ctx) {
      const detections = [];
      const detectedParents = /* @__PURE__ */ new Set();
      function visitNamed(node) {
        if (nameMatches(node, [NAME_PATTERN$1]) && (node.type === "FRAME" || node.type === "INSTANCE" || node.type === "COMPONENT")) {
          detectedParents.add(node.id);
          detections.push(
            makeDetection("table", node, ctx, {
              confidence: 0.7,
              evidence: [`Layer name matches table/grid naming convention ("${node.name}")`],
              metadata: { rowCount: (node.children ?? []).length }
            })
          );
          return;
        }
        for (const child of node.children ?? []) visitNamed(child);
      }
      visitNamed(root);
      const groups = findRepeatingGroups(root, 3);
      for (const group of groups) {
        if (detectedParents.has(group.parent.id)) continue;
        const aspect = averageAspectRatio(group.items);
        const avgColumns = group.items.reduce((sum, item) => sum + Math.max(1, (item.children ?? []).length), 0) / group.items.length;
        const looksLikeRows = aspect >= 2 && avgColumns >= 2;
        if (looksLikeRows) {
          detectedParents.add(group.parent.id);
          detections.push(
            makeDetection("table", group.parent, ctx, {
              confidence: 0.55,
              evidence: [
                `${group.items.length} structurally identical wide rows detected under "${group.parent.name}"`,
                `Average ${avgColumns.toFixed(1)} columns per row`
              ],
              metadata: { rowCount: group.items.length, totalNodes: countNodes(group.parent) }
            })
          );
        }
      }
      return detections;
    }
  };
  const NAME_PATTERN = /\btabs?\b/;
  const CANDIDATE_TYPES = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "INSTANCE", "GROUP"]);
  const tabsAnalyzer = {
    category: "tabs",
    detect(root, ctx) {
      const detections = [];
      const claimed = /* @__PURE__ */ new Set();
      const detectedParents = /* @__PURE__ */ new Set();
      function visit(node) {
        if (claimed.has(node.id)) return;
        if (CANDIDATE_TYPES.has(node.type) && nameMatches(node, [NAME_PATTERN])) {
          detectedParents.add(node.id);
          detections.push(
            makeDetection("tabs", node, ctx, {
              confidence: 0.7,
              evidence: [`Layer name matches tabs naming convention ("${node.name}")`],
              metadata: { tabCount: (node.children ?? []).length }
            })
          );
          for (const child of node.children ?? []) claimed.add(child.id);
          return;
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(root);
      const groups = findRepeatingGroups(root, 2);
      for (const group of groups) {
        if (detectedParents.has(group.parent.id) || claimed.has(group.parent.id)) continue;
        const withinTabCount = group.items.length >= 2 && group.items.length <= 8;
        const allHaveText = group.items.every((item) => hasDescendant(item, (n) => n.type === "TEXT"));
        const parentHintsTabs = /tabs?/.test(group.parent.name.toLowerCase());
        if (withinTabCount && allHaveText && parentHintsTabs) {
          detections.push(
            makeDetection("tabs", group.parent, ctx, {
              confidence: 0.45,
              evidence: [`${group.items.length} repeated tab-item-like children detected under "${group.parent.name}"`],
              metadata: { tabCount: group.items.length }
            })
          );
        }
      }
      return detections;
    }
  };
  const analyzerRegistry = [
    buttonAnalyzer,
    inputAnalyzer,
    dropdownAnalyzer,
    searchAnalyzer,
    tableAnalyzer,
    cardAnalyzer,
    modalAnalyzer,
    navigationAnalyzer,
    chartAnalyzer,
    tabsAnalyzer,
    accordionAnalyzer
  ];
  const ALL_COMPONENT_CATEGORIES = [
    "button",
    "input",
    "dropdown",
    "search",
    "table",
    "card",
    "modal",
    "navigation",
    "chart",
    "tabs",
    "accordion"
  ];
  function emptyCategoryCounts() {
    return ALL_COMPONENT_CATEGORIES.reduce((acc, category) => {
      acc[category] = 0;
      return acc;
    }, {});
  }
  const MIN_CONFIDENCE = 0.3;
  function analyzeFrame(frame) {
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    const ctx = { frameId: frame.frameId, frameName: frame.frameName };
    const allDetections = [];
    for (const analyzer of analyzerRegistry) {
      const detections = analyzer.detect(frame.root, ctx).filter((d) => d.confidence >= MIN_CONFIDENCE);
      allDetections.push(...detections);
    }
    const byKey = /* @__PURE__ */ new Map();
    for (const detection of allDetections) {
      const key = `${detection.nodeId}:${detection.category}`;
      const existing = byKey.get(key);
      if (!existing || detection.confidence > existing.confidence) byKey.set(key, detection);
    }
    const components = [...byKey.values()].sort((a, b) => b.confidence - a.confidence);
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      frameId: frame.frameId,
      frameName: frame.frameName,
      nodeCount: countNodes(frame.root),
      truncated: frame.truncated ?? false,
      components,
      analyzedAt: Date.now(),
      durationMs: end - start
    };
  }
  function analyzeFrames(frames) {
    const frameAnalyses = frames.map(analyzeFrame);
    const componentsByCategory = emptyCategoryCounts();
    let totalComponents = 0;
    for (const frame of frameAnalyses) {
      for (const component of frame.components) {
        componentsByCategory[component.category] += 1;
        totalComponents += 1;
      }
    }
    return {
      frames: frameAnalyses,
      totalComponents,
      componentsByCategory,
      multiFrame: frames.length > 1
    };
  }
  function stableHash(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function selectionSignature(frameIds) {
    const sorted = [...frameIds].sort();
    return stableHash(sorted.join("|"));
  }
  const MAX_NODES_PER_FRAME = 1e4;
  const FRAME_LIKE_TYPES = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);
  const KNOWN_NODE_KINDS = /* @__PURE__ */ new Set([
    "FRAME",
    "GROUP",
    "COMPONENT",
    "COMPONENT_SET",
    "INSTANCE",
    "TEXT",
    "RECTANGLE",
    "ELLIPSE",
    "VECTOR",
    "LINE",
    "STAR",
    "POLYGON",
    "BOOLEAN_OPERATION",
    "SLICE",
    "STICKY",
    "CONNECTOR",
    "SECTION"
  ]);
  function toNodeKind(type) {
    return KNOWN_NODE_KINDS.has(type) ? type : "OTHER";
  }
  async function resolveMainComponentName(node) {
    if (node.type !== "INSTANCE") return void 0;
    try {
      const main = await node.getMainComponentAsync();
      return main?.name;
    } catch {
      return void 0;
    }
  }
  async function walkNode(node, budget) {
    budget.remaining -= 1;
    const mainComponentName = await resolveMainComponentName(node);
    const base = {
      id: node.id,
      name: node.name,
      type: toNodeKind(node.type),
      visible: node.visible,
      width: "width" in node ? node.width : 0,
      height: "height" in node ? node.height : 0,
      characters: node.type === "TEXT" ? node.characters : void 0,
      mainComponentName,
      opacity: "opacity" in node ? node.opacity ?? void 0 : void 0,
      locked: "locked" in node ? node.locked : void 0
    };
    if (!("children" in node)) return base;
    const children = [];
    for (const child of node.children) {
      if (budget.remaining <= 0) {
        budget.truncated = true;
        break;
      }
      children.push(await walkNode(child, budget));
    }
    return { ...base, children };
  }
  async function serializeSelectedFrame(node) {
    const budget = { remaining: MAX_NODES_PER_FRAME, truncated: false };
    const root = await walkNode(node, budget);
    const nodeCount = MAX_NODES_PER_FRAME - budget.remaining;
    const topLevelChildNames = (root.children ?? []).slice(0, 20).map((child) => child.name);
    return {
      frameId: node.id,
      frameName: node.name,
      root,
      summary: {
        frameId: node.id,
        frameName: node.name,
        width: "width" in node ? node.width : 0,
        height: "height" in node ? node.height : 0,
        nodeCount,
        truncated: budget.truncated,
        topLevelChildNames
      }
    };
  }
  function getAnalyzableSelection() {
    return figma.currentPage.selection.filter((node) => FRAME_LIKE_TYPES.has(node.type));
  }
  async function serializeSelection(nodes) {
    const results = [];
    for (const node of nodes) {
      results.push(await serializeSelectedFrame(node));
    }
    return results;
  }
  const RESPONSES_KEY_PREFIX = "reqlens:responses:";
  const RESPONSES_INDEX_KEY = "reqlens:responses:index";
  const CUSTOM_QUESTIONS_KEY_PREFIX = "reqlens:custom:";
  const CUSTOM_QUESTIONS_INDEX_KEY = "reqlens:custom:index";
  const MAX_STORED_SIGNATURES = 200;
  async function getIndex(indexKey) {
    const index = await figma.clientStorage.getAsync(indexKey);
    return Array.isArray(index) ? index : [];
  }
  async function touchIndex(indexKey, keyPrefix, selectionSignature2) {
    const index = await getIndex(indexKey);
    const next = [selectionSignature2, ...index.filter((sig) => sig !== selectionSignature2)];
    const evicted = next.slice(MAX_STORED_SIGNATURES);
    const kept = next.slice(0, MAX_STORED_SIGNATURES);
    await Promise.all(evicted.map((sig) => figma.clientStorage.deleteAsync(`${keyPrefix}${sig}`)));
    await figma.clientStorage.setAsync(indexKey, kept);
  }
  async function saveResponses(responseSet) {
    await figma.clientStorage.setAsync(`${RESPONSES_KEY_PREFIX}${responseSet.selectionSignature}`, responseSet);
    await touchIndex(RESPONSES_INDEX_KEY, RESPONSES_KEY_PREFIX, responseSet.selectionSignature);
  }
  async function loadResponses(selectionSignature2) {
    const stored = await figma.clientStorage.getAsync(`${RESPONSES_KEY_PREFIX}${selectionSignature2}`);
    return stored ?? null;
  }
  async function saveCustomQuestions(customQuestionSet) {
    await figma.clientStorage.setAsync(
      `${CUSTOM_QUESTIONS_KEY_PREFIX}${customQuestionSet.selectionSignature}`,
      customQuestionSet
    );
    await touchIndex(CUSTOM_QUESTIONS_INDEX_KEY, CUSTOM_QUESTIONS_KEY_PREFIX, customQuestionSet.selectionSignature);
  }
  async function loadCustomQuestions(selectionSignature2) {
    const stored = await figma.clientStorage.getAsync(`${CUSTOM_QUESTIONS_KEY_PREFIX}${selectionSignature2}`);
    return stored ?? null;
  }
  const UI_WIDTH = 680;
  const UI_HEIGHT = 680;
  figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });
  function postToUI(message) {
    figma.ui.postMessage(message);
  }
  async function analyzeCurrentSelection() {
    try {
      const nodes = getAnalyzableSelection();
      if (nodes.length === 0) {
        postToUI({ type: "selection-empty" });
        return;
      }
      const selectedFrames = await serializeSelection(nodes);
      const analysis = analyzeFrames(
        selectedFrames.map((frame) => ({
          frameId: frame.frameId,
          frameName: frame.frameName,
          root: frame.root,
          truncated: frame.summary.truncated
        }))
      );
      postToUI({
        type: "selection-analyzed",
        payload: {
          selectionSignature: selectionSignature(selectedFrames.map((frame) => frame.frameId)),
          frames: selectedFrames.map((frame) => frame.summary),
          analysis
        }
      });
    } catch (error) {
      postToUI({
        type: "selection-error",
        payload: { message: error instanceof Error ? error.message : "Unknown error analyzing selection." }
      });
    }
  }
  figma.on("selectionchange", () => {
    void analyzeCurrentSelection();
  });
  figma.ui.onmessage = async (message) => {
    switch (message.type) {
      case "ui-ready":
      case "analyze-selection":
        await analyzeCurrentSelection();
        return;
      case "save-responses":
        try {
          await saveResponses(message.payload);
          postToUI({
            type: "responses-saved",
            payload: { selectionSignature: message.payload.selectionSignature, savedAt: Date.now() }
          });
        } catch (error) {
          postToUI({
            type: "selection-error",
            payload: { message: error instanceof Error ? error.message : "Failed to save responses." }
          });
        }
        return;
      case "load-responses": {
        const responseSet = await loadResponses(message.payload.selectionSignature);
        postToUI({ type: "responses-loaded", payload: { responseSet } });
        return;
      }
      case "save-custom-questions":
        try {
          await saveCustomQuestions(message.payload);
          postToUI({
            type: "custom-questions-saved",
            payload: { selectionSignature: message.payload.selectionSignature, savedAt: Date.now() }
          });
        } catch (error) {
          postToUI({
            type: "selection-error",
            payload: { message: error instanceof Error ? error.message : "Failed to save custom questions." }
          });
        }
        return;
      case "load-custom-questions": {
        const customQuestionSet = await loadCustomQuestions(message.payload.selectionSignature);
        postToUI({ type: "custom-questions-loaded", payload: { customQuestionSet } });
        return;
      }
      case "resize":
        figma.ui.resize(
          Math.max(320, Math.round(message.payload.width)),
          Math.max(400, Math.round(message.payload.height))
        );
        return;
    }
  };
  if (figma.command === "analyze") {
    void analyzeCurrentSelection();
  }
})();
