/// <reference types="@figma/plugin-typings" />

import { generateDocumentation } from './controller';
import type { UiToPluginMessage, PluginToUiMessage } from '@/types/messages';

figma.showUI(__html__, { width: 400, height: 456 });

figma.on('selectionchange', () => {
  figma.ui.postMessage({
    type: 'SELECTION_CHANGED',
    count: figma.currentPage.selection.length,
  } as PluginToUiMessage);
});

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  if (msg.type === 'GENERATE') {
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
      figma.ui.postMessage({ type: 'COMPLETE', result } as PluginToUiMessage);
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
