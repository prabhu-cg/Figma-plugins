import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '../../src/shared/messages';
import type { DesignSystem } from '../../src/shared/types';
import { GenerationRun } from '../../src/ui/generationRun';
import { fileSize } from '../../src/ui/preview';

const emptyDs = {
  metadata: { fileName: 'F', scope: 'file', generatedAt: '', pluginVersion: '1.2.0' },
  variables: [],
  styles: { text: [], color: [], effect: [], grid: [] },
  components: [],
} as unknown as DesignSystem;

describe('GenerationRun pictures', () => {
  const options = { ...DEFAULT_EXPORT_OPTIONS, componentsJson: true, includeImages: true };

  it('adds each picture as a binary file, once, in path order, after components.json', () => {
    const run = new GenerationRun(
      { needPlugin: false, needStructures: true },
      emptyDs,
      [],
      options,
    );
    const b = Uint8Array.from([1, 2]);
    const a = Uint8Array.from([3, 4, 5]);
    run.addImage('assets/images/b.png', b);
    run.addImage('assets/images/a.png', a);
    run.addImage('assets/images/a.png', a);
    run.structuresDone(false);
    const { files } = run.finish();
    expect(files.map((f) => f.path)).toEqual([
      'components.json',
      'assets/images/a.png',
      'assets/images/b.png',
    ]);
    expect(files[1]).toEqual({ path: 'assets/images/a.png', content: '', bytes: a });
    expect(fileSize(files[1])).toBe(3);
  });

  it('writes the options it was made with into components.json', () => {
    const run = new GenerationRun(
      { needPlugin: false, needStructures: true },
      emptyDs,
      [],
      options,
    );
    run.structuresDone(false);
    const parsed = JSON.parse(run.finish().files[0].content);
    expect(parsed.metadata.options).toMatchObject({
      includeVectorShapes: true,
      includeImages: true,
    });
  });
});
