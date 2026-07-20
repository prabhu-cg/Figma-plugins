import { describe, expect, it } from 'vitest';
import {
  isHiddenFromPublishing,
  type NamedAncestor,
} from '../../src/plugin/extraction/components';

function node(name: string, type: string, parent: NamedAncestor | null = null): NamedAncestor {
  return { name, type, parent };
}

describe('isHiddenFromPublishing', () => {
  it('is false for a plainly named component on a plainly named page', () => {
    const page = node('Components', 'PAGE');
    const component = node('Button', 'COMPONENT_SET', page);
    expect(isHiddenFromPublishing(component)).toBe(false);
  });

  it('is true when the component itself is dot-prefixed', () => {
    const page = node('Components', 'PAGE');
    const component = node('.Internal Button', 'COMPONENT', page);
    expect(isHiddenFromPublishing(component)).toBe(true);
  });

  it('is true when an ancestor frame is dot-prefixed', () => {
    const page = node('Components', 'PAGE');
    const frame = node('.wip', 'FRAME', page);
    const component = node('Button', 'COMPONENT_SET', frame);
    expect(isHiddenFromPublishing(component)).toBe(true);
  });

  it('is true when the containing page is dot-prefixed', () => {
    const page = node('.Archive', 'PAGE');
    const component = node('Button', 'COMPONENT_SET', page);
    expect(isHiddenFromPublishing(component)).toBe(true);
  });

  it('does not treat a leading dot with surrounding whitespace as visible', () => {
    const page = node('Components', 'PAGE');
    const component = node('  .hidden', 'COMPONENT', page);
    expect(isHiddenFromPublishing(component)).toBe(true);
  });

  it('never inspects past the page (the document root name is not a hide signal)', () => {
    const document = node('.My File Name', 'DOCUMENT');
    const page = node('Components', 'PAGE', document);
    const component = node('Button', 'COMPONENT_SET', page);
    expect(isHiddenFromPublishing(component)).toBe(false);
  });
});
