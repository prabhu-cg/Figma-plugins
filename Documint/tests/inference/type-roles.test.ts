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
