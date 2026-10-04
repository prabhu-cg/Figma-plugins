import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '../../../src/shared/messages';
import {
  component,
  frame,
  componentSet,
  document,
  fakeCollection,
  fakeVariable,
  installFakeFigma,
  page,
  type FakeFigmaHandle,
  type FakeFigmaOptions,
} from '../helpers/fakeFigma';

type Message = { type: string; [key: string]: unknown };

/** Loads a fresh copy of the controller (it keeps a module-level cache) against a fake figma. */
async function bootPlugin(options: FakeFigmaOptions = {}): Promise<FakeFigmaHandle> {
  vi.resetModules();
  const handle = installFakeFigma(options);
  await import('../../../src/plugin/main');
  return handle;
}

const messages = (h: FakeFigmaHandle) => h.posted as Message[];
const ofType = (h: FakeFigmaHandle, type: string) => messages(h).filter((m) => m.type === type);

/** A fresh document per test: the fake tree is mutable and tests tamper with it. */
const richFile = (): FakeFigmaOptions => ({
  root: document('Acme', [
    page('Buttons', [componentSet('Button', [{ props: { Size: 'L' } }])]),
    page('Drafts', [component('Scratch')]),
  ]),
  collections: [fakeCollection({ variableIds: ['v1'] })],
  variables: [fakeVariable({ id: 'v1' })],
});

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('plugin controller (main.ts)', () => {
  it('opens the UI at startup with the themed 480x700 window', async () => {
    const h = await bootPlugin();
    expect(h.figma.showUI).toHaveBeenCalledWith('<html></html>', {
      width: 480,
      height: 700,
      themeColors: true,
    });
  });

  it('extract: streams progress, then posts the design system named after the file', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });

    const progress = ofType(h, 'progress');
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every((p) => (p.percent as number) >= 0 && (p.percent as number) <= 100)).toBe(
      true,
    );
    expect(progress.map((p) => p.stage)).toContain('components');

    const [done] = ofType(h, 'extraction-complete');
    const ds = done.designSystem as {
      metadata: { fileName: string };
      summary: { variablesCount: number };
    };
    expect(ds.metadata.fileName).toBe('Acme');
    expect(ds.summary.variablesCount).toBe(1);
    expect(messages(h).at(-1)?.type).toBe('extraction-complete');
  });

  it('extract: reports 100% progress for an empty stage instead of dividing by zero', async () => {
    const h = await bootPlugin({ root: document('Empty', [page('P')]) });
    await h.send({ type: 'extract' });
    const percents = ofType(h, 'progress').map((p) => p.percent as number);
    expect(percents.every(Number.isFinite)).toBe(true);
  });

  it('extract: surfaces an unexpected failure as an extraction error', async () => {
    const h = await bootPlugin(richFile());
    // A throwing root name getter breaks the transform step, outside any per-stage guard.
    Object.defineProperty(h.figma.root, 'name', {
      get() {
        throw new Error('document went away');
      },
    });
    await h.send({ type: 'extract' });
    expect(ofType(h, 'error')).toEqual([
      {
        type: 'error',
        stage: 'extraction',
        message: 'Failed to extract the design system: document went away',
      },
    ]);
    expect(ofType(h, 'extraction-complete')).toHaveLength(0);
  });

  it('generate: refuses to run before anything has been extracted', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'generate', options: DEFAULT_EXPORT_OPTIONS, excludedPages: [] });
    expect(ofType(h, 'error')).toEqual([
      {
        type: 'error',
        stage: 'generation',
        message: 'Nothing to generate yet — extract the design system first.',
      },
    ]);
  });

  it('generate: returns the selected files for the cached extraction', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });
    await h.send({
      type: 'generate',
      options: { ...DEFAULT_EXPORT_OPTIONS, componentDocs: false, tokensJson: true },
      excludedPages: [],
    });
    const [done] = ofType(h, 'generation-complete');
    expect((done.files as Array<{ path: string }>).map((f) => f.path)).toEqual([
      'design.md',
      'tokens.json',
    ]);
  });

  it('generate: excludes components from pages the user opted out of', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });
    const request = (excludedPages: string[]) =>
      h.send({
        type: 'generate',
        options: { ...DEFAULT_EXPORT_OPTIONS, designMd: false },
        excludedPages,
      });

    await request([]);
    await request(['Buttons']);
    const [all, filtered] = ofType(h, 'generation-complete').map((m) =>
      (m.files as Array<{ path: string }>).map((f) => f.path),
    );
    expect(all).toEqual(['components/Button.md', 'components/Scratch.md']);
    expect(filtered).toEqual(['components/Scratch.md']);
  });

  it('generate: reports a clear error when no output type is selected', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });
    await h.send({
      type: 'generate',
      options: {
        designMd: false,
        componentDocs: false,
        tokensJson: false,
        cssTokensJson: false,
        zip: true,
      },
      excludedPages: [],
    });
    expect(ofType(h, 'error')[0]).toMatchObject({
      stage: 'generation',
      message: expect.stringContaining('No output types were selected'),
    });
    expect(ofType(h, 'generation-complete')).toHaveLength(0);
  });

  it('re-extracting replaces the cached design system', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });
    (h.figma.root as { name: string }).name = 'Renamed';
    await h.send({ type: 'extract' });
    const designSystems = ofType(h, 'extraction-complete').map(
      (m) => (m.designSystem as { metadata: { fileName: string } }).metadata.fileName,
    );
    expect(designSystems).toEqual(['Acme', 'Renamed']);
  });

  it('ready: reports the current selection count and saved settings', async () => {
    const h = await bootPlugin({
      ...richFile(),
      selection: [frame('A'), frame('B')],
      storage: {
        'designmd.settings.v1': { options: { ...DEFAULT_EXPORT_OPTIONS, tokensJson: true } },
      },
    });
    await h.send({ type: 'ready' });
    expect(ofType(h, 'selection')).toEqual([{ type: 'selection', count: 2 }]);
    expect(ofType(h, 'settings')).toEqual([
      { type: 'settings', settings: { options: { ...DEFAULT_EXPORT_OPTIONS, tokensJson: true } } },
    ]);
  });

  it('ready: reports no saved settings on a first run or when storage fails', async () => {
    const first = await bootPlugin(richFile());
    await first.send({ type: 'ready' });
    expect(ofType(first, 'settings')).toEqual([{ type: 'settings', settings: null }]);

    const broken = await bootPlugin({ ...richFile(), failures: { storageRead: true } });
    await broken.send({ type: 'ready' });
    expect(ofType(broken, 'settings')).toEqual([{ type: 'settings', settings: null }]);
  });

  it('save-settings: persists, and ignores storage failures', async () => {
    const h = await bootPlugin(richFile());
    const settings = { options: { ...DEFAULT_EXPORT_OPTIONS, scssFile: true } };
    await h.send({ type: 'save-settings', settings });
    expect(h.storage['designmd.settings.v1']).toEqual(settings);

    const broken = await bootPlugin({ ...richFile(), failures: { storageWrite: true } });
    await expect(broken.send({ type: 'save-settings', settings })).resolves.toBeUndefined();
    expect(ofType(broken, 'error')).toEqual([]);
  });

  it('posts the selection count whenever the selection changes', async () => {
    const h = await bootPlugin(richFile());
    h.setSelection([frame('A')]);
    h.emit('selectionchange');
    h.setSelection([]);
    h.emit('selectionchange');
    expect(ofType(h, 'selection')).toEqual([
      { type: 'selection', count: 1 },
      { type: 'selection', count: 0 },
    ]);
  });

  it('extract (selection scope): scans only selected layers and records the scope', async () => {
    const picked = frame('Picked', [component('InSelection')]);
    const h = await bootPlugin({
      root: document('Acme', [page('P', [picked, component('Outside')])]),
      selection: [picked],
    });
    await h.send({ type: 'extract', scope: 'selection' });
    const [done] = ofType(h, 'extraction-complete');
    const ds = done.designSystem as {
      metadata: { scope: string };
      components: Array<{ name: string }>;
    };
    expect(ds.metadata.scope).toBe('selection');
    expect(ds.components.map((c) => c.name)).toEqual(['InSelection']);
  });

  it('extract (selection scope): asks for a selection when nothing is selected', async () => {
    const h = await bootPlugin({ ...richFile(), selection: [] });
    await h.send({ type: 'extract', scope: 'selection' });
    expect(ofType(h, 'error')).toEqual([
      {
        type: 'error',
        stage: 'extraction',
        message: 'Select at least one layer in Figma to scan only the selection.',
      },
    ]);
    expect(ofType(h, 'extraction-complete')).toHaveLength(0);
  });

  it('extract defaults to the whole file and the design.md overview states the scope', async () => {
    const h = await bootPlugin(richFile());
    await h.send({ type: 'extract' });
    expect(
      (ofType(h, 'extraction-complete')[0].designSystem as { metadata: { scope: string } }).metadata
        .scope,
    ).toBe('file');
  });
});
