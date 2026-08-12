import type { TokenSnapshot } from "@shared/types/token";
import type { RawChange } from "./rawChange";
import { valuesEqual } from "./rawChange";

function byId(tokens: TokenSnapshot[]): Map<string, TokenSnapshot> {
  return new Map(tokens.map((t) => [t.id, t]));
}

function diffModes(before: TokenSnapshot, after: TokenSnapshot): RawChange[] {
  const changes: RawChange[] = [];
  const id = after.id;
  const name = after.name;
  const beforeByMode = new Map(before.valuesByMode.map((m) => [m.modeId, m]));
  const afterByMode = new Map(after.valuesByMode.map((m) => [m.modeId, m]));

  for (const [modeId, mode] of afterByMode) {
    if (!beforeByMode.has(modeId)) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: name,
        changeType: "token-mode-added",
        field: mode.modeName,
        after: mode.value,
      });
    }
  }
  for (const [modeId, mode] of beforeByMode) {
    if (!afterByMode.has(modeId)) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: name,
        changeType: "token-mode-removed",
        field: mode.modeName,
        before: mode.value,
      });
    }
  }

  const modeDetails: Array<{ modeName: string; before?: unknown; after?: unknown; changed: boolean }> = [];
  let anyValueChanged = false;
  let anyAliasChanged = false;
  let anyAliasRemoved = false;

  for (const [modeId, beforeMode] of beforeByMode) {
    const afterMode = afterByMode.get(modeId);
    if (!afterMode) continue;

    const aliasChanged = !valuesEqual(beforeMode.aliasTo, afterMode.aliasTo);
    const valueChanged = !valuesEqual(beforeMode.value, afterMode.value);
    const aliasRemoved = aliasChanged && Boolean(beforeMode.aliasTo) && !afterMode.aliasTo;

    modeDetails.push({
      modeName: afterMode.modeName,
      before: beforeMode.aliasTo ? `-> ${beforeMode.aliasTo.variableName ?? beforeMode.aliasTo.variableId}` : beforeMode.value,
      after: afterMode.aliasTo ? `-> ${afterMode.aliasTo.variableName ?? afterMode.aliasTo.variableId}` : afterMode.value,
      changed: aliasChanged || valueChanged,
    });

    if (aliasRemoved) anyAliasRemoved = true;
    else if (aliasChanged) anyAliasChanged = true;
    else if (valueChanged) anyValueChanged = true;
  }

  // A mode that lost its alias (pointed at another token, now a raw value)
  // is a distinct, definitively-breaking signal from a mere retarget —
  // see CLASSIFICATION_RULES["token-alias-removed"] (spec §10).
  if (anyAliasRemoved) {
    changes.push({
      entityType: "token",
      entityId: id,
      entityName: name,
      changeType: "token-alias-removed",
      modeDetails,
    });
  } else if (anyAliasChanged) {
    changes.push({
      entityType: "token",
      entityId: id,
      entityName: name,
      changeType: "token-alias-changed",
      modeDetails,
    });
  } else if (anyValueChanged) {
    changes.push({
      entityType: "token",
      entityId: id,
      entityName: name,
      changeType: "token-value-changed",
      modeDetails,
    });
  }

  return changes;
}

export function diffTokens(baseline: TokenSnapshot[], current: TokenSnapshot[]): RawChange[] {
  const changes: RawChange[] = [];
  const baselineMap = byId(baseline);
  const currentMap = byId(current);

  for (const [id, token] of currentMap) {
    if (!baselineMap.has(id)) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: token.name,
        changeType: "token-added",
        after: { name: token.name, collection: token.collectionName, type: token.type },
      });
    }
  }

  for (const [id, token] of baselineMap) {
    if (!currentMap.has(id)) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: token.name,
        changeType: "token-removed",
        before: { name: token.name, collection: token.collectionName, type: token.type },
      });
    }
  }

  for (const [id, before] of baselineMap) {
    const after = currentMap.get(id);
    if (!after) continue;
    if (before.hash === after.hash) continue;

    if (before.name !== after.name) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: after.name,
        changeType: "token-renamed",
        before: before.name,
        after: after.name,
      });
    }
    if (before.type !== after.type) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: after.name,
        changeType: "token-type-changed",
        before: before.type,
        after: after.type,
      });
    }
    if (before.description !== after.description) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: after.name,
        changeType: "token-description-changed",
        before: before.description,
        after: after.description,
      });
    }
    if (!valuesEqual(before.scopes, after.scopes)) {
      changes.push({
        entityType: "token",
        entityId: id,
        entityName: after.name,
        changeType: "token-scopes-changed",
        before: before.scopes,
        after: after.scopes,
      });
    }

    changes.push(...diffModes(before, after));
  }

  return changes;
}
