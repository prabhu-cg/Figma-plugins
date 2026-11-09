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

/** How the layer reading went, in numbers a person can check against the file. */
export interface ReadSummary {
  /** Components and component sets that were asked for. */
  components: number;
  /** Read in full. */
  read: number;
  /** Read but cut short by a budget (layers, depth, time or size). */
  truncated: number;
  /** Not read at all: failed, cancelled or out of time. */
  notRead: number;
  /** Warnings from reading, by code. */
  warningsByCode: Record<string, number>;
}

export function summarizeReads(
  componentIds: readonly string[],
  structures: ReadonlyMap<string, StructureResult>,
): ReadSummary {
  const summary: ReadSummary = {
    components: componentIds.length,
    read: 0,
    truncated: 0,
    notRead: 0,
    warningsByCode: {},
  };
  for (const id of componentIds) {
    const result = structures.get(id);
    if (!result || 'error' in result) {
      summary.notRead++;
      continue;
    }
    if (result.treeTruncated) summary.truncated++;
    else summary.read++;
    for (const w of result.warnings) {
      summary.warningsByCode[w.code] = (summary.warningsByCode[w.code] ?? 0) + 1;
    }
  }
  return summary;
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

  finish(): { files: GeneratedFile[]; failures: OutputFailure[]; readSummary?: ReadSummary } {
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
      return {
        files,
        failures,
        readSummary: summarizeReads(
          ds.components.map((c) => c.id),
          this.structures,
        ),
      };
    }
    return { files, failures };
  }
}
