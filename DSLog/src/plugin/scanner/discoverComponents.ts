import type { ComponentScanScope, DiscoveredComponent } from "@shared/types/scan";

/* eslint-disable @typescript-eslint/no-explicit-any */

function isTrackableRoot(node: any): boolean {
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") return false;
  // Variants inside a component set are tracked as part of the set, not individually.
  if (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") return false;
  return true;
}

async function collectFromPage(page: PageNode): Promise<DiscoveredComponent[]> {
  await page.loadAsync();
  const nodes = page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
  return nodes
    .filter((node) => isTrackableRoot(node))
    .map((node) => ({
      id: node.id,
      name: node.name,
      componentSetName: node.type === "COMPONENT" ? (node.parent as any)?.name : undefined,
      pageId: page.id,
      pageName: page.name,
    }));
}

export async function discoverComponents(
  scope: ComponentScanScope,
  pageIds: string[],
): Promise<DiscoveredComponent[]> {
  const results: DiscoveredComponent[] = [];

  if (scope === "selection") {
    for (const node of figma.currentPage.selection) {
      if (isTrackableRoot(node)) {
        results.push({
          id: node.id,
          name: node.name,
          pageId: figma.currentPage.id,
          pageName: figma.currentPage.name,
        });
      } else if ("findAllWithCriteria" in node) {
        const nested = (node as any).findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
        for (const n of nested) {
          if (isTrackableRoot(n)) {
            results.push({
              id: n.id,
              name: n.name,
              pageId: figma.currentPage.id,
              pageName: figma.currentPage.name,
            });
          }
        }
      }
    }
    return results;
  }

  if (scope === "current-page") {
    return collectFromPage(figma.currentPage);
  }

  if (scope === "selected-pages") {
    for (const pageId of pageIds) {
      const node = await figma.getNodeByIdAsync(pageId);
      if (node && node.type === "PAGE") {
        results.push(...(await collectFromPage(node)));
      }
    }
    return results;
  }

  // scope === "document"
  await figma.loadAllPagesAsync();
  for (const page of figma.root.children) {
    results.push(...(await collectFromPage(page)));
  }
  return results;
}
