import { describe, expect, it } from 'vitest';
import {
  transformVariableCollections,
  transformVariables,
} from '../../src/plugin/transform/variables';
import { makeAliasVariable, makeCollection, makeColorVariable } from './fixtures';

describe('transformVariableCollections', () => {
  it('carries through modes and default mode id', () => {
    const [collection] = transformVariableCollections([makeCollection()]);
    expect(collection.modes).toEqual([
      { modeId: 'mode:light', name: 'Light' },
      { modeId: 'mode:dark', name: 'Dark' },
    ]);
    expect(collection.defaultModeId).toBe('mode:light');
  });
});

describe('transformVariables', () => {
  it('builds path segments, css name, and category from a color variable', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const [variable] = transformVariables([makeColorVariable()], collections);

    expect(variable.path).toEqual(['Color', 'Primary', '500']);
    expect(variable.cssName).toBe('--color-primary-500');
    expect(variable.category).toBe('color');
    expect(variable.collectionName).toBe('Colors');
  });

  it('resolves color values to hex per mode', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const [variable] = transformVariables([makeColorVariable()], collections);

    const light = variable.valuesByMode.find((v) => v.modeName === 'Light');
    expect(light?.value).toMatchObject({ kind: 'color' });
    if (light?.value.kind === 'color') {
      expect(light.value.color.hex).toBe('#3366ff');
    }
  });

  it('resolves alias values to the referenced variable name', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const raw = [makeColorVariable(), makeAliasVariable()];
    const variables = transformVariables(raw, collections);
    const alias = variables.find((v) => v.id === 'var:2');

    expect(alias?.valuesByMode[0].value).toEqual({
      kind: 'alias',
      variableId: 'var:1',
      variableName: 'Color/Primary/500',
    });
  });

  it('falls back gracefully when a variable references a missing collection', () => {
    const collections = transformVariableCollections([makeCollection({ id: 'collection:other' })]);
    const [variable] = transformVariables([makeColorVariable()], collections);

    expect(variable.collectionName).toBe('Unknown Collection');
  });

  it('classifies semantic-named variables as semantic even when resolved type is COLOR', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const [alias] = transformVariables([makeAliasVariable()], collections);
    expect(alias.category).toBe('semantic');
  });
});
