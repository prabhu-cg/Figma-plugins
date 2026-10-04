/** Minimal stand-ins for Figma nodes — just the fields the audit code reads. */
export const MIXED = Symbol("figma.mixed");

export function solid(r: number, g: number, b: number, opacity = 1, visible = true): SolidPaint {
  return { type: "SOLID", color: { r: r / 255, g: g / 255, b: b / 255 }, opacity, visible } as SolidPaint;
}

export function gradient(): Paint {
  return { type: "GRADIENT_LINEAR", visible: true } as unknown as Paint;
}

export interface FakeInit {
  type?: string;
  name?: string;
  fills?: Paint[];
  strokes?: Paint[];
  opacity?: number;
  visible?: boolean;
  children?: FakeNode[];
}

export type FakeNode = SceneNode & { parent: BaseNode | null };

export function node(init: FakeInit = {}): FakeNode {
  const n: Record<string, unknown> = {
    type: init.type ?? "FRAME",
    name: init.name ?? "node",
    fills: init.fills ?? [],
    strokes: init.strokes ?? [],
    opacity: init.opacity ?? 1,
    visible: init.visible ?? true,
    parent: null
  };
  if (init.children) {
    n.children = init.children;
    for (const child of init.children) (child as unknown as { parent: unknown }).parent = n;
  }
  return n as unknown as FakeNode;
}

export function installFigmaStub(extra: Record<string, unknown> = {}): void {
  (globalThis as unknown as { figma: unknown }).figma = { mixed: MIXED, ...extra };
}
