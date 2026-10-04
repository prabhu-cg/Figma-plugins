import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSelectionSelfTest } from '../../../src/plugin/selftest/checks';
import { document, installFakeFigma, page, resetFakeIds, component } from '../helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

/**
 * The self-test is meant for real Figma, but its logic (fixture, selections, expectations,
 * cleanup) is exercised here against the fake API so mistakes surface without opening Figma.
 */
describe('selection self-test (against the fake API)', () => {
  it('passes every check', async () => {
    installFakeFigma({ root: document('File', [page('Existing', [component('Elsewhere')])]) });
    const checks = await runSelectionSelfTest();
    const failures = checks.filter((c) => !c.ok);
    expect(failures).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(9);
  });

  it('removes its scratch page and restores the page the user was on', async () => {
    const handle = installFakeFigma({
      root: document('File', [page('Existing', [component('Elsewhere')])]),
    });
    const root = handle.figma.root as { children: Array<{ name: string }> };
    const before = (handle.figma.currentPage as { name: string }).name;
    await runSelectionSelfTest();
    expect(root.children.map((p) => p.name)).toEqual(['Existing']);
    expect((handle.figma.currentPage as { name: string }).name).toBe(before);
  });

  it('cleans up and reports failure when something throws mid-run', async () => {
    const handle = installFakeFigma({ root: document('File', [page('Existing')]) });
    (handle.figma as { createComponent: () => never }).createComponent = () => {
      throw new Error('boom');
    };
    const checks = await runSelectionSelfTest();
    expect(checks.at(-1)).toMatchObject({ ok: false, detail: expect.stringContaining('boom') });
    expect((handle.figma.root as { children: unknown[] }).children).toHaveLength(1);
  });

  it('would catch a regression: a selection scan that ignores the selection fails', async () => {
    installFakeFigma({ root: document('File', [page('Existing', [component('Elsewhere')])]) });
    const components = await import('../../../src/plugin/extraction/components');
    const real = components.extractComponents;
    // Behaves like the original, but drops the selection argument (scans the whole file).
    const spy = vi
      .spyOn(components, 'extractComponents')
      .mockImplementation((onProgress, onWarning) => real(onProgress, onWarning));
    const checks = await runSelectionSelfTest();
    expect(checks.some((c) => !c.ok)).toBe(true);
    spy.mockRestore();
  });
});
