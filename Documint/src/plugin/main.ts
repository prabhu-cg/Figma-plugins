/// <reference types="@figma/plugin-typings" />

import { generateDocumentation } from './controller';
import { categorizePages } from './filter/page-detection';
import type { UiToPluginMessage, PluginToUiMessage } from '@/types/messages';

figma.showUI(__html__, { width: 400, height: 464 });

figma.on('selectionchange', () => {
  const selectedNames = figma.currentPage.selection
    .map((node: any) => node.name)
    .filter(Boolean);

  figma.ui.postMessage({
    type: 'SELECTION_CHANGED',
    count: figma.currentPage.selection.length,
    selectedNames,
  } as PluginToUiMessage);
});

function sendDetectedPages() {
  const allPages = figma.root.children;
  const pageNames = allPages.map((p: any) => p.name);
  const detectedPages = categorizePages(pageNames);
  console.log('Plugin: Sending PAGES_DETECTED:', {
    core: detectedPages.core,
    icons: detectedPages.icons,
    examples: detectedPages.examples,
    other: detectedPages.other,
  });
  figma.ui.postMessage({ type: 'PAGES_DETECTED', detectedPages } as PluginToUiMessage);
}

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  if (msg.type === 'READY') {
    const selectedNames = figma.currentPage.selection
      .map((node: any) => node.name)
      .filter(Boolean);

    figma.ui.postMessage({
      type: 'SELECTION_CHANGED',
      count: figma.currentPage.selection.length,
      selectedNames,
    } as PluginToUiMessage);

    sendDetectedPages();
  }

  if (msg.type === 'REQUEST_PAGES') {
    sendDetectedPages();
  }

  if (msg.type === 'CANCEL') {
    // Generation can't be interrupted mid-flight in a Figma plugin worker,
    // but we acknowledge the cancel so the UI can reset immediately.
    console.log('Plugin: generation cancelled by user');
  }

  if (msg.type === 'GENERATE') {
    console.log('GENERATE received with options:', msg.options);
    try {
      const result = await generateDocumentation(
        figma.currentPage.selection,
        msg.options,
        (step, index, total) => {
          figma.ui.postMessage({
            type: 'PROGRESS',
            step,
            index,
            total,
            percent: Math.round((index / total) * 100),
          } as PluginToUiMessage);
        }
      );

      // For full-system mode, use "fulldesign" as filename, otherwise use selected component names
      let selectedNames: string[] = [];
      if (msg.options?.markdownMode === 'full-system') {
        selectedNames = ['fulldesign'];
      } else {
        selectedNames = figma.currentPage.selection
          .map((node: any) => node.name)
          .filter(Boolean);
      }

      figma.ui.postMessage({ type: 'COMPLETE', result, selectedNames } as PluginToUiMessage);
    } catch (err) {
      figma.ui.postMessage({
        type: 'ERROR',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
      } as PluginToUiMessage);
    }
  }

  if (msg.type === 'NAVIGATE_TO_PAGE') {
    const page = figma.root.children.find((p: any) => p.id === msg.pageId);
    if (page) figma.currentPage = page as PageNode;
  }
};
