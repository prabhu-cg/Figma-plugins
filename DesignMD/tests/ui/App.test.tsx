// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/ui/App';
import { DEFAULT_EXPORT_OPTIONS, type PluginToUIMessage } from '../../src/shared/messages';
import { makeDesignSystem } from '../unit/fixtures';

type Sent = { type: string; [key: string]: unknown };

let sent: Sent[];

/** Delivers a plugin -> UI message the way Figma does. */
function fromPlugin(message: PluginToUIMessage) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: message } }));
  });
}

const messagesOfType = (type: string) => sent.filter((m) => m.type === type);
const checkbox = (name: RegExp) =>
  within(screen.getByText(name).closest('label') as HTMLElement).getByRole('checkbox');

const openTab = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));

async function scanAndGenerate(files = [{ path: 'design.md', content: '# Design\n' }]) {
  fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
  fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  fromPlugin({ type: 'generation-complete', files });
}

beforeEach(() => {
  sent = [];
  vi.spyOn(window.parent, 'postMessage').mockImplementation(((message: { pluginMessage: Sent }) => {
    sent.push(message.pluginMessage);
  }) as typeof window.postMessage);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App: startup', () => {
  it('tells the plugin it is ready to receive the selection and saved settings', () => {
    render(<App />);
    expect(messagesOfType('ready')).toHaveLength(1);
  });

  it('applies saved settings', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: { options: { ...DEFAULT_EXPORT_OPTIONS, designMd: false, cssFile: true } },
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    // Output choices live on the Export tab once a scan has finished.
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Export');
    expect(checkbox(/^design\.md$/)).not.toBeChecked();
    expect(checkbox(/^tokens\.css$/)).toBeChecked();
  });

  it('keeps defaults when there are no saved settings', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    expect(screen.getByRole('button', { name: /Scan/ })).toBeInTheDocument();
  });
});

describe('App: scan scope', () => {
  it('scans the whole file by default', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan Design System' }));
    expect(messagesOfType('extract')).toEqual([{ type: 'extract', scope: 'file' }]);
  });

  it('disables Selection until layers are selected, then offers it with the count', () => {
    render(<App />);
    const selection = screen.getByRole('radio', { name: /Selection/ });
    expect(selection).toBeDisabled();

    fromPlugin({ type: 'selection', count: 3 });
    expect(screen.getByRole('radio', { name: 'Selection (3)' })).toBeEnabled();
  });

  it('scans only the selection when chosen', () => {
    render(<App />);
    fromPlugin({ type: 'selection', count: 2 });
    fireEvent.click(screen.getByRole('radio', { name: 'Selection (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Scan Selection' }));
    expect(messagesOfType('extract')).toEqual([{ type: 'extract', scope: 'selection' }]);
  });

  it('falls back to the whole file when the selection is cleared', () => {
    render(<App />);
    fromPlugin({ type: 'selection', count: 2 });
    fireEvent.click(screen.getByRole('radio', { name: 'Selection (2)' }));
    fromPlugin({ type: 'selection', count: 0 });
    expect(screen.getByRole('radio', { name: 'Whole file' })).toBeChecked();
  });

  it('asks for a rescan when the scope differs from the scanned data', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fromPlugin({ type: 'selection', count: 1 });
    fireEvent.click(screen.getByRole('radio', { name: 'Selection (1)' }));
    expect(screen.getByText('Rescan to apply this scope.')).toBeInTheDocument();
  });
});

describe('App: saving settings', () => {
  it('saves output choices when they change', () => {
    render(<App />);
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Export');
    fireEvent.click(checkbox(/^tokens\.css$/));
    expect(messagesOfType('save-settings')).toEqual([
      {
        type: 'save-settings',
        settings: { options: { ...DEFAULT_EXPORT_OPTIONS, cssFile: true } },
      },
    ]);
  });
});

describe('App: generated file preview', () => {
  const files = [
    { path: 'design.md', content: '# Design\n' },
    { path: 'tokens.css', content: ':root {\n  --a: 1;\n}\n' },
  ];

  it('shows the files with a preview of the first one', async () => {
    render(<App />);
    await scanAndGenerate(files);
    expect(screen.getByRole('heading', { name: 'Generated files' })).toBeInTheDocument();
    expect(screen.getByLabelText('Preview of design.md')).toHaveTextContent('# Design');
    expect(screen.getByRole('button', { name: /Download 2 files/ })).toBeInTheDocument();
  });

  it('switches the preview when another file is picked', async () => {
    render(<App />);
    await scanAndGenerate(files);
    fireEvent.click(screen.getByRole('button', { name: /tokens\.css/ }));
    expect(screen.getByLabelText('Preview of tokens.css')).toHaveTextContent('--a: 1;');
  });

  it('copies the full file and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    await scanAndGenerate(files);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(writeText).toHaveBeenCalledWith('# Design\n');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('falls back to execCommand when the Clipboard API is blocked', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    render(<App />);
    await scanAndGenerate(files);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(exec).toHaveBeenCalledWith('copy');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('says so when copying is impossible', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    });
    render(<App />);
    await scanAndGenerate(files);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByText(/Copy blocked/)).toBeInTheDocument();
  });

  it('notes when a long file is truncated, but previews are capped', async () => {
    const long = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
    render(<App />);
    await scanAndGenerate([{ path: 'big.md', content: long }]);
    expect(screen.getByText(/Showing the first 300 of 500 lines/)).toBeInTheDocument();
    expect(screen.getByLabelText('Preview of big.md')).not.toHaveTextContent('line 450');
  });
});

describe('App: stale results', () => {
  it('drops generated files when the output selection changes, and says why', async () => {
    render(<App />);
    await scanAndGenerate();
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();

    openTab('Export');
    fireEvent.click(checkbox(/^tokens\.css$/));
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Generated files' })).not.toBeInTheDocument();
    expect(screen.getByText(/Settings changed — generate again/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('keeps the files when only the ZIP option changes', async () => {
    render(<App />);
    await scanAndGenerate();
    openTab('Export');
    fireEvent.click(checkbox(/^Export all as ZIP$/));
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
  });

  it('shows plugin errors and lets the user dismiss them', () => {
    render(<App />);
    fromPlugin({ type: 'error', stage: 'extraction', message: 'Select at least one layer.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one layer.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('App: components.json option', () => {
  const toExport = async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Export');
  };

  it('is off by default, and its sub-options and privacy note only show once it is on', async () => {
    await toExport();
    expect(checkbox(/^components\.json$/)).not.toBeChecked();
    expect(screen.queryByText('Include text content')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing leaves the plugin/)).not.toBeInTheDocument();

    fireEvent.click(checkbox(/^components\.json$/));
    expect(screen.getByLabelText('Include text content')).toBeChecked();
    expect(screen.getByLabelText('Include variant differences')).toBeChecked();
    expect(screen.getByText(/text content, layer names and design values/)).toBeInTheDocument();
  });

  it('counts as an output, and is remembered with its sub-options', async () => {
    await toExport();
    expect(screen.getByText('2 outputs selected')).toBeInTheDocument();
    fireEvent.click(checkbox(/^components\.json$/));
    fireEvent.click(screen.getByLabelText('Include text content'));
    expect(screen.getByText('3 outputs selected')).toBeInTheDocument();
    const saved = messagesOfType('save-settings').at(-1) as {
      settings: { options: typeof DEFAULT_EXPORT_OPTIONS };
    };
    expect(saved.settings.options).toMatchObject({
      componentsJson: true,
      includeText: false,
      includeVariantDiffs: true,
    });
  });

  it('restores saved sub-options', async () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: {
        options: { ...DEFAULT_EXPORT_OPTIONS, componentsJson: true, includeText: false },
      },
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Export');
    expect(screen.getByLabelText('Include text content')).not.toBeChecked();
    expect(screen.getByLabelText('Include variant differences')).toBeChecked();
  });

  it('invalidates generated files when a sub-option changes', async () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: { options: { ...DEFAULT_EXPORT_OPTIONS, componentsJson: true } },
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({ type: 'generation-complete', files: [{ path: 'design.md', content: '# x\n' }] });
    fromPlugin({ type: 'structures-complete', cancelled: false });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    openTab('Export');
    fireEvent.click(screen.getByLabelText('Include variant differences'));
    expect(screen.getByText(/Settings changed — generate again/)).toBeInTheDocument();
  });

  it('shows progress while component layers are read during generation', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({ type: 'progress', stage: 'structure', percent: 40 });
    expect(screen.getByRole('progressbar')).toHaveTextContent('Reading component layers… 40%');
  });
});

describe('App: cancel, chunks and progress detail', () => {
  it('offers Cancel while scanning, tells the plugin, and shows it is cancelling', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'progress', stage: 'components', percent: 25, done: 120, total: 480 });
    expect(screen.getByRole('progressbar')).toHaveTextContent('25% · 120 of 480');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(messagesOfType('cancel')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
  });

  it('offers Cancel while generating, and clears it when the result arrives', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(messagesOfType('cancel')).toHaveLength(1);
    fromPlugin({ type: 'generation-complete', files: [{ path: 'design.md', content: '# x\n' }] });
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
  });

  it('puts chunked files back together in the listed order', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    const part = (path: string, i: number, parts: number, data: string) =>
      fromPlugin({ type: 'file-chunk', path, part: i, parts, data });
    part('components.json', 1, 2, 'world');
    part('components.json', 0, 2, 'hello ');
    part('notes.md', 0, 1, '# notes\n');
    fromPlugin({
      type: 'generation-complete',
      files: [],
      chunked: ['components.json', 'notes.md'],
    });
    expect(screen.getByRole('heading', { name: 'Generated files' })).toBeInTheDocument();
    expect(screen.getAllByText('components.json').length).toBeGreaterThan(0);
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.getByLabelText('Preview of components.json')).toHaveTextContent('hello world');
  });

  it('reports a file that arrived incomplete instead of showing a broken result', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({ type: 'file-chunk', path: 'a.json', part: 0, parts: 2, data: 'x' });
    fromPlugin({ type: 'generation-complete', files: [], chunked: ['a.json'] });
    expect(screen.getByRole('alert')).toHaveTextContent('a.json arrived incomplete');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });
});

describe('App: components.json is built in the UI', () => {
  const structure = (name: string) => ({
    properties: [],
    defaultVariantId: 'variant:1',
    tree: {
      id: 'variant:1',
      name,
      type: 'FRAME',
      role: 'root' as const,
      roleSource: 'type' as const,
      visible: true,
      children: [],
    },
    variantDiffs: [],
    treeTruncated: false,
    usedVariableIds: [],
    usedStyleIds: [],
    warnings: [],
  });
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  const startRun = (extra: Partial<typeof DEFAULT_EXPORT_OPTIONS>) => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: { options: { ...DEFAULT_EXPORT_OPTIONS, ...extra } },
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  };

  it('asks the plugin for the layers, and for the other files only when they are selected', () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    expect(messagesOfType('generate')).toHaveLength(0);
    expect(messagesOfType('read-structures')).toEqual([
      { type: 'read-structures', excludedPages: [], includeText: true, includeVariantDiffs: true },
    ]);
  });

  it('asks for both when both are selected', () => {
    startRun({ componentsJson: true });
    expect(messagesOfType('generate')).toHaveLength(1);
    expect(messagesOfType('read-structures')).toHaveLength(1);
  });

  it('waits for the layers, then assembles components.json next to the plugin files', async () => {
    startRun({ componentsJson: true });
    fromPlugin({ type: 'generation-complete', files: [{ path: 'design.md', content: '# d\n' }] });
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();

    fromPlugin({ type: 'structures', items: [['component:1', structure('Button')]] });
    fromPlugin({ type: 'structures-complete', cancelled: false });
    await settle();

    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
    expect(screen.getAllByText('design.md').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('components.json')[0]);
    const preview = screen.getByLabelText('Preview of components.json').textContent ?? '';
    expect(preview).toContain('"schema": "designmd.components/v1"');
    expect(preview).toMatch(/"contentHash": "[0-9a-f]{64}"/);
  });

  it('summarizes how the layer reading went, so a short count can be checked', async () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    fromPlugin({
      type: 'structures',
      items: [
        [
          'component:1',
          {
            ...structure('Button'),
            treeTruncated: true,
            warnings: [{ code: 'TREE_TRUNCATED', message: 'm', componentId: 'component:1' }],
          },
        ],
      ],
    });
    fromPlugin({ type: 'structures-complete', cancelled: false });
    await settle();
    expect(
      screen.getByText(/Component layers: 1 read \(0 in full, 1 cut short, 0 not read\)/),
    ).toHaveTextContent('warnings: TREE_TRUNCATED 1');
  });

  it('says there were no warnings when there were none', async () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    fromPlugin({ type: 'structures', items: [['component:1', structure('Button')]] });
    fromPlugin({ type: 'structures-complete', cancelled: false });
    await settle();
    expect(screen.getByText(/1 in full, 0 cut short, 0 not read/)).toHaveTextContent('no warnings');
  });

  it('works with components.json alone', async () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    fromPlugin({ type: 'structures', items: [['component:1', structure('Button')]] });
    fromPlugin({ type: 'structures-complete', cancelled: false });
    await settle();
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
    expect(screen.getByText('1 file ready')).toBeInTheDocument();
  });

  it('marks components the plugin never reported when the run was cancelled', async () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    fromPlugin({ type: 'structures-complete', cancelled: true });
    await settle();
    const preview = screen.getByLabelText('Preview of components.json').textContent ?? '';
    expect(preview).toContain('SCAN_CANCELLED');
  });

  it('shows the plugin error and stops waiting if reading the layers fails', () => {
    startRun({ componentsJson: true, designMd: false, componentDocs: false });
    fromPlugin({
      type: 'error',
      stage: 'generation',
      message: 'Failed to read the component layers: x',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to read the component layers');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });
});

describe('App: partial generation', () => {
  it('shows which outputs failed next to the files that were generated', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Scan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({
      type: 'generation-complete',
      files: [{ path: 'design.md', content: '# x\n' }],
      failures: [{ output: 'components.json', reason: 'out of memory' }],
    });
    expect(screen.getByRole('alert')).toHaveTextContent('1 output could not be generated');
    expect(screen.getByRole('alert')).toHaveTextContent('components.json: out of memory');
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument();
  });

  it('shows no failure banner after a clean run', async () => {
    render(<App />);
    await scanAndGenerate();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('App: per-file settings', () => {
  function twoPageSystem() {
    const ds = makeDesignSystem();
    ds.components.push({ ...ds.components[0], id: 'c2', name: 'Card', pageName: 'Drafts' });
    return ds;
  }

  it('restores excluded pages for this file, ignoring pages that no longer exist', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: { excludedPages: ['Drafts', 'Deleted page'], contrastPairs: [] },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: twoPageSystem() });
    expect(
      within(
        screen.getByText('Drafts', { selector: '.dmd-page-name' }).closest('label') as HTMLElement,
      ).getByRole('checkbox'),
    ).not.toBeChecked();
    expect(
      within(
        screen
          .getByText('Components', { selector: '.dmd-page-name' })
          .closest('label') as HTMLElement,
      ).getByRole('checkbox'),
    ).toBeChecked();
  });

  it('saves excluded pages, keeping remembered ones from pages outside this scan', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: { excludedPages: ['Elsewhere'], contrastPairs: [] },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: twoPageSystem() });
    fireEvent.click(
      within(
        screen.getByText('Drafts', { selector: '.dmd-page-name' }).closest('label') as HTMLElement,
      ).getByRole('checkbox'),
    );
    expect(messagesOfType('save-file-settings').at(-1)).toEqual({
      type: 'save-file-settings',
      fileSettings: { excludedPages: ['Elsewhere', 'Drafts'], contrastPairs: [] },
    });
  });
});

describe('App: contrast pairs', () => {
  const choose = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  function openWithTokens() {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Contrast');
  }

  it('lists color tokens and only enables Add for a new, distinct pair', () => {
    openWithTokens();
    const add = screen.getByRole('button', { name: 'Add pair' });
    expect(add).toBeDisabled();
    choose('Text', 'Color/Primary/500');
    expect(add).toBeDisabled();
    choose('Background', 'Color/Primary/500');
    expect(add).toBeDisabled();
    choose('Background', 'Surface/Background');
    expect(add).toBeEnabled();
  });

  it('adds a pair with its ratio, saves it for the file, and can remove it', () => {
    openWithTokens();
    choose('Text', 'Color/Primary/500');
    choose('Background', 'Surface/Background');
    fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));

    expect(screen.getByText(/:1 · /)).toBeInTheDocument();
    expect(messagesOfType('save-file-settings').at(-1)).toMatchObject({
      fileSettings: {
        contrastPairs: [{ foreground: 'Color/Primary/500', background: 'Surface/Background' }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /Remove pair/ }));
    expect(screen.queryByText(/:1 · /)).not.toBeInTheDocument();
    expect(messagesOfType('save-file-settings').at(-1)).toMatchObject({
      fileSettings: { contrastPairs: [] },
    });
  });

  it('restores saved pairs and sends them when generating', () => {
    render(<App />);
    const pair = { foreground: 'Color/Primary/500', background: 'Surface/Background' };
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: { excludedPages: [], contrastPairs: [pair] },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Contrast');
    expect(screen.getByRole('button', { name: /Remove pair/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(messagesOfType('generate')[0]).toMatchObject({ contrastPairs: [pair] });
  });

  it('says so when a saved pair points at a token that no longer exists', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: {
        excludedPages: [],
        contrastPairs: [{ foreground: 'Gone', background: 'Surface/Background' }],
      },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    openTab('Contrast');
    expect(screen.getByText('Token not found')).toBeInTheDocument();
  });

  it('changing pairs invalidates generated files', async () => {
    openWithTokens();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({ type: 'generation-complete', files: [{ path: 'design.md', content: '#' }] });
    openTab('Contrast');
    choose('Text', 'Color/Primary/500');
    choose('Background', 'Surface/Background');
    fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });
});

describe('App: tabs', () => {
  const names = () => screen.getAllByRole('tab').map((t) => t.textContent);

  function scanned() {
    render(<App />);
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
  }

  it('shows no tabs before a scan, then Summary, Contrast and Export', () => {
    render(<App />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    expect(names()).toEqual(['Summary', 'Contrast', 'Export']);
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });

  it('puts scope, summary, and pages on Summary; outputs on Export; pairs on Contrast', () => {
    scanned();
    expect(screen.getByRole('heading', { name: 'Design system summary' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Whole file' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contrast pairs' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Choose export outputs' }),
    ).not.toBeInTheDocument();

    openTab('Contrast');
    expect(screen.getByRole('heading', { name: 'Contrast pairs' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Design system summary' }),
    ).not.toBeInTheDocument();

    openTab('Export');
    expect(screen.getByRole('heading', { name: 'Choose export outputs' })).toBeInTheDocument();
    expect(screen.getByLabelText('Export file name')).toBeInTheDocument();
  });

  it('links each tab to its panel for assistive technology', () => {
    scanned();
    openTab('Export');
    const tab = screen.getByRole('tab', { name: 'Export' });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', tab.getAttribute('aria-controls'));
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('supports arrow keys, Home and End with a roving tabindex', () => {
    scanned();
    const summary = screen.getByRole('tab', { name: 'Summary' });
    expect(summary).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(summary, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Contrast' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Contrast' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Export' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Summary' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Export' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });

  it('hides the Contrast tab when the file has fewer than two color tokens', () => {
    render(<App />);
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles.color = ds.styles.color.slice(0, 1);
    fromPlugin({ type: 'extraction-complete', designSystem: ds });
    expect(names()).toEqual(['Summary', 'Export']);
  });

  it('counts defined pairs on the Contrast tab', () => {
    render(<App />);
    fromPlugin({
      type: 'settings',
      settings: null,
      fileSettings: {
        excludedPages: [],
        contrastPairs: [{ foreground: 'Color/Primary/500', background: 'Surface/Background' }],
      },
    });
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    expect(screen.getByRole('tab', { name: /^Contrast/ })).toHaveTextContent('Contrast1');
  });

  it('adds a Files tab with a count and opens it when generation finishes', async () => {
    render(<App />);
    await scanAndGenerate([
      { path: 'design.md', content: '#' },
      { path: 'tokens.css', content: ':root {}' },
    ]);
    expect(names()).toEqual(['Summary', 'Contrast', 'Export', 'Files2']);
    expect(screen.getByRole('tab', { name: /^Files/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Generated files' })).toBeInTheDocument();
  });

  it('drops the Files tab and lands on Export when settings change', async () => {
    render(<App />);
    await scanAndGenerate();
    openTab('Export');
    fireEvent.click(checkbox(/^tokens\.css$/));
    expect(names()).toEqual(['Summary', 'Contrast', 'Export']);
    expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves a user who is on Files to Export when the files go stale', async () => {
    render(<App />);
    await scanAndGenerate();
    expect(screen.getByRole('tab', { name: /^Files/ })).toHaveAttribute('aria-selected', 'true');
    openTab('Contrast');
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Color/Primary/500' } });
    fireEvent.change(screen.getByLabelText('Background'), {
      target: { value: 'Surface/Background' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));
    expect(screen.queryByRole('tab', { name: /^Files/ })).not.toBeInTheDocument();
  });

  it('returns to Summary after a rescan', async () => {
    render(<App />);
    await scanAndGenerate();
    fireEvent.click(screen.getByRole('button', { name: /Rescan/ }));
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });
});
