import type {
  DesignSystem,
  EffectValue,
  StyleToken,
  TokenValue,
  VariableToken,
} from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { aliasCssName, defaultModeValue, primitiveValue } from './tokenValue';

function unitFor(category: VariableToken['category']): string {
  return category === 'spacing' || category === 'typography' ? 'px' : '';
}

function valueToCss(value: TokenValue, category: VariableToken['category']): string | null {
  if (value.kind === 'alias') return `var(${aliasCssName(value.variableName)})`;
  const primitive = primitiveValue(value);
  if (primitive === null) return null;
  return value.kind === 'float' ? `${primitive}${unitFor(category)}` : String(primitive);
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
    [`${style.cssName}-font-family`]: props.fontFamily,
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
    const css = valueToCss(defaultValue, v.category);
    if (css !== null) target[v.cssName] = css;
  }
}

function addVariableModeVars(
  modes: Record<string, Record<string, string>>,
  variables: VariableToken[],
) {
  for (const v of variables) {
    for (const vbm of v.valuesByMode) {
      const css = valueToCss(vbm.value, v.category);
      if (css === null) continue;
      const modeKey = vbm.modeName;
      (modes[modeKey] ??= {})[v.cssName] = css;
    }
  }
}

export function generateCssTokensJson(ds: DesignSystem): GeneratedFile {
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

  const output = {
    metadata: {
      fileName: ds.metadata.fileName,
      generatedAt: ds.metadata.generatedAt,
    },
    root,
    modes,
  };

  return {
    path: 'css-tokens.json',
    content: JSON.stringify(output, null, 2),
  };
}
