/**
 * Value helpers shared by every generator that renders variable values, so "what is this token's
 * default value" and "what CSS name does an alias point at" are answered in exactly one place.
 */
import { toCssVarName, toPathSegments } from '@shared/naming';
import type { TokenValue, TokenValueByMode, VariableToken } from '@shared/types';

/** The default-mode entry of a variable (transformVariables orders the default mode first). */
export function defaultModeEntry(variable: VariableToken): TokenValueByMode | undefined {
  return variable.valuesByMode[0];
}

export function defaultModeValue(variable: VariableToken): TokenValue | undefined {
  return defaultModeEntry(variable)?.value;
}

/** The value of a non-alias token as a plain primitive; null for aliases and unknown values. */
export function primitiveValue(value: TokenValue): string | number | boolean | null {
  switch (value.kind) {
    case 'color':
      return value.color.hex;
    case 'float':
    case 'string':
    case 'boolean':
      return value.value;
    default:
      return null;
  }
}

/** CSS custom property an alias points at; identical to how the target's own `cssName` is built. */
export function aliasCssName(variableName: string): string {
  return toCssVarName(toPathSegments(variableName));
}
