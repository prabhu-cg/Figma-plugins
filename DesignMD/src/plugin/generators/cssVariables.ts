import type {
  DesignSystem,
  EffectValue,
  StyleToken,
  TokenValue,
  VariableToken,
} from '@shared/types';
import { kebabCase } from '@shared/naming';
import { aliasCssName, defaultModeValue, primitiveValue } from './tokenValue';

function unitFor(category: VariableToken['category']): string {
  return category === 'spacing' || category === 'typography' ? 'px' : '';
}

/** Font names with spaces or symbols ("SF Pro Display") must be quoted to be valid in font-family. */
function cssFontFamily(family: string): string {
  return /^[A-Za-z_-][\w-]*$/.test(family) ? family : JSON.stringify(family);
}

function valueToCss(value: TokenValue, variable: VariableToken): string | null {
  if (value.kind === 'alias') return `var(${aliasCssName(value.variableName)})`;
  const primitive = primitiveValue(value);
  if (primitive === null) return null;
  if (value.kind === 'float') return `${primitive}${unitFor(variable.category)}`;
  if (value.kind === 'string' && variable.scopes.includes('FONT_FAMILY')) {
    return cssFontFamily(value.value);
  }
  return String(primitive);
}

function effectToBoxShadowSegment(e: EffectValue): string | null {
  if (!e.visible) return null;
  if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') return null;
  const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
  const x = e.offsetX ?? 0;
  const y = e.offsetY ?? 0;
  const blur = e.radius ?? 0;
  const spread = e.spread ?? 0;
  const color = e.color?.hex ?? '#000000';
  return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

function textStyleToCssVars(style: StyleToken): Record<string, string> {
  const props = style.textProperties;
  if (!props) return {};
  return {
    [`${style.cssName}-font-family`]: cssFontFamily(props.fontFamily),
    [`${style.cssName}-font-weight`]: String(props.fontWeight),
    [`${style.cssName}-font-size`]: `${props.fontSize}px`,
    [`${style.cssName}-line-height`]: props.lineHeight === 'AUTO' ? 'normal' : props.lineHeight,
    [`${style.cssName}-letter-spacing`]: props.letterSpacing,
  };
}

function gridStyleToCssVars(style: StyleToken): Record<string, string> {
  const out: Record<string, string> = {};
  (style.grids ?? []).forEach((g, i) => {
    const suffix = style.grids!.length > 1 ? `-${i}` : '';
    if (g.count !== undefined) out[`${style.cssName}${suffix}-count`] = String(g.count);
    if (g.gutterSize !== undefined) out[`${style.cssName}${suffix}-gutter`] = `${g.gutterSize}px`;
    if (g.offset !== undefined) out[`${style.cssName}${suffix}-offset`] = `${g.offset}px`;
    if (g.sectionSize !== undefined)
      out[`${style.cssName}${suffix}-section`] = `${g.sectionSize}px`;
  });
  return out;
}

function addVariableVars(target: Record<string, string>, variables: VariableToken[]) {
  for (const v of variables) {
    const defaultValue = defaultModeValue(v);
    if (!defaultValue) continue;
    const css = valueToCss(defaultValue, v);
    if (css !== null) target[v.cssName] = css;
  }
}

function addVariableModeVars(
  modes: Record<string, Record<string, string>>,
  variables: VariableToken[],
) {
  for (const v of variables) {
    for (const vbm of v.valuesByMode) {
      const css = valueToCss(vbm.value, v);
      if (css === null) continue;
      const modeKey = vbm.modeName;
      (modes[modeKey] ??= {})[v.cssName] = css;
    }
  }
}

export interface CssVariableMaps {
  /** Default-mode values, keyed by custom property name (e.g. "--color-primary-500"). */
  root: Record<string, string>;
  /** Every mode's values (default mode included), keyed by mode name. */
  modes: Record<string, Record<string, string>>;
}

/** The CSS custom properties a design system resolves to, shared by every CSS-flavoured output. */
export function buildCssVariableMaps(ds: DesignSystem): CssVariableMaps {
  const root: Record<string, string> = {};
  const modes: Record<string, Record<string, string>> = {};

  addVariableVars(root, ds.variables);
  addVariableModeVars(modes, ds.variables);

  // Styles only fill in where there's no variable of that kind (variables are the source of truth).
  if (!ds.variables.some((v) => v.category === 'color')) {
    for (const s of ds.styles.color) {
      if (s.paint) root[s.cssName] = s.paint.hex;
    }
  }
  if (!ds.variables.some((v) => v.category === 'typography')) {
    for (const s of ds.styles.text) Object.assign(root, textStyleToCssVars(s));
  }
  for (const s of ds.styles.effect) {
    const shadowSegments = (s.effects ?? [])
      .map(effectToBoxShadowSegment)
      .filter((v): v is string => !!v);
    if (shadowSegments.length > 0) root[s.cssName] = shadowSegments.join(', ');
    const blur = (s.effects ?? []).find((e) => e.type === 'LAYER_BLUR' && e.visible);
    if (blur?.radius !== undefined) root[`${s.cssName}-blur`] = `${blur.radius}px`;
  }
  for (const s of ds.styles.grid) {
    Object.assign(root, gridStyleToCssVars(s));
  }

  return { root, modes };
}

export interface ModeOverride {
  modeName: string;
  /** Mode-specific attribute value, e.g. "dark" for `[data-theme="dark"]`. */
  slug: string;
  /** Only the variables whose value differs from the default (root) value. */
  vars: Record<string, string>;
}

/**
 * Non-empty per-mode override sets. The default mode already lives in `root`, so a mode whose
 * values all match it (usually "Light") yields nothing.
 */
export function modeOverrides({ root, modes }: CssVariableMaps): ModeOverride[] {
  const overrides: ModeOverride[] = [];
  for (const [modeName, values] of Object.entries(modes)) {
    const vars = Object.fromEntries(Object.entries(values).filter(([name, v]) => root[name] !== v));
    if (Object.keys(vars).length > 0) {
      overrides.push({ modeName, slug: kebabCase(modeName) || 'mode', vars });
    }
  }
  return overrides;
}
