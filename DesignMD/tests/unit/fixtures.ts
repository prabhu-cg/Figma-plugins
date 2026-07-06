import type {
  RawComponent,
  RawEffectStyle,
  RawGridStyle,
  RawPaintStyle,
  RawTextStyle,
  RawVariable,
  RawVariableCollection,
} from '../../src/plugin/extraction/rawTypes';
import type { DesignSystem } from '../../src/shared/types';
import { transformToDesignSystem } from '../../src/plugin/transform';

export function makeCollection(
  overrides: Partial<RawVariableCollection> = {},
): RawVariableCollection {
  return {
    id: 'collection:1',
    name: 'Colors',
    modes: [
      { modeId: 'mode:light', name: 'Light' },
      { modeId: 'mode:dark', name: 'Dark' },
    ],
    defaultModeId: 'mode:light',
    variableIds: ['var:1'],
    hiddenFromPublishing: false,
    ...overrides,
  };
}

export function makeColorVariable(overrides: Partial<RawVariable> = {}): RawVariable {
  return {
    id: 'var:1',
    name: 'Color/Primary/500',
    variableCollectionId: 'collection:1',
    resolvedType: 'COLOR',
    description: 'Primary brand color',
    scopes: ['ALL_FILLS'],
    codeSyntax: {},
    valuesByMode: [
      { modeId: 'mode:light', value: { kind: 'color', r: 0.2, g: 0.4, b: 1, a: 1 } },
      { modeId: 'mode:dark', value: { kind: 'color', r: 0.1, g: 0.2, b: 0.6, a: 1 } },
    ],
    ...overrides,
  };
}

export function makeAliasVariable(overrides: Partial<RawVariable> = {}): RawVariable {
  return {
    id: 'var:2',
    name: 'Semantic/Color/Danger',
    variableCollectionId: 'collection:1',
    resolvedType: 'COLOR',
    description: '',
    scopes: [],
    codeSyntax: {},
    valuesByMode: [{ modeId: 'mode:light', value: { kind: 'alias', variableId: 'var:1' } }],
    ...overrides,
  };
}

export function makeTextStyle(overrides: Partial<RawTextStyle> = {}): RawTextStyle {
  return {
    id: 'style:text:1',
    name: 'Heading/Large',
    description: '',
    fontFamily: 'Inter',
    fontStyle: 'Bold',
    fontWeight: 700,
    fontSize: 32,
    lineHeight: '120%',
    letterSpacing: '0px',
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    paragraphSpacing: 0,
    boundVariableIds: [],
    ...overrides,
  };
}

export function makePaintStyle(overrides: Partial<RawPaintStyle> = {}): RawPaintStyle {
  return {
    id: 'style:paint:1',
    name: 'Surface/Background',
    description: '',
    color: { r: 1, g: 1, b: 1, a: 1 },
    isGradientOrImage: false,
    boundVariableIds: [],
    ...overrides,
  };
}

export function makeEffectStyle(overrides: Partial<RawEffectStyle> = {}): RawEffectStyle {
  return {
    id: 'style:effect:1',
    name: 'Elevation/Card',
    description: '',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offsetX: 0,
        offsetY: 2,
        radius: 8,
        spread: 0,
        visible: true,
      },
    ],
    boundVariableIds: [],
    ...overrides,
  };
}

export function makeGridStyle(overrides: Partial<RawGridStyle> = {}): RawGridStyle {
  return {
    id: 'style:grid:1',
    name: 'Layout/12col',
    description: '',
    grids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, offset: 24 }],
    ...overrides,
  };
}

export function makeComponent(overrides: Partial<RawComponent> = {}): RawComponent {
  return {
    id: 'component:1',
    key: 'key:1',
    name: 'Button',
    description: 'A clickable button',
    isComponentSet: true,
    pageName: 'Components',
    properties: [{ name: 'Label', type: 'TEXT', defaultValue: 'Click me' }],
    variants: [
      {
        id: 'variant:1',
        name: 'Size=Large, State=Default',
        description: '',
        variantProperties: { Size: 'Large', State: 'Default' },
        boundVariableIds: ['var:1'],
      },
      {
        id: 'variant:2',
        name: 'Size=Small, State=Hover',
        description: '',
        variantProperties: { Size: 'Small', State: 'Hover' },
        boundVariableIds: ['var:1'],
      },
    ],
    boundVariableIds: ['var:1'],
    ...overrides,
  };
}

/** A small but representative DesignSystem, built through the real transform layer. */
export function makeDesignSystem(): DesignSystem {
  return transformToDesignSystem(
    {
      collections: [makeCollection()],
      variables: [makeColorVariable(), makeAliasVariable()],
      textStyles: [makeTextStyle()],
      paintStyles: [makePaintStyle()],
      effectStyles: [makeEffectStyle()],
      gridStyles: [makeGridStyle()],
      components: [makeComponent()],
      warnings: [],
    },
    'Fixture File',
  );
}
