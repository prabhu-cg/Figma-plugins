/// <reference types="@figma/plugin-typings" />
import { analyzeFrames } from '@core/services/analysis.service';
import { selectionSignature } from '@core/utils/id';
import type { MainToUIMessage, UIToMainMessage } from '@shared/messages';
import { getAnalyzableSelection, serializeSelection } from './selection.service';
import { loadCustomQuestions, loadResponses, saveCustomQuestions, saveResponses } from './storage.service';

const UI_WIDTH = 680;
const UI_HEIGHT = 680;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

function postToUI(message: MainToUIMessage): void {
  figma.ui.postMessage(message);
}

async function analyzeCurrentSelection(): Promise<void> {
  try {
    const nodes = getAnalyzableSelection();

    if (nodes.length === 0) {
      postToUI({ type: 'selection-empty' });
      return;
    }

    const selectedFrames = await serializeSelection(nodes);
    const analysis = analyzeFrames(
      selectedFrames.map((frame) => ({
        frameId: frame.frameId,
        frameName: frame.frameName,
        root: frame.root,
        truncated: frame.summary.truncated,
      })),
    );

    postToUI({
      type: 'selection-analyzed',
      payload: {
        selectionSignature: selectionSignature(selectedFrames.map((frame) => frame.frameId)),
        frames: selectedFrames.map((frame) => frame.summary),
        analysis,
      },
    });
  } catch (error) {
    postToUI({
      type: 'selection-error',
      payload: { message: error instanceof Error ? error.message : 'Unknown error analyzing selection.' },
    });
  }
}

figma.on('selectionchange', () => {
  void analyzeCurrentSelection();
});

figma.ui.onmessage = async (message: UIToMainMessage) => {
  switch (message.type) {
    case 'ui-ready':
    case 'analyze-selection':
      await analyzeCurrentSelection();
      return;

    case 'save-responses':
      try {
        await saveResponses(message.payload);
        postToUI({
          type: 'responses-saved',
          payload: { selectionSignature: message.payload.selectionSignature, savedAt: Date.now() },
        });
      } catch (error) {
        postToUI({
          type: 'selection-error',
          payload: { message: error instanceof Error ? error.message : 'Failed to save responses.' },
        });
      }
      return;

    case 'load-responses': {
      const responseSet = await loadResponses(message.payload.selectionSignature);
      postToUI({ type: 'responses-loaded', payload: { responseSet } });
      return;
    }

    case 'save-custom-questions':
      try {
        await saveCustomQuestions(message.payload);
        postToUI({
          type: 'custom-questions-saved',
          payload: { selectionSignature: message.payload.selectionSignature, savedAt: Date.now() },
        });
      } catch (error) {
        postToUI({
          type: 'selection-error',
          payload: { message: error instanceof Error ? error.message : 'Failed to save custom questions.' },
        });
      }
      return;

    case 'load-custom-questions': {
      const customQuestionSet = await loadCustomQuestions(message.payload.selectionSignature);
      postToUI({ type: 'custom-questions-loaded', payload: { customQuestionSet } });
      return;
    }

    case 'resize':
      figma.ui.resize(
        Math.max(320, Math.round(message.payload.width)),
        Math.max(400, Math.round(message.payload.height)),
      );
      return;
  }
};

if (figma.command === 'analyze') {
  void analyzeCurrentSelection();
}
