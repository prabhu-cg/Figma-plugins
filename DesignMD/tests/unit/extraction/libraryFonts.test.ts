import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractDesignSystem } from '../../../src/plugin/extraction';
import { generateCssFile } from '../../../src/plugin/generators/cssFile';
import { generateDesignMd } from '../../../src/plugin/generators/designMd';
import { generateTokensJson } from '../../../src/plugin/generators/tokensJson';
import { transformToDesignSystem } from '../../../src/plugin/transform';
import {
  component,
  document,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
} from '../helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const libraryTextStyle = (id: string, name: string) => ({
  id,
  type: 'TEXT',
  name,
  description: '',
  // no fontName: Figma did not report the font of this library style
  fontSize: 16,
  lineHeight: { unit: 'PIXELS', value: 24 },
  letterSpacing: { unit: 'PIXELS', value: 0 },
  textCase: 'ORIGINAL',
  textDecoration: 'NONE',
  paragraphSpacing: 0,
  boundVariables: {},
});
const textLayer = (props: object) =>
  node('TEXT', 'Label', { visible: true, characters: 'Hi', ...props });
const fileWith = (layer: ReturnType<typeof textLayer>) =>
  document('F', [page('P', [component('Card', {}, [layer])])]);

describe('a library text style whose font Figma does not report', () => {
  it('takes the font from a text layer that uses it', async () => {
    installFakeFigma({
      root: fileWith(
        textLayer({ textStyleId: 'S:lib,1:1', fontName: { family: 'Roboto', style: 'Bold' } }),
      ),
      libraryStyles: [libraryTextStyle('S:lib,1:1', 'Body/Strong')],
    });
    const raw = await extractDesignSystem();
    const style = raw.textStyles.find((s) => s.id === 'S:lib,1:1')!;
    expect(style).toMatchObject({
      library: true,
      fontFamily: 'Roboto',
      fontStyle: 'Bold',
      fontWeight: 700,
      fontSize: 16,
    });
  });

  it('reads the first character when the layer mixes fonts', async () => {
    installFakeFigma({
      root: fileWith(
        textLayer({
          textStyleId: 'S:lib,1:1',
          fontName: Symbol('figma.mixed'),
          getRangeFontName: () => ({ family: 'Inter', style: 'Medium' }),
        }),
      ),
      libraryStyles: [libraryTextStyle('S:lib,1:1', 'Body/Strong')],
    });
    const raw = await extractDesignSystem();
    expect(raw.textStyles.find((s) => s.id === 'S:lib,1:1')).toMatchObject({
      fontFamily: 'Inter',
      fontWeight: 500,
    });
  });

  it('stays unknown, and no output writes "Unknown" as a font, when no layer can say', async () => {
    installFakeFigma({
      root: fileWith(textLayer({ textStyleId: 'S:lib,1:1' })), // the layer has no fontName either
      libraryStyles: [libraryTextStyle('S:lib,1:1', 'Body/Strong')],
    });
    const raw = await extractDesignSystem();
    expect(raw.textStyles.find((s) => s.id === 'S:lib,1:1')!.fontFamily).toBe('Unknown');
    const ds = transformToDesignSystem(raw, 'F');
    expect(generateCssFile(ds).content).not.toContain('Unknown');
    expect(generateCssFile(ds).content).toContain('--body-strong-font-size: 16px;');
    const tokens = JSON.parse(generateTokensJson(ds).content);
    expect(tokens.typography.library.Body.Strong.$value.fontFamily).toBeUndefined();
    expect(tokens.typography.library.Body.Strong.$value.fontSize).toBe('16px');
    const md = generateDesignMd(ds).content;
    expect(md).not.toContain('Unknown');
    expect(md).toContain('Body/Strong (library) | --body-strong | — | 16');
  });
});
