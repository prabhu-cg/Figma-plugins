import { describe, expect, it } from 'vitest';
import { filterDesignSystemByPages } from '../../src/plugin/transform/pageFilter';
import { makeColorVariable, makeCollection, makeComponent } from './fixtures';
import { transformComponents } from '../../src/plugin/transform/components';
import {
  transformVariableCollections,
  transformVariables,
} from '../../src/plugin/transform/variables';
import { computeVariableUsage } from '../../src/plugin/transform/usage';
import { buildSummary } from '../../src/plugin/transform/summary';
import type { DesignSystem } from '../../src/shared/types';

function makeSystem(): DesignSystem {
  const collections = transformVariableCollections([makeCollection()]);
  const rawVariables = transformVariables([makeColorVariable()], collections);
  const components = transformComponents([
    makeComponent({
      id: 'c:1',
      name: 'Button',
      pageName: 'Components',
      boundVariableIds: ['var:1'],
    }),
    makeComponent({
      id: 'c:2',
      name: 'Playground Card',
      pageName: 'Playground',
      boundVariableIds: [],
    }),
  ]);
  const variables = computeVariableUsage(rawVariables, components);
  const styles = { text: [], color: [], effect: [], grid: [] };
  const base = { collections, variables, styles, components };

  return {
    metadata: { fileName: 'Fixture', generatedAt: '2026-01-01', pluginVersion: '1.0.0' },
    ...base,
    summary: buildSummary(base),
    warnings: [],
  };
}

describe('filterDesignSystemByPages', () => {
  it('returns the same system unchanged when no pages are excluded', () => {
    const ds = makeSystem();
    expect(filterDesignSystemByPages(ds, [])).toBe(ds);
  });

  it('drops components on excluded pages', () => {
    const ds = makeSystem();
    const filtered = filterDesignSystemByPages(ds, ['Playground']);
    expect(filtered.components.map((c) => c.name)).toEqual(['Button']);
  });

  it('recomputes summary counts to reflect the filtered components', () => {
    const ds = makeSystem();
    expect(ds.summary.componentSetsCount).toBe(2);
    const filtered = filterDesignSystemByPages(ds, ['Playground']);
    expect(filtered.summary.componentSetsCount).toBe(1);
  });

  it('leaves variables/collections/styles untouched since they are not page-scoped', () => {
    const ds = makeSystem();
    const filtered = filterDesignSystemByPages(ds, ['Playground']);
    expect(filtered.collections).toBe(ds.collections);
    expect(filtered.styles).toBe(ds.styles);
    expect(filtered.summary.variablesCount).toBe(ds.summary.variablesCount);
  });

  it('excluding a page every component belongs to results in an empty component list', () => {
    const ds = makeSystem();
    const filtered = filterDesignSystemByPages(ds, ['Components', 'Playground']);
    expect(filtered.components).toEqual([]);
  });
});
