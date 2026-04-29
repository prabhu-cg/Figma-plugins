# Design to Doc — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Design to Doc Figma plugin project and implement the fully-tested Inference Engine — the pure-logic core that infers semantic meaning from naming conventions, classifies variants/states, maps anatomy, and scores documentation health.

**Architecture:** Project setup (manifest, webpack, jest) → TypeScript schema type contracts → WCAG utility → five Inference Engine modules (naming parser, color roles, typography roles, variant classifier, anatomy mapper) → all covered by Jest unit tests with no Figma API dependency.

**Tech Stack:** TypeScript 5, React 18, Webpack 5, Jest 29, ts-jest, @figma/plugin-typings

**Deliverable:** `npm test` passes with full inference engine coverage. `npm run build` produces `dist/main.js` and `dist/ui.html`.

---

## File Map

| File | Responsibility |
|---|---|
| `manifest.json` | Figma plugin manifest — declares entry points and permissions |
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript config for plugin build (excludes tests) |
| `tsconfig.test.json` | TypeScript config for Jest (includes tests) |
| `webpack.config.js` | Dual-entry bundle: plugin sandbox + React UI inlined into HTML |
| `jest.config.js` | Jest with ts-jest, figma global mock, module aliases |
| `tests/__setup__/figma-mock.ts` | Mocks the `figma` global so tests run in Node.js |
| `src/types/schemas.ts` | All TypeScript interfaces for the 4 domain schemas (the contract) |
| `src/types/raw.ts` | Shapes for raw unprocessed Figma API output |
| `src/types/messages.ts` | postMessage protocol between plugin sandbox and UI |
| `src/plugin/inference/wcag.ts` | Relative luminance + contrast ratio + WCAG AA/AAA checks |
| `src/plugin/inference/naming-parser.ts` | Separator detection, segment extraction, label humanization |
| `src/plugin/inference/color-roles.ts` | Maps token names to semantic color roles |
| `src/plugin/inference/type-roles.ts` | Maps token names to typography roles |
| `src/plugin/inference/variant-classifier.ts` | Classifies Figma component properties as variant vs. state |
| `src/plugin/inference/anatomy-mapper.ts` | Maps layer names to anatomy roles |
| `tests/inference/wcag.test.ts` | Unit tests for WCAG utility |
| `tests/inference/naming-parser.test.ts` | Unit tests for naming parser |
| `tests/inference/color-roles.test.ts` | Unit tests for color role inference |
| `tests/inference/type-roles.test.ts` | Unit tests for typography role inference |
| `tests/inference/variant-classifier.test.ts` | Unit tests for variant classifier |
| `tests/inference/anatomy-mapper.test.ts` | Unit tests for anatomy mapper |

---

## Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.test.json`

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "name": "Design to Doc",
  "id": "design-to-doc-plugin",
  "api": "1.0.0",
  "main": "dist/main.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "permissions": ["currentuser", "filecontents"]
}
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "design-to-doc",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "webpack --mode production",
    "watch": "webpack --mode development --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@figma/plugin-typings": "*",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/jest": "^29.5.0",
    "css-loader": "^6.10.0",
    "html-inline-script-webpack-plugin": "^3.2.0",
    "html-webpack-plugin": "^5.6.0",
    "jest": "^29.7.0",
    "style-loader": "^3.3.4",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.5.0",
    "typescript": "^5.4.0",
    "webpack": "^5.91.0",
    "webpack-cli": "^5.1.0"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2017",
    "lib": ["es2017", "dom"],
    "module": "commonjs",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created with no peer dependency errors.

- [ ] **Step 6: Commit**

```bash
git add manifest.json package.json tsconfig.json tsconfig.test.json package-lock.json
git commit -m "chore: scaffold project with manifest, package.json, and tsconfig"
```

---

## Task 2: Webpack + Jest Configuration

**Files:**
- Create: `webpack.config.js`
- Create: `jest.config.js`
- Create: `tests/__setup__/figma-mock.ts`
- Create: `src/ui/index.html` (stub)
- Create: `src/plugin/main.ts` (stub)
- Create: `src/ui/App.tsx` (stub)

- [ ] **Step 1: Create `webpack.config.js`**

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',
  entry: {
    main: './src/plugin/main.ts',
    ui: './src/ui/App.tsx',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui/index.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
    }),
    new HtmlInlineScriptPlugin(),
  ],
});
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/__setup__/figma-mock.ts'],
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.test.json' },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 3: Create `tests/__setup__/figma-mock.ts`**

```typescript
const makeFigmaFrame = () => ({
  id: 'mock-frame-id',
  name: '',
  type: 'FRAME' as const,
  layoutMode: 'NONE' as const,
  primaryAxisSizingMode: 'AUTO' as const,
  counterAxisSizingMode: 'AUTO' as const,
  itemSpacing: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  cornerRadius: 0,
  fills: [] as Paint[],
  strokes: [] as Paint[],
  effects: [] as Effect[],
  children: [] as SceneNode[],
  appendChild: jest.fn(),
  insertChild: jest.fn(),
  resize: jest.fn(),
  remove: jest.fn(),
});

const makeFigmaText = () => ({
  id: 'mock-text-id',
  name: '',
  type: 'TEXT' as const,
  characters: '',
  fontSize: 12,
  fontName: { family: 'Inter', style: 'Regular' } as FontName,
  fills: [] as Paint[],
  textAlignHorizontal: 'LEFT' as const,
  resize: jest.fn(),
  remove: jest.fn(),
});

const figmaMock = {
  getLocalPaintStyles: jest.fn(() => []),
  getLocalTextStyles: jest.fn(() => []),
  getLocalEffectStyles: jest.fn(() => []),
  getLocalGridStyles: jest.fn(() => []),
  variables: {
    getLocalVariableCollections: jest.fn(() => []),
    getLocalVariables: jest.fn(() => []),
  },
  currentPage: {
    name: 'Page 1',
    id: 'page-1',
    selection: [] as SceneNode[],
    appendChild: jest.fn(),
    findAll: jest.fn(() => []),
  },
  root: {
    name: 'Test File',
    id: 'root',
  },
  createFrame: jest.fn(() => makeFigmaFrame()),
  createText: jest.fn(() => makeFigmaText()),
  createRectangle: jest.fn(() => ({
    id: 'mock-rect',
    fills: [] as Paint[],
    resize: jest.fn(),
    remove: jest.fn(),
  })),
  loadFontAsync: jest.fn(() => Promise.resolve()),
  notify: jest.fn(),
  showUI: jest.fn(),
  ui: {
    postMessage: jest.fn(),
    onmessage: null,
  },
  on: jest.fn(),
  off: jest.fn(),
};

(global as any).figma = figmaMock;
```

- [ ] **Step 4: Create stub entry points**

Create `src/plugin/main.ts`:
```typescript
// Plugin sandbox entry point — implemented in Plan 4
figma.showUI(__html__, { width: 340, height: 480 });
```

Create `src/ui/App.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <div>Design to Doc</div>;
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

Create `src/ui/index.html`:
```html
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Design to Doc</title></head>
  <body><div id="root"></div></body>
</html>
```

- [ ] **Step 5: Verify build succeeds**

```bash
npm run build
```

Expected: `dist/main.js` and `dist/ui.html` created with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add webpack.config.js jest.config.js tests/ src/plugin/main.ts src/ui/
git commit -m "chore: add webpack build, jest config, and figma global mock"
```

---

## Task 3: TypeScript Type Contracts

**Files:**
- Create: `src/types/schemas.ts`
- Create: `src/types/raw.ts`
- Create: `src/types/messages.ts`

- [ ] **Step 1: Create `src/types/schemas.ts`**

```typescript
// ─── Source ───────────────────────────────────────────────────────────────────

export interface SourceInfo {
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
  selectionIds: string[];
}

// ─── Root Manifest ────────────────────────────────────────────────────────────

export interface RootManifest {
  version: string;
  generatedAt: string;
  source: SourceInfo;
  domains: {
    foundations: FoundationsSchema;
    components: ComponentsSchema;
    metadata: MetadataSchema;
    health: HealthSchema;
  };
}

// ─── Foundations ──────────────────────────────────────────────────────────────

export type SemanticColorRole =
  | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  | 'neutral' | 'surface' | 'on-surface' | 'unknown';

export type TokenSource = 'style' | 'variable';

export interface RgbValue {
  r: number;
  g: number;
  b: number;
}

export interface ColorToken {
  id: string;
  tokenName: string;
  label: string;
  value: { hex: string; rgb: RgbValue };
  semanticRole: SemanticColorRole;
  source: TokenSource;
  variableMode: string | null;
  aliases: string[];
  contrastOnWhite: number;
  contrastOnBlack: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  usageHint: string;
}

export type TypographyRole =
  | 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body-lg' | 'body-md' | 'body-sm'
  | 'caption' | 'label' | 'code' | 'overline' | 'unknown';

export type LineHeightUnit = 'px' | '%' | 'auto';
export type LetterSpacingUnit = 'px' | '%';
export type TextCaseValue = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TextDecorationValue = 'none' | 'underline' | 'strikethrough';

export interface TypographyToken {
  id: string;
  tokenName: string;
  label: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: { value: number; unit: LineHeightUnit };
  letterSpacing: { value: number; unit: LetterSpacingUnit };
  textCase: TextCaseValue;
  textDecoration: TextDecorationValue;
  role: TypographyRole;
  source: TokenSource;
  usageHint: string;
}

export interface SpacingToken {
  tokenName: string;
  label: string;
  value: number;
  unit: 'px';
  scaleBase: number;
  scaleStep: number;
  usageHint: string;
}

export type BreakpointHint = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'unknown';
export type GridType = 'columns' | 'rows' | 'grid';

export interface GridToken {
  tokenName: string;
  label: string;
  type: GridType;
  count: number;
  gutter: number;
  margin: number;
  sectionSize: number;
  breakpointHint: BreakpointHint;
}

export interface FoundationsSchema {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  grids: GridToken[];
}

// ─── Components ───────────────────────────────────────────────────────────────

export type ComponentCategory = 'atom' | 'molecule' | 'organism' | 'template' | 'unknown';
export type AnatomyRole = 'text' | 'icon' | 'container' | 'indicator' | 'media' | 'unknown';
export type VariantGroupType = 'variant' | 'state';
export type AccessibilityRole = 'button' | 'link' | 'input' | 'checkbox' | 'radio' | 'listitem' | 'unknown';

export interface AnatomyPart {
  partName: string;
  nodeId: string;
  role: AnatomyRole;
}

export interface VariantGroup {
  property: string;
  type: VariantGroupType;
  values: string[];
}

export interface ComponentVariant {
  id: string;
  combination: Record<string, string>;
  nodeId: string;
}

export interface TokenBindings {
  colors: string[];
  typography: string[];
  spacing: string[];
  effects: string[];
}

export interface AccessibilityNotes {
  role: AccessibilityRole;
  keyboardInteraction: string;
  ariaAttributes: string[];
}

export interface UsageGuidelines {
  when: string[];
  whenNot: string[];
  antiPatterns: string[];
}

export interface ComponentDoc {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  anatomy: AnatomyPart[];
  variantGroups: VariantGroup[];
  variants: ComponentVariant[];
  states: string[];
  tokenBindings: TokenBindings;
  accessibilityNotes: AccessibilityNotes;
  usageGuidelines: UsageGuidelines;
  doExamples: Array<{ label: string; description: string }>;
  dontExamples: Array<{ label: string; description: string }>;
}

export interface ComponentsSchema {
  components: ComponentDoc[];
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface MetadataCounts {
  colorTokens: number;
  typographyTokens: number;
  spacingTokens: number;
  gridTokens: number;
  components: number;
  variants: number;
  tokenBindings: number;
}

export interface MetadataSchema {
  pluginVersion: string;
  schemaVersion: string;
  generatedAt: string;
  source: Pick<SourceInfo, 'fileKey' | 'fileName' | 'selectionIds'>;
  counts: MetadataCounts;
  exportFormats: string[];
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type WarningSeverity = 'error' | 'warning' | 'info';
export type HealthDomain = 'foundations' | 'components' | 'metadata';
export type WarningCode =
  | 'MISSING_DESCRIPTION' | 'UNLINKED_TOKEN' | 'INCONSISTENT_NAMING'
  | 'NO_STATES' | 'NO_VARIANTS' | 'HARDCODED_VALUE';

export interface HealthWarning {
  severity: WarningSeverity;
  domain: HealthDomain;
  itemId: string;
  itemName: string;
  code: WarningCode;
  message: string;
  suggestion: string;
}

export interface MissingField {
  domain: string;
  itemId: string;
  field: string;
}

export interface HealthBreakdown {
  foundationsScore: number;
  componentsScore: number;
  tokenCoverageScore: number;
  namingConsistencyScore: number;
}

export interface NamingPatterns {
  detected: string[];
  consistent: boolean;
  recommendation: string;
}

export interface HealthSchema {
  overallScore: number;
  breakdown: HealthBreakdown;
  warnings: HealthWarning[];
  missingFields: MissingField[];
  namingPatterns: NamingPatterns;
}
```

- [ ] **Step 2: Create `src/types/raw.ts`**

```typescript
// Raw shapes extracted directly from the Figma API — no inference applied.
// These types mirror the Figma API as closely as possible.

export interface RawColorStyle {
  id: string;
  name: string;
  paints: readonly Paint[];
}

export interface RawTextStyle {
  id: string;
  name: string;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
}

export interface RawEffectStyle {
  id: string;
  name: string;
  effects: readonly Effect[];
}

export interface RawGridStyle {
  id: string;
  name: string;
  grids: readonly LayoutGrid[];
}

export interface RawVariable {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, VariableValue>;
  aliasedVariableId: string | null;
}

export interface RawComponentNode {
  id: string;
  name: string;
  description: string;
  componentPropertyDefinitions: ComponentPropertyDefinitions;
  children: readonly SceneNode[];
  fills: readonly Paint[];
  strokes: readonly Paint[];
  effects: readonly Effect[];
  fillStyleId: string;
  strokeStyleId: string;
  effectStyleId: string;
  boundVariables: Record<string, VariableAlias | VariableAlias[]>;
}

export interface RawVariantNode {
  id: string;
  name: string;
  componentProperties: ComponentProperties;
  children: readonly SceneNode[];
  fills: readonly Paint[];
  strokes: readonly Paint[];
  effects: readonly Effect[];
  fillStyleId: string;
  textStyleId: string;
  effectStyleId: string;
}

export interface RawExtractionResult {
  colorStyles: RawColorStyle[];
  textStyles: RawTextStyle[];
  effectStyles: RawEffectStyle[];
  gridStyles: RawGridStyle[];
  colorVariables: RawVariable[];
  typographyVariables: RawVariable[];
  spacingVariables: RawVariable[];
  components: RawComponentNode[];
  variantsByComponentId: Record<string, RawVariantNode[]>;
  selectedNodeIds: string[];
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
}
```

- [ ] **Step 3: Create `src/types/messages.ts`**

```typescript
import type { RootManifest } from './schemas';

export type ProgressStep =
  | 'EXTRACTING_STYLES'
  | 'EXTRACTING_VARIABLES'
  | 'EXTRACTING_COMPONENTS'
  | 'BUILDING_SCHEMA'
  | 'RENDERING_FIGMA_PAGE'
  | 'EXPORTING_FILES';

export interface GenerationOptions {
  exportFigmaPage: boolean;
  exportMarkdown: boolean;
  exportHtml: boolean;
  exportJson: boolean;
}

export interface GenerationResult {
  manifest: RootManifest;
  exports: {
    markdown?: string;
    html?: string;
    json?: string;
    figmaPageId?: string;
  };
}

export type PluginToUiMessage =
  | { type: 'SELECTION_CHANGED'; count: number }
  | { type: 'PROGRESS'; step: ProgressStep; index: number; total: number; percent: number }
  | { type: 'COMPLETE'; result: GenerationResult }
  | { type: 'ERROR'; message: string };

export type UiToPluginMessage =
  | { type: 'GENERATE'; options: GenerationOptions }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'CANCEL' };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: No errors. If `@figma/plugin-typings` type errors appear for `Paint`, `FontName` etc., add `"types": []` to tsconfig and rely on the typeRoots.

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript schema, raw, and message type contracts"
```

---

## Task 4: WCAG Contrast Utilities

**Files:**
- Create: `src/plugin/inference/wcag.ts`
- Create: `tests/inference/wcag.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/wcag.test.ts`:

```typescript
import { relativeLuminance, contrastRatio, meetsWCAG_AA, meetsWCAG_AAA } from '@/plugin/inference/wcag';

describe('relativeLuminance', () => {
  it('returns 1 for white (255, 255, 255)', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
  });

  it('returns 0 for black (0, 0, 0)', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
  });

  it('returns ~0.2126 for pure red (255, 0, 0)', () => {
    expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });
});

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    const ratio = contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1 for identical colors', () => {
    const ratio = contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
    expect(ratio).toBeCloseTo(1, 4);
  });

  it('is commutative — same result regardless of order', () => {
    const a = { r: 59, g: 130, b: 246 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 4);
  });
});

describe('meetsWCAG_AA', () => {
  it('returns true for ratio >= 4.5', () => {
    expect(meetsWCAG_AA(4.5)).toBe(true);
    expect(meetsWCAG_AA(7.0)).toBe(true);
  });

  it('returns false for ratio < 4.5', () => {
    expect(meetsWCAG_AA(4.49)).toBe(false);
    expect(meetsWCAG_AA(2.0)).toBe(false);
  });
});

describe('meetsWCAG_AAA', () => {
  it('returns true for ratio >= 7.0', () => {
    expect(meetsWCAG_AAA(7.0)).toBe(true);
    expect(meetsWCAG_AAA(21.0)).toBe(true);
  });

  it('returns false for ratio < 7.0', () => {
    expect(meetsWCAG_AAA(6.99)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- wcag
```

Expected: FAIL — `Cannot find module '@/plugin/inference/wcag'`

- [ ] **Step 3: Implement `src/plugin/inference/wcag.ts`**

```typescript
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const la = relativeLuminance(a.r, a.g, a.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function meetsWCAG_AA(ratio: number): boolean {
  return ratio >= 4.5;
}

export function meetsWCAG_AAA(ratio: number): boolean {
  return ratio >= 7.0;
}

export function contrastOnWhite(rgb: RgbColor): number {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 });
}

export function contrastOnBlack(rgb: RgbColor): number {
  return contrastRatio(rgb, { r: 0, g: 0, b: 0 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- wcag
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/wcag.ts tests/inference/wcag.test.ts
git commit -m "feat: add WCAG contrast ratio and AA/AAA check utilities"
```

---

## Task 5: Naming Parser

**Files:**
- Create: `src/plugin/inference/naming-parser.ts`
- Create: `tests/inference/naming-parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/naming-parser.test.ts`:

```typescript
import { parseTokenName } from '@/plugin/inference/naming-parser';

describe('parseTokenName — separator detection', () => {
  it('detects slash separator', () => {
    const result = parseTokenName('color/primary/500');
    expect(result.separator).toBe('slash');
    expect(result.segments).toEqual(['color', 'primary', '500']);
  });

  it('detects dot separator', () => {
    const result = parseTokenName('color.primary.500');
    expect(result.separator).toBe('dot');
    expect(result.segments).toEqual(['color', 'primary', '500']);
  });

  it('detects space separator', () => {
    const result = parseTokenName('Color Primary 500');
    expect(result.separator).toBe('space');
    expect(result.segments).toEqual(['Color', 'Primary', '500']);
  });

  it('detects camelCase', () => {
    const result = parseTokenName('colorPrimary');
    expect(result.separator).toBe('camelCase');
    expect(result.segments).toHaveLength(2);
  });

  it('detects PascalCase', () => {
    const result = parseTokenName('ColorPrimary');
    expect(result.separator).toBe('PascalCase');
    expect(result.segments).toHaveLength(2);
  });

  it('falls back to unknown for single word', () => {
    const result = parseTokenName('primary');
    expect(result.separator).toBe('unknown');
    expect(result.segments).toEqual(['primary']);
  });
});

describe('parseTokenName — segment mapping', () => {
  it('maps domain, category, and scale from slash token', () => {
    const result = parseTokenName('color/primary/500');
    expect(result.domain).toBe('color');
    expect(result.category).toBe('primary');
    expect(result.scale).toBe('500');
  });

  it('maps domain only for two-segment token', () => {
    const result = parseTokenName('spacing/4');
    expect(result.domain).toBe('spacing');
    expect(result.category).toBe('4');
    expect(result.scale).toBe('');
  });
});

describe('parseTokenName — label humanization', () => {
  it('humanizes multi-segment labels by dropping domain', () => {
    expect(parseTokenName('color/primary/500').label).toBe('Primary 500');
  });

  it('humanizes single-segment label', () => {
    expect(parseTokenName('primary').label).toBe('Primary');
  });

  it('humanizes spacing token', () => {
    expect(parseTokenName('spacing/4').label).toBe('4');
  });

  it('humanizes text/heading/h1', () => {
    expect(parseTokenName('text/heading/h1').label).toBe('Heading H1');
  });
});

describe('parseTokenName — raw passthrough', () => {
  it('preserves the raw token name', () => {
    expect(parseTokenName('color/primary/500').raw).toBe('color/primary/500');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- naming-parser
```

Expected: FAIL — `Cannot find module '@/plugin/inference/naming-parser'`

- [ ] **Step 3: Implement `src/plugin/inference/naming-parser.ts`**

```typescript
export type SeparatorType = 'slash' | 'dot' | 'space' | 'camelCase' | 'PascalCase' | 'unknown';

export interface ParsedTokenName {
  raw: string;
  segments: string[];
  domain: string;
  category: string;
  scale: string;
  label: string;
  separator: SeparatorType;
}

function detectSeparator(name: string): SeparatorType {
  if (name.includes('/')) return 'slash';
  if (name.includes('.')) return 'dot';
  if (name.includes(' ')) return 'space';
  if (/^[A-Z]/.test(name) && /[A-Z]/.test(name.slice(1))) return 'PascalCase';
  if (/^[a-z]/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  return 'unknown';
}

function split(name: string, sep: SeparatorType): string[] {
  switch (sep) {
    case 'slash': return name.split('/').map(s => s.trim()).filter(Boolean);
    case 'dot':   return name.split('.').map(s => s.trim()).filter(Boolean);
    case 'space': return name.split(' ').map(s => s.trim()).filter(Boolean);
    case 'camelCase':
    case 'PascalCase':
      return name.replace(/([A-Z])/g, ' $1').trim().split(' ').filter(Boolean);
    default:
      return [name];
  }
}

function humanize(segments: string[]): string {
  return segments
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function parseTokenName(name: string): ParsedTokenName {
  const separator = detectSeparator(name);
  const segments = split(name, separator);
  const labelSegments = segments.length > 1 ? segments.slice(1) : segments;

  return {
    raw: name,
    segments,
    domain: segments[0]?.toLowerCase() ?? '',
    category: segments[1]?.toLowerCase() ?? '',
    scale: segments[2]?.toLowerCase() ?? '',
    label: humanize(labelSegments),
    separator,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- naming-parser
```

Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/naming-parser.ts tests/inference/naming-parser.test.ts
git commit -m "feat: add convention-agnostic token naming parser"
```

---

## Task 6: Color Role Inference

**Files:**
- Create: `src/plugin/inference/color-roles.ts`
- Create: `tests/inference/color-roles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/color-roles.test.ts`:

```typescript
import { inferColorRole } from '@/plugin/inference/color-roles';

describe('inferColorRole', () => {
  it.each([
    ['color/primary/500', 'primary'],
    ['brand-blue', 'primary'],
    ['color/secondary/300', 'secondary'],
    ['accent-purple', 'secondary'],
    ['color/success/400', 'success'],
    ['green-500', 'success'],
    ['color/warning/300', 'warning'],
    ['caution-yellow', 'warning'],
    ['color/error/500', 'error'],
    ['red-600', 'error'],
    ['danger-red', 'error'],
    ['destructive', 'error'],
    ['color/neutral/200', 'neutral'],
    ['gray-100', 'neutral'],
    ['grey-200', 'neutral'],
    ['slate-300', 'neutral'],
    ['color/surface/default', 'surface'],
    ['background/primary', 'surface'],
    ['bg-white', 'surface'],
    ['canvas', 'surface'],
    ['color/on-surface/primary', 'on-surface'],
    ['foreground/text', 'on-surface'],
    ['fg-default', 'on-surface'],
    ['random-token-xyz-123', 'unknown'],
  ] as [string, string][])(
    '"%s" → role "%s"',
    (tokenName, expectedRole) => {
      expect(inferColorRole(tokenName)).toBe(expectedRole);
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- color-roles
```

Expected: FAIL — `Cannot find module '@/plugin/inference/color-roles'`

- [ ] **Step 3: Implement `src/plugin/inference/color-roles.ts`**

```typescript
import type { SemanticColorRole } from '@/types/schemas';

type RoleKeywords = Record<Exclude<SemanticColorRole, 'unknown'>, string[]>;

const ROLE_KEYWORDS: RoleKeywords = {
  primary:    ['primary', 'brand', 'main', 'key'],
  secondary:  ['secondary', 'accent'],
  success:    ['success', 'positive', 'confirm'],
  warning:    ['warning', 'caution', 'alert'],
  error:      ['error', 'danger', 'destructive'],
  neutral:    ['neutral', 'gray', 'grey', 'slate'],
  surface:    ['surface', 'background', 'bg', 'canvas'],
  'on-surface': ['on-surface', 'foreground', 'fg', 'text'],
};

const COLOR_NAME_TO_ROLE: Record<string, SemanticColorRole> = {
  red:    'error',
  green:  'success',
  yellow: 'warning',
  blue:   'primary',
  white:  'surface',
  black:  'on-surface',
};

export function inferColorRole(tokenName: string): SemanticColorRole {
  const lower = tokenName.toLowerCase();

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS) as [SemanticColorRole, string[]][]) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }

  for (const [colorName, role] of Object.entries(COLOR_NAME_TO_ROLE)) {
    if (lower.includes(colorName)) return role;
  }

  return 'unknown';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- color-roles
```

Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/color-roles.ts tests/inference/color-roles.test.ts
git commit -m "feat: add color semantic role inference from token names"
```

---

## Task 7: Typography Role Inference

**Files:**
- Create: `src/plugin/inference/type-roles.ts`
- Create: `tests/inference/type-roles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/type-roles.test.ts`:

```typescript
import { inferTypographyRole } from '@/plugin/inference/type-roles';

describe('inferTypographyRole', () => {
  it.each([
    ['text/display', 'display'],
    ['typography/hero', 'display'],
    ['text/heading/h1', 'h1'],
    ['heading-1', 'h1'],
    ['text/h2', 'h2'],
    ['text/heading/h3', 'h3'],
    ['text/h4', 'h4'],
    ['text/h5', 'h5'],
    ['text/h6', 'h6'],
    ['text/body-lg', 'body-lg'],
    ['body-large', 'body-lg'],
    ['text/body', 'body-md'],
    ['paragraph/md', 'body-md'],
    ['text/body-sm', 'body-sm'],
    ['text/caption', 'caption'],
    ['helper-text', 'caption'],
    ['hint', 'caption'],
    ['text/label/md', 'label'],
    ['tag-text', 'label'],
    ['text/code', 'code'],
    ['mono/sm', 'code'],
    ['text/overline', 'overline'],
    ['eyebrow/sm', 'overline'],
    ['something-completely-random', 'unknown'],
  ] as [string, string][])(
    '"%s" → role "%s"',
    (tokenName, expectedRole) => {
      expect(inferTypographyRole(tokenName)).toBe(expectedRole);
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- type-roles
```

Expected: FAIL — `Cannot find module '@/plugin/inference/type-roles'`

- [ ] **Step 3: Implement `src/plugin/inference/type-roles.ts`**

```typescript
import type { TypographyRole } from '@/types/schemas';

interface TypographyRule {
  keywords: string[];
  role: TypographyRole;
}

const TYPE_RULES: TypographyRule[] = [
  { keywords: ['display', 'hero'],                                   role: 'display' },
  { keywords: ['h1', 'heading-1', 'heading1'],                       role: 'h1' },
  { keywords: ['h2', 'heading-2', 'heading2'],                       role: 'h2' },
  { keywords: ['h3', 'heading-3', 'heading3'],                       role: 'h3' },
  { keywords: ['h4', 'heading-4', 'heading4'],                       role: 'h4' },
  { keywords: ['h5', 'heading-5', 'heading5'],                       role: 'h5' },
  { keywords: ['h6', 'heading-6', 'heading6'],                       role: 'h6' },
  { keywords: ['body-lg', 'body-large', 'bodylarge'],                role: 'body-lg' },
  { keywords: ['body-sm', 'body-small', 'bodysmall'],                role: 'body-sm' },
  { keywords: ['body', 'paragraph'],                                 role: 'body-md' },
  { keywords: ['caption', 'helper', 'hint'],                         role: 'caption' },
  { keywords: ['label', 'tag'],                                      role: 'label' },
  { keywords: ['code', 'mono', 'monospace'],                         role: 'code' },
  { keywords: ['overline', 'eyebrow'],                               role: 'overline' },
];

export function inferTypographyRole(tokenName: string): TypographyRole {
  const lower = tokenName.toLowerCase();
  for (const { keywords, role } of TYPE_RULES) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }
  return 'unknown';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- type-roles
```

Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/type-roles.ts tests/inference/type-roles.test.ts
git commit -m "feat: add typography role inference from token names"
```

---

## Task 8: Variant Classifier

**Files:**
- Create: `src/plugin/inference/variant-classifier.ts`
- Create: `tests/inference/variant-classifier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/variant-classifier.test.ts`:

```typescript
import {
  classifyVariantProperty,
  classifyVariantValue,
  extractStatesFromVariants,
} from '@/plugin/inference/variant-classifier';

describe('classifyVariantProperty', () => {
  it.each([
    ['State', 'state'],
    ['state', 'state'],
    ['Size', 'variant'],
    ['Type', 'variant'],
    ['Variant', 'variant'],
    ['style', 'variant'],
    ['emphasis', 'variant'],
    ['density', 'variant'],
    ['Unknown', 'variant'],
  ] as [string, string][])(
    '"%s" → "%s"',
    (prop, expected) => {
      expect(classifyVariantProperty(prop)).toBe(expected);
    }
  );
});

describe('classifyVariantValue', () => {
  it.each([
    ['hover', 'state'],
    ['Hover', 'state'],
    ['focused', 'state'],
    ['disabled', 'state'],
    ['loading', 'state'],
    ['selected', 'state'],
    ['sm', 'variant'],
    ['primary', 'variant'],
    ['filled', 'variant'],
  ] as [string, string][])(
    '"%s" → "%s"',
    (value, expected) => {
      expect(classifyVariantValue(value)).toBe(expected);
    }
  );
});

describe('extractStatesFromVariants', () => {
  it('collects unique state values from a State property', () => {
    const variantGroups = [
      { property: 'State', type: 'state' as const, values: ['default', 'hover', 'disabled'] },
      { property: 'Size', type: 'variant' as const, values: ['sm', 'md', 'lg'] },
    ];
    expect(extractStatesFromVariants(variantGroups)).toEqual(['default', 'hover', 'disabled']);
  });

  it('returns empty array when no state group exists', () => {
    const variantGroups = [
      { property: 'Size', type: 'variant' as const, values: ['sm', 'md'] },
    ];
    expect(extractStatesFromVariants(variantGroups)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- variant-classifier
```

Expected: FAIL — `Cannot find module '@/plugin/inference/variant-classifier'`

- [ ] **Step 3: Implement `src/plugin/inference/variant-classifier.ts`**

```typescript
import type { VariantGroup, VariantGroupType } from '@/types/schemas';

const STATE_KEYWORDS = new Set([
  'default', 'hover', 'hovered', 'focus', 'focused', 'active', 'pressed',
  'disabled', 'error', 'loading', 'selected', 'checked', 'indeterminate',
  'empty', 'filled', 'state',
]);

const VARIANT_KEYWORDS = new Set([
  'size', 'variant', 'type', 'style', 'color', 'emphasis', 'shape',
  'weight', 'layout', 'density',
]);

export function classifyVariantProperty(property: string): VariantGroupType {
  const lower = property.toLowerCase();
  if (STATE_KEYWORDS.has(lower)) return 'state';
  if (VARIANT_KEYWORDS.has(lower)) return 'variant';
  return 'variant';
}

export function classifyVariantValue(value: string): 'state' | 'variant' {
  return STATE_KEYWORDS.has(value.toLowerCase()) ? 'state' : 'variant';
}

export function extractStatesFromVariants(variantGroups: VariantGroup[]): string[] {
  const stateGroup = variantGroups.find(g => g.type === 'state');
  return stateGroup ? stateGroup.values : [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- variant-classifier
```

Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/variant-classifier.ts tests/inference/variant-classifier.test.ts
git commit -m "feat: add variant vs. state property classifier"
```

---

## Task 9: Anatomy Mapper

**Files:**
- Create: `src/plugin/inference/anatomy-mapper.ts`
- Create: `tests/inference/anatomy-mapper.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/inference/anatomy-mapper.test.ts`:

```typescript
import { inferAnatomyRole, inferComponentCategory, inferAccessibilityRole, inferKeyboardInteraction, inferAriaAttributes } from '@/plugin/inference/anatomy-mapper';

describe('inferAnatomyRole', () => {
  it.each([
    ['icon', 'icon'],
    ['leading-icon', 'icon'],
    ['trailing-icon', 'icon'],
    ['Icon', 'icon'],
    ['label', 'text'],
    ['text', 'text'],
    ['title', 'text'],
    ['caption', 'text'],
    ['container', 'container'],
    ['background', 'container'],
    ['fill', 'container'],
    ['wrapper', 'container'],
    ['indicator', 'indicator'],
    ['dot', 'indicator'],
    ['badge', 'indicator'],
    ['image', 'media'],
    ['avatar', 'media'],
    ['thumbnail', 'media'],
    ['random-layer-xyz', 'unknown'],
  ] as [string, string][])(
    '"%s" → role "%s"',
    (layerName, expectedRole) => {
      expect(inferAnatomyRole(layerName)).toBe(expectedRole);
    }
  );
});

describe('inferComponentCategory', () => {
  it.each([
    ['Button', 'atom'],
    ['Input', 'atom'],
    ['Checkbox', 'atom'],
    ['Icon', 'atom'],
    ['Badge', 'atom'],
    ['Card', 'molecule'],
    ['FormField', 'molecule'],
    ['DropdownMenu', 'molecule'],
    ['Header', 'organism'],
    ['NavigationBar', 'organism'],
    ['Modal', 'organism'],
    ['RandomComponent', 'unknown'],
  ] as [string, string][])(
    '"%s" → category "%s"',
    (name, expectedCategory) => {
      expect(inferComponentCategory(name)).toBe(expectedCategory);
    }
  );
});

describe('inferAccessibilityRole', () => {
  it('infers button role', () => {
    expect(inferAccessibilityRole('Button')).toBe('button');
    expect(inferAccessibilityRole('IconButton')).toBe('button');
  });

  it('infers input role', () => {
    expect(inferAccessibilityRole('TextInput')).toBe('input');
    expect(inferAccessibilityRole('TextField')).toBe('input');
  });

  it('infers checkbox role', () => {
    expect(inferAccessibilityRole('Checkbox')).toBe('checkbox');
  });

  it('falls back to unknown', () => {
    expect(inferAccessibilityRole('SomethingRandom')).toBe('unknown');
  });
});

describe('inferKeyboardInteraction', () => {
  it('returns Enter or Space for button', () => {
    expect(inferKeyboardInteraction('button')).toContain('Enter');
  });

  it('returns a non-empty string for all known roles', () => {
    const roles = ['button', 'link', 'input', 'checkbox', 'radio', 'listitem', 'unknown'] as const;
    roles.forEach(role => {
      expect(inferKeyboardInteraction(role).length).toBeGreaterThan(0);
    });
  });
});

describe('inferAriaAttributes', () => {
  it('adds aria-disabled when disabled state present', () => {
    expect(inferAriaAttributes('button', ['default', 'disabled'])).toContain('aria-disabled');
  });

  it('adds aria-checked for checkbox', () => {
    expect(inferAriaAttributes('checkbox', [])).toContain('aria-checked');
  });

  it('returns empty array when no states match', () => {
    expect(inferAriaAttributes('unknown', [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- anatomy-mapper
```

Expected: FAIL — `Cannot find module '@/plugin/inference/anatomy-mapper'`

- [ ] **Step 3: Implement `src/plugin/inference/anatomy-mapper.ts`**

```typescript
import type { AnatomyRole, ComponentCategory, AccessibilityRole } from '@/types/schemas';

// ─── Anatomy ──────────────────────────────────────────────────────────────────

interface AnatomyRule { keywords: string[]; role: AnatomyRole }

const ANATOMY_RULES: AnatomyRule[] = [
  { keywords: ['icon', 'leading-icon', 'trailing-icon'],                role: 'icon' },
  { keywords: ['label', 'text', 'title', 'caption'],                    role: 'text' },
  { keywords: ['container', 'background', 'fill', 'wrapper', 'frame'],  role: 'container' },
  { keywords: ['indicator', 'dot', 'badge', 'chip'],                    role: 'indicator' },
  { keywords: ['image', 'thumbnail', 'avatar', 'media', 'photo'],       role: 'media' },
];

export function inferAnatomyRole(layerName: string): AnatomyRole {
  const lower = layerName.toLowerCase();
  for (const { keywords, role } of ANATOMY_RULES) {
    if (keywords.some(kw => lower.includes(kw))) return role;
  }
  return 'unknown';
}

// ─── Component Category ───────────────────────────────────────────────────────

const ATOM_KEYWORDS    = ['button', 'input', 'checkbox', 'radio', 'icon', 'badge', 'tag', 'chip', 'avatar', 'tooltip', 'toggle', 'switch'];
const MOLECULE_KEYWORDS = ['card', 'form', 'field', 'search', 'dropdown', 'select', 'menu', 'list', 'item', 'row', 'tab'];
const ORGANISM_KEYWORDS = ['header', 'footer', 'nav', 'navigation', 'sidebar', 'modal', 'dialog', 'table', 'banner', 'hero'];

export function inferComponentCategory(name: string): ComponentCategory {
  const lower = name.toLowerCase();
  if (ATOM_KEYWORDS.some(kw => lower.includes(kw)))     return 'atom';
  if (MOLECULE_KEYWORDS.some(kw => lower.includes(kw))) return 'molecule';
  if (ORGANISM_KEYWORDS.some(kw => lower.includes(kw))) return 'organism';
  return 'unknown';
}

// ─── Accessibility ────────────────────────────────────────────────────────────

const A11Y_ROLE_MAP: Array<[string, AccessibilityRole]> = [
  ['button', 'button'], ['btn', 'button'],
  ['link', 'link'],     ['anchor', 'link'],
  ['input', 'input'],   ['textfield', 'input'], ['textarea', 'input'],
  ['checkbox', 'checkbox'],
  ['radio', 'radio'],
  ['listitem', 'listitem'], ['item', 'listitem'],
];

export function inferAccessibilityRole(name: string): AccessibilityRole {
  const lower = name.toLowerCase();
  for (const [kw, role] of A11Y_ROLE_MAP) {
    if (lower.includes(kw)) return role;
  }
  return 'unknown';
}

export function inferKeyboardInteraction(role: AccessibilityRole): string {
  const map: Record<AccessibilityRole, string> = {
    button:   'Enter or Space to activate',
    link:     'Enter to navigate',
    input:    'Type to enter text; Tab to move focus',
    checkbox: 'Space to toggle',
    radio:    'Arrow keys to select between options',
    listitem: 'Arrow keys to navigate; Enter to select',
    unknown:  'Tab to focus',
  };
  return map[role];
}

export function inferAriaAttributes(role: AccessibilityRole, states: string[]): string[] {
  const attrs: string[] = [];
  if (states.includes('disabled'))                        attrs.push('aria-disabled');
  if (role === 'button' && states.includes('pressed'))    attrs.push('aria-pressed');
  if (role === 'checkbox')                                attrs.push('aria-checked');
  if (role === 'input')                                   attrs.push('aria-required', 'aria-invalid');
  return attrs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- anatomy-mapper
```

Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/inference/anatomy-mapper.ts tests/inference/anatomy-mapper.test.ts
git commit -m "feat: add anatomy mapper, component category, and a11y role inference"
```

---

## Task 10: Full Test Suite Verification

**Files:** (no new files — integration check)

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: All inference tests pass. Output resembles:

```
 PASS  tests/inference/wcag.test.ts
 PASS  tests/inference/naming-parser.test.ts
 PASS  tests/inference/color-roles.test.ts
 PASS  tests/inference/type-roles.test.ts
 PASS  tests/inference/variant-classifier.test.ts
 PASS  tests/inference/anatomy-mapper.test.ts

Test Suites: 6 passed, 6 total
Tests:       ~45 passed
```

- [ ] **Step 2: Verify TypeScript has no errors**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: `dist/main.js` and `dist/ui.html` generated with no errors.

- [ ] **Step 4: Final Plan 1 commit**

```bash
git add -A
git commit -m "feat: complete Plan 1 — inference engine fully tested and build verified"
```

---

## Milestone: Plan 1 Complete

At this point:
- `npm test` passes with full inference engine coverage (~45 tests)
- `npm run build` produces valid plugin artifacts
- All TypeScript type contracts are defined as the shared language for Plans 2–4
- Zero Figma API dependency in the inference layer

**Proceed to Plan 2:** Figma Extractor + Schema Assembler
