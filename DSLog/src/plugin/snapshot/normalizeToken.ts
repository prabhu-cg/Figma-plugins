import type { VariableInputLike } from "@plugin/scanner/types";
import type { TokenModeValue, TokenSnapshot } from "@shared/types/token";
import { hashObject } from "@shared/utils/hash";
import { rgbToHex } from "./color";

function normalizeRawValue(
  raw: VariableInputLike["valuesByMode"][number]["value"],
  type: VariableInputLike["resolvedType"],
): { value: TokenModeValue["value"]; aliasTo?: TokenModeValue["aliasTo"] } {
  if (raw !== null && typeof raw === "object" && "type" in raw && raw.type === "VARIABLE_ALIAS") {
    return { value: null, aliasTo: { variableId: raw.id } };
  }
  if (type === "COLOR" && raw !== null && typeof raw === "object") {
    return { value: rgbToHex(raw as unknown as { r: number; g: number; b: number; a?: number }) };
  }
  return { value: raw as TokenModeValue["value"] };
}

export function normalizeToken(input: VariableInputLike): TokenSnapshot {
  const valuesByMode: TokenModeValue[] = input.valuesByMode
    .map((entry) => {
      const { value, aliasTo } = normalizeRawValue(entry.value, input.resolvedType);
      const aliasName = aliasTo ? input.variableNamesById?.[aliasTo.variableId] : undefined;
      return {
        modeId: entry.modeId,
        modeName: entry.modeName,
        value,
        aliasTo: aliasTo ? { ...aliasTo, variableName: aliasName } : undefined,
        resolvedValue: aliasTo ? undefined : value,
      };
    })
    .sort((a, b) => a.modeName.localeCompare(b.modeName));

  const snapshot: Omit<TokenSnapshot, "hash"> = {
    id: input.id,
    key: input.key,
    name: input.name,
    collectionId: input.collectionId,
    collectionName: input.collectionName,
    type: input.resolvedType,
    scopes: [...input.scopes].sort(),
    description: input.description,
    remote: input.remote,
    libraryKey: input.libraryKey,
    valuesByMode,
    capturedAt: new Date().toISOString(),
  };

  const hash = hashObject({ ...snapshot, capturedAt: undefined });

  return { ...snapshot, hash };
}
