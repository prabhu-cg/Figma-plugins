export type TokenValueType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

/** A resolved or raw value for a variable in a specific mode. */
export interface TokenModeValue {
  modeId: string;
  modeName: string;
  /** Raw value: color hex string, number, string, or boolean. */
  value: string | number | boolean | null;
  /** Present when the value is an alias to another variable. */
  aliasTo?: {
    variableId: string;
    variableName?: string;
  };
  /** Best-effort resolved value after following alias chains, when practical. */
  resolvedValue?: string | number | boolean | null;
}

export interface TokenSnapshot {
  id: string;
  key?: string;
  name: string;
  collectionId: string;
  collectionName: string;
  type: TokenValueType;
  scopes: string[];
  description?: string;
  remote: boolean;
  libraryKey?: string;
  valuesByMode: TokenModeValue[];

  /** Deterministic content hash for change short-circuiting. */
  hash: string;

  capturedAt: string;
}

export interface VariableCollectionSnapshot {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  remote: boolean;
}
