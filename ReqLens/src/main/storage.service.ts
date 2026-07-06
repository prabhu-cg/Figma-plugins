import type { CustomQuestionSet } from '@core/types/custom-question.types';
import type { ResponseSet } from '@core/types/response.types';

const RESPONSES_KEY_PREFIX = 'reqlens:responses:';
const RESPONSES_INDEX_KEY = 'reqlens:responses:index';
const CUSTOM_QUESTIONS_KEY_PREFIX = 'reqlens:custom:';
const CUSTOM_QUESTIONS_INDEX_KEY = 'reqlens:custom:index';
/** figma.clientStorage keys must stay under this key-count/size budget in practice; keep an index for cleanup. */
const MAX_STORED_SIGNATURES = 200;

async function getIndex(indexKey: string): Promise<string[]> {
  const index = await figma.clientStorage.getAsync(indexKey);
  return Array.isArray(index) ? (index as string[]) : [];
}

async function touchIndex(indexKey: string, keyPrefix: string, selectionSignature: string): Promise<void> {
  const index = await getIndex(indexKey);
  const next = [selectionSignature, ...index.filter((sig) => sig !== selectionSignature)];

  // Evict oldest entries beyond the cap so clientStorage doesn't grow unbounded
  // across many different frame selections over the plugin's lifetime.
  const evicted = next.slice(MAX_STORED_SIGNATURES);
  const kept = next.slice(0, MAX_STORED_SIGNATURES);

  await Promise.all(evicted.map((sig) => figma.clientStorage.deleteAsync(`${keyPrefix}${sig}`)));
  await figma.clientStorage.setAsync(indexKey, kept);
}

export async function saveResponses(responseSet: ResponseSet): Promise<void> {
  await figma.clientStorage.setAsync(`${RESPONSES_KEY_PREFIX}${responseSet.selectionSignature}`, responseSet);
  await touchIndex(RESPONSES_INDEX_KEY, RESPONSES_KEY_PREFIX, responseSet.selectionSignature);
}

export async function loadResponses(selectionSignature: string): Promise<ResponseSet | null> {
  const stored = await figma.clientStorage.getAsync(`${RESPONSES_KEY_PREFIX}${selectionSignature}`);
  return (stored as ResponseSet | undefined) ?? null;
}

export async function saveCustomQuestions(customQuestionSet: CustomQuestionSet): Promise<void> {
  await figma.clientStorage.setAsync(
    `${CUSTOM_QUESTIONS_KEY_PREFIX}${customQuestionSet.selectionSignature}`,
    customQuestionSet,
  );
  await touchIndex(CUSTOM_QUESTIONS_INDEX_KEY, CUSTOM_QUESTIONS_KEY_PREFIX, customQuestionSet.selectionSignature);
}

export async function loadCustomQuestions(selectionSignature: string): Promise<CustomQuestionSet | null> {
  const stored = await figma.clientStorage.getAsync(`${CUSTOM_QUESTIONS_KEY_PREFIX}${selectionSignature}`);
  return (stored as CustomQuestionSet | undefined) ?? null;
}
