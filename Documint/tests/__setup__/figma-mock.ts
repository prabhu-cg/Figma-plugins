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
  fills: [] as any[],
  strokes: [] as any[],
  effects: [] as any[],
  children: [] as any[],
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
  fontName: { family: 'Inter', style: 'Regular' } as any,
  fills: [] as any[],
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
    selection: [] as any[],
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
    fills: [] as any[],
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
