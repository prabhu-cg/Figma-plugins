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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/plugin/rules/registry.ts
  var RuleRegistry = class {
    constructor() {
      __publicField(this, "rules", /* @__PURE__ */ new Map());
    }
    register(rule) {
      if (this.rules.has(rule.id)) {
        throw new Error(`Duplicate audit rule id: ${rule.id}`);
      }
      this.rules.set(rule.id, rule);
    }
    registerAll(rules) {
      for (const rule of rules) this.register(rule);
    }
    getAll() {
      return Array.from(this.rules.values());
    }
    async runAll(context, onProgress) {
      var _a, _b, _c;
      const issues = [];
      const all = this.getAll();
      let issueSeq = 0;
      for (let i = 0; i < all.length; i++) {
        if (context.isCancelled()) break;
        const rule = all[i];
        onProgress == null ? void 0 : onProgress(rule.title, i + 1, all.length);
        let findings;
        try {
          findings = await rule.evaluate(context);
        } catch (err) {
          findings = [
            {
              message: `Rule "${rule.id}" threw an error during evaluation: ${err instanceof Error ? err.message : String(err)}`,
              severity: "warning"
            }
          ];
        }
        for (const finding of findings) {
          issueSeq += 1;
          issues.push({
            id: `${rule.id}-${issueSeq}`,
            ruleId: rule.id,
            category: rule.category,
            severity: (_a = finding.severity) != null ? _a : rule.severity,
            title: rule.title,
            description: finding.message,
            whyItMatters: rule.whyItMatters,
            recommendation: rule.recommendation(finding),
            estimatedImpact: (_b = finding.impact) != null ? _b : "medium",
            estimatedEffort: (_c = finding.effort) != null ? _c : "low",
            reference: rule.reference,
            node: finding.node,
            collection: finding.collection,
            status: "open",
            meta: finding.meta
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return issues;
    }
  };
  var ruleRegistry = new RuleRegistry();

  // src/plugin/color/contrast.ts
  function channelToLinear(c) {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  }
  function relativeLuminance({ r, g, b }) {
    const R = channelToLinear(r);
    const G = channelToLinear(g);
    const B = channelToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function paintToRgb(paint) {
    if (paint.type !== "SOLID" || paint.visible === false) return null;
    const { r, g, b } = paint.color;
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  function compositeOnBackground(paints, background) {
    var _a;
    let result = background;
    for (const paint of paints) {
      const rgb = paintToRgb(paint);
      if (!rgb) continue;
      const alpha = (_a = paint.opacity) != null ? _a : 1;
      result = {
        r: rgb.r * alpha + result.r * (1 - alpha),
        g: rgb.g * alpha + result.g * (1 - alpha),
        b: rgb.b * alpha + result.b * (1 - alpha)
      };
    }
    return result;
  }
  var WCAG_THRESHOLDS = {
    AA: { normalText: 4.5, largeText: 3, uiComponent: 3 },
    AAA: { normalText: 7, largeText: 4.5, uiComponent: 3 }
  };
  function isLargeText(fontSize, fontWeight) {
    return fontSize >= 24 || fontSize >= 18.66 && fontWeight >= 700;
  }
  function findFirstSolidFill(node) {
    if (!("fills" in node)) return null;
    const fills = node.fills;
    if (fills === figma.mixed || !Array.isArray(fills)) return null;
    for (const paint of fills) {
      const rgb = paintToRgb(paint);
      if (rgb) return rgb;
    }
    return null;
  }
  function findAncestorBackground(node) {
    var _a, _b;
    let current = node.parent;
    while (current) {
      if ("fills" in current) {
        const fills = current.fills;
        if (Array.isArray(fills)) {
          for (const paint of fills) {
            if (paint.type === "SOLID" && paint.visible !== false && ((_a = paint.opacity) != null ? _a : 1) >= 0.99) {
              return (_b = paintToRgb(paint)) != null ? _b : { r: 255, g: 255, b: 255 };
            }
          }
        }
      }
      current = current.parent;
    }
    return { r: 255, g: 255, b: 255 };
  }

  // src/plugin/rules/helpers.ts
  function findOwningPage(node) {
    let current = node;
    while (current) {
      if (current.type === "PAGE") return current;
      current = current.parent;
    }
    return null;
  }
  function toNodeRef(node, componentId, componentName) {
    var _a, _b;
    const page = findOwningPage(node);
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      pageId: (_a = page == null ? void 0 : page.id) != null ? _a : "",
      pageName: (_b = page == null ? void 0 : page.name) != null ? _b : "",
      componentId,
      componentName
    };
  }
  function componentRef(record) {
    return toNodeRef(record.node, record.info.id, record.info.name);
  }
  function hasBoundVariableAt(node, field, index) {
    const bound = node.boundVariables;
    if (!bound) return false;
    const entry = bound[field];
    if (entry === void 0 || entry === null) return false;
    if (typeof index === "number" && Array.isArray(entry)) {
      return entry[index] !== void 0 && entry[index] !== null;
    }
    return true;
  }
  function isInteractiveKind(kind) {
    return !!kind && ["button", "input", "checkbox", "radio", "switch", "select", "link", "menu-item", "tab"].includes(kind);
  }

  // src/plugin/rules/contrast.ts
  var textContrastRule = {
    id: "contrast-text-aa",
    category: "contrast",
    title: "Text contrast below WCAG minimum",
    description: "Text color does not meet the configured WCAG contrast level against its background.",
    whyItMatters: "Low-contrast text is unreadable for users with low vision or color vision deficiencies, and fails automated accessibility audits before it ever ships to production.",
    severity: "critical",
    reference: "WCAG 2.1 SC 1.4.3 Contrast (Minimum)",
    evaluate(context) {
      const findings = [];
      const thresholds = WCAG_THRESHOLDS[context.wcagLevel];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const textNodes = variant.findAll((n) => n.type === "TEXT");
          for (const text of textNodes) {
            if (text.fontSize === figma.mixed || text.fontName === figma.mixed) continue;
            const fg = findFirstSolidFill(text);
            if (!fg) continue;
            const bg = findAncestorBackground(text);
            const rendered = compositeOnBackground(
              (text.fills !== figma.mixed ? text.fills : []).filter((p) => p.type === "SOLID"),
              bg
            );
            const ratio = contrastRatio(rendered, bg);
            const fontSize = text.fontSize;
            const style = text.fontName.style.toLowerCase();
            const bold = style.includes("bold") || style.includes("black") || style.includes("heavy");
            const large = isLargeText(fontSize, bold ? 700 : 400);
            const threshold = large ? thresholds.largeText : thresholds.normalText;
            if (ratio < threshold) {
              findings.push({
                node: toNodeRef(text, record.info.id, record.info.name),
                message: `"${text.characters.slice(0, 40)}" in ${record.info.name} has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${threshold}:1 ${context.wcagLevel} minimum for ${large ? "large" : "normal"} text.`,
                severity: ratio < threshold * 0.7 ? "critical" : "warning",
                impact: "high",
                effort: "low",
                meta: { ratio: round2(ratio), threshold, componentId: record.info.id }
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation(finding) {
      var _a, _b;
      return `Increase text color contrast or darken the background so the ratio meets ${(_b = (_a = finding.meta) == null ? void 0 : _a.threshold) != null ? _b : 4.5}:1. Try a darker text token, a heavier font weight, or a lighter surface color.`;
    }
  };
  var nonTextContrastRule = {
    id: "contrast-ui-component",
    category: "contrast",
    title: "UI component contrast below WCAG minimum",
    description: "A non-text UI element's border does not meet the 3:1 minimum contrast for graphical objects.",
    whyItMatters: "Input borders and control boundaries need enough contrast to be perceivable \u2014 otherwise users can't tell where one element ends and another begins.",
    severity: "warning",
    reference: "WCAG 2.1 SC 1.4.11 Non-text Contrast",
    evaluate(context) {
      var _a;
      const findings = [];
      const thresholds = WCAG_THRESHOLDS[context.wcagLevel];
      const kindsToCheck = /* @__PURE__ */ new Set(["button", "input", "checkbox", "radio", "switch", "badge", "alert", "card"]);
      for (const record of context.components) {
        if (!kindsToCheck.has((_a = record.info.detectedKind) != null ? _a : "unknown")) continue;
        for (const variant of record.variantNodes) {
          if (!("strokes" in variant)) continue;
          const strokes = variant.strokes.filter((p) => p.type === "SOLID" && p.visible !== false);
          if (strokes.length === 0) continue;
          const bg = findAncestorBackground(variant);
          const strokeColor = compositeOnBackground(strokes, bg);
          const ratio = contrastRatio(strokeColor, bg);
          if (ratio < thresholds.uiComponent) {
            findings.push({
              node: toNodeRef(variant, record.info.id, record.info.name),
              message: `Border on ${variant.name} (${record.info.name}) has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${thresholds.uiComponent}:1 minimum for UI components.`,
              severity: "warning",
              impact: "medium",
              effort: "low",
              meta: { ratio: round2(ratio) }
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Darken the border/stroke color or increase contrast against the surrounding surface to reach at least 3:1.";
    }
  };
  var iconContrastRule = {
    id: "contrast-icon",
    category: "contrast",
    title: "Icon fill contrast below WCAG minimum",
    description: "A standalone icon's fill color does not meet the 3:1 minimum contrast for graphical objects.",
    whyItMatters: "Icons that communicate meaning (not purely decorative) need to be perceivable against their background just like text does.",
    severity: "warning",
    reference: "WCAG 2.1 SC 1.4.11 Non-text Contrast",
    evaluate(context) {
      const findings = [];
      const thresholds = WCAG_THRESHOLDS[context.wcagLevel];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const icons = variant.findAll((n) => n.name.toLowerCase().includes("icon") && n.type !== "TEXT");
          for (const icon of icons) {
            const fg = findFirstSolidFill(icon);
            if (!fg) continue;
            const bg = findAncestorBackground(icon);
            const ratio = contrastRatio(fg, bg);
            if (ratio < thresholds.uiComponent) {
              findings.push({
                node: toNodeRef(icon, record.info.id, record.info.name),
                message: `Icon "${icon.name}" in ${record.info.name} has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${thresholds.uiComponent}:1 minimum.`,
                severity: "warning",
                impact: "medium",
                effort: "low",
                meta: { ratio: round2(ratio) }
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Darken the icon fill or lighten its background, or confirm this icon is purely decorative and can be excluded from the contrast requirement.";
    }
  };
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  var contrastRules = [textContrastRule, nonTextContrastRule, iconContrastRule];

  // src/plugin/rules/typography.ts
  var hardcodedTypeRule = {
    id: "typography-hardcoded-style",
    category: "typography",
    title: "Text not using a shared text style",
    description: "Text layer has hand-set font properties instead of a linked text style.",
    whyItMatters: "Hardcoded typography drifts from the type scale over time and breaks silently when the design system updates its type ramp \u2014 every unlinked layer has to be found and fixed by hand.",
    severity: "warning",
    reference: "Design system best practice: single source of truth for type scale",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const textNodes = variant.findAll((n) => n.type === "TEXT");
          for (const text of textNodes) {
            if (text.textStyleId !== "" && typeof text.textStyleId === "string") continue;
            if (text.textStyleId === figma.mixed) continue;
            findings.push({
              node: toNodeRef(text, record.info.id, record.info.name),
              message: `"${text.characters.slice(0, 30)}" in ${record.info.name} has no linked text style.`,
              severity: "warning",
              impact: "medium",
              effort: "low"
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Apply a shared text style (or bind font family/size/weight/line-height to typography variables) instead of hand-set values.";
    }
  };
  var fontFamilyConsistencyRule = {
    id: "typography-family-consistency",
    category: "typography",
    title: "Inconsistent font family",
    description: "Component uses a font family that differs from the library's dominant font family.",
    whyItMatters: "Mixed font families inside a single design system usually indicate a copy-pasted layer from another file or an unintentional override, and they undermine visual consistency across products.",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const familyCounts = /* @__PURE__ */ new Map();
      const perText = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const textNodes = variant.findAll((n) => n.type === "TEXT");
          for (const text of textNodes) {
            if (text.fontName === figma.mixed) continue;
            const family = text.fontName.family;
            familyCounts.set(family, ((_a = familyCounts.get(family)) != null ? _a : 0) + 1);
            perText.push({ node: text, family, componentId: record.info.id, componentName: record.info.name });
          }
        }
      }
      if (familyCounts.size <= 1) return [];
      const dominant = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const findings = [];
      for (const entry of perText) {
        if (entry.family !== dominant) {
          findings.push({
            node: toNodeRef(entry.node, entry.componentId, entry.componentName),
            message: `${entry.componentName} uses "${entry.family}" while the library's dominant font is "${dominant}".`,
            severity: "suggestion",
            impact: "low",
            effort: "low",
            meta: { family: entry.family, dominant }
          });
        }
      }
      return findings;
    },
    recommendation(finding) {
      var _a;
      return `Switch to the library's dominant font family ("${(_a = finding.meta) == null ? void 0 : _a.dominant}") unless this is an intentional secondary typeface.`;
    }
  };
  var unusedTextStyleRule = {
    id: "typography-unused-style",
    category: "typography",
    title: "Text style not used by any audited text layer",
    description: "This shared text style isn't linked from any text node within the scanned components.",
    whyItMatters: "Unused text styles bloat the type picker and make it unclear to consumers which styles are actually part of the current type scale.",
    severity: "suggestion",
    evaluate(context) {
      const usedStyleIds = /* @__PURE__ */ new Set();
      for (const node of context.allComponentNodes) {
        if (node.type !== "TEXT") continue;
        const styleId = node.textStyleId;
        if (typeof styleId === "string" && styleId !== "") usedStyleIds.add(styleId);
      }
      return context.textStyles.filter((style) => !usedStyleIds.has(style.id)).map((style) => ({
        message: `Text style "${style.name}" is not referenced by any text layer in the audited components.`,
        severity: "suggestion",
        impact: "low",
        effort: "low",
        meta: { styleName: style.name }
      }));
    },
    recommendation() {
      return "Confirm this style isn't used elsewhere in the file/library before removing it, then delete it to keep the type picker clean.";
    }
  };
  var COMMON_FONT_SIZES = /* @__PURE__ */ new Set([10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64]);
  var sizeScaleRule = {
    id: "typography-size-scale",
    category: "typography",
    title: "Font size off the standard type scale",
    description: "Text uses a font size that isn't part of the library's common type scale.",
    whyItMatters: "One-off font sizes fragment the type scale over time \u2014 a design system should have a small, deliberate set of sizes that every text style draws from.",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const sizeCounts = /* @__PURE__ */ new Map();
      const perText = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const textNodes = variant.findAll((n) => n.type === "TEXT");
          for (const text of textNodes) {
            if (text.fontSize === figma.mixed) continue;
            const size = text.fontSize;
            sizeCounts.set(size, ((_a = sizeCounts.get(size)) != null ? _a : 0) + 1);
            perText.push({ node: text, size, componentId: record.info.id, componentName: record.info.name });
          }
        }
      }
      if (sizeCounts.size <= 4) return [];
      const commonSizes = new Set(
        Array.from(sizeCounts.entries()).filter(([size]) => COMMON_FONT_SIZES.has(size)).map(([size]) => size)
      );
      if (commonSizes.size === 0) return [];
      return perText.filter((entry) => !commonSizes.has(entry.size)).map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.characters.slice(0, 30)}" in ${entry.componentName} uses ${entry.size}px, outside the library's common type scale.`,
        severity: "suggestion",
        impact: "low",
        effort: "low"
      }));
    },
    recommendation() {
      return "Round to the nearest size in the library's type scale, or add this size to the scale deliberately if it's a genuine new step.";
    }
  };
  var typographyRules = [
    hardcodedTypeRule,
    fontFamilyConsistencyRule,
    unusedTextStyleRule,
    sizeScaleRule
  ];

  // src/plugin/rules/spacing.ts
  var GRID_UNIT = 4;
  function isOnGrid(value) {
    return Math.abs(value % GRID_UNIT) < 0.01;
  }
  var missingAutoLayoutRule = {
    id: "spacing-missing-autolayout",
    category: "spacing",
    title: "Multi-child frame without Auto Layout",
    description: "A frame with multiple children does not use Auto Layout.",
    whyItMatters: "Without Auto Layout, spacing is positional and silently breaks when content, translations, or child count change \u2014 Auto Layout keeps spacing systematic and resilient.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const frames = variant.findAll(
            (n) => n.type === "FRAME" && n.children.length >= 2
          );
          for (const frame of frames) {
            if (frame.layoutMode === "NONE") {
              findings.push({
                node: toNodeRef(frame, record.info.id, record.info.name),
                message: `Frame "${frame.name}" in ${record.info.name} has ${frame.children.length} children but no Auto Layout.`,
                severity: "suggestion",
                impact: "medium",
                effort: "medium"
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Convert this frame to Auto Layout so spacing scales predictably with content changes.";
    }
  };
  var hardcodedSpacingRule = {
    id: "spacing-off-grid",
    category: "spacing",
    title: "Spacing value off the 4px/8pt grid",
    description: "Auto Layout padding or gap uses a value that isn't a multiple of the base spacing unit.",
    whyItMatters: "Off-grid spacing accumulates into inconsistent rhythm across a product and is a strong signal the value isn't bound to a spacing token.",
    severity: "warning",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const frames = variant.findAll((n) => n.type === "FRAME" && n.layoutMode !== "NONE");
          for (const frame of frames) {
            const values = [
              ["padding top", frame.paddingTop],
              ["padding right", frame.paddingRight],
              ["padding bottom", frame.paddingBottom],
              ["padding left", frame.paddingLeft],
              ["item spacing", frame.itemSpacing]
            ];
            for (const [label, value] of values) {
              if (value !== 0 && !isOnGrid(value)) {
                findings.push({
                  node: toNodeRef(frame, record.info.id, record.info.name),
                  message: `${frame.name} in ${record.info.name} has ${label} of ${value}px, off the ${GRID_UNIT}px grid.`,
                  severity: "warning",
                  impact: "low",
                  effort: "low",
                  meta: { label, value }
                });
              }
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation(finding) {
      var _a;
      return `Round "${(_a = finding.meta) == null ? void 0 : _a.label}" to the nearest ${GRID_UNIT}px increment and bind it to a spacing variable.`;
    }
  };
  var spacingRules = [missingAutoLayoutRule, hardcodedSpacingRule];

  // src/plugin/rules/tokens.ts
  var hardcodedColorRule = {
    id: "tokens-hardcoded-color",
    category: "tokens",
    title: "Hardcoded color instead of a variable",
    description: "A solid fill or stroke uses a raw color value instead of a bound color variable.",
    whyItMatters: "Hardcoded colors can't be updated by changing a token, break theming/dark mode, and are the single biggest source of visual drift in a design system.",
    severity: "warning",
    reference: "Design token best practice: bind color to semantic variables",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const nodes = [variant, ...variant.findAll(() => true)];
          for (const node of nodes) {
            if ("fills" in node) {
              const fills = node.fills;
              if (Array.isArray(fills)) {
                fills.forEach((paint, i) => {
                  if (paint.type === "SOLID" && paint.visible !== false && !hasBoundVariableAt(node, "fills", i)) {
                    findings.push({
                      node: toNodeRef(node, record.info.id, record.info.name),
                      message: `Fill on "${node.name}" in ${record.info.name} is a hardcoded color, not a variable.`,
                      severity: "warning",
                      impact: "medium",
                      effort: "low",
                      meta: { property: "fill" }
                    });
                  }
                });
              }
            }
            if ("strokes" in node) {
              const strokes = node.strokes;
              strokes.forEach((paint, i) => {
                if (paint.type === "SOLID" && paint.visible !== false && !hasBoundVariableAt(node, "strokes", i)) {
                  findings.push({
                    node: toNodeRef(node, record.info.id, record.info.name),
                    message: `Stroke on "${node.name}" in ${record.info.name} is a hardcoded color, not a variable.`,
                    severity: "warning",
                    impact: "medium",
                    effort: "low",
                    meta: { property: "stroke" }
                  });
                }
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation(finding) {
      var _a, _b;
      return `Replace this hardcoded ${(_b = (_a = finding.meta) == null ? void 0 : _a.property) != null ? _b : "color"} with the matching semantic color variable.`;
    }
  };
  var hardcodedRadiusRule = {
    id: "tokens-hardcoded-radius",
    category: "tokens",
    title: "Hardcoded corner radius",
    description: "Corner radius is a raw number instead of a bound radius variable.",
    whyItMatters: "Unbound radii drift from the shape scale and make global radius changes require manual sweeps.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const nodes = [variant, ...variant.findAll(() => true)];
          for (const node of nodes) {
            if (!("cornerRadius" in node)) continue;
            const radius = node.cornerRadius;
            if (typeof radius === "number" && radius > 0 && !hasBoundVariableAt(node, "cornerRadius")) {
              findings.push({
                node: toNodeRef(node, record.info.id, record.info.name),
                message: `"${node.name}" in ${record.info.name} has a hardcoded ${radius}px corner radius.`,
                severity: "suggestion",
                impact: "low",
                effort: "low"
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Bind the corner radius to a shared radius variable (e.g. radius/sm, radius/md) instead of a raw number.";
    }
  };
  var unusedVariableRule = {
    id: "tokens-unused-variable",
    category: "tokens",
    title: "Variable not referenced by any audited component",
    description: "This variable is not bound to any property within the scanned components.",
    whyItMatters: "Unused tokens bloat the library, confuse consumers choosing between similar-looking variables, and make it unclear which tokens are actually safe to remove.",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const usedIds = /* @__PURE__ */ new Set();
      for (const node of context.allComponentNodes) {
        const bound = node.boundVariables;
        if (!bound) continue;
        for (const value of Object.values(bound)) {
          if (Array.isArray(value)) {
            for (const entry of value) {
              if (entry && typeof entry === "object" && "id" in entry) usedIds.add(entry.id);
            }
          } else if (value && typeof value === "object" && "id" in value) {
            usedIds.add(value.id);
          }
        }
      }
      const findings = [];
      for (const variable of context.variables) {
        if (!usedIds.has(variable.id)) {
          const collection = (_a = context.variableCollections.find((c) => c.id === variable.variableCollectionId)) == null ? void 0 : _a.name;
          findings.push({
            message: `Variable "${variable.name}" is not referenced by any bound property in the audited components (usage outside these components is not visible to this scan).`,
            severity: "suggestion",
            impact: "low",
            effort: "low",
            collection,
            meta: { variableName: variable.name }
          });
        }
      }
      return findings;
    },
    recommendation() {
      return "Confirm this variable is genuinely unused elsewhere in the file/library before removing it, then delete it to reduce token sprawl.";
    }
  };
  var duplicateVariableRule = {
    id: "tokens-duplicate-variable",
    category: "tokens",
    title: "Duplicate variable value",
    description: "Two variables in the same collection resolve to the identical value across all modes.",
    whyItMatters: "Duplicate tokens create ambiguity about which one to use, and teams end up splitting usage between them inconsistently.",
    severity: "suggestion",
    evaluate(context) {
      var _a, _b;
      const findings = [];
      const byCollection = /* @__PURE__ */ new Map();
      for (const v of context.variables) {
        const list = (_a = byCollection.get(v.variableCollectionId)) != null ? _a : [];
        list.push(v);
        byCollection.set(v.variableCollectionId, list);
      }
      for (const [collectionId, vars] of byCollection) {
        const collectionName = (_b = context.variableCollections.find((c) => c.id === collectionId)) == null ? void 0 : _b.name;
        for (let i = 0; i < vars.length; i++) {
          for (let j = i + 1; j < vars.length; j++) {
            if (vars[i].resolvedType !== vars[j].resolvedType) continue;
            const a = JSON.stringify(vars[i].valuesByMode);
            const b = JSON.stringify(vars[j].valuesByMode);
            if (a === b) {
              findings.push({
                message: `"${vars[i].name}" and "${vars[j].name}" resolve to the same value in every mode.`,
                severity: "suggestion",
                impact: "low",
                effort: "medium",
                collection: collectionName,
                meta: { a: vars[i].name, b: vars[j].name }
              });
            }
          }
        }
      }
      return findings;
    },
    recommendation(finding) {
      var _a, _b;
      return `Consolidate "${(_a = finding.meta) == null ? void 0 : _a.a}" and "${(_b = finding.meta) == null ? void 0 : _b.b}" into a single variable, or make one an alias of the other if they represent distinct semantic roles.`;
    }
  };
  var hardcodedShadowRule = {
    id: "tokens-hardcoded-shadow",
    category: "tokens",
    title: "Hardcoded shadow effect",
    description: "A drop/inner shadow effect is set directly on the layer instead of a bound effect variable or shared effect style.",
    whyItMatters: "Unbound shadows drift from the elevation system and make global depth/elevation changes require manual sweeps across every component.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const nodes = [variant, ...variant.findAll(() => true)];
          for (const node of nodes) {
            if (!("effects" in node)) continue;
            const effects = node.effects;
            if (!Array.isArray(effects)) continue;
            effects.forEach((effect, i) => {
              const isShadow = effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";
              if (isShadow && effect.visible !== false && !hasBoundVariableAt(node, "effects", i)) {
                findings.push({
                  node: toNodeRef(node, record.info.id, record.info.name),
                  message: `"${node.name}" in ${record.info.name} has a hardcoded ${effect.type === "DROP_SHADOW" ? "drop" : "inner"} shadow.`,
                  severity: "suggestion",
                  impact: "low",
                  effort: "low"
                });
              }
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Apply a shared effect style, or bind the shadow to an elevation variable, instead of a one-off shadow.";
    }
  };
  var hardcodedOpacityRule = {
    id: "tokens-hardcoded-opacity",
    category: "tokens",
    title: "Hardcoded opacity",
    description: "Layer opacity is a raw, non-default number instead of a bound opacity variable.",
    whyItMatters: "Ad-hoc opacity values (0.64, 0.72, 0.8...) accumulate over time and make it unclear which value represents a deliberate disabled/hover/scrim state.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const nodes = [variant, ...variant.findAll(() => true)];
          for (const node of nodes) {
            if (!("opacity" in node)) continue;
            const opacity = node.opacity;
            if (opacity !== 1 && !hasBoundVariableAt(node, "opacity")) {
              findings.push({
                node: toNodeRef(node, record.info.id, record.info.name),
                message: `"${node.name}" in ${record.info.name} has a hardcoded opacity of ${Math.round(opacity * 100)}%.`,
                severity: "suggestion",
                impact: "low",
                effort: "low"
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Bind opacity to a shared variable (e.g. opacity/disabled, opacity/hover) so the meaning of the value is explicit and reusable.";
    }
  };
  var brokenAliasRule = {
    id: "tokens-broken-alias",
    category: "tokens",
    title: "Variable alias points to a missing variable",
    description: "A variable's value is an alias referencing a variable id that no longer exists in this file.",
    whyItMatters: "Broken alias chains silently fall back to an undefined or stale value, which is one of the hardest token bugs to spot visually.",
    severity: "critical",
    evaluate(context) {
      var _a;
      const knownIds = new Set(context.variables.map((v) => v.id));
      const findings = [];
      for (const variable of context.variables) {
        const collection = (_a = context.variableCollections.find((c) => c.id === variable.variableCollectionId)) == null ? void 0 : _a.name;
        for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
          if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
            const aliasId = value.id;
            if (!knownIds.has(aliasId)) {
              findings.push({
                message: `"${variable.name}" (mode ${modeId}) aliases a variable that no longer exists.`,
                severity: "critical",
                impact: "high",
                effort: "medium",
                collection,
                meta: { variableName: variable.name }
              });
            }
          }
        }
      }
      return findings;
    },
    recommendation() {
      return "Repoint this alias to a valid variable, or replace it with a direct value if the original target was intentionally deleted.";
    }
  };
  var tokenRules = [
    hardcodedColorRule,
    hardcodedRadiusRule,
    hardcodedShadowRule,
    hardcodedOpacityRule,
    unusedVariableRule,
    duplicateVariableRule,
    brokenAliasRule
  ];

  // src/plugin/rules/components.ts
  var MAX_COMBINATION_SPACE = 200;
  function cartesianProduct(valuesByProp) {
    return valuesByProp.reduce(
      (acc, [prop, values]) => acc.flatMap((combo) => values.map((value) => __spreadProps(__spreadValues({}, combo), { [prop]: value }))),
      [{}]
    );
  }
  function comboKey(combo) {
    return JSON.stringify(Object.entries(combo).sort());
  }
  var missingDescriptionRule = {
    id: "components-missing-description",
    category: "components",
    title: "Component missing a description",
    description: "Component or component set has no description set.",
    whyItMatters: "Without a description, consumers of the library have to guess intended usage, which leads to misuse and inconsistent adoption.",
    severity: "warning",
    evaluate(context) {
      return context.components.filter((r) => !r.info.hasDocumentation).map((r) => ({
        node: componentRef(r),
        message: `"${r.info.name}" has no description.`,
        severity: "warning",
        impact: "medium",
        effort: "low"
      }));
    },
    recommendation() {
      return "Add a description covering purpose, usage guidance, and when not to use this component.";
    }
  };
  var duplicateVariantRule = {
    id: "components-duplicate-variant",
    category: "components",
    title: "Duplicate variant properties",
    description: "Two variants within the same component set share identical property values.",
    whyItMatters: "Duplicate variants are confusing to pick between and usually indicate a cleanup was left unfinished.",
    severity: "warning",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (record.info.type !== "COMPONENT_SET") continue;
        const seen = /* @__PURE__ */ new Map();
        for (const variant of record.info.variants) {
          const key = JSON.stringify(Object.entries(variant.properties).sort());
          if (seen.has(key)) {
            findings.push({
              node: componentRef(record),
              message: `"${variant.name}" duplicates the property values of "${seen.get(key)}" in ${record.info.name}.`,
              severity: "warning",
              impact: "medium",
              effort: "medium"
            });
          } else {
            seen.set(key, variant.name);
          }
        }
      }
      return findings;
    },
    recommendation() {
      return "Remove or differentiate the duplicate variant so each combination of properties maps to exactly one variant.";
    }
  };
  var inconsistentPropertyNamingRule = {
    id: "components-inconsistent-property-naming",
    category: "components",
    title: "Inconsistent variant property naming",
    description: "The same conceptual property is named with different casing across component sets.",
    whyItMatters: 'Inconsistent property names (e.g. "Size" vs "size") make the API of the library unpredictable and complicate codegen/Code Connect mappings.',
    severity: "suggestion",
    evaluate(context) {
      const canonicalToVariants = /* @__PURE__ */ new Map();
      for (const record of context.components) {
        for (const prop of record.info.propertyDefinitions) {
          const base = prop.split("#")[0];
          const canonical = base.toLowerCase();
          if (!canonicalToVariants.has(canonical)) canonicalToVariants.set(canonical, /* @__PURE__ */ new Map());
          const variantsMap = canonicalToVariants.get(canonical);
          if (!variantsMap.has(base)) variantsMap.set(base, []);
          variantsMap.get(base).push(record.info.name);
        }
      }
      const findings = [];
      for (const [canonical, variantsMap] of canonicalToVariants) {
        if (variantsMap.size > 1) {
          const spellings = Array.from(variantsMap.entries());
          findings.push({
            message: `Property "${canonical}" appears with ${variantsMap.size} different casings: ${spellings.map(([spelling, comps]) => `"${spelling}" (${comps.length} component${comps.length === 1 ? "" : "s"})`).join(", ")}.`,
            severity: "suggestion",
            impact: "low",
            effort: "medium"
          });
        }
      }
      return findings;
    },
    recommendation() {
      return "Standardize on one casing/spelling for this property name across every component that exposes it.";
    }
  };
  var missingVariantCombinationRule = {
    id: "components-missing-variant-combination",
    category: "components",
    title: "Missing variant combination",
    description: "This component set doesn't cover every combination of its own variant property values.",
    whyItMatters: "Gaps in the variant matrix force engineers to compose properties Figma doesn't support, or fall back to a visually inconsistent default when the exact combination they need doesn't exist.",
    severity: "warning",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (record.info.type !== "COMPONENT_SET" || record.info.variants.length < 2) continue;
        const propNames = Object.keys(record.info.variants[0].properties);
        if (propNames.length === 0 || propNames.length > 5) continue;
        const valuesByProp = propNames.map((prop) => [
          prop,
          Array.from(new Set(record.info.variants.map((v) => v.properties[prop]).filter((v) => v !== void 0)))
        ]);
        const combinationSpace = valuesByProp.reduce((acc, [, values]) => acc * values.length, 1);
        if (combinationSpace > MAX_COMBINATION_SPACE || combinationSpace <= record.info.variants.length) continue;
        const existing = new Set(record.info.variants.map((v) => comboKey(v.properties)));
        const missing = cartesianProduct(valuesByProp).filter((combo) => !existing.has(comboKey(combo)));
        if (missing.length === 0) continue;
        const examples = missing.slice(0, 5).map((combo) => Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(", ")).join(" \xB7 ");
        findings.push({
          node: componentRef(record),
          message: `${record.info.name} is missing ${missing.length} of ${combinationSpace} possible variant combinations, e.g. ${examples}${missing.length > 5 ? "\u2026" : ""}.`,
          severity: missing.length / combinationSpace > 0.3 ? "warning" : "suggestion",
          impact: "medium",
          effort: "high",
          meta: { missingCount: missing.length, total: combinationSpace }
        });
      }
      return findings;
    },
    recommendation() {
      return "Add the missing variant combinations, or confirm they're intentionally unsupported and document why in the component description.";
    }
  };
  var unusedVariantRule = {
    id: "components-unused-variant",
    category: "components",
    title: "Variant not instantiated anywhere in this file",
    description: "This specific variant has no instances, even though other variants in the same set are used.",
    whyItMatters: "An unused variant inside an otherwise-adopted component set is a strong candidate for pruning \u2014 keeping it adds picker noise without proven value.",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const findings = [];
      for (const record of context.components) {
        if (record.info.type !== "COMPONENT_SET" || record.variantNodes.length < 2) continue;
        for (const variant of record.variantNodes) {
          if (((_a = context.variantInstanceCounts.get(variant.id)) != null ? _a : 0) === 0) {
            findings.push({
              node: toNodeRef(variant, record.info.id, record.info.name),
              message: `Variant "${variant.name}" of ${record.info.name} has no instances in this file.`,
              severity: "suggestion",
              impact: "low",
              effort: "low"
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Confirm this variant isn't consumed by other files before removing it \u2014 cross-file usage isn't visible to a single-file scan.";
    }
  };
  var componentRules = [
    missingDescriptionRule,
    duplicateVariantRule,
    inconsistentPropertyNamingRule,
    missingVariantCombinationRule,
    unusedVariantRule
  ];

  // src/plugin/rules/states.ts
  var missingStatesRule = {
    id: "states-missing-expected",
    category: "states",
    title: "Missing expected interaction state",
    description: "This component type is expected to cover a state that has no matching variant.",
    whyItMatters: "Missing states force engineers to invent their own hover/focus/disabled treatment at implementation time, causing visual inconsistency between the design system and the shipped product.",
    severity: "warning",
    reference: "Design system best practice: cover Default/Hover/Focus/Disabled (and type-specific states) per interactive component",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (!record.info.detectedKind || record.info.detectedKind === "unknown") continue;
        if (record.info.missingStates.length === 0) continue;
        findings.push({
          node: componentRef(record),
          message: `${record.info.name} (detected as "${record.info.detectedKind}") is missing state${record.info.missingStates.length === 1 ? "" : "s"}: ${record.info.missingStates.join(", ")}.`,
          severity: record.info.variantCount <= 1 ? "critical" : "warning",
          impact: "high",
          effort: "medium",
          meta: { kind: record.info.detectedKind, missing: record.info.missingStates.join(",") }
        });
      }
      return findings;
    },
    recommendation(finding) {
      var _a;
      return `Add variant(s) covering: ${(_a = finding.meta) == null ? void 0 : _a.missing}. Expose them as a "State" variant property so consumers can switch state without duplicating the component.`;
    }
  };
  var stateRules = [missingStatesRule];

  // src/plugin/rules/accessibility.ts
  var MIN_TOUCH_TARGET = 44;
  var MIN_TEXT_SIZE = 12;
  var GENERIC_LAYER_NAMES = /* @__PURE__ */ new Set(["vector", "ellipse", "rectangle", "path", "icon", "group", "frame"]);
  var touchTargetRule = {
    id: "a11y-touch-target-size",
    category: "accessibility",
    title: "Touch target smaller than 44x44",
    description: "An interactive component's bounding box is smaller than the recommended minimum touch target size.",
    whyItMatters: "Small tap targets are hard to hit accurately for users with motor impairments and on touch devices generally \u2014 this is one of the most common mobile accessibility failures.",
    severity: "warning",
    reference: "WCAG 2.2 SC 2.5.8 Target Size (Minimum)",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (!isInteractiveKind(record.info.detectedKind)) continue;
        for (const variant of record.variantNodes) {
          if (variant.width < MIN_TOUCH_TARGET || variant.height < MIN_TOUCH_TARGET) {
            findings.push({
              node: toNodeRef(variant, record.info.id, record.info.name),
              message: `${variant.name} in ${record.info.name} is ${Math.round(variant.width)}x${Math.round(
                variant.height
              )}px, below the ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px minimum touch target.`,
              severity: "warning",
              impact: "high",
              effort: "medium"
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return `Increase padding/hit area to at least ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px, even if the visible control stays visually smaller.`;
    }
  };
  var minTextSizeRule = {
    id: "a11y-min-text-size",
    category: "accessibility",
    title: "Text below minimum readable size",
    description: "Text layer uses a font size smaller than the recommended readable minimum.",
    whyItMatters: "Very small text is difficult to read for low-vision users and fails many platform accessibility guidelines.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const textNodes = variant.findAll((n) => n.type === "TEXT");
          for (const text of textNodes) {
            if (text.fontSize === figma.mixed) continue;
            const size = text.fontSize;
            if (size < MIN_TEXT_SIZE) {
              findings.push({
                node: toNodeRef(text, record.info.id, record.info.name),
                message: `"${text.characters.slice(0, 30)}" in ${record.info.name} is ${size}px, below the ${MIN_TEXT_SIZE}px readable minimum.`,
                severity: "suggestion",
                impact: "medium",
                effort: "low"
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return `Increase the font size to at least ${MIN_TEXT_SIZE}px, or confirm this is intentional caption/legal text with adequate contrast.`;
    }
  };
  var iconLabelRule = {
    id: "a11y-icon-without-label",
    category: "accessibility",
    title: "Icon-only element without an accessible name",
    description: "An icon-only interactive layer keeps its generic default name and has no description, so it likely has no accessible label downstream.",
    whyItMatters: 'Screen reader users rely on accessible names for icon-only buttons and controls \u2014 a component named "Vector 204" with no description usually means engineering has no naming guidance to hand to their aria-label.',
    severity: "warning",
    reference: "WCAG 2.1 SC 4.1.2 Name, Role, Value",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        const nameLower = record.info.name.toLowerCase();
        const looksIconOnly = nameLower.includes("icon") && !nameLower.includes("button");
        if (!looksIconOnly) continue;
        const genericName = GENERIC_LAYER_NAMES.has(nameLower.trim());
        if ((genericName || record.info.name.match(/^(Vector|Ellipse|Rectangle|Icon)\s*\d*$/i)) && !record.info.hasDocumentation) {
          findings.push({
            node: componentRef(record),
            message: `"${record.info.name}" is an icon-only component with a generic name and no description to guide an accessible label.`,
            severity: "warning",
            impact: "medium",
            effort: "low"
          });
        }
      }
      return findings;
    },
    recommendation() {
      return 'Rename the layer to describe its meaning (e.g. "icon-close") and add a description noting the aria-label/accessible name engineering should apply.';
    }
  };
  var hiddenLayerRule = {
    id: "a11y-hidden-layer",
    category: "accessibility",
    title: "Hidden layer left inside a component",
    description: "A layer inside this component is set to invisible.",
    whyItMatters: "Hidden layers are sometimes intentional (state toggles), but they're also frequently leftover debugging cruft that ships hidden content, unexpected spacing, or dead weight into every instance.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const hidden = variant.findAll((n) => "visible" in n && n.visible === false);
          for (const node of hidden) {
            findings.push({
              node: toNodeRef(node, record.info.id, record.info.name),
              message: `"${node.name}" in ${record.info.name} is hidden. Verify this is an intentional state layer.`,
              severity: "suggestion",
              impact: "low",
              effort: "low"
            });
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "If this layer isn't used as a toggled state, remove it. If it is, note that in the component description so it isn't mistaken for cruft.";
    }
  };
  var focusVisibilityRule = {
    id: "a11y-focus-visibility",
    category: "accessibility",
    title: "Focus state has no visible focus indicator",
    description: "This component has a Focus variant, but it has no visible stroke to distinguish it from the default state.",
    whyItMatters: "A focus state that looks identical to default is invisible to keyboard users \u2014 the whole point of the state is to show where keyboard focus currently is.",
    severity: "critical",
    reference: "WCAG 2.2 SC 2.4.11 Focus Not Obscured / SC 1.4.11 Non-text Contrast",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (record.info.type !== "COMPONENT_SET" || !record.info.detectedStates.includes("focus")) continue;
        record.info.variants.forEach((variantInfo, i) => {
          const isFocusVariant = Object.values(variantInfo.properties).some((v) => v.toLowerCase() === "focus");
          if (!isFocusVariant) return;
          const node = record.variantNodes[i];
          if (!node || !("strokes" in node)) return;
          const hasVisibleStroke = node.strokes.some((p) => p.type === "SOLID" && p.visible !== false);
          if (!hasVisibleStroke) {
            findings.push({
              node: toNodeRef(node, record.info.id, record.info.name),
              message: `The Focus variant of ${record.info.name} has no visible stroke/outline.`,
              severity: "critical",
              impact: "high",
              effort: "low"
            });
          }
        });
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Add a visible focus ring (stroke) to the Focus variant \u2014 don't rely on color/fill changes alone, which many keyboard/low-vision users won't perceive.";
    }
  };
  var accessibilityRules = [
    touchTargetRule,
    minTextSizeRule,
    iconLabelRule,
    hiddenLayerRule,
    focusVisibilityRule
  ];

  // src/plugin/rules/documentation.ts
  var EXPECTED_SECTIONS = [
    { key: "usage", label: "Usage", patterns: [/usage/i, /when to use/i] },
    { key: "do", label: "Do", patterns: [/\bdo:/i, /\bdo\b/i] },
    { key: "dont", label: "Don't", patterns: [/don'?t/i, /avoid/i] },
    { key: "accessibility", label: "Accessibility", patterns: [/a11y/i, /accessib/i] }
  ];
  var incompleteDocumentationRule = {
    id: "docs-incomplete-sections",
    category: "documentation",
    title: "Documentation missing expected sections",
    description: "A description exists but is missing recommended sections (usage, do/don't, accessibility notes).",
    whyItMatters: "Partial documentation gives a false sense of coverage \u2014 teams see a description exists and assume guidance is complete, then miss the do/don't and accessibility context that prevents misuse.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (!record.info.hasDocumentation) continue;
        const text = record.info.description;
        const missing = EXPECTED_SECTIONS.filter((s) => !s.patterns.some((p) => p.test(text)));
        if (missing.length > 0) {
          findings.push({
            node: componentRef(record),
            message: `${record.info.name}'s description is missing: ${missing.map((m) => m.label).join(", ")}.`,
            severity: "suggestion",
            impact: "low",
            effort: "medium",
            meta: { missing: missing.map((m) => m.key).join(",") }
          });
        }
      }
      return findings;
    },
    recommendation(finding) {
      var _a;
      return `Extend the description to cover: ${(_a = finding.meta) == null ? void 0 : _a.missing}. Keep each section short and link out to full docs if you have a site.`;
    }
  };
  var undocumentedPropertiesRule = {
    id: "docs-undocumented-properties",
    category: "documentation",
    title: "Variant properties not explained in the description",
    description: "Component exposes variant properties that are never mentioned in its description.",
    whyItMatters: "Consumers picking between properties they don't understand tend to misuse them or duplicate the component instead.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (record.info.propertyDefinitions.length === 0) continue;
        const text = record.info.description.toLowerCase();
        const unmentioned = record.info.propertyDefinitions.filter((p) => {
          const base = p.split("#")[0].toLowerCase();
          return !text.includes(base);
        });
        if (unmentioned.length > 0 && record.info.hasDocumentation) {
          findings.push({
            node: componentRef(record),
            message: `${record.info.name} has properties not referenced in its description: ${unmentioned.map((p) => p.split("#")[0]).join(", ")}.`,
            severity: "suggestion",
            impact: "low",
            effort: "low"
          });
        }
      }
      return findings;
    },
    recommendation() {
      return "Mention each property and its accepted values in the description so consumers know what's configurable.";
    }
  };
  var documentationRules = [incompleteDocumentationRule, undocumentedPropertiesRule];

  // src/plugin/rules/governance.ts
  var LEGACY_MARKERS = [/^old[\s_-]/i, /^copy of/i, /\bv1\b/i, /\btemp\b/i, /^untitled/i, /\bwip\b/i];
  var legacyNamingRule = {
    id: "governance-legacy-naming",
    category: "governance",
    title: "Legacy or placeholder naming",
    description: 'Component name carries a legacy/placeholder marker such as "Copy of", "old_", or "WIP".',
    whyItMatters: "Placeholder names leak into published libraries and signal to consumers that the component isn't production-ready, or worse, get adopted anyway.",
    severity: "warning",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        if (LEGACY_MARKERS.some((re) => re.test(record.info.name))) {
          findings.push({
            node: componentRef(record),
            message: `"${record.info.name}" carries a legacy/placeholder naming marker.`,
            severity: "warning",
            impact: "medium",
            effort: "low"
          });
        }
      }
      return findings;
    },
    recommendation() {
      return "Rename to the final, production naming convention and remove any placeholder markers before publishing.";
    }
  };
  var duplicateNameRule = {
    id: "governance-duplicate-name",
    category: "governance",
    title: "Duplicate component name",
    description: "Two components or component sets share the exact same name.",
    whyItMatters: "Duplicate names make it ambiguous which component to insert, and usually indicate an unintentional fork.",
    severity: "critical",
    evaluate(context) {
      var _a;
      const byName = /* @__PURE__ */ new Map();
      for (const record of context.components) {
        const list = (_a = byName.get(record.info.name)) != null ? _a : [];
        list.push(record);
        byName.set(record.info.name, list);
      }
      const findings = [];
      for (const [name, records] of byName) {
        if (records.length > 1) {
          for (const record of records) {
            findings.push({
              node: componentRef(record),
              message: `"${name}" is used by ${records.length} separate components (pages: ${records.map((r) => r.info.pageName).join(", ")}).`,
              severity: "critical",
              impact: "high",
              effort: "medium"
            });
          }
        }
      }
      return findings;
    },
    recommendation() {
      return "Rename to disambiguate, or consolidate into a single component if these are true duplicates.";
    }
  };
  var namingConventionRule = {
    id: "governance-naming-convention",
    category: "governance",
    title: "Inconsistent top-level naming convention",
    description: 'Component naming mixes slash-namespaced names (e.g. "Button/Primary") with flat names inconsistently.',
    whyItMatters: "A mixed naming convention breaks the assets panel's grouping and makes the library harder to browse and search.",
    severity: "suggestion",
    evaluate(context) {
      if (context.components.length < 4) return [];
      const namespaced = context.components.filter((r) => r.info.name.includes("/"));
      const flat = context.components.filter((r) => !r.info.name.includes("/"));
      if (namespaced.length === 0 || flat.length === 0) return [];
      const minority = namespaced.length < flat.length ? namespaced : flat;
      const style = namespaced.length < flat.length ? "slash-namespaced" : "flat";
      return minority.map((record) => ({
        node: componentRef(record),
        message: `"${record.info.name}" uses a ${style} naming style while most of the library uses the opposite convention.`,
        severity: "suggestion",
        impact: "low",
        effort: "low"
      }));
    },
    recommendation() {
      return "Align this component's name with the library's dominant naming convention (either consistently slash-namespaced or consistently flat).";
    }
  };
  var PLACEHOLDER_COLLECTION_NAMES = /^(collection\s*\d*|untitled.*|new collection.*)$/i;
  var collectionNamingRule = {
    id: "governance-collection-naming",
    category: "governance",
    title: "Placeholder variable collection name",
    description: "A variable collection still has Figma's default placeholder name.",
    whyItMatters: "An unnamed collection ('Collection 1') gives consumers no signal about what tokens live inside it \u2014 collections should be named for their purpose (Primitives, Semantic, Component).",
    severity: "warning",
    evaluate(context) {
      return context.variableCollections.filter((c) => PLACEHOLDER_COLLECTION_NAMES.test(c.name.trim())).map((c) => ({
        message: `Variable collection "${c.name}" still has a placeholder name.`,
        severity: "warning",
        impact: "medium",
        effort: "low",
        collection: c.name
      }));
    },
    recommendation() {
      return 'Rename the collection to describe what it contains (e.g. "Primitives", "Semantic Colors", "Component Tokens").';
    }
  };
  var variableNamingConventionRule = {
    id: "governance-variable-naming",
    category: "governance",
    title: "Inconsistent variable naming convention",
    description: 'Variable naming mixes hierarchical slash names (e.g. "color/text/primary") with flat names within the same collection.',
    whyItMatters: "A mixed naming convention inside one collection makes the variables panel's grouping unpredictable and complicates any tooling that parses variable names for semantic meaning.",
    severity: "suggestion",
    evaluate(context) {
      var _a, _b;
      const findings = [];
      const byCollection = /* @__PURE__ */ new Map();
      for (const v of context.variables) {
        const list = (_a = byCollection.get(v.variableCollectionId)) != null ? _a : [];
        list.push(v);
        byCollection.set(v.variableCollectionId, list);
      }
      for (const [collectionId, vars] of byCollection) {
        if (vars.length < 4) continue;
        const collectionName = (_b = context.variableCollections.find((c) => c.id === collectionId)) == null ? void 0 : _b.name;
        const namespaced = vars.filter((v) => v.name.includes("/"));
        const flat = vars.filter((v) => !v.name.includes("/"));
        if (namespaced.length === 0 || flat.length === 0) continue;
        const minority = namespaced.length < flat.length ? namespaced : flat;
        const style = namespaced.length < flat.length ? "slash-namespaced" : "flat";
        for (const v of minority) {
          findings.push({
            message: `Variable "${v.name}" uses a ${style} naming style while most of "${collectionName}" uses the opposite convention.`,
            severity: "suggestion",
            impact: "low",
            effort: "low",
            collection: collectionName
          });
        }
      }
      return findings;
    },
    recommendation() {
      return "Rename to match the collection's dominant naming convention, ideally a consistent hierarchical scheme (group/subgroup/name).";
    }
  };
  var governanceRules = [
    legacyNamingRule,
    duplicateNameRule,
    namingConventionRule,
    collectionNamingRule,
    variableNamingConventionRule
  ];

  // src/plugin/rules/deprecated.ts
  var flaggedDeprecatedRule = {
    id: "deprecated-flagged",
    category: "deprecated",
    title: "Component flagged as deprecated",
    description: "Component name or description marks it as deprecated, legacy, or obsolete.",
    whyItMatters: "Deprecated components left in the published library keep getting inserted by consumers who don't notice the marker.",
    severity: "warning",
    evaluate(context) {
      return context.components.filter((r) => r.info.isDeprecated).map((r) => {
        var _a;
        const usageCount = (_a = context.instanceCounts.get(r.info.id)) != null ? _a : 0;
        return {
          node: componentRef(r),
          message: `"${r.info.name}" is marked deprecated and still has ${usageCount} instance${usageCount === 1 ? "" : "s"} in this file.`,
          severity: usageCount > 0 ? "critical" : "warning",
          impact: "high",
          effort: "high",
          meta: { usageCount }
        };
      });
    },
    recommendation(finding) {
      var _a, _b;
      const count = (_b = (_a = finding.meta) == null ? void 0 : _a.usageCount) != null ? _b : 0;
      return count && Number(count) > 0 ? "Migrate remaining instances to the replacement component before removing this one, then archive it in a deprecated/ page." : "No instances found in this file \u2014 safe to archive or delete after confirming no other files in the library depend on it.";
    }
  };
  var unusedComponentRule = {
    id: "deprecated-unused-component",
    category: "deprecated",
    title: "Component not instantiated anywhere in this file",
    description: "No instance of this component was found while scanning the file.",
    whyItMatters: "Components with zero visible usage are candidates for archiving \u2014 keeping them published adds noise to the picker without proven value. (This only reflects usage within the current file, not other files consuming the library.)",
    severity: "suggestion",
    evaluate(context) {
      return context.components.filter((r) => {
        var _a;
        return !r.info.isDeprecated && ((_a = context.instanceCounts.get(r.info.id)) != null ? _a : 0) === 0;
      }).map((r) => ({
        node: componentRef(r),
        message: `"${r.info.name}" has no instances in this file.`,
        severity: "suggestion",
        impact: "low",
        effort: "low"
      }));
    },
    recommendation() {
      return "Confirm this component isn't consumed by other files before archiving \u2014 cross-file usage isn't visible to a single-file scan.";
    }
  };
  function normalizeName(name) {
    return name.toLowerCase().replace(/\(deprecated\)|\[deprecated\]|deprecated|legacy|obsolete/gi, "").replace(/\bv\d+\b/gi, "").replace(/^copy of\s*/i, "").replace(/[^a-z0-9]+/g, "").trim();
  }
  var replacementSuggestionRule = {
    id: "deprecated-replacement-suggestion",
    category: "deprecated",
    title: "Likely replacement component found",
    description: "A deprecated component's name closely matches an active component, suggesting a migration target.",
    whyItMatters: "Naming the replacement in the deprecation notice turns a dead-end warning into an actionable migration path.",
    severity: "suggestion",
    evaluate(context) {
      const active = context.components.filter((r) => !r.info.isDeprecated);
      const findings = [];
      for (const deprecated of context.components) {
        if (!deprecated.info.isDeprecated) continue;
        const base = normalizeName(deprecated.info.name);
        if (base.length < 2) continue;
        const match = active.find((r) => normalizeName(r.info.name) === base && r.info.id !== deprecated.info.id);
        if (match) {
          findings.push({
            node: componentRef(deprecated),
            message: `"${deprecated.info.name}" looks like an older version of "${match.info.name}".`,
            severity: "suggestion",
            impact: "medium",
            effort: "low",
            meta: { replacement: match.info.name }
          });
        }
      }
      return findings;
    },
    recommendation(finding) {
      var _a;
      return `Point consumers to "${(_a = finding.meta) == null ? void 0 : _a.replacement}" in the deprecation notice, then migrate remaining instances to it.`;
    }
  };
  var deprecatedRules = [flaggedDeprecatedRule, unusedComponentRule, replacementSuggestionRule];

  // src/plugin/rules/visual.ts
  var COMMON_ICON_SIZES = /* @__PURE__ */ new Set([12, 16, 20, 24, 28, 32, 40, 48]);
  var iconSizeConsistencyRule = {
    id: "visual-icon-size-inconsistency",
    category: "visual",
    title: "Icon size off the standard scale",
    description: "An icon-named layer doesn't match any size in the library's common icon scale, or isn't square.",
    whyItMatters: "Off-scale icons look mismatched next to standard-size icons and usually mean the SVG was placed without resizing to the grid.",
    severity: "suggestion",
    evaluate(context) {
      const findings = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const icons = variant.findAll(
            (n) => n.name.toLowerCase().includes("icon") && "width" in n && n.type !== "TEXT"
          );
          for (const icon of icons) {
            const w = Math.round(icon.width);
            const h = Math.round(icon.height);
            const notSquare = Math.abs(w - h) > 1;
            const offScale = !COMMON_ICON_SIZES.has(w) || !COMMON_ICON_SIZES.has(h);
            if (notSquare || offScale) {
              findings.push({
                node: toNodeRef(icon, record.info.id, record.info.name),
                message: `Icon "${icon.name}" in ${record.info.name} is ${w}x${h}px${notSquare ? " (not square)" : ", off the standard icon scale"}.`,
                severity: "suggestion",
                impact: "low",
                effort: "low"
              });
            }
          }
        }
        if (context.isCancelled()) break;
      }
      return findings;
    },
    recommendation() {
      return "Resize to a standard icon size (16/20/24/32px) and keep the bounding box square.";
    }
  };
  var strokeConsistencyRule = {
    id: "visual-stroke-weight-inconsistency",
    category: "visual",
    title: "Stroke weight outside common values",
    description: "Border weight doesn't match the small set of stroke widths used elsewhere in the library.",
    whyItMatters: "Arbitrary stroke weights create visual noise \u2014 borders should read as one of a small number of deliberate weights (hairline, default, emphasis).",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const weightCounts = /* @__PURE__ */ new Map();
      const perNode = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const withStrokes = [variant, ...variant.findAll(() => true)].filter(
            (n) => "strokeWeight" in n && n.strokes.length > 0
          );
          for (const node of withStrokes) {
            const weight = node.strokeWeight;
            if (typeof weight !== "number" || weight === 0) continue;
            weightCounts.set(weight, ((_a = weightCounts.get(weight)) != null ? _a : 0) + 1);
            perNode.push({ node, weight, componentId: record.info.id, componentName: record.info.name });
          }
        }
      }
      if (weightCounts.size <= 3) return [];
      const commonWeights = new Set(
        Array.from(weightCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w)
      );
      return perNode.filter((entry) => !commonWeights.has(entry.weight)).map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.name}" in ${entry.componentName} uses a ${entry.weight}px stroke, outside the library's ${Array.from(commonWeights).join("/")}px common weights.`,
        severity: "suggestion",
        impact: "low",
        effort: "low"
      }));
    },
    recommendation() {
      return "Standardize on the library's common stroke weights instead of introducing a new one-off value.";
    }
  };
  var cornerRadiusConsistencyRule = {
    id: "visual-corner-radius-inconsistency",
    category: "visual",
    title: "Corner radius outside common values",
    description: "Corner radius doesn't match the small set of radii used elsewhere in the library.",
    whyItMatters: "A handful of deliberate radius steps (e.g. 0/4/8/full) reads as a coherent shape language; one-off radii look like an accident.",
    severity: "suggestion",
    evaluate(context) {
      var _a;
      const radiusCounts = /* @__PURE__ */ new Map();
      const perNode = [];
      for (const record of context.components) {
        for (const variant of record.variantNodes) {
          const withRadius = [variant, ...variant.findAll(() => true)].filter((n) => "cornerRadius" in n);
          for (const node of withRadius) {
            const radius = node.cornerRadius;
            if (typeof radius !== "number" || radius <= 0) continue;
            radiusCounts.set(radius, ((_a = radiusCounts.get(radius)) != null ? _a : 0) + 1);
            perNode.push({ node, radius, componentId: record.info.id, componentName: record.info.name });
          }
        }
      }
      if (radiusCounts.size <= 3) return [];
      const commonRadii = new Set(
        Array.from(radiusCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r]) => r)
      );
      return perNode.filter((entry) => !commonRadii.has(entry.radius)).map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.name}" in ${entry.componentName} uses a ${entry.radius}px corner radius, outside the library's common ${Array.from(commonRadii).sort((a, b) => a - b).join("/")}px radii.`,
        severity: "suggestion",
        impact: "low",
        effort: "low"
      }));
    },
    recommendation() {
      return "Standardize on one of the library's common radius steps instead of introducing a new one-off value.";
    }
  };
  var visualRules = [iconSizeConsistencyRule, strokeConsistencyRule, cornerRadiusConsistencyRule];

  // src/plugin/rules/index.ts
  function registerAllRules() {
    ruleRegistry.registerAll([
      ...contrastRules,
      ...typographyRules,
      ...spacingRules,
      ...tokenRules,
      ...componentRules,
      ...stateRules,
      ...accessibilityRules,
      ...documentationRules,
      ...governanceRules,
      ...deprecatedRules,
      ...visualRules
    ]);
  }

  // src/plugin/scanner/componentTaxonomy.ts
  var KIND_KEYWORDS = [
    ["checkbox", ["checkbox"]],
    ["radio", ["radio"]],
    ["switch", ["switch", "toggle"]],
    ["select", ["select", "dropdown", "combobox"]],
    ["input", ["input", "textfield", "text field", "textarea", "text area"]],
    ["button", ["button", "btn", "cta"]],
    ["tab", ["tab"]],
    ["accordion", ["accordion", "disclosure"]],
    ["menu-item", ["menu item", "menuitem", "list item", "dropdown item"]],
    ["link", ["link"]],
    ["card", ["card"]],
    ["badge", ["badge", "tag", "chip", "pill"]],
    ["alert", ["alert", "banner", "toast", "notification"]],
    ["icon", ["icon"]]
  ];
  function detectComponentKind(name) {
    const lower = name.toLowerCase();
    for (const [kind, keywords] of KIND_KEYWORDS) {
      if (keywords.some((k) => lower.includes(k))) return kind;
    }
    return "unknown";
  }
  var EXPECTED_STATES = {
    button: ["default", "hover", "pressed", "focus", "disabled"],
    input: ["default", "focus", "error", "disabled"],
    checkbox: ["checked", "unchecked", "indeterminate", "disabled"],
    radio: ["selected", "unselected", "disabled"],
    switch: ["on", "off", "disabled"],
    select: ["default", "open", "disabled"],
    tab: ["default", "selected", "disabled"],
    accordion: ["collapsed", "expanded"],
    "menu-item": ["default", "hover", "selected", "disabled"],
    link: ["default", "hover", "visited"],
    card: [],
    badge: [],
    alert: [],
    icon: [],
    unknown: []
  };
  var KNOWN_STATE_VOCAB = new Set(
    Array.from(new Set(Object.values(EXPECTED_STATES).flat())).concat([
      "active",
      "loading",
      "expanded",
      "collapsed",
      "indeterminate",
      "visited",
      "error",
      "success",
      "warning"
    ])
  );
  function detectStatesFromVariants(variantPropertyValues) {
    const found = /* @__PURE__ */ new Set();
    for (const raw of variantPropertyValues) {
      const value = raw.trim().toLowerCase();
      if (KNOWN_STATE_VOCAB.has(value)) found.add(value);
    }
    return Array.from(found);
  }

  // src/plugin/scanner/collect.ts
  var DEPRECATED_PATTERN = /deprecated|legacy|do not use|obsolete|\[old\]/i;
  function isDeprecatedMarker(text) {
    if (!text) return false;
    return DEPRECATED_PATTERN.test(text) || text.trim().startsWith("\u{1F6AB}") || text.trim().startsWith("\u26A0\uFE0F deprecated");
  }
  function tick() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  function variantPropsToDict(props) {
    return props ? __spreadValues({}, props) : {};
  }
  function buildComponentSetRecord(set, page) {
    var _a, _b, _c;
    const variantNodes = set.children.filter((c) => c.type === "COMPONENT");
    const variants = variantNodes.map((v) => ({
      id: v.id,
      name: v.name,
      properties: variantPropsToDict(v.variantProperties)
    }));
    const propertyDefinitions = Object.keys((_a = set.componentPropertyDefinitions) != null ? _a : {});
    const allPropValues = variantNodes.flatMap((v) => {
      var _a2;
      return Object.values((_a2 = v.variantProperties) != null ? _a2 : {});
    });
    const kind = detectComponentKind(set.name);
    const detectedStates = detectStatesFromVariants(allPropValues);
    const expected = (_b = EXPECTED_STATES[kind]) != null ? _b : [];
    const missingStates = expected.filter((s) => !detectedStates.includes(s));
    const description = (_c = set.description) != null ? _c : "";
    const info = {
      id: set.id,
      name: set.name,
      type: "COMPONENT_SET",
      pageId: page.id,
      pageName: page.name,
      description,
      variantCount: variantNodes.length,
      variants,
      propertyDefinitions,
      isDeprecated: isDeprecatedMarker(set.name) || isDeprecatedMarker(description),
      hasDocumentation: description.trim().length > 0,
      detectedKind: kind,
      detectedStates,
      missingStates
    };
    return { node: set, info, variantNodes: variantNodes.length > 0 ? variantNodes : [] };
  }
  function buildStandaloneComponentRecord(node, page) {
    var _a, _b, _c;
    const kind = detectComponentKind(node.name);
    const expected = (_a = EXPECTED_STATES[kind]) != null ? _a : [];
    const description = (_b = node.description) != null ? _b : "";
    const info = {
      id: node.id,
      name: node.name,
      type: "COMPONENT",
      pageId: page.id,
      pageName: page.name,
      description,
      variantCount: 1,
      variants: [],
      propertyDefinitions: Object.keys((_c = node.componentPropertyDefinitions) != null ? _c : {}),
      isDeprecated: isDeprecatedMarker(node.name) || isDeprecatedMarker(description),
      hasDocumentation: description.trim().length > 0,
      detectedKind: kind,
      detectedStates: [],
      missingStates: expected
    };
    return { node, info, variantNodes: [node] };
  }
  async function collectDocument(onProgress, isCancelled) {
    var _a, _b, _c, _d;
    await figma.loadAllPagesAsync();
    const pages = figma.root.children;
    const components = [];
    const instanceCounts = /* @__PURE__ */ new Map();
    const variantInstanceCounts = /* @__PURE__ */ new Map();
    let totalLayers = 0;
    for (let p = 0; p < pages.length; p++) {
      if (isCancelled()) break;
      const page = pages[p];
      onProgress("Scanning pages", p + 1, pages.length);
      const nodes = page.findAll(() => true);
      totalLayers += nodes.length;
      for (const node of nodes) {
        if (node.type === "COMPONENT_SET") {
          components.push(buildComponentSetRecord(node, page));
        } else if (node.type === "COMPONENT" && ((_a = node.parent) == null ? void 0 : _a.type) !== "COMPONENT_SET") {
          components.push(buildStandaloneComponentRecord(node, page));
        } else if (node.type === "INSTANCE") {
          try {
            const main = node.mainComponent;
            if (main) {
              const rollupKey = ((_b = main.parent) == null ? void 0 : _b.type) === "COMPONENT_SET" ? main.parent.id : main.id;
              instanceCounts.set(rollupKey, ((_c = instanceCounts.get(rollupKey)) != null ? _c : 0) + 1);
              variantInstanceCounts.set(main.id, ((_d = variantInstanceCounts.get(main.id)) != null ? _d : 0) + 1);
            }
          } catch (e) {
          }
        }
      }
      await tick();
    }
    const allComponentNodes = [];
    for (let i = 0; i < components.length; i++) {
      if (isCancelled()) break;
      if (i % 25 === 0) {
        onProgress("Indexing component layers", i + 1, components.length);
        await tick();
      }
      for (const variant of components[i].variantNodes) {
        allComponentNodes.push(variant, ...variant.findAll(() => true));
      }
    }
    onProgress("Reading variables and styles", 0, 1);
    const [variables, variableCollections, paintStyles, textStyles, effectStyles, gridStyles] = await Promise.all([
      figma.variables.getLocalVariablesAsync(),
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalTextStylesAsync(),
      figma.getLocalEffectStylesAsync(),
      figma.getLocalGridStylesAsync()
    ]);
    return {
      components,
      variables,
      variableCollections,
      paintStyles,
      textStyles,
      effectStyles,
      gridStyles,
      allComponentNodes,
      totalLayers,
      instanceCounts,
      variantInstanceCounts
    };
  }

  // src/shared/types.ts
  var AUDIT_CATEGORIES = [
    "visual",
    "contrast",
    "typography",
    "spacing",
    "tokens",
    "components",
    "states",
    "accessibility",
    "documentation",
    "governance",
    "deprecated"
  ];

  // src/plugin/scoring/healthScore.ts
  var CATEGORY_WEIGHTS = {
    accessibility: 0.15,
    contrast: 0.1,
    components: 0.15,
    states: 0.05,
    documentation: 0.15,
    tokens: 0.15,
    typography: 0.08,
    spacing: 0.08,
    governance: 0.07,
    visual: 0.02,
    deprecated: 0
  };
  var SEVERITY_PENALTY = {
    critical: 10,
    warning: 4,
    suggestion: 1
  };
  function computeHealthScore(issues, denominators) {
    const categories = AUDIT_CATEGORIES.map((category) => {
      var _a;
      const categoryIssues = issues.filter((i) => i.category === category);
      const criticalCount = categoryIssues.filter((i) => i.severity === "critical").length;
      const warningCount = categoryIssues.filter((i) => i.severity === "warning").length;
      const suggestionCount = categoryIssues.filter((i) => i.severity === "suggestion").length;
      const denominator = Math.max(1, (_a = denominators[category]) != null ? _a : 1);
      const penalty = (criticalCount * SEVERITY_PENALTY.critical + warningCount * SEVERITY_PENALTY.warning + suggestionCount * SEVERITY_PENALTY.suggestion) / denominator;
      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
      const passCount = Math.max(0, Math.round(denominator) - (criticalCount + warningCount + suggestionCount));
      return {
        category,
        score,
        weight: CATEGORY_WEIGHTS[category],
        criticalCount,
        warningCount,
        suggestionCount,
        passCount
      };
    });
    const overall = Math.round(categories.reduce((sum, c) => sum + c.score * c.weight, 0));
    return {
      overall,
      categories,
      totalCritical: issues.filter((i) => i.severity === "critical").length,
      totalWarnings: issues.filter((i) => i.severity === "warning").length,
      totalSuggestions: issues.filter((i) => i.severity === "suggestion").length,
      totalSuccesses: categories.reduce((sum, c) => sum + c.passCount, 0)
    };
  }

  // src/plugin/scanner/scanEngine.ts
  var ScanCancelledError = class extends Error {
    constructor() {
      super("Scan was cancelled");
      this.name = "ScanCancelledError";
    }
  };
  function buildDenominators(collected, componentCount) {
    const nodeDenominator = Math.max(1, Math.round(collected.allComponentNodes.length / 25));
    const tokenDenominator = Math.max(
      1,
      collected.variables.length + collected.paintStyles.length + collected.textStyles.length + collected.effectStyles.length + collected.gridStyles.length
    );
    const componentDenominator = Math.max(1, componentCount);
    return {
      accessibility: nodeDenominator,
      contrast: nodeDenominator,
      visual: nodeDenominator,
      typography: nodeDenominator,
      spacing: nodeDenominator,
      components: componentDenominator,
      states: componentDenominator,
      documentation: componentDenominator,
      governance: componentDenominator,
      tokens: tokenDenominator,
      deprecated: componentDenominator
    };
  }
  async function runScan(onProgress, isCancelled, wcagLevel) {
    const startTime = Date.now();
    const collected = await collectDocument(onProgress, isCancelled);
    if (isCancelled()) throw new ScanCancelledError();
    const context = {
      components: collected.components,
      variables: collected.variables,
      variableCollections: collected.variableCollections,
      paintStyles: collected.paintStyles,
      textStyles: collected.textStyles,
      effectStyles: collected.effectStyles,
      gridStyles: collected.gridStyles,
      allComponentNodes: collected.allComponentNodes,
      instanceCounts: collected.instanceCounts,
      variantInstanceCounts: collected.variantInstanceCounts,
      wcagLevel,
      isCancelled
    };
    const issues = await ruleRegistry.runAll(context, (title, i, total) => onProgress(`Auditing: ${title}`, i, total));
    if (isCancelled()) throw new ScanCancelledError();
    const totalComponents = collected.components.filter((c) => c.info.type === "COMPONENT").length;
    const totalComponentSets = collected.components.filter((c) => c.info.type === "COMPONENT_SET").length;
    const totalVariants = collected.components.filter((c) => c.info.type === "COMPONENT_SET").reduce((sum, c) => sum + c.info.variantCount, 0);
    const totalStyles = collected.paintStyles.length + collected.textStyles.length + collected.effectStyles.length + collected.gridStyles.length;
    const deprecatedComponents = collected.components.filter((c) => c.info.isDeprecated).length;
    const stats = {
      totalComponents,
      totalComponentSets,
      totalVariants,
      totalVariables: collected.variables.length,
      totalTokens: collected.variables.length + totalStyles,
      totalLayers: collected.totalLayers,
      totalStyles,
      deprecatedComponents,
      scanDurationMs: Date.now() - startTime
    };
    const tokenStats = {
      totalVariables: collected.variables.length,
      totalCollections: collected.variableCollections.length,
      totalStyles,
      hardcodedColorCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-color").length,
      hardcodedTypographyCount: issues.filter((i) => i.ruleId === "typography-hardcoded-style").length,
      hardcodedSpacingCount: issues.filter((i) => i.ruleId === "spacing-off-grid").length,
      hardcodedRadiusCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-radius").length,
      hardcodedShadowCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-shadow").length,
      hardcodedOpacityCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-opacity").length,
      unusedVariableCount: issues.filter((i) => i.ruleId === "tokens-unused-variable").length,
      duplicateVariableCount: issues.filter((i) => i.ruleId === "tokens-duplicate-variable").length,
      brokenAliasCount: issues.filter((i) => i.ruleId === "tokens-broken-alias").length
    };
    const denominators = buildDenominators(collected, totalComponents + totalComponentSets);
    const health = computeHealthScore(issues, denominators);
    const variables = collected.variables.map((v) => {
      var _a, _b;
      return {
        id: v.id,
        name: v.name,
        collectionId: v.variableCollectionId,
        collectionName: (_b = (_a = collected.variableCollections.find((c) => c.id === v.variableCollectionId)) == null ? void 0 : _a.name) != null ? _b : "Unknown collection",
        resolvedType: v.resolvedType,
        isAlias: Object.values(v.valuesByMode).some(
          (value) => typeof value === "object" && value !== null && value.type === "VARIABLE_ALIAS"
        ),
        usageCount: 0
      };
    });
    return {
      scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
      fileName: figma.root.name,
      stats,
      tokenStats,
      health,
      issues,
      components: collected.components.map((c) => c.info),
      variables
    };
  }

  // src/shared/util.ts
  function issueKey(issue) {
    var _a, _b;
    return `${issue.ruleId}::${(_b = (_a = issue.node) == null ? void 0 : _a.id) != null ? _b : "file"}`;
  }

  // src/plugin/persistence.ts
  var MAX_TREND_ENTRIES = 20;
  var SETTINGS_KEY = "designlens:settings";
  var DEFAULT_SETTINGS = { wcagLevel: "AA" };
  var MAX_LAST_RESULT_BYTES = 35e5;
  var LOCAL_FILE_ID_KEY = "designlens:localFileId";
  function generateLocalFileId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function getLocalFileId() {
    const existing = figma.root.getPluginData(LOCAL_FILE_ID_KEY);
    if (existing) return existing;
    const id = generateLocalFileId();
    figma.root.setPluginData(LOCAL_FILE_ID_KEY, id);
    return id;
  }
  function getFileKey() {
    var _a;
    return (_a = figma.fileKey) != null ? _a : `local:${getLocalFileId()}`;
  }
  function scopedKey(fileKey2, name) {
    return `designlens:${fileKey2}:${name}`;
  }
  async function safeGet(key) {
    try {
      return await figma.clientStorage.getAsync(key);
    } catch (err) {
      console.warn(`DesignLens: failed to read client storage key "${key}":`, err);
      return void 0;
    }
  }
  async function safeSet(key, value) {
    try {
      await figma.clientStorage.setAsync(key, value);
      return true;
    } catch (err) {
      console.warn(`DesignLens: failed to write client storage key "${key}":`, err);
      return false;
    }
  }
  async function getSettings() {
    const stored = await safeGet(SETTINGS_KEY);
    return __spreadValues(__spreadValues({}, DEFAULT_SETTINGS), stored);
  }
  async function setWcagLevel(level) {
    const current = await getSettings();
    await safeSet(SETTINGS_KEY, __spreadProps(__spreadValues({}, current), { wcagLevel: level }));
  }
  async function getLastResult(fileKey2) {
    const stored = await safeGet(scopedKey(fileKey2, "last-result"));
    return stored != null ? stored : null;
  }
  async function saveLastResult(fileKey2, result) {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_LAST_RESULT_BYTES) {
      console.warn(
        `DesignLens: scan result is ${Math.round(serialized.length / 1e6)}MB, too large to persist locally (5MB quota). Trend history and issue status will still be saved; the full result just won't resume on reopen this session.`
      );
      return;
    }
    await safeSet(scopedKey(fileKey2, "last-result"), result);
  }
  async function getTrend(fileKey2) {
    const stored = await safeGet(scopedKey(fileKey2, "trend"));
    return stored != null ? stored : [];
  }
  async function appendTrend(fileKey2, entry) {
    const existing = await getTrend(fileKey2);
    const next = [...existing, entry].slice(-MAX_TREND_ENTRIES);
    await safeSet(scopedKey(fileKey2, "trend"), next);
    return next;
  }
  async function getIssueStatusMap(fileKey2) {
    const stored = await safeGet(scopedKey(fileKey2, "issue-status"));
    return stored != null ? stored : {};
  }
  async function setIssueStatus(fileKey2, key, status) {
    const map = await getIssueStatusMap(fileKey2);
    if (status === "open") {
      delete map[key];
    } else {
      map[key] = status;
    }
    await safeSet(scopedKey(fileKey2, "issue-status"), map);
    return map;
  }
  function applyIssueStatuses(issues, statusMap) {
    var _a;
    for (const issue of issues) {
      issue.status = (_a = statusMap[issueKey(issue)]) != null ? _a : "open";
    }
  }
  function buildTrendEntry(result) {
    const categories = {};
    for (const c of result.health.categories) {
      categories[c.category] = c.score;
    }
    return {
      scannedAt: result.scannedAt,
      overall: result.health.overall,
      categories,
      totalCritical: result.health.totalCritical,
      totalWarnings: result.health.totalWarnings,
      totalSuggestions: result.health.totalSuggestions
    };
  }

  // src/plugin/main.ts
  registerAllRules();
  figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });
  var cancelled = false;
  var fileKey = getFileKey();
  function post(message) {
    figma.ui.postMessage(message);
  }
  async function focusNode(nodeId) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.removed || !("visible" in node)) return;
    const scene = node;
    const page = findOwningPage(scene);
    if (page) await figma.setCurrentPageAsync(page);
    figma.currentPage.selection = [scene];
    figma.viewport.scrollAndZoomIntoView([scene]);
  }
  async function handleInit() {
    const [settings, lastResult, trend, statusMap] = await Promise.all([
      getSettings(),
      getLastResult(fileKey),
      getTrend(fileKey),
      getIssueStatusMap(fileKey)
    ]);
    if (lastResult) applyIssueStatuses(lastResult.issues, statusMap);
    post({ type: "init", settings, result: lastResult, trend });
  }
  async function handleStartScan() {
    cancelled = false;
    try {
      const settings = await getSettings();
      const result = await runScan(
        (phase, processed, total) => post({ type: "scan-progress", phase, processed, total }),
        () => cancelled,
        settings.wcagLevel
      );
      const statusMap = await getIssueStatusMap(fileKey);
      applyIssueStatuses(result.issues, statusMap);
      await saveLastResult(fileKey, result);
      const trend = await appendTrend(fileKey, buildTrendEntry(result));
      post({ type: "scan-complete", result, trend });
    } catch (err) {
      if (err instanceof ScanCancelledError) {
        post({ type: "scan-cancelled" });
      } else {
        post({ type: "scan-error", message: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  figma.ui.onmessage = async (message) => {
    switch (message.type) {
      case "start-scan":
        await handleStartScan();
        break;
      case "cancel-scan":
        cancelled = true;
        break;
      case "select-node":
        await focusNode(message.nodeId);
        break;
      case "set-wcag-level":
        await setWcagLevel(message.level);
        break;
      case "set-issue-status":
        await setIssueStatus(fileKey, message.issueKey, message.status);
        break;
    }
  };
  void handleInit();
})();
