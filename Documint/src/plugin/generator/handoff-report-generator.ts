import type { RootManifest } from '@/types/schemas';

export function generateHandoffReport(manifest: RootManifest): string {
  try {
    const components = manifest?.domains?.components?.components || [];
    const fileName = manifest?.source?.fileName || 'design-system';
    const pageName = manifest?.source?.pageName || 'Unknown Page';

    let markdown = `# Design System Handoff Report

**Source:** ${fileName} > ${pageName}
**Generated:** ${new Date().toLocaleDateString()}

## 📦 Components (${components.length} total)

`;

    components.forEach((comp: any, i: number) => {
      const name = comp?.name || `Component ${i + 1}`;
      const variantCount = comp?.variants ? Object.keys(comp.variants).length : 1;
      markdown += `### ${i + 1}. ${name}\n`;
      markdown += `- **Variants:** ${variantCount}\n`;
      markdown += `- [ ] Implement component\n`;
      markdown += `- [ ] Test all variants\n`;
      markdown += `- [ ] Add accessibility\n`;
      markdown += `- [ ] Write tests\n\n`;
    });

    markdown += `
## 🚀 Getting Started

1. Install the design system package
2. Import components as needed
3. Follow component documentation
4. Test on all target browsers

## 💻 Integration Examples

### React
\`\`\`jsx
import { Button, Card } from '@design-system/components';

export function App() {
  return <Button>Click me</Button>;
}
\`\`\`

### Vue
\`\`\`vue
<template>
  <Button>Click me</Button>
</template>
\`\`\`

### Vanilla JS
\`\`\`html
<button class="ds-button">Click me</button>
\`\`\`

## ✅ Implementation Checklist

- [ ] Set up development environment
- [ ] Review component specifications
- [ ] Implement components
- [ ] Add unit tests
- [ ] Test accessibility (WCAG AA)
- [ ] Test on mobile devices
- [ ] Documentation complete
- [ ] Code review approved

## 📞 Support

For questions, contact the design team or check the component documentation.

---
*This handoff report was automatically generated from your Figma design system.*
`;

    return markdown;
  } catch (error) {
    console.error('Error in handoff report generator:', error);
    return `# Design System Handoff Report

An error occurred while generating the handoff report.

Please try again or regenerate from the latest design system.
`;
  }
}
