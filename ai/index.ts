import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel } from 'ai';

export const customMiddleware = {};

export const customModel = (apiIdentifier: string, customerId?: string) => {
  const litellm = createOpenAICompatible({
    name: "litellm",
    baseURL: process.env.LITELLM_BASE_URL || 'https://api.openai.com/v1',
    headers: {
      customerId: customerId || 'chris'
    }
  });

  return wrapLanguageModel({
    model: litellm(apiIdentifier),
    middleware: customMiddleware,
  });
};
