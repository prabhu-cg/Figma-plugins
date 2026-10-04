/**
 * Selection-scope checks that run against REAL Figma nodes. The unit tests use a fake Plugin API;
 * this builds actual components, frames and a component set on a scratch page, selects them the
 * way a user would, and runs the production `extractComponents` over the real selection.
 *
 * Run it through the self-test plugin (manifest.selftest.json). It never touches existing pages
 * and removes its scratch page afterwards.
 */
import { extractComponents } from '../extraction/components';

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b));
const fmt = (names: string[]) => `[${sorted(names).join(', ')}]`;

function expectNames(name: string, actual: string[], expected: string[]): Check {
  const ok = fmt(actual) === fmt(expected);
  return { name, ok, detail: ok ? undefined : `expected ${fmt(expected)}, got ${fmt(actual)}` };
}

function component(name: string, parent: ChildrenMixin, width = 100, height = 40): ComponentNode {
  const node = figma.createComponent();
  node.name = name;
  node.resize(width, height);
  parent.appendChild(node);
  return node;
}

/** Builds the scratch fixture; returns the nodes the checks select. */
function buildFixture(page: PageNode) {
  const group = figma.createFrame();
  group.name = 'Group';
  page.appendChild(group);

  const button = component('Button', group, 120, 40);
  button.layoutMode = 'HORIZONTAL';
  button.itemSpacing = 8;
  button.paddingTop = button.paddingBottom = 12;
  button.paddingLeft = button.paddingRight = 16;
  button.cornerRadius = 6;

  const nested = figma.createFrame();
  nested.name = 'Nested';
  group.appendChild(nested);
  component('Icon', nested, 24, 24);
  component('.Hidden', group);

  const outside = component('Outside', page);

  const small = figma.createComponent();
  small.name = 'Size=Small';
  const large = figma.createComponent();
  large.name = 'Size=Large';
  page.appendChild(small);
  page.appendChild(large);
  const chip = figma.combineAsVariants([small, large], page);
  chip.name = 'Chip';

  const rect = figma.createRectangle();
  page.appendChild(rect);

  return { group, button, nested, outside, chip, variant: chip.children[0] as ComponentNode, rect };
}

async function scan(selection: SceneNode[]) {
  figma.currentPage.selection = selection;
  const warnings: string[] = [];
  const result = await extractComponents(undefined, (m) => warnings.push(m), [
    ...figma.currentPage.selection,
  ]);
  return { result, warnings };
}

/** Runs every check on a temporary page and always cleans it up. */
export async function runSelectionSelfTest(): Promise<Check[]> {
  const previousPage = figma.currentPage;
  const page = figma.createPage();
  page.name = 'DesignMD self-test (temporary)';
  const checks: Check[] = [];

  try {
    await figma.setCurrentPageAsync(page);
    const f = buildFixture(page);
    const names = (r: { name: string }[]) => r.map((c) => c.name);

    // 1. A selected frame contributes every component inside it, at any depth.
    let { result } = await scan([f.group]);
    checks.push(
      expectNames('frame selection finds nested components', names(result), ['Button', 'Icon']),
    );
    checks.push({
      name: 'components hidden with a "." name are skipped',
      ok: !names(result).includes('.Hidden'),
    });

    // 2. Selecting a component directly.
    ({ result } = await scan([f.button]));
    checks.push(expectNames('component selection', names(result), ['Button']));

    // 3. Selecting one variant stands for its whole component set.
    ({ result } = await scan([f.variant]));
    checks.push(expectNames('variant selection resolves to its set', names(result), ['Chip']));
    checks.push({
      name: 'resolved set keeps every variant',
      ok: result[0]?.isComponentSet === true && result[0].variants.length === 2,
      detail: `isComponentSet=${result[0]?.isComponentSet}, variants=${result[0]?.variants.length}`,
    });

    // 4. Layers that are not (or cannot contain) components contribute nothing.
    ({ result } = await scan([f.rect]));
    checks.push(expectNames('non-container selection finds nothing', names(result), []));

    // 5. Mixed selection, each component reported once.
    ({ result } = await scan([f.group, f.outside, f.variant, f.chip]));
    checks.push(
      expectNames('mixed selection, no duplicates', names(result), [
        'Button',
        'Icon',
        'Outside',
        'Chip',
      ]),
    );

    // 6. Real geometry and auto layout come through readLayout.
    ({ result } = await scan([f.button]));
    const layout = result[0]?.layout;
    checks.push({
      name: 'layout reads size, auto layout, gap, padding and radius',
      ok:
        layout?.width === 120 &&
        layout.height === 40 &&
        layout.layoutMode === 'HORIZONTAL' &&
        layout.gap === 8 &&
        layout.padding?.left === 16 &&
        layout.padding.top === 12 &&
        layout.cornerRadius === 6,
      detail: JSON.stringify(layout),
    });

    // 7. Selection scope never calls loadAllPages, but whole-file scope still sees these too.
    const whole = await extractComponents();
    const wholeNames = names(whole);
    checks.push({
      name: 'whole-file scan still finds the scratch components',
      ok: ['Button', 'Icon', 'Outside', 'Chip'].every((n) => wholeNames.includes(n)),
      detail: fmt(wholeNames),
    });
  } catch (err) {
    checks.push({ name: 'self-test ran without throwing', ok: false, detail: String(err) });
  } finally {
    try {
      await figma.setCurrentPageAsync(previousPage);
      page.remove();
    } catch (err) {
      checks.push({ name: 'scratch page cleaned up', ok: false, detail: String(err) });
    }
  }
  return checks;
}
