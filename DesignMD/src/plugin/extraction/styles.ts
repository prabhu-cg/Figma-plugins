import { processInBatches, safely } from '../utils/async';
import type {
  RawEffect,
  RawEffectStyle,
  RawGrid,
  RawGridStyle,
  RawPaintStyle,
  RawTextStyle,
} from './rawTypes';

const STYLE_BATCH_SIZE = 200;

/** Recursively collect VARIABLE_ALIAS ids out of a node/style's boundVariables map. */
export function collectBoundVariableIds(boundVariables: unknown): string[] {
  const ids: string[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string') {
        ids.push(obj.id);
        return;
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(boundVariables);
  return Array.from(new Set(ids));
}

function formatLineHeight(lineHeight: LineHeight): string {
  if (lineHeight.unit === 'AUTO') return 'AUTO';
  return `${lineHeight.value}${lineHeight.unit === 'PERCENT' ? '%' : 'px'}`;
}

function formatLetterSpacing(letterSpacing: LetterSpacing): string {
  return `${letterSpacing.value}${letterSpacing.unit === 'PERCENT' ? '%' : 'px'}`;
}

export async function extractTextStyles(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<RawTextStyle[]> {
  const warn = onWarning ?? (() => {});
  const styles = await safely(
    () => figma.getLocalTextStylesAsync(),
    (err) => warn(`Failed to load text styles: ${String(err)}`),
  );

  return processInBatches(
    styles ?? [],
    STYLE_BATCH_SIZE,
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      fontFamily: s.fontName?.family ?? 'Unknown',
      fontStyle: s.fontName?.style ?? 'Regular',
      fontWeight: (s as unknown as { fontWeight?: number }).fontWeight ?? 400,
      fontSize: s.fontSize ?? 0,
      lineHeight: s.lineHeight ? formatLineHeight(s.lineHeight) : 'AUTO',
      letterSpacing: s.letterSpacing ? formatLetterSpacing(s.letterSpacing) : '0px',
      textCase: s.textCase ?? 'ORIGINAL',
      textDecoration: s.textDecoration ?? 'NONE',
      paragraphSpacing: s.paragraphSpacing ?? 0,
      boundVariableIds: collectBoundVariableIds(
        (s as unknown as { boundVariables?: unknown }).boundVariables,
      ),
    }),
    onProgress,
  );
}

export async function extractPaintStyles(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<RawPaintStyle[]> {
  const warn = onWarning ?? (() => {});
  const styles = await safely(
    () => figma.getLocalPaintStylesAsync(),
    (err) => warn(`Failed to load color styles: ${String(err)}`),
  );

  return processInBatches(
    styles ?? [],
    STYLE_BATCH_SIZE,
    (s) => {
      const paints = s.paints ?? [];
      const solid = paints.find((p): p is SolidPaint => p.type === 'SOLID' && p.visible !== false);
      const hasNonSolid = paints.some((p) => p.type !== 'SOLID');

      return {
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        color: solid
          ? {
              r: solid.color.r,
              g: solid.color.g,
              b: solid.color.b,
              a: solid.opacity ?? 1,
            }
          : null,
        isGradientOrImage: hasNonSolid || !solid,
        boundVariableIds: collectBoundVariableIds(
          (s as unknown as { boundVariables?: unknown }).boundVariables,
        ),
      };
    },
    onProgress,
  );
}

function mapEffect(e: Effect): RawEffect {
  const base: RawEffect = { type: e.type, visible: e.visible };
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
    base.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a };
    base.offsetX = e.offset.x;
    base.offsetY = e.offset.y;
    base.radius = e.radius;
    base.spread = e.spread ?? 0;
  } else if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
    base.radius = e.radius;
  }
  return base;
}

export async function extractEffectStyles(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<RawEffectStyle[]> {
  const warn = onWarning ?? (() => {});
  const styles = await safely(
    () => figma.getLocalEffectStylesAsync(),
    (err) => warn(`Failed to load effect styles: ${String(err)}`),
  );

  return processInBatches(
    styles ?? [],
    STYLE_BATCH_SIZE,
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      effects: (s.effects ?? []).map(mapEffect),
      boundVariableIds: collectBoundVariableIds(
        (s as unknown as { boundVariables?: unknown }).boundVariables,
      ),
    }),
    onProgress,
  );
}

function mapGrid(g: LayoutGrid): RawGrid {
  return {
    pattern: g.pattern,
    sectionSize: 'sectionSize' in g ? g.sectionSize : undefined,
    count: 'count' in g ? g.count : undefined,
    gutterSize: 'gutterSize' in g ? g.gutterSize : undefined,
    offset: 'offset' in g ? g.offset : undefined,
    alignment: 'alignment' in g ? g.alignment : undefined,
  };
}

export async function extractGridStyles(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<RawGridStyle[]> {
  const warn = onWarning ?? (() => {});
  const styles = await safely(
    () => figma.getLocalGridStylesAsync(),
    (err) => warn(`Failed to load grid styles: ${String(err)}`),
  );

  return processInBatches(
    styles ?? [],
    STYLE_BATCH_SIZE,
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      grids: (s.layoutGrids ?? []).map(mapGrid),
    }),
    onProgress,
  );
}
