import type { DocumentationResult } from './types';

export function validateSelection(selection: readonly any[]): { valid: boolean; error?: string } {
  if (!selection || selection.length === 0) {
    return {
      valid: false,
      error: 'Please select a valid Figma component or component set to generate documentation.',
    };
  }

  const validComponents = selection.filter(
    (node: any) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  );

  if (validComponents.length === 0) {
    return {
      valid: false,
      error: 'Please select a valid Figma component or component set to generate documentation.',
    };
  }

  return { valid: true };
}

export function createErrorResult(error: string): DocumentationResult {
  return {
    valid: false,
    error,
  };
}
