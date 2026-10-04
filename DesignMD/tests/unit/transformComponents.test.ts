import { describe, expect, it } from 'vitest';
import { transformComponents } from '../../src/plugin/transform/components';
import { makeComponent } from './fixtures';

describe('transformComponents', () => {
  it('infers sizes and states from variant properties', () => {
    const [doc] = transformComponents([makeComponent()]);
    expect(doc.sizes.sort()).toEqual(['Large', 'Small']);
    expect(doc.states.sort()).toEqual(['Default', 'Hover']);
  });

  it('carries through component properties and variants', () => {
    const [doc] = transformComponents([makeComponent()]);
    expect(doc.properties).toEqual([
      { name: 'Label', type: 'TEXT', defaultValue: 'Click me', variantOptions: undefined },
    ]);
    expect(doc.variants).toHaveLength(2);
  });

  it('links components that share bound variables as related, excluding itself', () => {
    const a = makeComponent({ id: 'a', name: 'Button', boundVariableIds: ['var:1'] });
    const b = makeComponent({ id: 'b', name: 'IconButton', boundVariableIds: ['var:1'] });
    const c = makeComponent({ id: 'c', name: 'Unrelated', boundVariableIds: ['var:9'] });

    const docs = transformComponents([a, b, c]);
    const buttonDoc = docs.find((d) => d.id === 'a')!;

    expect(buttonDoc.relatedComponentNames).toContain('IconButton');
    expect(buttonDoc.relatedComponentNames).not.toContain('Unrelated');
    expect(buttonDoc.relatedComponentNames).not.toContain('Button');
  });

  it('leaves relatedComponentNames empty when a component has no bound variables', () => {
    const [doc] = transformComponents([makeComponent({ boundVariableIds: [] })]);
    expect(doc.relatedComponentNames).toEqual([]);
  });
});

describe('transformComponents related components', () => {
  it('ignores tokens bound by most components once the system is large', () => {
    const shared = Array.from({ length: 40 }, (_, i) =>
      makeComponent({ id: `c${i}`, name: `Comp${i}`, boundVariableIds: ['var:common'] }),
    );
    const docs = transformComponents(shared);
    expect(docs[0].relatedComponentNames).toEqual([]);
  });

  it('ranks components sharing more (and rarer) tokens first and caps the list', () => {
    const a = makeComponent({ id: 'a', name: 'A', boundVariableIds: ['v1', 'v2', 'v3'] });
    const strong = makeComponent({ id: 'b', name: 'Strong', boundVariableIds: ['v1', 'v2', 'v3'] });
    const weak = makeComponent({ id: 'c', name: 'Weak', boundVariableIds: ['v1'] });
    const [doc] = transformComponents([a, weak, strong]);
    expect(doc.relatedComponentNames).toEqual(['Strong', 'Weak']);

    const many = Array.from({ length: 15 }, (_, i) =>
      makeComponent({ id: `m${i}`, name: `M${i}`, boundVariableIds: ['v1'] }),
    );
    const [first] = transformComponents(many);
    expect(first.relatedComponentNames).toHaveLength(10);
  });
});
