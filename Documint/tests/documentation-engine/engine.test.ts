import { generateComponentDocumentation, validateSelection } from '@/plugin/documentation-engine';
import { validateSelection as validateSelectionDirect } from '@/plugin/documentation-engine/validator';

describe('Documentation Engine', () => {
  describe('Validation', () => {
    it('should reject empty selection', () => {
      const result = validateSelection([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Please select a valid');
    });

    it('should reject non-component nodes', () => {
      const result = validateSelection([
        { type: 'FRAME', id: '1', name: 'Frame' },
      ]);
      expect(result.valid).toBe(false);
    });

    it('should accept COMPONENT nodes', () => {
      const result = validateSelection([
        { type: 'COMPONENT', id: '1', name: 'Button', description: '', componentPropertyDefinitions: {}, children: [] },
      ]);
      expect(result.valid).toBe(true);
    });

    it('should accept COMPONENT_SET nodes', () => {
      const result = validateSelection([
        { type: 'COMPONENT_SET', id: '1', name: 'Button', description: '', componentPropertyDefinitions: {}, children: [] },
      ]);
      expect(result.valid).toBe(true);
    });

    it('should filter mixed nodes and accept only components', () => {
      const result = validateSelection([
        { type: 'FRAME', id: '1', name: 'Frame' },
        { type: 'COMPONENT', id: '2', name: 'Button', description: '', componentPropertyDefinitions: {}, children: [] },
      ]);
      expect(result.valid).toBe(true);
    });
  });

  describe('Component Extraction', () => {
    it('should extract basic component data', async () => {
      const mockComponent = {
        id: 'comp-1',
        type: 'COMPONENT',
        name: 'Button',
        description: 'A button component',
        componentPropertyDefinitions: {
          size: { type: 'VARIANT', defaultValue: ['Small', 'Medium', 'Large'] },
          variant: { type: 'VARIANT', defaultValue: ['Primary', 'Secondary'] },
        },
        children: [
          { type: 'FRAME', name: 'Icon', description: 'Icon container' },
          { type: 'TEXT', name: 'Label', description: 'Button label' },
        ],
        boundVariables: {},
      };

      const result = await generateComponentDocumentation(
        [mockComponent],
        { exportMarkdown: true }
      );

      expect(result.valid).toBe(true);
      expect(result.components).toBeDefined();
      expect(result.components!.length).toBe(1);

      const component = result.components![0];
      expect(component.name).toBe('Button');
      expect(component.description).toBe('A button component');
      expect(component.variantGroups.length).toBeGreaterThan(0);
      expect(component.anatomy.length).toBeGreaterThan(0);
    });

    it('should generate markdown output', async () => {
      const mockComponent = {
        id: 'comp-1',
        type: 'COMPONENT',
        name: 'Button/Primary',
        description: 'Primary action button',
        componentPropertyDefinitions: {},
        children: [
          { type: 'FRAME', name: 'Icon' },
        ],
        boundVariables: {},
      };

      const result = await generateComponentDocumentation(
        [mockComponent],
        { exportMarkdown: true }
      );

      expect(result.markdown).toBeDefined();
      expect(result.markdown!).toContain('# Button – Primary');
      expect(result.markdown!).toContain('## Description');
      expect(result.markdown!).toContain('## Anatomy');
    });

  });

  describe('Multiple Components', () => {
    it('should handle multiple selected components', async () => {
      const mockComponents = [
        {
          id: 'comp-1',
          type: 'COMPONENT',
          name: 'Button',
          description: 'Button component',
          componentPropertyDefinitions: {},
          children: [],
          boundVariables: {},
        },
        {
          id: 'comp-2',
          type: 'COMPONENT',
          name: 'Input',
          description: 'Input component',
          componentPropertyDefinitions: {},
          children: [],
          boundVariables: {},
        },
      ];

      const result = await generateComponentDocumentation(mockComponents);

      expect(result.valid).toBe(true);
      expect(result.components!.length).toBe(2);
      expect(result.components![0].name).toBe('Button');
      expect(result.components![1].name).toBe('Input');
    });
  });

  describe('Naming Convention Parsing', () => {
    it('should normalize component names with slashes', async () => {
      const mockComponent = {
        id: 'comp-1',
        type: 'COMPONENT',
        name: 'Button/Primary/Large',
        description: 'Large primary button',
        componentPropertyDefinitions: {},
        children: [],
        boundVariables: {},
      };

      const result = await generateComponentDocumentation([mockComponent], { exportMarkdown: true });

      expect(result.markdown).toContain('# Button – Primary – Large');
    });
  });

  describe('UI Metadata', () => {
    it('should provide ui metadata for component chips', async () => {
      const mockComponent = {
        id: 'comp-1',
        type: 'COMPONENT',
        name: 'Button',
        description: 'Button component',
        componentPropertyDefinitions: {
          size: { type: 'VARIANT', defaultValue: ['Small', 'Medium', 'Large'] },
          type: { type: 'VARIANT', defaultValue: ['Primary', 'Secondary'] },
        },
        children: [],
        boundVariables: {},
      };

      // Provide actual variants from Figma
      const mockVariants = [
        { id: 'v1', name: 'Small/Primary', componentProperties: {} },
        { id: 'v2', name: 'Medium/Primary', componentProperties: {} },
        { id: 'v3', name: 'Large/Primary', componentProperties: {} },
      ];

      const result = await generateComponentDocumentation([mockComponent], {}, {
        components: [mockComponent],
        variantsByComponentId: { 'comp-1': mockVariants },
      });

      expect(result.ui).toBeDefined();
      expect(result.ui!.components.length).toBe(1);
      expect(result.ui!.components[0].name).toBe('Button');
      expect(result.ui!.components[0].variantCount).toBe(3);
    });
  });
});
