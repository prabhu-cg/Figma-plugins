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
      settings: { options: { ...DEFAULT_EXPORT_OPTIONS, designMd: false, scssFile: true } },
      fileSettings: { excludedPages: [], contrastPairs: [] },
    });
    // Output choices are shown once a scan has finished.
    fromPlugin({ type: 'extraction-complete', designSystem: makeDesignSystem() });
    expect(checkbox(/^design\.md$/)).not.toBeChecked();
    expect(checkbox(/^_tokens\.scss$/)).toBeChecked();
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

    fireEvent.click(checkbox(/^tokens\.css$/));
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Generated files' })).not.toBeInTheDocument();
    expect(screen.getByText(/Settings changed — generate again/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('keeps the files when only the ZIP option changes', async () => {
    render(<App />);
    await scanAndGenerate();
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
    expect(screen.getByText('Token not found')).toBeInTheDocument();
  });

  it('changing pairs invalidates generated files', async () => {
    openWithTokens();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    fromPlugin({ type: 'generation-complete', files: [{ path: 'design.md', content: '#' }] });
    choose('Text', 'Color/Primary/500');
    choose('Background', 'Surface/Background');
    fireEvent.click(screen.getByRole('button', { name: 'Add pair' }));
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });
});
