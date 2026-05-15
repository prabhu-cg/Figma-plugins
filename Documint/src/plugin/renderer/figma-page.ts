import {
  createDocHeader,
  createDocSection,
  createPropertyGrid,
  createPropertyCards,
  createFrame,
  createText,
  loadFont,
  DESIGN,
} from './figma-primitives';

const DOC_WIDTH = 720;
const DOC_PADDING = DESIGN.spacing.xl;

// ── Utilities ─────────────────────────────────────────────────────────────────

function safeGet<T>(fn: () => T): T | undefined {
  try { return fn(); } catch (_) { return undefined; }
}

function calculateAdjacentPosition(node: any): { x: number; y: number } {
  return {
    x: (node.x || 0) + (node.width || 400) + 48,
    y: node.y || 0,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(c => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Resolve fill variable name from boundVariables (returns null if not bound)
function getFillVariableName(node: any, fillIndex: number): string | null {
  try {
    const bv = safeGet(() => node.boundVariables);
    if (!bv) return null;
    const fillBindings = (bv as any).fills;
    if (!fillBindings || !Array.isArray(fillBindings)) return null;
    const binding = fillBindings[fillIndex];
    if (!binding) return null;
    const id = (binding as any).id;
    if (!id) return null;
    const variable = figma.variables.getVariableById(id);
    return variable ? variable.name : null;
  } catch (_) {
    return null;
  }
}

// Resolve stroke variable name from boundVariables (returns null if not bound)
function getStrokeVariableName(node: any, strokeIndex: number): string | null {
  try {
    const bv = safeGet(() => node.boundVariables);
    if (!bv) return null;
    const strokeBindings = (bv as any).strokes;
    if (!strokeBindings || !Array.isArray(strokeBindings)) return null;
    const binding = strokeBindings[strokeIndex];
    if (!binding) return null;
    const id = (binding as any).id;
    if (!id) return null;
    const variable = figma.variables.getVariableById(id);
    return variable ? variable.name : null;
  } catch (_) {
    return null;
  }
}

// ── Node spec extraction ──────────────────────────────────────────────────────

interface NodeSpec { label: string; value: string; }

interface NodeSpecs {
  position: NodeSpec[];
  autoLayout: NodeSpec[];
  appearance: NodeSpec[];
  typography: NodeSpec[];
}

function extractNodeSpecs(node: any): NodeSpecs {
  const position: NodeSpec[] = [];
  const autoLayout: NodeSpec[] = [];
  const appearance: NodeSpec[] = [];
  const typography: NodeSpec[] = [];

  // ── Position ─────────────────────────────────────────────────────────────
  const nx = safeGet(() => node.x);
  const ny = safeGet(() => node.y);
  if (nx !== undefined) position.push({ label: 'X', value: `${Math.round(nx as number)}` });
  if (ny !== undefined) position.push({ label: 'Y', value: `${Math.round(ny as number)}` });

  const rotation = safeGet(() => node.rotation);
  if (rotation !== undefined && Math.abs(rotation as number) > 0.01) {
    position.push({ label: 'Rotation', value: `${Math.round(rotation as number)}°` });
  }

  const constraints = safeGet(() => node.constraints);
  if (constraints) {
    const ch = (constraints as any).horizontal;
    const cv = (constraints as any).vertical;
    if (ch && ch !== 'SCALE') position.push({ label: 'Constraint H', value: String(ch).toLowerCase().replace(/_/g, ' ') });
    if (cv && cv !== 'SCALE') position.push({ label: 'Constraint V', value: String(cv).toLowerCase().replace(/_/g, ' ') });
  }

  // ── Auto Layout ───────────────────────────────────────────────────────────
  const lm = safeGet(() => node.layoutMode);
  if (lm && lm !== 'NONE') {
    autoLayout.push({ label: 'Direction', value: lm === 'HORIZONTAL' ? 'Horizontal' : 'Vertical' });

    const wrap = safeGet(() => node.layoutWrap);
    if (wrap === 'WRAP') autoLayout.push({ label: 'Wrap', value: 'Wrap' });

    // Width with sizing mode
    const wSizing = safeGet(() => node.layoutSizingHorizontal);
    const nw = safeGet(() => node.width);
    const minW = safeGet(() => node.minWidth);
    const maxW = safeGet(() => node.maxWidth);
    if (wSizing) {
      let wVal = wSizing === 'FIXED' ? `${Math.round((nw as number) ?? 0)}px` : String(wSizing).charAt(0) + String(wSizing).slice(1).toLowerCase();
      if (minW !== null && minW !== undefined) wVal += `  min ${minW}`;
      if (maxW !== null && maxW !== undefined) wVal += `  max ${maxW}`;
      autoLayout.push({ label: 'Width', value: wVal });
    } else if (nw !== undefined) {
      autoLayout.push({ label: 'Width', value: `${Math.round(nw as number)}px` });
    }

    // Height with sizing mode
    const hSizing = safeGet(() => node.layoutSizingVertical);
    const nh = safeGet(() => node.height);
    const minH = safeGet(() => node.minHeight);
    const maxH = safeGet(() => node.maxHeight);
    if (hSizing) {
      let hVal = hSizing === 'FIXED' ? `${Math.round((nh as number) ?? 0)}px` : String(hSizing).charAt(0) + String(hSizing).slice(1).toLowerCase();
      if (minH !== null && minH !== undefined) hVal += `  min ${minH}`;
      if (maxH !== null && maxH !== undefined) hVal += `  max ${maxH}`;
      autoLayout.push({ label: 'Height', value: hVal });
    } else if (nh !== undefined) {
      autoLayout.push({ label: 'Height', value: `${Math.round(nh as number)}px` });
    }

    // Alignment
    const pri = safeGet(() => node.primaryAxisAlignItems);
    const ctr = safeGet(() => node.counterAxisAlignItems);
    if (pri && typeof pri !== 'symbol') autoLayout.push({ label: 'Primary axis align', value: String(pri).toLowerCase().replace(/_/g, ' ') });
    if (ctr && typeof ctr !== 'symbol') autoLayout.push({ label: 'Counter axis align', value: String(ctr).toLowerCase().replace(/_/g, ' ') });

    // Gap
    const gap = safeGet(() => node.itemSpacing);
    if (typeof gap === 'number') autoLayout.push({ label: 'Gap', value: `${gap}px` });
    const counterGap = safeGet(() => node.counterAxisSpacing);
    if (typeof counterGap === 'number' && counterGap > 0) autoLayout.push({ label: 'Row gap', value: `${counterGap}px` });

    // Padding
    const pt = (safeGet(() => node.paddingTop) as number) ?? 0;
    const pr = (safeGet(() => node.paddingRight) as number) ?? 0;
    const pb = (safeGet(() => node.paddingBottom) as number) ?? 0;
    const pl = (safeGet(() => node.paddingLeft) as number) ?? 0;
    if (pt + pr + pb + pl > 0) {
      if (pt === pr && pr === pb && pb === pl) {
        autoLayout.push({ label: 'Padding', value: `${pt}px` });
      } else if (pt === pb && pl === pr) {
        autoLayout.push({ label: 'Padding', value: `↕ ${pt}px  ↔ ${pr}px` });
      } else {
        autoLayout.push({ label: 'Padding', value: `↑${pt}  →${pr}  ↓${pb}  ←${pl}` });
      }
    }

    const clip = safeGet(() => node.clipsContent);
    if (clip === true) autoLayout.push({ label: 'Clip content', value: 'Yes' });

  } else {
    // No auto-layout: plain dimensions
    const nw = safeGet(() => node.width);
    const nh = safeGet(() => node.height);
    if (nw !== undefined) autoLayout.push({ label: 'Width', value: `${Math.round(nw as number)}px` });
    if (nh !== undefined) autoLayout.push({ label: 'Height', value: `${Math.round(nh as number)}px` });
  }

  // ── Appearance ────────────────────────────────────────────────────────────
  // Fills (prefer variable name over raw hex)
  const fills = safeGet(() => node.fills);
  if (fills && typeof fills !== 'symbol' && Array.isArray(fills)) {
    (fills as any[]).filter((f: any) => f.visible !== false).forEach((f: any, idx: number) => {
      if (f.type === 'SOLID') {
        const varName = getFillVariableName(node, idx);
        const op = (f.opacity ?? 1) < 1 ? `  ${Math.round((f.opacity ?? 1) * 100)}%` : '';
        if (varName) {
          appearance.push({ label: 'Fill', value: `${varName}${op}` });
        } else {
          const hex = rgbToHex(f.color.r, f.color.g, f.color.b);
          appearance.push({ label: 'Fill', value: `${hex}${op}` });
        }
      } else if (typeof f.type === 'string' && f.type.includes('GRADIENT')) {
        appearance.push({ label: 'Fill', value: f.type.replace(/_/g, ' ').toLowerCase() });
      } else if (f.type === 'IMAGE') {
        appearance.push({ label: 'Fill', value: 'Image fill' });
      }
    });
  }

  // Strokes
  const strokes = safeGet(() => node.strokes);
  if (strokes && typeof strokes !== 'symbol' && Array.isArray(strokes)) {
    (strokes as any[]).filter((s: any) => s.visible !== false).forEach((s: any, idx: number) => {
      if (s.type === 'SOLID') {
        const varName = getStrokeVariableName(node, idx);
        const hex = rgbToHex(s.color.r, s.color.g, s.color.b);
        const op = (s.opacity ?? 1) < 1 ? `  ${Math.round((s.opacity ?? 1) * 100)}%` : '';
        const sw = safeGet(() => node.strokeWeight);
        const sa = safeGet(() => node.strokeAlign);
        const wPart = sw !== undefined ? `  ${Math.round(sw * 10) / 10}px` : '';
        const aPart = sa && typeof sa !== 'symbol' ? `  ${String(sa).toLowerCase()}` : '';
        const colorPart = varName ? varName : hex;
        appearance.push({ label: 'Stroke', value: `${colorPart}${op}${wPart}${aPart}` });
      }
    });
  }

  // Corner radius
  const cr = safeGet(() => node.cornerRadius);
  if (cr !== undefined && typeof cr === 'number' && cr > 0) {
    appearance.push({ label: 'Corner radius', value: `${cr}px` });
  } else {
    const tl = (safeGet(() => node.topLeftRadius) as number) ?? 0;
    const tr = (safeGet(() => node.topRightRadius) as number) ?? 0;
    const brc = (safeGet(() => node.bottomRightRadius) as number) ?? 0;
    const bl = (safeGet(() => node.bottomLeftRadius) as number) ?? 0;
    if (tl + tr + brc + bl > 0) {
      appearance.push({ label: 'Corner radius', value: `↖${tl}  ↗${tr}  ↘${brc}  ↙${bl}` });
    }
  }

  // Opacity
  const opacity = safeGet(() => node.opacity);
  if (opacity !== undefined && (opacity as number) < 1) {
    appearance.push({ label: 'Opacity', value: `${Math.round((opacity as number) * 100)}%` });
  }

  // Effects
  const effects = safeGet(() => node.effects);
  if (effects && typeof effects !== 'symbol' && Array.isArray(effects)) {
    (effects as any[]).filter((e: any) => e.visible !== false).forEach((e: any) => {
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const lbl = e.type === 'DROP_SHADOW' ? 'Drop shadow' : 'Inner shadow';
        const r = Math.round((e.color?.r ?? 0) * 255);
        const g = Math.round((e.color?.g ?? 0) * 255);
        const b = Math.round((e.color?.b ?? 0) * 255);
        const a = Number(e.color?.a ?? 1).toFixed(2);
        appearance.push({ label: lbl, value: `${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px  rgba(${r},${g},${b},${a})` });
      } else if (e.type === 'LAYER_BLUR') {
        appearance.push({ label: 'Blur', value: `${e.radius}px` });
      } else if (e.type === 'BACKGROUND_BLUR') {
        appearance.push({ label: 'Bg blur', value: `${e.radius}px` });
      }
    });
  }

  // Blend mode
  const blendMode = safeGet(() => node.blendMode);
  if (blendMode && typeof blendMode !== 'symbol' && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') {
    appearance.push({ label: 'Blend mode', value: String(blendMode).toLowerCase().replace(/_/g, ' ') });
  }

  // ── Typography ────────────────────────────────────────────────────────────
  if (safeGet(() => node.type) === 'TEXT') {
    const fn = safeGet(() => node.fontName);
    if (fn && typeof fn !== 'symbol') {
      typography.push({ label: 'Font', value: `${(fn as any).family}  ${(fn as any).style}` });
    }
    const fs = safeGet(() => node.fontSize);
    if (fs !== undefined && typeof fs !== 'symbol') typography.push({ label: 'Size', value: `${fs}px` });
    const lh = safeGet(() => node.lineHeight);
    if (lh && typeof lh !== 'symbol') {
      const lhv = lh as any;
      if (lhv.unit === 'PIXELS') typography.push({ label: 'Line height', value: `${Math.round(lhv.value)}px` });
      else if (lhv.unit === 'PERCENT') typography.push({ label: 'Line height', value: `${Math.round(lhv.value)}%` });
      else if (lhv.unit === 'AUTO') typography.push({ label: 'Line height', value: 'Auto' });
    }
    const ls = safeGet(() => node.letterSpacing);
    if (ls && typeof ls !== 'symbol' && (ls as any).value !== 0) {
      typography.push({ label: 'Letter spacing', value: `${(ls as any).value}${(ls as any).unit === 'PIXELS' ? 'px' : '%'}` });
    }
    const td = safeGet(() => node.textDecoration);
    if (td && typeof td !== 'symbol' && td !== 'NONE') {
      typography.push({ label: 'Decoration', value: String(td).toLowerCase() });
    }
    const tc = safeGet(() => node.textCase);
    if (tc && typeof tc !== 'symbol' && tc !== 'ORIGINAL') {
      typography.push({ label: 'Transform', value: String(tc).toLowerCase().replace(/_/g, ' ') });
    }
  }

  return { position, autoLayout, appearance, typography };
}

// ── Extract node specs with Figma-style labels ────────────────────────────────

function extractNodeSpecsWithIcons(node: any): NodeSpecs {
  const specs = extractNodeSpecs(node);

  // Use Figma-style descriptive labels instead of Unicode icons
  // These match the terminology Figma uses in their UI
  const labelMap: Record<string, string> = {
    'Direction': 'DIRECTION',
    'Wrap': 'WRAP',
    'Primary axis align': 'PRIMARY AXIS ALIGN',
    'Counter axis align': 'COUNTER AXIS ALIGN',
    'Gap': 'GAP',
    'Row gap': 'ROW GAP',
    'Padding': 'PADDING',
    'Clip content': 'CLIP',
    'Width': 'WIDTH',
    'Height': 'HEIGHT',
  };

  specs.autoLayout = specs.autoLayout.map(spec => ({
    ...spec,
    label: labelMap[spec.label] || spec.label,
  }));

  return specs;
}

// ── Component property definitions (all types) ────────────────────────────────

interface CompPropDef { label: string; value: string; kind: string; }

function extractAllComponentProperties(node: any): CompPropDef[] {
  const props: CompPropDef[] = [];
  try {
    const defs = safeGet(() => node.componentPropertyDefinitions);
    if (!defs || typeof defs !== 'object') return props;

    for (const [key, def] of Object.entries(defs as Record<string, any>)) {
      const kind = def.type as string;
      const cleanKey = key.replace(/#\d+:?\d*$/g, '').replace(/_/g, ' ').trim();

      if (kind === 'VARIANT') {
        const values: string[] = def.variantOptions || [];
        props.push({ label: cleanKey, value: values.join('  ·  ') || '—', kind: 'Variant' });
      } else if (kind === 'BOOLEAN') {
        const defaultVal = def.defaultValue !== undefined ? (def.defaultValue ? 'true' : 'false') : '—';
        props.push({ label: cleanKey, value: defaultVal, kind: 'Boolean' });
      } else if (kind === 'TEXT') {
        const val = def.defaultValue !== undefined ? String(def.defaultValue) : '—';
        props.push({ label: cleanKey, value: val || '(empty)', kind: 'Text' });
      } else if (kind === 'INSTANCE_SWAP') {
        const preferred: any[] = def.preferredValues || [];
        const val = preferred.length > 0
          ? preferred.map((p: any) => p.key || p.name || '—').join(', ')
          : '—';
        props.push({ label: cleanKey, value: val, kind: 'Instance' });
      }
    }
  } catch (_) {}
  return props;
}

// ── Unique token names ────────────────────────────────────────────────────────

function uniqueTokenNames(bindings: any[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of bindings) {
    const n = (t.tokenName || t.name || t.token || '').trim();
    if (n && !seen.has(n)) { seen.add(n); result.push(n); }
    if (result.length >= limit) break;
  }
  return result;
}

// ── Anatomy diagram ───────────────────────────────────────────────────────────
//
// Badges are placed adjacent to the component (not at diagram edges),
// with short ~40px stub lines connecting to the component boundary.

// Extract all nodes from a component instance recursively
function extractAllNodesFromInstance(node: any): any[] {
  const allNodes: any[] = [];

  function traverse(n: any): void {
    if (!n) return;

    // Add current node if it's a meaningful structural element
    if (n.type && n.name && !n.name.includes('=')) {
      const types = ['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'TEXT', 'VECTOR', 'RECTANGLE', 'ELLIPSE', 'BUTTON', 'SHAPE'];
      if (types.includes(n.type)) {
        allNodes.push({
          name: n.name,
          type: n.type,
          id: n.id,
          x: n.x || 0,
          y: n.y || 0,
          width: n.width || 0,
          height: n.height || 0,
        });
      }
    }

    // Traverse children
    if (n.children && Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return allNodes;
}

function createAnatomyDiagram(
  parent: FrameNode,
  selectedNode: any,
  anatomy: any[],
  width: number
): void {
  // If anatomy is empty or incomplete, try to extract from the selected node directly
  let anatomyToUse = anatomy;
  if (!anatomyToUse || anatomyToUse.length < 3) {
    // Get all nodes from the instance for more complete anatomy
    const defaultVariant = safeGet(() => selectedNode.defaultVariant);
    const sourceNode = defaultVariant || selectedNode;
    const allInstanceNodes = extractAllNodesFromInstance(sourceNode);

    if (allInstanceNodes.length > 0) {
      anatomyToUse = allInstanceNodes.map((n: any) => ({
        name: n.name,
        description: '',
        nodeId: n.id,
        nodeType: n.type,
      }));
    }
  }

  if (!anatomyToUse || anatomyToUse.length === 0) return;

  const BADGE = 20;
  const STUB = 40;        // horizontal distance from component edge to badge
  const PADDING_V = 32;

  try {
    // ── 1. Create instance ──────────────────────────────────────────────────
    let instance: InstanceNode | null = null;
    if (selectedNode.type === 'COMPONENT_SET') {
      const dv = safeGet(() => selectedNode.defaultVariant);
      if (dv) instance = (dv as any).createInstance();
    } else if (selectedNode.type === 'COMPONENT') {
      instance = selectedNode.createInstance();
    }
    if (!instance) return;

    const instW = instance.width;
    const instH = instance.height;

    // Safety check: if dimensions are variable-bound symbols, skip diagram
    if (typeof instW !== 'number' || typeof instH !== 'number') return;

    // ── 2. Size the diagram frame ───────────────────────────────────────────
    const badgesEachSide = Math.ceil(anatomy.length / 2);
    const minHForBadges = badgesEachSide * (BADGE + 8) + PADDING_V * 2;
    // Ensure minimum height of 400px to show complex component content properly
    const diagramH = Math.max(instH + PADDING_V * 2, minHForBadges, 400);

    // Ensure diagram width accommodates badges on both sides
    const minWidthForBadges = instW + (STUB + BADGE) * 2 + PADDING_V * 2;
    const diagramW = Math.max(width, minWidthForBadges);

    const diagram = figma.createFrame();
    diagram.name = 'Anatomy Diagram';
    diagram.resize(diagramW, diagramH);
    diagram.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99 } }];
    diagram.strokes = [{ type: 'SOLID', color: DESIGN.colors.border }];
    diagram.strokeWeight = 1;
    diagram.cornerRadius = DESIGN.radius.md;
    parent.appendChild(diagram);
    diagram.layoutSizingHorizontal = 'FILL';

    // ── 3. Place instance centred ───────────────────────────────────────────
    const instX = Math.round((diagramW - instW) / 2);
    const instY = Math.round((diagramH - instH) / 2);
    diagram.appendChild(instance);
    instance.x = instX;
    instance.y = instY;

    // ── 4. Helper: find any node in instance tree by name (recursive) ──────────
    function findNodeInTree(nodes: any[], targetName: string): any | null {
      if (!nodes) return null;
      for (const node of nodes) {
        if (node.name?.toLowerCase().trim() === targetName.toLowerCase().trim()) return node;
        if (node.children) {
          const found = findNodeInTree(node.children, targetName);
          if (found) return found;
        }
      }
      return null;
    }

    // ── 5. Gather all nodes from instance (flattened) ─────────────────────────
    const allInstNodes: any[] = [];
    function collectAllNodes(nodes: any[]): void {
      if (!nodes) return;
      for (const node of nodes) {
        allInstNodes.push(node);
        if (node.children) collectAllNodes(node.children);
      }
    }
    const instChildren = Array.from(safeGet(() => instance!.children) || []) as any[];
    collectAllNodes(instChildren);

    // ── 6. Pre-compute badge Y positions (peripheral stacking) ───────────────
    // Place badges on edges in a peripheral pattern (like Specs plugin)
    const leftBadgeYs: number[] = [];
    const rightBadgeYs: number[] = [];
    const badgeSpacing = BADGE + 10;
    const totalBadges = anatomyToUse.length;
    const badgesPerSide = Math.ceil(totalBadges / 2);

    // Calculate centered vertical distribution for each side
    const availHeight = diagramH - PADDING_V * 2;
    const totalHeightNeeded = (badgesPerSide - 1) * badgeSpacing + BADGE;
    const topOffset = PADDING_V + Math.max(0, (availHeight - totalHeightNeeded) / 2);

    for (let i = 0; i < badgesPerSide; i++) {
      leftBadgeYs.push(Math.round(topOffset + i * badgeSpacing));
      rightBadgeYs.push(Math.round(topOffset + i * badgeSpacing));
    }

    // ── 7. Draw leaders and badges ───────────────────────────────────────────
    let li = 0;
    let ri = 0;
    const LINE_WIDTH = 2;

    anatomyToUse.slice(0, 12).forEach((part, idx) => {
      try {
        const partName = (part.name || part.partName || '').toLowerCase().trim();
        // First try exact match in direct children, then search full tree
        let target = instChildren.find((c: any) => c.name?.toLowerCase().trim() === partName);
        if (!target) {
          target = findNodeInTree(instChildren, partName);
        }
        if (!target && idx < instChildren.length) {
          target = instChildren[idx];
        }

        const goLeft = idx % 2 === 0;
        const badgeY = goLeft ? leftBadgeYs[li++] : rightBadgeYs[ri++];
        const badgeCY = badgeY + BADGE / 2;

        // Component edge (left or right boundary) — where the dot sits
        const edgeX = goLeft ? instX : instX + instW;

        // Badge X: STUB away from component edge (not at diagram edge)
        const badgeX = goLeft ? instX - STUB - BADGE : instX + instW + STUB;
        const badgeCenterX = badgeX + BADGE / 2;

        // Part vertical centre — more accurate calculation
        let partCY = instY + instH / 2;
        if (target) {
          const targetTop = target.y ?? 0;
          const targetHeight = target.height ?? instH;
          partCY = instY + targetTop + targetHeight / 2;
        }

        // Endpoint dot at component edge (7px circle)
        const dot = figma.createEllipse();
        dot.resize(7, 7);
        dot.x = Math.round(edgeX - 3.5);
        dot.y = Math.round(partCY - 3.5);
        dot.fills = [{ type: 'SOLID', color: DESIGN.colors.primary }];
        diagram.appendChild(dot);

        // Draw L-shaped connector: horizontal then vertical
        // Horizontal: from component edge to stub distance
        const hLen = STUB;
        const hLine = figma.createRectangle();
        hLine.resize(hLen, LINE_WIDTH);
        if (goLeft) {
          hLine.x = Math.round(edgeX - hLen);
        } else {
          hLine.x = Math.round(edgeX);
        }
        hLine.y = Math.round(partCY - LINE_WIDTH / 2);
        hLine.fills = [{ type: 'SOLID', color: DESIGN.colors.primary }];
        diagram.appendChild(hLine);

        // Vertical: from part center level to badge center level
        if (Math.abs(partCY - badgeCY) > 2) {
          const vLen = Math.round(Math.abs(partCY - badgeCY));
          const vLine = figma.createRectangle();
          vLine.resize(LINE_WIDTH, vLen);
          const vX = goLeft ? edgeX - hLen : edgeX + hLen;
          vLine.x = Math.round(vX - LINE_WIDTH / 2);
          vLine.y = Math.round(Math.min(partCY, badgeCY));
          vLine.fills = [{ type: 'SOLID', color: DESIGN.colors.primary }];
          diagram.appendChild(vLine);
        }

        // Final horizontal: from the vertical connector to badge center
        const finalHX = goLeft ? edgeX - hLen : edgeX + hLen;
        const finalLen = Math.abs(badgeCenterX - finalHX);
        if (finalLen > 1) {
          const finalH = figma.createRectangle();
          finalH.resize(finalLen, LINE_WIDTH);
          finalH.x = Math.round(Math.min(finalHX, badgeCenterX));
          finalH.y = Math.round(badgeCY - LINE_WIDTH / 2);
          finalH.fills = [{ type: 'SOLID', color: DESIGN.colors.primary }];
          diagram.appendChild(finalH);
        }

        // Badge circle
        const badge = figma.createFrame();
        badge.name = `Callout ${idx + 1}`;
        badge.resize(BADGE, BADGE);
        badge.cornerRadius = BADGE / 2;
        badge.fills = [{ type: 'SOLID', color: DESIGN.colors.primary }];
        badge.effects = [{
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.18 },
          offset: { x: 0, y: 1 },
          radius: 3,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL',
        }];
        badge.x = Math.round(badgeX);
        badge.y = Math.round(badgeY);
        badge.layoutMode = 'VERTICAL';
        badge.primaryAxisAlignItems = 'CENTER';
        badge.counterAxisAlignItems = 'CENTER';
        badge.primaryAxisSizingMode = 'FIXED';
        badge.counterAxisSizingMode = 'FIXED';

        const num = figma.createText();
        num.fontName = { family: DESIGN.typography.fontFamily, style: DESIGN.typography.weights.bold };
        num.fontSize = 9;
        num.characters = String(idx + 1);
        num.fills = [{ type: 'SOLID', color: DESIGN.colors.white }];
        num.textAutoResize = 'WIDTH_AND_HEIGHT';
        badge.appendChild(num);
        diagram.appendChild(badge);

      } catch (_) { /* skip individual annotation on error */ }
    });

  } catch (_) { /* skip entire diagram on failure */ }
}

// ── Per-anatomy-part spec chips ───────────────────────────────────────────────

function renderPartSpecs(
  parent: FrameNode,
  nodeId: string | undefined,
  nodeName: string,
  selectedNode: any
): void {
  try {
    let actualNode: any = null;

    if (nodeId) actualNode = safeGet(() => figma.getNodeById(nodeId));

    if (!actualNode) {
      let searchRoot: any = selectedNode;
      if (selectedNode.type === 'COMPONENT_SET') {
        searchRoot = safeGet(() => selectedNode.defaultVariant) || selectedNode;
      }
      const children = Array.from(safeGet(() => searchRoot.children) || []) as any[];
      actualNode = children.find((c: any) => c.name?.toLowerCase().trim() === nodeName.toLowerCase().trim());
    }

    if (!actualNode) return;

    const { autoLayout, appearance, typography } = extractNodeSpecs(actualNode);
    const filteredAutoLayout = autoLayout.filter(spec =>
      !spec.label.includes('PRIMARY') && !spec.label.includes('COUNTER')
    );
    const allSpecs = [...typography, ...filteredAutoLayout, ...appearance];
    if (allSpecs.length === 0) return;

    const chipsRow = createFrame(parent, 'Part Specs', {
      autoLayout: true,
      layoutMode: 'HORIZONTAL',
      spacing: 8,
      padding: DESIGN.spacing.sm,
      cornerRadius: DESIGN.radius.sm,
    });
    chipsRow.layoutSizingHorizontal = 'FILL';
    chipsRow.counterAxisAlignItems = 'CENTER';
    chipsRow.layoutWrap = 'WRAP';
    chipsRow.itemReverseZIndex = false;
    (chipsRow as any).counterAxisSpacing = 8;

    allSpecs.slice(0, 8).forEach(({ label, value }) => {
      const chip = createFrame(chipsRow, 'Spec Chip', {
        autoLayout: true,
        layoutMode: 'HORIZONTAL',
        spacing: 3,
        padding: { top: 2, right: 6, bottom: 2, left: 6 },
        background: { r: 0.93, g: 0.95, b: 0.99 },
        cornerRadius: DESIGN.radius.sm,
      });
      createText(chip, label, {
        fontSize: DESIGN.typography.sizes.xs,
        fontWeight: DESIGN.typography.weights.medium,
        color: DESIGN.colors.textTertiary,
      });
      createText(chip, value, {
        fontSize: DESIGN.typography.sizes.xs,
        fontWeight: DESIGN.typography.weights.regular,
        color: DESIGN.colors.text,
      });
    });
  } catch (_) { /* skip on any error */ }
}

// ── Smart positioning: find optimal placement for new document ────────────────

function findOptimalDocPosition(currentPage: PageNode, selectedNode: any | undefined): { x: number; y: number } {
  const MARGIN = 80; // Increased margin to avoid overlaps
  const DEFAULT_X = 100;
  const DEFAULT_Y = 100;

  // Find the rightmost x position across all frames on the page
  let maxRightX = 0;

  function findRightmostX(node: any): void {
    if (!node) return;

    // Check all nodes for position data
    if (node.x !== undefined && node.width !== undefined) {
      const rightX = node.x + node.width;
      if (rightX > maxRightX) {
        maxRightX = rightX;
      }
    }

    // Recurse into all children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any) => findRightmostX(child));
    }
  }

  // Scan entire page
  findRightmostX(currentPage);

  // If we found any elements, position to the right
  if (maxRightX > 0) {
    return { x: Math.round(maxRightX + MARGIN), y: DEFAULT_Y };
  }

  // Fallback: default position
  return { x: DEFAULT_X, y: DEFAULT_Y };
}

// ── Main render ───────────────────────────────────────────────────────────────

export async function renderFigmaPage(
  components: any[],
  selectedNode?: any,
  foundations?: any
): Promise<string> {
  const currentPage = figma.currentPage;
  if (!currentPage) throw new Error('No active page in Figma');

  await loadFont(DESIGN.typography.fontFamily, DESIGN.typography.weights.regular);
  await loadFont(DESIGN.typography.fontFamily, DESIGN.typography.weights.medium);
  await loadFont(DESIGN.typography.fontFamily, DESIGN.typography.weights.semibold);
  await loadFont(DESIGN.typography.fontFamily, DESIGN.typography.weights.bold);

  // Use smart positioning to place document to the right of existing docs
  const position = findOptimalDocPosition(currentPage, selectedNode);
  const componentName = selectedNode?.name || components?.[0]?.name || 'Component';
  const isSingleComponent = !components || components.length <= 1;
  const sectionWidth = DOC_WIDTH - DOC_PADDING * 2;

  // ── Document container ────────────────────────────────────────────────────
  const docContainer = createFrame(currentPage, `${componentName} — Specs`, {
    width: DOC_WIDTH,
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN.spacing.xl,
    padding: DOC_PADDING,
    background: DESIGN.colors.white,
  });
  docContainer.x = position.x;
  docContainer.y = position.y;

  // ── Header ────────────────────────────────────────────────────────────────
  const firstDesc = isSingleComponent ? (components?.[0]?.description || undefined) : undefined;
  await createDocHeader(docContainer, componentName, firstDesc, sectionWidth);

  // ── Metadata row ──────────────────────────────────────────────────────────
  {
    const items: string[] = [];
    if (selectedNode?.type === 'COMPONENT_SET') {
      items.push('Component Set');
      const vc = safeGet(() => (selectedNode.children || []).length);
      if (vc) items.push(`${vc} variants`);
    } else if (selectedNode?.type === 'COMPONENT') {
      items.push('Component');
    }
    const anatCount = components?.[0]?.anatomy?.length || 0;
    if (anatCount) items.push(`${anatCount} anatomy parts`);

    if (items.length) {
      createText(docContainer, items.join('  ·  '), {
        fontSize: DESIGN.typography.sizes.xs,
        fontWeight: DESIGN.typography.weights.regular,
        color: DESIGN.colors.textTertiary,
      });
    }
  }

  if (!components || components.length === 0) return currentPage.id;

  const specSource: any = selectedNode
    ? (selectedNode.type === 'COMPONENT_SET'
        ? (safeGet(() => selectedNode.defaultVariant) || selectedNode)
        : selectedNode)
    : null;

  // ── 1. Anatomy (moved first for better scannability) ────────────────────────
  if (isSingleComponent && components.length > 0) {
    let anatomy: any[] = components[0].anatomy || [];

    // If anatomy is incomplete (< 3 parts), extract from instance
    if (anatomy.length < 3 && selectedNode) {
      try {
        const sourceNode = selectedNode.type === 'COMPONENT_SET'
          ? (safeGet(() => selectedNode.defaultVariant) || selectedNode)
          : selectedNode;
        const allInstanceNodes = extractAllNodesFromInstance(sourceNode);
        if (allInstanceNodes.length > 0) {
          anatomy = allInstanceNodes.map((n: any) => ({
            name: n.name,
            description: '',
            nodeId: n.id,
            nodeType: n.type,
          }));
        }
      } catch (_) { /* use original anatomy */ }
    }

    if (anatomy.length > 0) {
      const anatomySection = await createDocSection(docContainer, 'Anatomy', sectionWidth);

      if (selectedNode) {
        createAnatomyDiagram(anatomySection, selectedNode, anatomy, sectionWidth);
      }

      const anatomyList = createFrame(anatomySection, 'Anatomy List', {
        autoLayout: true,
        layoutMode: 'VERTICAL',
        spacing: DESIGN.spacing.xs,
      });
      anatomyList.layoutSizingHorizontal = 'FILL';

      anatomy.slice(0, 20).forEach((part, i) => {
        const label = part.name || part.partName || '—';
        const role = part.description || part.role || '';
        const nodeType = (part.nodeType || '').toUpperCase();

        const card = createFrame(anatomyList, `Anatomy ${i + 1}`, {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: DESIGN.spacing.md,
          padding: { top: DESIGN.spacing.sm, right: DESIGN.spacing.md, bottom: DESIGN.spacing.sm, left: DESIGN.spacing.md },
          background: DESIGN.colors.white,
          cornerRadius: DESIGN.radius.sm,
          borderColor: DESIGN.colors.border,
          borderWidth: 1,
        });
        card.layoutSizingHorizontal = 'FILL';
        card.counterAxisAlignItems = 'MIN';

        const numBadge = createFrame(card, 'Num', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          padding: { top: 2, right: 0, bottom: 0, left: 0 },
        });
        createText(numBadge, String(i + 1).padStart(2, '0'), {
          fontSize: DESIGN.typography.sizes.xs,
          fontWeight: DESIGN.typography.weights.bold,
          color: DESIGN.colors.primary,
          width: 20,
        });

        const content = createFrame(card, 'Content', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          spacing: 4,
        });
        content.layoutSizingHorizontal = 'FILL';

        const nameRow = createFrame(content, 'Name Row', {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: DESIGN.spacing.xs,
        });
        nameRow.layoutSizingHorizontal = 'FILL';
        nameRow.counterAxisAlignItems = 'CENTER';

        createText(nameRow, label, {
          fontSize: DESIGN.typography.sizes.sm,
          fontWeight: DESIGN.typography.weights.semibold,
          color: DESIGN.colors.text,
        });

        if (nodeType) {
          const typeTag = createFrame(nameRow, 'Type Tag', {
            autoLayout: true,
            layoutMode: 'HORIZONTAL',
            spacing: 0,
            padding: { top: 2, right: 6, bottom: 2, left: 6 },
            background: { r: 0.93, g: 0.95, b: 0.99 },
              cornerRadius: DESIGN.radius.sm,
          });
          createText(typeTag, nodeType, {
            fontSize: 9,
            fontWeight: DESIGN.typography.weights.medium,
            color: DESIGN.colors.primary,
          });
        }

        if (role) {
          const roleFrame = createFrame(content, 'Role', {
            autoLayout: true,
            layoutMode: 'VERTICAL',
            spacing: 0,
          });
          roleFrame.layoutSizingHorizontal = 'FILL';
          roleFrame.layoutSizingVertical = 'HUG';
          const roleT = createText(roleFrame, role, {
            fontSize: DESIGN.typography.sizes.xs,
            fontWeight: DESIGN.typography.weights.regular,
            color: DESIGN.colors.textSecondary,
          });
          roleT.layoutSizingHorizontal = 'FILL';
          roleT.layoutSizingVertical = 'HUG';
          roleT.textAutoResize = 'NONE';
        }

        if (selectedNode) {
          renderPartSpecs(content, part.nodeId, label, selectedNode);
        }
      });

      if (anatomy.length > 20) {
        createText(anatomySection, `+ ${anatomy.length - 20} more parts`, {
          fontSize: DESIGN.typography.sizes.xs,
          fontWeight: DESIGN.typography.weights.regular,
          color: DESIGN.colors.textTertiary,
        });
      }
    }
  }

  // ── 2. Properties (all component property definitions) ────────────────────
  const variantGroups: any[] = components[0]?.variantGroups || [];
  const variantCombinations: string[] = components[0]?.variantCombinations || [];

  if (specSource) {
    const allProps = extractAllComponentProperties(specSource);
    if (allProps.length > 0) {
      const propsSection = await createDocSection(docContainer, 'Properties', sectionWidth);

      const propCards = allProps.map((p: any) => ({
        label: p.label || '—',
        value: p.value || '—',
      }));

      await createPropertyCards(propsSection, propCards);
    }
  }

  // ── 3. Variants Table with previews ─────────────────────────────────────────
  if (variantCombinations.length > 0 && selectedNode) {
    const variantsSection = await createDocSection(docContainer, 'Variants', sectionWidth);

    // Create variant previews
    try {
      const previewSize = 120; // Max preview dimension
      const variantInstances: Array<{ instance: InstanceNode; label: string }> = [];

      // Get all variants from component set
      if (selectedNode.type === 'COMPONENT_SET' && selectedNode.children) {
        const variantNodes = Array.from(selectedNode.children as any[]);
        variantNodes.slice(0, 12).forEach((vNode) => {
          try {
            if (vNode && (vNode.type === 'COMPONENT' || vNode.type === 'COMPONENT_SET')) {
              const inst = (vNode as any).createInstance?.();
              if (inst) {
                variantInstances.push({
                  instance: inst,
                  label: vNode.name || 'Variant',
                });
              }
            }
          } catch (_) { /* skip on error */ }
        });
      }

      // Render variant previews (working version) + integrated detail cards
      const previewGrid = createFrame(variantsSection, 'Variants Grid', {
        autoLayout: true,
        layoutMode: 'VERTICAL',
        spacing: DESIGN.spacing.lg,
        background: { r: 0.96, g: 0.97, b: 0.99 },
        cornerRadius: DESIGN.radius.md,
        padding: DESIGN.spacing.md,
      });
      previewGrid.layoutSizingHorizontal = 'FILL';

      variantInstances.slice(0, 6).forEach((variant, idx) => {
        // Create wrapper for variant (instance + card)
        const variantWrapper = createFrame(previewGrid, `Variant ${idx + 1}`, {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          spacing: 16,
          padding: 16,
        });
        variantWrapper.layoutSizingHorizontal = 'FILL';

        // Append instance to wrapper FIRST
        variantWrapper.appendChild(variant.instance);

        // THEN set sizing properties
        variant.instance.layoutSizingHorizontal = 'FILL';
        variant.instance.layoutSizingVertical = 'HUG';

        // Detail card with variant combination
        if (idx < variantCombinations.length) {
          const card = createFrame(variantWrapper, `Details ${idx + 1}`, {
            autoLayout: true,
            layoutMode: 'HORIZONTAL',
            spacing: DESIGN.spacing.md,
            padding: { top: DESIGN.spacing.sm, right: DESIGN.spacing.md, bottom: DESIGN.spacing.sm, left: DESIGN.spacing.md },
            background: DESIGN.colors.white,
            cornerRadius: DESIGN.radius.sm,
            borderColor: DESIGN.colors.border,
            borderWidth: 1,
          });
          card.layoutSizingHorizontal = 'FILL';

          const numBadge = createFrame(card, 'Num', {
            autoLayout: true,
            layoutMode: 'HORIZONTAL',
            spacing: 0,
            padding: { top: 2, right: 6, bottom: 2, left: 6 },
              cornerRadius: DESIGN.radius.sm,
          });
          createText(numBadge, String(idx + 1).padStart(2, '0'), {
            fontSize: 10,
            fontWeight: DESIGN.typography.weights.semibold,
            color: DESIGN.colors.primary,
          });

          const text = createText(card, variantCombinations[idx], {
            fontSize: DESIGN.typography.sizes.sm,
            fontWeight: DESIGN.typography.weights.regular,
            color: DESIGN.colors.text,
          });
          text.layoutSizingHorizontal = 'FILL';
        }
      });
    } catch (_) {
      // Fallback: just show text list without previews
      const variantsList = createFrame(variantsSection, 'Variants List', {
        autoLayout: true,
        layoutMode: 'VERTICAL',
        spacing: DESIGN.spacing.xs,
      });
      variantsList.layoutSizingHorizontal = 'FILL';

      variantCombinations.forEach((combo, idx) => {
        const card = createFrame(variantsList, `Variant ${idx + 1}`, {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: DESIGN.spacing.md,
          padding: { top: DESIGN.spacing.sm, right: DESIGN.spacing.md, bottom: DESIGN.spacing.sm, left: DESIGN.spacing.md },
          background: DESIGN.colors.white,
          cornerRadius: DESIGN.radius.sm,
          borderColor: DESIGN.colors.border,
          borderWidth: 1,
        });
        card.layoutSizingHorizontal = 'FILL';

        const numBadge = createFrame(card, 'Number', {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: 0,
          padding: { top: 2, right: 6, bottom: 2, left: 6 },
          cornerRadius: DESIGN.radius.sm,
        });
        createText(numBadge, String(idx + 1).padStart(2, '0'), {
          fontSize: 10,
          fontWeight: DESIGN.typography.weights.semibold,
          color: DESIGN.colors.primary,
        });

        const textFrame = createFrame(card, 'Variant Details', {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          padding: { top: DESIGN.spacing.xs, right: DESIGN.spacing.sm, bottom: DESIGN.spacing.xs, left: DESIGN.spacing.sm },
          cornerRadius: DESIGN.radius.sm,
        });
        textFrame.layoutSizingHorizontal = 'FILL';

        const text = createText(textFrame, combo, {
          fontSize: DESIGN.typography.sizes.sm,
          fontWeight: DESIGN.typography.weights.regular,
          color: DESIGN.colors.text,
        });
        text.layoutSizingHorizontal = 'FILL';
      });
    }
  }

  // ── 4. Auto Layout (exclude Direction which is in Properties) ─────────────
  if (specSource) {
    const { autoLayout: alSpecs } = extractNodeSpecsWithIcons(specSource);
    // Filter out Direction since it's already in Properties
    const filteredSpecs = alSpecs.filter((spec: any) => !spec.label.includes('DIRECTION'));
    if (filteredSpecs.length > 0) {
      const alSection = await createDocSection(docContainer, 'Auto Layout', sectionWidth);
      await createPropertyCards(alSection, filteredSpecs.map(s => ({ label: s.label, value: s.value })), true);
    }
  }

  // ── 5. Appearance ─────────────────────────────────────────────────────────
  if (specSource) {
    const { appearance: appSpecs } = extractNodeSpecs(specSource);
    if (appSpecs.length > 0) {
      const appSection = await createDocSection(docContainer, 'Appearance', sectionWidth);
      await createPropertyCards(appSection, appSpecs.map(s => ({ label: s.label, value: s.value })), true);
    }
  }

  // ── Per-component sections ────────────────────────────────────────────────
  for (const component of components) {
    const contentParent = isSingleComponent
      ? docContainer
      : await createDocSection(docContainer, component.name, sectionWidth);

    if (!isSingleComponent && component.description) {
      const t = createText(contentParent, component.description, {
        fontSize: DESIGN.typography.sizes.sm,
        fontWeight: DESIGN.typography.weights.regular,
        color: DESIGN.colors.textSecondary,
        width: sectionWidth,
      });
      t.layoutSizingHorizontal = 'FILL';
    }

    // ── 5. Anatomy (skip if already rendered for single component) ───────────
    const anatomy: any[] = component.anatomy || [];
    if (anatomy.length > 0 && !isSingleComponent) {
      const anatomySection = await createDocSection(contentParent, 'Anatomy', sectionWidth);

      if (selectedNode) {
        createAnatomyDiagram(anatomySection, selectedNode, anatomy, sectionWidth);
      }

      // Anatomy list: card per part with number, name, type tag, description, spec chips
      const anatomyList = createFrame(anatomySection, 'Anatomy List', {
        autoLayout: true,
        layoutMode: 'VERTICAL',
        spacing: DESIGN.spacing.xs,
      });
      anatomyList.layoutSizingHorizontal = 'FILL';

      anatomy.slice(0, 20).forEach((part, i) => {
        const label = part.name || part.partName || '—';
        const role = part.description || part.role || '';
        const nodeType = (part.nodeType || '').toUpperCase();

        const card = createFrame(anatomyList, `Anatomy ${i + 1}`, {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: DESIGN.spacing.md,
          padding: { top: DESIGN.spacing.sm, right: DESIGN.spacing.md, bottom: DESIGN.spacing.sm, left: DESIGN.spacing.md },
          background: DESIGN.colors.white,
          cornerRadius: DESIGN.radius.sm,
          borderColor: DESIGN.colors.border,
          borderWidth: 1,
        });
        card.layoutSizingHorizontal = 'FILL';
        card.counterAxisAlignItems = 'MIN';

        // Number badge (left column)
        const numBadge = createFrame(card, 'Num', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          padding: { top: 2, right: 0, bottom: 0, left: 0 },
        });
        createText(numBadge, String(i + 1).padStart(2, '0'), {
          fontSize: DESIGN.typography.sizes.xs,
          fontWeight: DESIGN.typography.weights.bold,
          color: DESIGN.colors.primary,
          width: 20,
        });

        // Content column (right)
        const content = createFrame(card, 'Content', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          spacing: 4,
        });
        content.layoutSizingHorizontal = 'FILL';

        // Name + type tag on same row
        const nameRow = createFrame(content, 'Name Row', {
          autoLayout: true,
          layoutMode: 'HORIZONTAL',
          spacing: DESIGN.spacing.xs,
        });
        nameRow.layoutSizingHorizontal = 'FILL';
        nameRow.counterAxisAlignItems = 'CENTER';

        const nameText = createText(nameRow, label, {
          fontSize: DESIGN.typography.sizes.sm,
          fontWeight: DESIGN.typography.weights.semibold,
          color: DESIGN.colors.text,
        });
        nameText.layoutSizingHorizontal = 'FILL';
        nameText.layoutSizingVertical = 'FILL';

        if (nodeType) {
          const typeTag = createFrame(nameRow, 'Type Tag', {
            autoLayout: true,
            layoutMode: 'HORIZONTAL',
            spacing: 0,
            padding: { top: 2, right: 6, bottom: 2, left: 6 },
            background: { r: 0.93, g: 0.95, b: 0.99 },
            cornerRadius: DESIGN.radius.sm,
          });
          createText(typeTag, nodeType, {
            fontSize: 9,
            fontWeight: DESIGN.typography.weights.medium,
            color: DESIGN.colors.primary,
          });
        }

        if (role) {
          const roleFrame = createFrame(content, 'Role', {
            autoLayout: true,
            layoutMode: 'HORIZONTAL',
            spacing: 0,
          });
          roleFrame.layoutSizingHorizontal = 'FILL';
          const roleT = createText(roleFrame, role, {
            fontSize: DESIGN.typography.sizes.xs,
            fontWeight: DESIGN.typography.weights.regular,
            color: DESIGN.colors.textSecondary,
          });
          roleT.layoutSizingHorizontal = 'FILL';
        }

        // Figma property chips
        if (selectedNode) {
          renderPartSpecs(content, part.nodeId, label, selectedNode);
        }
      });

      if (anatomy.length > 20) {
        createText(anatomySection, `+ ${anatomy.length - 20} more parts`, {
          fontSize: DESIGN.typography.sizes.xs,
          fontWeight: DESIGN.typography.weights.regular,
          color: DESIGN.colors.textTertiary,
        });
      }
    }

    // ── 6. Design Tokens ──────────────────────────────────────────────────────
    const bindings = component.tokenBindings;
    if (bindings) {
      const colorB: any[] = bindings.colors || [];
      const typoB: any[] = bindings.typography || [];
      const spacingB: any[] = bindings.spacing || [];
      const effectB: any[] = bindings.effects || [];
      const total = colorB.length + typoB.length + spacingB.length + effectB.length;

      if (total > 0) {
        const tokenSection = await createDocSection(contentParent, 'Design Tokens', sectionWidth);
        const tokenProps: Array<{ label: string; value: string }> = [];

        if (colorB.length > 0) {
          tokenProps.push({ label: `Color (${colorB.length})`, value: uniqueTokenNames(colorB).join('\n') || `${colorB.length} bindings` });
        }
        if (typoB.length > 0) {
          tokenProps.push({ label: `Typography (${typoB.length})`, value: uniqueTokenNames(typoB).join('\n') || `${typoB.length} bindings` });
        }
        if (spacingB.length > 0) {
          tokenProps.push({ label: `Spacing (${spacingB.length})`, value: uniqueTokenNames(spacingB).join('\n') || `${spacingB.length} bindings` });
        }
        if (effectB.length > 0) {
          tokenProps.push({ label: `Effects (${effectB.length})`, value: uniqueTokenNames(effectB).join('\n') || `${effectB.length} bindings` });
        }

        await createPropertyGrid(tokenSection, tokenProps, sectionWidth);
      }
    }

    // ── 7. Component Specifications ────────────────────────────────────────────
    // Extract technical specs from component for display
    function extractDisplaySpecs(comp: any): Array<{ label: string; value: string }> {
      const displaySpecs: Array<{ label: string; value: string }> = [];

      try {
        // Get component dimensions
        if (comp.width && comp.height) {
          displaySpecs.push({ label: 'Component size', value: `${Math.round(comp.width)}×${Math.round(comp.height)}px` });
        }

        // Get spacing
        if (comp.itemSpacing) {
          displaySpecs.push({ label: 'Item spacing', value: `${Math.round(comp.itemSpacing)}px` });
        }

        // Extract text elements with specs
        const textElements: Array<{ name: string; fontSize: number; width: number }> = [];
        const seenText = new Set<string>();

        function findTextNodes(nodes: any[]): void {
          if (!nodes) return;
          for (const node of nodes) {
            if (node && node.type === 'TEXT' && node.fontSize) {
              const key = `${node.name}|${node.fontSize}`;
              if (!seenText.has(key)) {
                seenText.add(key);
                textElements.push({
                  name: node.name || 'Text',
                  fontSize: Math.round(node.fontSize),
                  width: node.width ? Math.round(node.width) : 200,
                });
              }
            }
            if (node && node.children) findTextNodes(node.children);
          }
        }

        if (comp.children) findTextNodes(comp.children);

        for (const textElem of textElements) {
          const charWidth = textElem.fontSize * 0.55;
          const maxChars = Math.round(textElem.width / charWidth);
          displaySpecs.push({
            label: textElem.name,
            value: `${textElem.fontSize}px, ~${maxChars} characters`,
          });
        }

        // Extract icon elements with specs
        const iconElements: Array<{ name: string; width: number; height: number }> = [];
        const seenIcons = new Set<string>();

        function findIconNodes(nodes: any[]): void {
          if (!nodes) return;
          for (const node of nodes) {
            if (node && node.name && node.name.toLowerCase().includes('icon') && (node.width || node.height)) {
              const key = `${node.name}|${node.width}|${node.height}`;
              if (!seenIcons.has(key)) {
                seenIcons.add(key);
                iconElements.push({
                  name: node.name,
                  width: node.width ? Math.round(node.width) : 16,
                  height: node.height ? Math.round(node.height) : 16,
                });
              }
            }
            if (node && node.children) findIconNodes(node.children);
          }
        }

        if (comp.children) findIconNodes(comp.children);

        for (const icon of iconElements) {
          displaySpecs.push({
            label: icon.name,
            value: `${icon.width}×${icon.height}px`,
          });
        }

        // Get states from component variants
        if (comp.variants && Object.keys(comp.variants).length > 0) {
          const stateNames = Object.keys(comp.variants)
            .map((name: string) => name.split('/')[0])
            .filter((name: string, index: number, self: string[]) => name && !name.includes('=') && self.indexOf(name) === index)
            .slice(0, 6);
          if (stateNames.length > 0) {
            displaySpecs.push({ label: 'Supported states', value: stateNames.join(', ') });
          }
        }
      } catch (_) {
        // Silent fail
      }

      return displaySpecs;
    }

    const specDetails = extractDisplaySpecs(component);
    if (specDetails.length > 0) {
      const specSection = await createDocSection(contentParent, 'Component Specifications', sectionWidth);
      await createPropertyGrid(specSection, specDetails, sectionWidth);
    }

    // ── 8. Usage ───────────────────────────────────────────────────────────────
    const guidelines = component.usageGuidelines || component.usage;
    const whenToUse: string[] = (guidelines?.when || guidelines?.whenToUse || []).slice(0, 12);
    const whenNotToUse: string[] = (guidelines?.whenNot || guidelines?.whenNotToUse || []).slice(0, 12);

    // Generate dynamic usage guidelines based on component characteristics
    function generateDynamicUsageGuides(comp: any): { whenToUse: string[]; whenNotToUse: string[] } {
      const componentName = (comp.name || '').toLowerCase();
      const hasVariants = (comp.variants && Object.keys(comp.variants).length > 0);
      const isInteractive = componentName.includes('button') || componentName.includes('input') || componentName.includes('select') || componentName.includes('toggle') || componentName.includes('checkbox');
      const isLayout = componentName.includes('container') || componentName.includes('section') || componentName.includes('card') || componentName.includes('list');
      const isTypography = componentName.includes('heading') || componentName.includes('text') || componentName.includes('label') || componentName.includes('caption');
      const isIcon = componentName.includes('icon') || componentName.includes('symbol');

      const uses: string[] = [];
      const notUses: string[] = [];

      // Interactive components
      if (isInteractive) {
        uses.push('Use for user interactions and form inputs');
        uses.push('Maintain consistent behavior across all instances');
        uses.push('Apply appropriate disabled and loading states');
        notUses.push('Do not use for non-interactive visual elements');
        notUses.push('Do not bypass accessibility requirements');
      }

      // Layout components
      if (isLayout) {
        uses.push('Use as containers for organizing content');
        uses.push('Maintain proper spacing and padding for content');
        uses.push('Use responsive properties for different screen sizes');
        notUses.push('Do not force content into inappropriate containers');
        notUses.push('Do not override internal spacing and alignment');
      }

      // Typography components
      if (isTypography) {
        uses.push('Use for consistent text styling across the product');
        uses.push('Apply hierarchy for improved readability');
        uses.push('Maintain proper line heights and letter spacing');
        notUses.push('Do not use for styled text that needs custom formatting');
        notUses.push('Do not modify typography properties arbitrarily');
      }

      // Icon components
      if (isIcon) {
        uses.push('Use to enhance UI with visual clarity and recognition');
        uses.push('Ensure icons have sufficient size for visibility');
        uses.push('Apply consistent color treatment across instances');
        notUses.push('Do not use oversized icons in dense layouts');
        notUses.push('Do not modify icon structure or core shape');
      }

      // Components with variants
      if (hasVariants) {
        uses.push('Leverage variants to adapt to different contexts');
        uses.push('Select appropriate variant for each use case');
        uses.push('Ensure variant changes do not break layout');
        notUses.push('Do not combine multiple variant states inappropriately');
        notUses.push('Do not create new variants; use existing ones');
      }

      // General guidelines
      uses.push('Follow design system documentation and standards');
      uses.push('Test across different viewport sizes and devices');
      notUses.push('Do not ignore component constraints and limitations');
      notUses.push('Do not detach instances unnecessarily');

      return { whenToUse: uses, whenNotToUse: notUses };
    }

    // Add default usage guidelines if needed
    if (whenToUse.length === 0) {
      const dynamicGuides = generateDynamicUsageGuides(component);
      whenToUse.push(...dynamicGuides.whenToUse.slice(0, 12));
    }
    if (whenNotToUse.length === 0) {
      const dynamicGuides = generateDynamicUsageGuides(component);
      whenNotToUse.push(...dynamicGuides.whenNotToUse.slice(0, 12));
    }

    const guidelineSection = await createDocSection(contentParent, 'Usage', sectionWidth);
    const columnsRow = createFrame(guidelineSection, 'Usage Columns', {
      autoLayout: true,
      layoutMode: 'HORIZONTAL',
      spacing: DESIGN.spacing.md,
    });
    columnsRow.layoutSizingHorizontal = 'FILL';

    const doCol = createFrame(columnsRow, 'Do', {
      autoLayout: true,
      layoutMode: 'VERTICAL',
      spacing: DESIGN.spacing.xs,
      padding: DESIGN.spacing.md,
      background: { r: 0.94, g: 0.99, b: 0.96 },
      borderColor: DESIGN.colors.success,
      borderWidth: 1,
      cornerRadius: DESIGN.radius.sm,
    });
    doCol.layoutSizingHorizontal = 'FILL';
    createText(doCol, '✓  When to use', { fontSize: DESIGN.typography.sizes.sm, fontWeight: DESIGN.typography.weights.semibold, color: DESIGN.colors.success });
    for (const item of whenToUse) {
      if (item) {
        const t = createText(doCol, `• ${item}`, { fontSize: DESIGN.typography.sizes.xs, fontWeight: DESIGN.typography.weights.regular, color: DESIGN.colors.text });
        t.layoutSizingHorizontal = 'FILL';
      }
    }

    const dontCol = createFrame(columnsRow, 'Dont', {
      autoLayout: true,
      layoutMode: 'VERTICAL',
      spacing: DESIGN.spacing.xs,
      padding: DESIGN.spacing.md,
      background: { r: 1, g: 0.94, b: 0.94 },
      borderColor: { r: 0.9, g: 0.2, b: 0.2 },
      borderWidth: 1,
      cornerRadius: DESIGN.radius.sm,
    });
    dontCol.layoutSizingHorizontal = 'FILL';
    createText(dontCol, '✕  When not to use', { fontSize: DESIGN.typography.sizes.sm, fontWeight: DESIGN.typography.weights.semibold, color: { r: 0.9, g: 0.1, b: 0.1 } });
    for (const item of whenNotToUse) {
      if (item) {
        const t = createText(dontCol, `• ${item}`, { fontSize: DESIGN.typography.sizes.xs, fontWeight: DESIGN.typography.weights.regular, color: DESIGN.colors.text });
        t.layoutSizingHorizontal = 'FILL';
      }
    }

    // ── 8. Best Practices (Dos & Donts) ────────────────────────────────────────
    const dos: string[] = component.usage?.dos || [];
    const donts: string[] = component.usage?.donts || [];

    if (dos.length > 0 || donts.length > 0) {
      const practicesSection = await createDocSection(contentParent, 'Best Practices', sectionWidth);
      const practicesRow = createFrame(practicesSection, 'Practices Columns', {
        autoLayout: true,
        layoutMode: 'HORIZONTAL',
        spacing: DESIGN.spacing.md,
      });
      practicesRow.layoutSizingHorizontal = 'FILL';

      // Dos column
      if (dos.length > 0) {
        const dosCol = createFrame(practicesRow, 'Dos', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          spacing: DESIGN.spacing.xs,
          padding: DESIGN.spacing.md,
          background: { r: 0.94, g: 0.99, b: 0.96 },
          borderColor: DESIGN.colors.success,
          borderWidth: 1,
          cornerRadius: DESIGN.radius.sm,
        });
        dosCol.layoutSizingHorizontal = 'FILL';
        createText(dosCol, '✓  Do', { fontSize: DESIGN.typography.sizes.sm, fontWeight: DESIGN.typography.weights.semibold, color: DESIGN.colors.success });
        for (const item of dos) {
          if (item) {
            const t = createText(dosCol, `• ${item}`, { fontSize: DESIGN.typography.sizes.xs, fontWeight: DESIGN.typography.weights.regular, color: DESIGN.colors.text });
            t.layoutSizingHorizontal = 'FILL';
          }
        }
      }

      // Donts column
      if (donts.length > 0) {
        const dontsCol = createFrame(practicesRow, 'Donts', {
          autoLayout: true,
          layoutMode: 'VERTICAL',
          spacing: DESIGN.spacing.xs,
          padding: DESIGN.spacing.md,
          background: { r: 1, g: 0.94, b: 0.94 },
          borderColor: { r: 0.9, g: 0.2, b: 0.2 },
          borderWidth: 1,
          cornerRadius: DESIGN.radius.sm,
        });
        dontsCol.layoutSizingHorizontal = 'FILL';
        createText(dontsCol, '✕  Don\'t', { fontSize: DESIGN.typography.sizes.sm, fontWeight: DESIGN.typography.weights.semibold, color: { r: 0.9, g: 0.1, b: 0.1 } });
        for (const item of donts) {
          if (item) {
            const t = createText(dontsCol, `• ${item}`, { fontSize: DESIGN.typography.sizes.xs, fontWeight: DESIGN.typography.weights.regular, color: DESIGN.colors.text });
            t.layoutSizingHorizontal = 'FILL';
          }
        }
      }
    }

    // ── 9. Accessibility ───────────────────────────────────────────────────────
    const a11y = component.accessibility || component.accessibilityNotes;
    const a11ySection = await createDocSection(contentParent, 'Accessibility', sectionWidth);
    const a11yProps: Array<{ label: string; value: string }> = [];

    // Collect accessibility data
    const role = a11y?.role;
    const keyboard = a11y?.keyboardInteraction || a11y?.interactionClarity;
    const aria: string[] = a11y?.ariaAttributes || [];
    const focusable = a11y?.focusable !== undefined ? (a11y.focusable ? 'Yes' : 'No') : '';
    const screenReader = a11y?.screenReaderText || a11y?.screenReaderHint || '';
    const wcag = a11y?.wcagLevel || a11y?.wcagCompliance || 'AA';
    const contrast = a11y?.contrastRatio || a11y?.colorContrast || '4.5:1 (normal text), 3:1 (large text)';
    const focusIndicator = a11y?.focusIndicator || a11y?.focusStyle || '2px solid outline';
    const motionReducing = a11y?.motionReducing || a11y?.reducedMotion !== undefined ? 'Supported' : 'Consider prefers-reduced-motion';
    const semanticHTML = a11y?.semanticHTML || 'Use semantic HTML elements';
    const labelAssociation = a11y?.labelAssociation || 'Labels properly associated with form fields';
    const altText = a11y?.altText || 'Descriptive alt text for images';
    const errorHandling = a11y?.errorHandling || 'Clear error messages and recovery instructions';

    // WCAG 2.1 Criteria
    if (role) a11yProps.push({ label: 'ARIA role', value: String(role) });
    if (focusable) a11yProps.push({ label: 'Focusable', value: focusable });

    a11yProps.push({ label: 'Keyboard interaction', value: keyboard || 'Tab: focus | Enter/Space: activate | Esc: close' });
    a11yProps.push({ label: 'Focus indicator', value: String(focusIndicator) });

    if (aria.length > 0) {
      a11yProps.push({ label: 'ARIA attributes', value: aria.slice(0, 10).join('\n') });
    } else {
      a11yProps.push({ label: 'ARIA attributes', value: 'aria-label, aria-describedby, aria-expanded, aria-disabled' });
    }

    a11yProps.push({ label: 'Screen reader', value: screenReader || 'Announced clearly with context' });
    a11yProps.push({ label: 'WCAG 2.1 target', value: wcag });
    a11yProps.push({ label: 'Color contrast', value: String(contrast) });
    a11yProps.push({ label: 'Reduced motion', value: motionReducing });
    a11yProps.push({ label: 'Semantic HTML', value: semanticHTML });
    a11yProps.push({ label: 'Label association', value: labelAssociation });
    a11yProps.push({ label: 'Alternative text', value: altText });
    a11yProps.push({ label: 'Error handling', value: errorHandling });

    await createPropertyGrid(a11ySection, a11yProps, sectionWidth);
  }

  return currentPage.id;
}
