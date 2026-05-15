import type { RootManifest } from '@/types/schemas';

export function generateAICatalog(manifest: RootManifest): string {
  try {
    const components = manifest?.domains?.components?.components || [];
    const timestamp = new Date().toISOString();

    const catalog = {
      version: '1.0.0',
      generatedAt: timestamp,
      source: {
        fileName: manifest?.source?.fileName || 'design-system',
        pageName: manifest?.source?.pageName || 'Unknown',
      },
      components: components.map((comp: any, i: number) => ({
        id: i,
        name: comp?.name || `Component ${i + 1}`,
        description: `Component for building UI`,
        variantCount: comp?.variants ? Object.keys(comp.variants).length : 0,
      })),
      summary: `Design system with ${components.length} components extracted from Figma`,
    };

    return JSON.stringify(catalog, null, 2);
  } catch (error) {
    console.error('Error in AI catalog generator:', error);
    return JSON.stringify({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      components: [],
      summary: 'Design system catalog',
    }, null, 2);
  }
}
