import { fontWeightFromStyle } from '@shared/naming';
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

/** Variable ids bound on a node or style (typings don't expose `boundVariables` on every type). */
export function boundVariablesOf(node: unknown): string[] {
  return collectBoundVariableIds((node as { boundVariables?: unknown }).boundVariables);
}

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

/**
 * Shared shape of every style extractor: load the local styles (a failure becomes a warning, not
 * an abort), then map each one in yielding batches.
 */
async function extractStyles<TStyle, TRaw>(
  label: string,
  load: () => Promise<TStyle[]>,
  map: (style: TStyle) => TRaw,
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<TRaw[]> {
  const styles = await safely(load, (err) =>
    (onWarning ?? (() => {}))(`Failed to load ${label}: ${String(err)}`),
  );
  return processInBatches(styles ?? [], STYLE_BATCH_SIZE, map, onProgress);
}

type ProgressFn = (done: number, total: number) => void;
type WarnFn = (message: string) => void;

export function extractTextStyles(onProgress?: ProgressFn, onWarning?: WarnFn) {
  return extractStyles<TextStyle, RawTextStyle>(
    'text styles',
    () => figma.getLocalTextStylesAsync(),
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      fontFamily: s.fontName?.family ?? 'Unknown',
      fontStyle: s.fontName?.style ?? 'Regular',
      fontWeight: fontWeightFromStyle(s.fontName?.style ?? 'Regular'),
      fontSize: s.fontSize ?? 0,
      lineHeight: s.lineHeight ? formatLineHeight(s.lineHeight) : 'AUTO',
      letterSpacing: s.letterSpacing ? formatLetterSpacing(s.letterSpacing) : '0px',
      textCase: s.textCase ?? 'ORIGINAL',
      textDecoration: s.textDecoration ?? 'NONE',
      paragraphSpacing: s.paragraphSpacing ?? 0,
      boundVariableIds: boundVariablesOf(s),
    }),
    onProgress,
    onWarning,
  );
}

export function extractPaintStyles(onProgress?: ProgressFn, onWarning?: WarnFn) {
  return extractStyles<PaintStyle, RawPaintStyle>(
    'color styles',
    () => figma.getLocalPaintStylesAsync(),
    (s) => {
      const paints = s.paints ?? [];
      const solid = paints.find((p): p is SolidPaint => p.type === 'SOLID' && p.visible !== false);
      const hasNonSolid = paints.some((p) => p.type !== 'SOLID');

      return {
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        color: solid
          ? { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 }
          : null,
        isGradientOrImage: hasNonSolid || !solid,
        boundVariableIds: boundVariablesOf(s),
      };
    },
    onProgress,
    onWarning,
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

export function extractEffectStyles(onProgress?: ProgressFn, onWarning?: WarnFn) {
  return extractStyles<EffectStyle, RawEffectStyle>(
    'effect styles',
    () => figma.getLocalEffectStylesAsync(),
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      effects: (s.effects ?? []).map(mapEffect),
      boundVariableIds: boundVariablesOf(s),
    }),
    onProgress,
    onWarning,
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

export function extractGridStyles(onProgress?: ProgressFn, onWarning?: WarnFn) {
  return extractStyles<GridStyle, RawGridStyle>(
    'grid styles',
    () => figma.getLocalGridStylesAsync(),
    (s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      grids: (s.layoutGrids ?? []).map(mapGrid),
    }),
    onProgress,
    onWarning,
  );
}
