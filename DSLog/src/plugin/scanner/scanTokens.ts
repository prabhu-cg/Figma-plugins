import type { TokenSnapshot, VariableCollectionSnapshot } from "@shared/types/token";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import type { VariableInputLike } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUPPORTED_TYPES = new Set(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);

export interface TokenScanResult {
  tokens: TokenSnapshot[];
  collections: VariableCollectionSnapshot[];
  scanned: number;
  skipped: Array<{ id: string; name: string; reason: string }>;
}

export async function scanTokens(
  includedCollectionIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<TokenScanResult> {
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const targetCollections = includedCollectionIds.length
    ? allCollections.filter((c) => includedCollectionIds.includes(c.id))
    : allCollections;
  const targetCollectionIds = new Set(targetCollections.map((c) => c.id));

  const collectionSnapshots: VariableCollectionSnapshot[] = targetCollections.map((c) => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    defaultModeId: c.defaultModeId,
    remote: c.remote,
  }));

  const allVariables = await figma.variables.getLocalVariablesAsync();
  const variableNamesById: Record<string, string> = {};
  for (const v of allVariables) variableNamesById[v.id] = v.name;

  const targetVariables = allVariables.filter((v) => targetCollectionIds.has(v.variableCollectionId));

  const tokens: TokenSnapshot[] = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];
  let done = 0;

  for (const variable of targetVariables) {
    try {
      if (!SUPPORTED_TYPES.has(variable.resolvedType)) {
        skipped.push({
          id: variable.id,
          name: variable.name,
          reason: `Unsupported variable type ${variable.resolvedType}`,
        });
        continue;
      }
      const collection = targetCollections.find((c) => c.id === variable.variableCollectionId);
      if (!collection) {
        skipped.push({ id: variable.id, name: variable.name, reason: "Owning collection not found" });
        continue;
      }

      const valuesByMode = collection.modes.map((mode) => ({
        modeId: mode.modeId,
        modeName: mode.name,
        value: (variable.valuesByMode as Record<string, any>)[mode.modeId] ?? null,
      }));

      const input: VariableInputLike = {
        id: variable.id,
        key: variable.key,
        name: variable.name,
        collectionId: collection.id,
        collectionName: collection.name,
        resolvedType: variable.resolvedType as VariableInputLike["resolvedType"],
        scopes: variable.scopes as string[],
        description: variable.description || undefined,
        remote: variable.remote,
        libraryKey: variable.remote ? variable.key : undefined,
        valuesByMode,
        variableNamesById,
      };

      tokens.push(normalizeToken(input));
    } catch (error) {
      skipped.push({
        id: variable.id,
        name: variable.name,
        reason: error instanceof Error ? error.message : "Unknown scan error",
      });
    }
    done += 1;
    if (done % 25 === 0 || done === targetVariables.length) {
      onProgress?.(done, targetVariables.length);
    }
  }

  return { tokens, collections: collectionSnapshots, scanned: tokens.length, skipped };
}
