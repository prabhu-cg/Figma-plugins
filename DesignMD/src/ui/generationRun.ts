/**
 * One press of Generate. The plugin makes the Markdown and token files and streams the component
 * layers it read from Figma; this class collects both and, when everything has arrived, builds
 * components.json here in the UI. That work (assembling, hashing and splitting a file that can be
 * tens of megabytes) would otherwise run on Figma's main thread and freeze the editor.
 */
import type { ExportOptions, GeneratedFile, OutputFailure } from '@shared/messages';
import type { StructureResult } from '@shared/structureTypes';
import type { DesignSystem } from '@shared/types';
import { generateOutputsDetailed } from '../plugin/generators';
import { filterDesignSystemByPages } from '../plugin/transform/pageFilter';

export interface RunPlan {
  /** Does the plugin need to generate Markdown/token files? */
  needPlugin: boolean;
  /** Does components.json need the component layers? */
  needStructures: boolean;
}

export function planRun(options: ExportOptions): RunPlan {
  return {
    needPlugin: options.designMd || options.componentDocs || options.tokensJson || options.cssFile,
    needStructures: options.componentsJson,
  };
}

export class GenerationRun {
  private pluginFiles: GeneratedFile[] | null = null;
  private pluginFailures: OutputFailure[] = [];
  private structures = new Map<string, StructureResult>();
  private structuresFinished = false;
  private cancelled = false;

  constructor(
    private plan: RunPlan,
    private designSystem: DesignSystem,
    private excludedPages: readonly string[],
    private options: ExportOptions,
  ) {}

  addPluginResult(files: GeneratedFile[], failures: OutputFailure[] = []): void {
    this.pluginFiles = files;
    this.pluginFailures = failures;
  }

  addStructures(items: ReadonlyArray<[string, StructureResult]>): void {
    for (const [id, result] of items) this.structures.set(id, result);
  }

  structuresDone(cancelled: boolean): void {
    this.structuresFinished = true;
    this.cancelled = cancelled;
  }

  /** True once everything this run is waiting for has arrived. */
  isReady(): boolean {
    return (
      (!this.plan.needPlugin || this.pluginFiles !== null) &&
      (!this.plan.needStructures || this.structuresFinished)
    );
  }

  /** True when finishing will do real work (building components.json) rather than just hand over files. */
  get buildsComponentsJson(): boolean {
    return this.plan.needStructures;
  }

  finish(): { files: GeneratedFile[]; failures: OutputFailure[] } {
    const files = [...(this.pluginFiles ?? [])];
    const failures = [...this.pluginFailures];
    if (this.plan.needStructures) {
      const ds = filterDesignSystemByPages(this.designSystem, this.excludedPages);
      // Anything the plugin did not report is marked, never silently missing.
      for (const doc of ds.components) {
        if (this.structures.has(doc.id)) continue;
        this.structures.set(
          doc.id,
          this.cancelled
            ? { error: 'Generation was cancelled.', cancelled: true }
            : { error: 'No result was received from the plugin.' },
        );
      }
      const built = generateOutputsDetailed(
        ds,
        {
          ...this.options,
          designMd: false,
          componentDocs: false,
          tokensJson: false,
          cssFile: false,
          componentsJson: true,
        },
        { structures: this.structures },
      );
      files.push(...built.files);
      failures.push(...built.failures);
    }
    return { files, failures };
  }
}
