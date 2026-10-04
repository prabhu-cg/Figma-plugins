import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractVariableCollections } from '../../../src/plugin/extraction/variables';
import { fakeCollection, fakeVariable, installFakeFigma, resetFakeIds } from '../helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const warnings = () => {
  const list: string[] = [];
  return { list, warn: (m: string) => list.push(m) };
};

describe('extractVariableCollections', () => {
  it('maps collections, modes, and the default mode', async () => {
    installFakeFigma({
      collections: [fakeCollection({ variableIds: ['v1'], hiddenFromPublishing: true })],
      variables: [fakeVariable({ id: 'v1' })],
    });
    const { collections } = await extractVariableCollections();
    expect(collections).toEqual([
      {
        id: 'VariableCollectionId:1',
        name: 'Colors',
        modes: [
          { modeId: 'm:light', name: 'Light' },
          { modeId: 'm:dark', name: 'Dark' },
        ],
        defaultModeId: 'm:light',
        variableIds: ['v1'],
        hiddenFromPublishing: true,
      },
    ]);
  });

  it('converts every Figma value kind: color, float, string, boolean, alias, unknown', async () => {
    installFakeFigma({
      collections: [fakeCollection({ variableIds: ['c', 'f', 's', 'b', 'a', 'n'] })],
      variables: [
        fakeVariable({ id: 'c', valuesByMode: { m: { r: 0.1, g: 0.2, b: 0.3 } } }),
        fakeVariable({ id: 'f', resolvedType: 'FLOAT', valuesByMode: { m: 16 } }),
        fakeVariable({ id: 's', resolvedType: 'STRING', valuesByMode: { m: 'Inter' } }),
        fakeVariable({ id: 'b', resolvedType: 'BOOLEAN', valuesByMode: { m: false } }),
        fakeVariable({
          id: 'a',
          valuesByMode: { m: { type: 'VARIABLE_ALIAS', id: 'c' } },
        }),
        fakeVariable({ id: 'n', valuesByMode: { m: null } }),
      ],
    });
    const { variables } = await extractVariableCollections();
    const valueOf = (id: string) => variables.find((v) => v.id === id)!.valuesByMode[0].value;

    // RGB without alpha defaults to fully opaque.
    expect(valueOf('c')).toEqual({ kind: 'color', r: 0.1, g: 0.2, b: 0.3, a: 1 });
    expect(valueOf('f')).toEqual({ kind: 'float', value: 16 });
    expect(valueOf('s')).toEqual({ kind: 'string', value: 'Inter' });
    expect(valueOf('b')).toEqual({ kind: 'boolean', value: false });
    expect(valueOf('a')).toEqual({ kind: 'alias', variableId: 'c' });
    expect(valueOf('n')).toEqual({ kind: 'unknown' });
  });

  it('carries description, scopes, code syntax, and the hidden flag, with safe defaults', async () => {
    installFakeFigma({
      collections: [fakeCollection({ variableIds: ['v1', 'v2'] })],
      variables: [
        fakeVariable({
          id: 'v1',
          description: 'Brand color',
          scopes: ['ALL_FILLS'],
          codeSyntax: { WEB: 'var(--brand)' },
          hiddenFromPublishing: true,
        }),
        fakeVariable({
          id: 'v2',
          description: undefined,
          scopes: undefined,
          codeSyntax: undefined,
        }),
      ],
    });
    const { variables } = await extractVariableCollections();
    expect(variables[0]).toMatchObject({
      description: 'Brand color',
      scopes: ['ALL_FILLS'],
      codeSyntax: { WEB: 'var(--brand)' },
      hiddenFromPublishing: true,
    });
    expect(variables[1]).toMatchObject({
      description: '',
      scopes: [],
      codeSyntax: {},
      hiddenFromPublishing: false,
    });
  });

  it('deduplicates variable ids shared across collections and looks each up once', async () => {
    const handle = installFakeFigma({
      collections: [
        fakeCollection({ id: 'c1', variableIds: ['v1', 'v2'] }),
        fakeCollection({ id: 'c2', variableIds: ['v2', 'v3'] }),
      ],
      variables: ['v1', 'v2', 'v3'].map((id) => fakeVariable({ id, variableCollectionId: 'c1' })),
    });
    const { variables } = await extractVariableCollections();
    expect(variables.map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
    expect(handle.calls.variableLookups).toEqual(['v1', 'v2', 'v3']);
  });

  it('warns and skips a variable whose lookup fails, keeping the rest', async () => {
    installFakeFigma({
      collections: [fakeCollection({ variableIds: ['ok', 'bad'] })],
      variables: [fakeVariable({ id: 'ok' }), fakeVariable({ id: 'bad' })],
      failures: { variableIds: ['bad'] },
    });
    const { list, warn } = warnings();
    const { variables } = await extractVariableCollections(undefined, warn);
    expect(variables.map((v) => v.id)).toEqual(['ok']);
    expect(list).toHaveLength(1);
    expect(list[0]).toContain('Failed to load variable bad');
  });

  it('silently skips ids that resolve to nothing (deleted/remote variables)', async () => {
    installFakeFigma({ collections: [fakeCollection({ variableIds: ['gone'] })], variables: [] });
    const { list, warn } = warnings();
    const { variables } = await extractVariableCollections(undefined, warn);
    expect(variables).toEqual([]);
    expect(list).toEqual([]);
  });

  it('warns when a variable points at a collection that was not returned', async () => {
    installFakeFigma({
      collections: [fakeCollection({ id: 'c1', variableIds: ['v1'] })],
      variables: [fakeVariable({ id: 'v1', variableCollectionId: 'missing' })],
    });
    const { list, warn } = warnings();
    await extractVariableCollections(undefined, warn);
    expect(list.some((m) => m.includes('missing collection'))).toBe(true);
  });

  it('returns empty results and a warning when collections cannot be loaded', async () => {
    installFakeFigma({ failures: { collections: true } });
    const { list, warn } = warnings();
    const result = await extractVariableCollections(undefined, warn);
    expect(result).toEqual({ collections: [], variables: [] });
    expect(list[0]).toContain('Failed to load variable collections');
  });

  it('reports progress in batches ending at the total', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `v${i}`);
    installFakeFigma({
      collections: [fakeCollection({ variableIds: ids })],
      variables: ids.map((id) => fakeVariable({ id })),
    });
    const onProgress = vi.fn();
    await extractVariableCollections(onProgress);
    // Batch size is 200: 200, 400, 450.
    expect(onProgress.mock.calls).toEqual([
      [200, 450],
      [400, 450],
      [450, 450],
    ]);
  });
});
