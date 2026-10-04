import { describe, expect, it } from 'vitest';
import { transformToDesignSystem } from '../../src/plugin/transform';
import { makeAliasVariable, makeCollection, makeColorVariable, makeComponent } from './fixtures';

function build(overrides: {
  collections?: ReturnType<typeof makeCollection>[];
  variables?: ReturnType<typeof makeColorVariable>[];
  components?: ReturnType<typeof makeComponent>[];
}) {
  return transformToDesignSystem(
    {
      collections: overrides.collections ?? [makeCollection({ variableIds: ['var:1', 'var:2'] })],
      variables: overrides.variables ?? [makeColorVariable(), makeAliasVariable()],
      textStyles: [],
      paintStyles: [],
      effectStyles: [],
      gridStyles: [],
      components: overrides.components ?? [],
      warnings: [],
    },
    'File',
  );
}

describe('hidden-from-publishing variables', () => {
  it('drops every variable (and the collection) when the collection is hidden', () => {
    const ds = build({ collections: [makeCollection({ hiddenFromPublishing: true })] });
    expect(ds.variables).toEqual([]);
    expect(ds.collections).toEqual([]);
    expect(ds.warnings.some((w) => w.includes('hidden from publishing'))).toBe(true);
  });

  it('drops variables flagged hidden or named/grouped with a leading "."', () => {
    const ds = build({
      variables: [
        makeColorVariable({ hiddenFromPublishing: true }),
        makeAliasVariable({ name: 'Color/.internal/Danger' }),
        makeColorVariable({ id: 'var:3', name: 'Color/Visible' }),
      ],
      collections: [makeCollection({ variableIds: ['var:1', 'var:2', 'var:3'] })],
    });
    expect(ds.variables.map((v) => v.id)).toEqual(['var:3']);
    expect(ds.collections[0].variableIds).toEqual(['var:3']);
    expect(ds.summary.variablesCount).toBe(1);
  });

  it('inlines the value of a hidden alias target so no dangling reference remains', () => {
    const ds = build({
      variables: [makeColorVariable({ hiddenFromPublishing: true }), makeAliasVariable()],
    });
    const alias = ds.variables.find((v) => v.id === 'var:2')!;
    expect(alias.valuesByMode[0].value).toMatchObject({ kind: 'color' });
  });

  it('does not report hidden variables as bound by components', () => {
    const ds = build({
      variables: [makeColorVariable({ hiddenFromPublishing: true }), makeAliasVariable()],
      components: [makeComponent({ boundVariableIds: ['var:1', 'var:2'] })],
    });
    expect(ds.components[0].boundVariableIds).toEqual(['var:2']);
  });

  it('counts variables used through a style applied by a component', () => {
    const ds = transformToDesignSystem(
      {
        collections: [makeCollection({ variableIds: ['var:1'] })],
        variables: [makeColorVariable()],
        textStyles: [
          {
            id: 'style:t',
            name: 'Body',
            description: '',
            fontFamily: 'Inter',
            fontStyle: 'Regular',
            fontWeight: 400,
            fontSize: 12,
            lineHeight: 'AUTO',
            letterSpacing: '0px',
            textCase: 'ORIGINAL',
            textDecoration: 'NONE',
            paragraphSpacing: 0,
            boundVariableIds: ['var:1'],
          },
        ],
        paintStyles: [],
        effectStyles: [],
        gridStyles: [],
        components: [makeComponent({ boundVariableIds: [], styleIds: ['style:t'] })],
        warnings: [],
      },
      'File',
    );
    expect(ds.variables[0].usedByComponents).toEqual(['Button']);
  });
});
