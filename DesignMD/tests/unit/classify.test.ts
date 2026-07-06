import { describe, expect, it } from 'vitest';
import { classifyVariable } from '../../src/plugin/transform/classify';

describe('classifyVariable', () => {
  it('classifies COLOR resolved type as color', () => {
    expect(classifyVariable('Color/Primary/500', 'COLOR', [])).toBe('color');
  });

  it('classifies BOOLEAN resolved type as boolean', () => {
    expect(classifyVariable('Enabled', 'BOOLEAN', [])).toBe('boolean');
  });

  it('classifies FLOAT with spacing hints in the name as spacing', () => {
    expect(classifyVariable('Spacing/md', 'FLOAT', [])).toBe('spacing');
    expect(classifyVariable('Radius/lg', 'FLOAT', [])).toBe('spacing');
  });

  it('classifies FLOAT with typography scopes as typography', () => {
    expect(classifyVariable('Body/size', 'FLOAT', ['FONT_SIZE'])).toBe('typography');
  });

  it('classifies FLOAT with GAP scope as spacing', () => {
    expect(classifyVariable('Layout/gap', 'FLOAT', ['GAP'])).toBe('spacing');
  });

  it('falls back to number for unrecognized FLOAT names', () => {
    expect(classifyVariable('Misc/value', 'FLOAT', [])).toBe('number');
  });

  it('classifies STRING with typography hints as typography', () => {
    expect(classifyVariable('Font/family', 'STRING', [])).toBe('typography');
  });

  it('falls back to string for unrecognized STRING names', () => {
    expect(classifyVariable('Misc/label', 'STRING', [])).toBe('string');
  });

  it('gives semantic and component name hints priority over resolved type', () => {
    expect(classifyVariable('Semantic/Color/Danger', 'COLOR', [])).toBe('semantic');
    expect(classifyVariable('Component/Button/Radius', 'FLOAT', [])).toBe('component');
  });
});
