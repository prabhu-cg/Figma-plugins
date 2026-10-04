import { describe, expect, it } from 'vitest';
import { computeVariableUsage, mergeStyleBoundVariables } from '../../src/plugin/transform/usage';
import { makeColorVariable, makeCollection, makeComponent } from './fixtures';
import { transformComponents } from '../../src/plugin/transform/components';
import {
  transformVariableCollections,
  transformVariables,
} from '../../src/plugin/transform/variables';

describe('computeVariableUsage', () => {
  it('attaches component names to a variable they bind, deduped and sorted', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const variables = transformVariables([makeColorVariable()], collections);
    const components = transformComponents([
      makeComponent({ id: 'c:1', name: 'Button', boundVariableIds: ['var:1'] }),
      makeComponent({ id: 'c:2', name: 'Alert', boundVariableIds: ['var:1'] }),
    ]);

    const [variable] = computeVariableUsage(variables, components);

    expect(variable.usedByComponents).toEqual(['Alert', 'Button']);
  });

  it('leaves usedByComponents empty for a variable no component binds', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const variables = transformVariables([makeColorVariable({ id: 'var:unused' })], collections);
    const components = transformComponents([makeComponent({ boundVariableIds: ['var:1'] })]);

    const [variable] = computeVariableUsage(variables, components);

    expect(variable.usedByComponents).toEqual([]);
  });

  it('counts a component once even if multiple variants bind the same variable', () => {
    const collections = transformVariableCollections([makeCollection()]);
    const variables = transformVariables([makeColorVariable()], collections);
    // The fixture's default component has two variants that both bind var:1,
    // but transformComponents flattens that to a single boundVariableIds entry.
    const components = transformComponents([makeComponent()]);

    const [variable] = computeVariableUsage(variables, components);

    expect(variable.usedByComponents).toEqual(['Button']);
  });
});

describe('mergeStyleBoundVariables', () => {
  it('adds variables bound inside styles a component applies', () => {
    const component = makeComponent({ boundVariableIds: ['var:1'], styleIds: ['style:text:1'] });
    const [merged] = mergeStyleBoundVariables(
      [component],
      [{ id: 'style:text:1', boundVariableIds: ['var:2', 'var:1'] }],
    );
    expect(merged.boundVariableIds.sort()).toEqual(['var:1', 'var:2']);
  });

  it('leaves components without style ids untouched', () => {
    const component = makeComponent({ boundVariableIds: ['var:1'] });
    const result = mergeStyleBoundVariables(
      [component],
      [{ id: 's', boundVariableIds: ['var:9'] }],
    );
    expect(result[0]).toBe(component);
  });
});
