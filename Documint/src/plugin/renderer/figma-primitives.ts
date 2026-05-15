// ─── Figma Documentation Primitives ─────────────────────────────────────────
// Reusable components for building polished documentation pages inside Figma

import type { RootManifest } from '@/types/schemas';

// ─── Design System ──────────────────────────────────────────────────────────

const DESIGN_SYSTEM = {
  colors: {
    text: { r: 0.13, g: 0.13, b: 0.13 }, // #212121
    textSecondary: { r: 0.5, g: 0.5, b: 0.5 }, // #808080
    textTertiary: { r: 0.7, g: 0.7, b: 0.7 }, // #B3B3B3
    border: { r: 0.92, g: 0.92, b: 0.92 }, // #EBEBEB
    background: { r: 0.98, g: 0.98, b: 0.98 }, // #FAFAFA
    white: { r: 1, g: 1, b: 1 },
    primary: { r: 0, g: 0.4, b: 1 }, // #0066FF
    success: { r: 0, g: 0.6, b: 0.3 }, // #009933
    warning: { r: 1, g: 0.6, b: 0 }, // #FF9900
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  typography: {
    fontFamily: 'Inter',
    weights: {
      regular: 'Regular',
      medium: 'Medium',
      semibold: 'Semi Bold',
      bold: 'Bold',
    },
    sizes: {
      xs: 10,
      sm: 11,
      base: 12,
      lg: 14,
      xl: 16,
      xxl: 20,
      xxxl: 28,
    },
    lineHeights: {
      xs: 14,
      sm: 16,
      base: 18,
      lg: 20,
      xl: 24,
      xxl: 28,
      xxxl: 36,
    },
  },
};

// ─── Utility Functions ──────────────────────────────────────────────────────

export async function loadFont(family: string, style: string) {
  try {
    await figma.loadFontAsync({ family, style });
  } catch (e) {
    console.warn(`Failed to load font: ${family} ${style}`);
  }
}

export function createText(
  parent: FrameNode,
  content: string,
  options: {
    fontSize?: number;
    fontWeight?: string;
    color?: { r: number; g: number; b: number };
    width?: number;
    lineHeight?: number;
  }
): TextNode {
  const text = figma.createText();
  text.fontName = {
    family: DESIGN_SYSTEM.typography.fontFamily,
    style: options.fontWeight || DESIGN_SYSTEM.typography.weights.regular,
  };
  text.fontSize = options.fontSize || DESIGN_SYSTEM.typography.sizes.base;
  text.characters = content || ' ';
  if (options.color) {
    text.fills = [{ type: 'SOLID', color: options.color }];
  }
  if (options.width) {
    text.resize(options.width, 100);
    text.textAutoResize = 'HEIGHT';
  } else {
    // For text without explicit width in auto-layout frames, allow wrapping by setting NONE
    // The parent frame's auto-layout will control sizing
    text.textAutoResize = 'NONE';
  }
  if (options.lineHeight) {
    text.lineHeight = { value: options.lineHeight, unit: 'PIXELS' };
  }
  parent.appendChild(text);
  return text;
}

export function createFrame(
  parent: FrameNode | PageNode,
  name: string,
  options: {
    width?: number;
    height?: number;
    background?: { r: number; g: number; b: number };
    borderColor?: { r: number; g: number; b: number };
    borderWidth?: number;
    cornerRadius?: number;
    autoLayout?: boolean;
    layoutMode?: 'HORIZONTAL' | 'VERTICAL';
    spacing?: number;
    padding?: number | { top: number; right: number; bottom: number; left: number };
    alignContent?: 'MIN' | 'CENTER' | 'MAX';
    justifyContent?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  } = {}
): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;

  if (options.background) {
    frame.fills = [{ type: 'SOLID', color: options.background }];
  }
  if (options.borderColor && options.borderWidth) {
    frame.strokes = [{ type: 'SOLID', color: options.borderColor }];
    frame.strokeWeight = options.borderWidth;
  }
  if (options.cornerRadius) {
    frame.cornerRadius = options.cornerRadius;
  }

  if (options.autoLayout) {
    frame.layoutMode = options.layoutMode || 'VERTICAL';
    // Hug content by default — prevents 100px ghost height on empty frames
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';

    if (options.spacing !== undefined) frame.itemSpacing = options.spacing;
    if (options.padding !== undefined) {
      if (typeof options.padding === 'number') {
        frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = options.padding;
      } else {
        frame.paddingTop = options.padding.top;
        frame.paddingRight = options.padding.right;
        frame.paddingBottom = options.padding.bottom;
        frame.paddingLeft = options.padding.left;
      }
    }
    if (options.alignContent) frame.primaryAxisAlignItems = options.alignContent;
    if (options.justifyContent) frame.primaryAxisAlignItems = options.justifyContent;

    // Apply fixed width after sizing modes so auto-height is preserved
    if (options.width) {
      if (frame.layoutMode === 'VERTICAL') {
        // Width is the counter axis — fix it, leave height as AUTO
        frame.counterAxisSizingMode = 'FIXED';
      } else {
        // HORIZONTAL: width is the primary axis — fix it, leave height as AUTO
        frame.primaryAxisSizingMode = 'FIXED';
      }
      frame.resize(options.width, frame.height);
    }
  } else if (options.width) {
    frame.resize(options.width, options.height || 100);
  }

  parent.appendChild(frame);
  return frame;
}

export function createDivider(parent: FrameNode, width: number = 400): RectangleNode {
  const divider = figma.createRectangle();
  divider.resize(width, 1);
  divider.fills = [{ type: 'SOLID', color: DESIGN_SYSTEM.colors.border }];
  parent.appendChild(divider);
  return divider;
}

// ─── Header Primitive ───────────────────────────────────────────────────────

export async function createDocHeader(
  parent: FrameNode,
  title: string,
  description?: string,
  width: number = 400
): Promise<FrameNode> {
  const header = createFrame(parent, 'Doc/Header', {
    width,
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
    padding: DESIGN_SYSTEM.spacing.md,
  });

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.semibold);
  createText(header, title, {
    fontSize: DESIGN_SYSTEM.typography.sizes.xxl,
    fontWeight: DESIGN_SYSTEM.typography.weights.semibold,
    color: DESIGN_SYSTEM.colors.text,
  });

  if (description) {
    await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
    const descText = createText(header, description, {
      fontSize: DESIGN_SYSTEM.typography.sizes.base,
      fontWeight: DESIGN_SYSTEM.typography.weights.regular,
      color: DESIGN_SYSTEM.colors.textSecondary,
      width: width - DESIGN_SYSTEM.spacing.md * 2,
      lineHeight: DESIGN_SYSTEM.typography.lineHeights.lg,
    });
    descText.layoutSizingHorizontal = 'FILL';
  }

  header.layoutSizingHorizontal = 'FILL';
  return header;
}

// ─── Section Primitive ──────────────────────────────────────────────────────

export async function createDocSection(
  parent: FrameNode,
  title: string,
  width: number = 400
): Promise<FrameNode> {
  const section = createFrame(parent, 'Doc/Section', {
    width,
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN_SYSTEM.spacing.md,
    padding: DESIGN_SYSTEM.spacing.md,
  });

  section.layoutSizingHorizontal = 'FILL';

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.semibold);
  createText(section, title, {
    fontSize: DESIGN_SYSTEM.typography.sizes.lg,
    fontWeight: DESIGN_SYSTEM.typography.weights.semibold,
    color: DESIGN_SYSTEM.colors.text,
  });

  const sectionDivider = createDivider(section, width - DESIGN_SYSTEM.spacing.md * 2);
  sectionDivider.layoutSizingHorizontal = 'FILL';

  return section;
}

// ─── Property Grid ─────────────────────────────────────────────────────────

export async function createPropertyGrid(
  parent: FrameNode,
  properties: Array<{ label: string; value: string }>,
  width: number = 400
): Promise<FrameNode> {
  const grid = createFrame(parent, 'Doc/PropertyGrid', {
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: 0,
  });
  grid.layoutSizingHorizontal = 'FILL';

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.medium);
  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);

  const LABEL_W = 100;

  properties.forEach(({ label, value }, index) => {
    const row = createFrame(grid, 'Property Row', {
      autoLayout: true,
      layoutMode: 'HORIZONTAL',
      spacing: DESIGN_SYSTEM.spacing.md,
      padding: {
        top: DESIGN_SYSTEM.spacing.sm,
        right: DESIGN_SYSTEM.spacing.sm,
        bottom: DESIGN_SYSTEM.spacing.sm,
        left: DESIGN_SYSTEM.spacing.sm,
      },
    });
    row.layoutSizingHorizontal = 'FILL';
    if (index % 2 === 0) {
      row.fills = [{ type: 'SOLID', color: DESIGN_SYSTEM.colors.background }];
    }

    createText(row, label, {
      fontSize: DESIGN_SYSTEM.typography.sizes.sm,
      fontWeight: DESIGN_SYSTEM.typography.weights.medium,
      color: DESIGN_SYSTEM.colors.textSecondary,
      width: LABEL_W,
    });

    const valueText = createText(row, value, {
      fontSize: DESIGN_SYSTEM.typography.sizes.sm,
      fontWeight: DESIGN_SYSTEM.typography.weights.regular,
      color: DESIGN_SYSTEM.colors.text,
      width: 200,
    });
    valueText.layoutSizingHorizontal = 'FILL';
  });

  return grid;
}

// ─── Property Cards (2-column grid) ───────────────────────────────────────

export async function createPropertyCards(
  parent: FrameNode,
  properties: Array<{ label: string; value: string }>,
  withBackground: boolean = false,
): Promise<FrameNode> {
  const container = createFrame(parent, 'Doc/PropertyGrid', {
    autoLayout: true,
    layoutMode: 'HORIZONTAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
  });
  container.layoutSizingHorizontal = 'FILL';
  container.counterAxisAlignItems = 'MIN';

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.semibold);
  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);

  const addCard = (col: FrameNode, label: string, value: string) => {
    const cardOptions: any = {
      autoLayout: true,
      layoutMode: 'VERTICAL',
      spacing: DESIGN_SYSTEM.spacing.xs,
      padding: DESIGN_SYSTEM.spacing.sm,
      cornerRadius: DESIGN_SYSTEM.radius.sm,
    };
    if (withBackground) {
      cardOptions.background = DESIGN_SYSTEM.colors.background;
    }
    const card = createFrame(col, 'Property Card', cardOptions);
    card.layoutSizingHorizontal = 'FILL';
    createText(card, label.toUpperCase(), {
      fontSize: DESIGN_SYSTEM.typography.sizes.xs,
      fontWeight: DESIGN_SYSTEM.typography.weights.semibold,
      color: DESIGN_SYSTEM.colors.textSecondary,
    });
    const valText = createText(card, value, {
      fontSize: DESIGN_SYSTEM.typography.sizes.sm,
      fontWeight: DESIGN_SYSTEM.typography.weights.regular,
      color: DESIGN_SYSTEM.colors.text,
      width: 150,
    });
    valText.layoutSizingHorizontal = 'FILL';
  };

  const leftProps = properties.filter((_, i) => i % 2 === 0);
  const rightProps = properties.filter((_, i) => i % 2 === 1);

  const leftCol = createFrame(container, 'Left', {
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
  });
  leftCol.layoutSizingHorizontal = 'FILL';
  leftProps.forEach(({ label, value }) => addCard(leftCol, label, value));

  if (rightProps.length > 0) {
    const rightCol = createFrame(container, 'Right', {
      autoLayout: true,
      layoutMode: 'VERTICAL',
      spacing: DESIGN_SYSTEM.spacing.sm,
    });
    rightCol.layoutSizingHorizontal = 'FILL';
    rightProps.forEach(({ label, value }) => addCard(rightCol, label, value));
  }

  return container;
}

// ─── Token Chip ────────────────────────────────────────────────────────────

export async function createTokenChip(
  parent: FrameNode,
  tokenName: string,
  tokenValue: string,
  options?: { color?: { r: number; g: number; b: number } }
): Promise<FrameNode> {
  const chip = createFrame(parent, 'Doc/TokenChip', {
    autoLayout: true,
    layoutMode: 'HORIZONTAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
    padding: { top: 6, right: 10, bottom: 6, left: 10 },
    background: DESIGN_SYSTEM.colors.background,
    borderColor: DESIGN_SYSTEM.colors.border,
    borderWidth: 1,
    cornerRadius: DESIGN_SYSTEM.radius.sm,
  });

  if (options?.color) {
    const colorSwatch = figma.createRectangle();
    colorSwatch.resize(16, 16);
    colorSwatch.fills = [{ type: 'SOLID', color: options.color }];
    colorSwatch.cornerRadius = 2;
    chip.appendChild(colorSwatch);
  }

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
  createText(chip, `${tokenName}: ${tokenValue}`, {
    fontSize: DESIGN_SYSTEM.typography.sizes.xs,
    fontWeight: DESIGN_SYSTEM.typography.weights.regular,
    color: DESIGN_SYSTEM.colors.text,
  });

  parent.appendChild(chip);
  return chip;
}

// ─── Variant Card ──────────────────────────────────────────────────────────

export async function createVariantCard(
  parent: FrameNode,
  variantName: string,
  properties: Array<{ key: string; value: string }>,
  width: number = 180
): Promise<FrameNode> {
  const card = createFrame(parent, 'Doc/VariantCard', {
    width,
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
    padding: DESIGN_SYSTEM.spacing.md,
    background: DESIGN_SYSTEM.colors.white,
    borderColor: DESIGN_SYSTEM.colors.border,
    borderWidth: 1,
    cornerRadius: DESIGN_SYSTEM.radius.md,
  });

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.semibold);
  createText(card, variantName, {
    fontSize: DESIGN_SYSTEM.typography.sizes.sm,
    fontWeight: DESIGN_SYSTEM.typography.weights.semibold,
    color: DESIGN_SYSTEM.colors.text,
  });

  createDivider(card, width - DESIGN_SYSTEM.spacing.md * 2);

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
  properties.forEach(({ key, value }) => {
    createText(card, `${key}: ${value}`, {
      fontSize: DESIGN_SYSTEM.typography.sizes.xs,
      fontWeight: DESIGN_SYSTEM.typography.weights.regular,
      color: DESIGN_SYSTEM.colors.textSecondary,
      width: width - DESIGN_SYSTEM.spacing.md * 2,
    });
  });

  parent.appendChild(card);
  return card;
}

// ─── Do/Don't Callout ──────────────────────────────────────────────────────

export async function createDoCallout(parent: FrameNode, text: string, width: number = 350): Promise<FrameNode> {
  const callout = createFrame(parent, 'Doc/Do', {
    width,
    autoLayout: true,
    layoutMode: 'HORIZONTAL',
    spacing: DESIGN_SYSTEM.spacing.md,
    padding: DESIGN_SYSTEM.spacing.md,
    background: { r: 0.95, g: 1, b: 0.97 }, // Light green
    borderColor: DESIGN_SYSTEM.colors.success,
    borderWidth: 1,
    cornerRadius: DESIGN_SYSTEM.radius.md,
  });

  const indicator = figma.createRectangle();
  indicator.resize(4, 100);
  indicator.fills = [{ type: 'SOLID', color: DESIGN_SYSTEM.colors.success }];
  indicator.cornerRadius = 2;
  callout.appendChild(indicator);

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
  createText(callout, text, {
    fontSize: DESIGN_SYSTEM.typography.sizes.sm,
    fontWeight: DESIGN_SYSTEM.typography.weights.regular,
    color: DESIGN_SYSTEM.colors.text,
    width: width - DESIGN_SYSTEM.spacing.md * 3,
    lineHeight: DESIGN_SYSTEM.typography.lineHeights.lg,
  });

  parent.appendChild(callout);
  return callout;
}

export async function createDontCallout(parent: FrameNode, text: string, width: number = 350): Promise<FrameNode> {
  const callout = createFrame(parent, 'Doc/Dont', {
    width,
    autoLayout: true,
    layoutMode: 'HORIZONTAL',
    spacing: DESIGN_SYSTEM.spacing.md,
    padding: DESIGN_SYSTEM.spacing.md,
    background: { r: 1, g: 0.95, b: 0.95 }, // Light red
    borderColor: { r: 1, g: 0.2, b: 0.2 },
    borderWidth: 1,
    cornerRadius: DESIGN_SYSTEM.radius.md,
  });

  const indicator = figma.createRectangle();
  indicator.resize(4, 100);
  indicator.fills = [{ type: 'SOLID', color: { r: 1, g: 0.2, b: 0.2 } }];
  indicator.cornerRadius = 2;
  callout.appendChild(indicator);

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
  createText(callout, text, {
    fontSize: DESIGN_SYSTEM.typography.sizes.sm,
    fontWeight: DESIGN_SYSTEM.typography.weights.regular,
    color: DESIGN_SYSTEM.colors.text,
    width: width - DESIGN_SYSTEM.spacing.md * 3,
    lineHeight: DESIGN_SYSTEM.typography.lineHeights.lg,
  });

  parent.appendChild(callout);
  return callout;
}

// ─── Callout/Info Box ──────────────────────────────────────────────────────

export async function createInfoCallout(parent: FrameNode, title: string, text: string, width: number = 350): Promise<FrameNode> {
  const callout = createFrame(parent, 'Doc/Callout', {
    width,
    autoLayout: true,
    layoutMode: 'VERTICAL',
    spacing: DESIGN_SYSTEM.spacing.sm,
    padding: DESIGN_SYSTEM.spacing.md,
    background: { r: 0.95, g: 0.98, b: 1 }, // Light blue
    borderColor: DESIGN_SYSTEM.colors.primary,
    borderWidth: 1,
    cornerRadius: DESIGN_SYSTEM.radius.md,
  });

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.semibold);
  createText(callout, title, {
    fontSize: DESIGN_SYSTEM.typography.sizes.sm,
    fontWeight: DESIGN_SYSTEM.typography.weights.semibold,
    color: DESIGN_SYSTEM.colors.primary,
  });

  await loadFont(DESIGN_SYSTEM.typography.fontFamily, DESIGN_SYSTEM.typography.weights.regular);
  createText(callout, text, {
    fontSize: DESIGN_SYSTEM.typography.sizes.xs,
    fontWeight: DESIGN_SYSTEM.typography.weights.regular,
    color: DESIGN_SYSTEM.colors.text,
    width: width - DESIGN_SYSTEM.spacing.md * 2,
    lineHeight: DESIGN_SYSTEM.typography.lineHeights.base,
  });

  parent.appendChild(callout);
  return callout;
}

export const DESIGN = DESIGN_SYSTEM;
