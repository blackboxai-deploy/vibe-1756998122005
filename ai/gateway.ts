import type { JSONValue } from 'ai'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { MODEL_NAME_MAP } from './constants'
import { customModel } from '.'
import { LanguageModel } from 'ai';


interface AvailableModel {
  id: string | 'gpt-5'
  name: string
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  return Object.entries(MODEL_NAME_MAP).map(([id, name]) => ({
    id,
    name
  }))
}

interface ModelOptions {
  model: LanguageModel
  customerId?: string
  providerOptions?: Record<string, Record<string, JSONValue>>
  temperature?: number,
  headers?: Record<string, string>
}

export function getModelOptions(modelId: string, customerId?: string): ModelOptions {
  if (modelId === 'o4-mini') {
    return {
      model: customModel(modelId, customerId),
      temperature:0,
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'detailed',
        } satisfies OpenAIResponsesProviderOptions,
      },
    }
  }

  if (modelId === 'gpt-5') {
    return {
      model: customModel(modelId, customerId),
      providerOptions: {
        openai: {
          include: ['reasoning.encrypted_content'],
          reasoningEffort: 'low',
          reasoningSummary: 'detailed',
        } satisfies OpenAIResponsesProviderOptions,
      },
    }
  }

  if (modelId === 'anthropic/claude-4-sonnet' || modelId === 'openrouter/claude-sonnet-4') {
    return {
      model: customModel(modelId, customerId),
      headers: { 'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14' },
      temperature:0,
      providerOptions: {
        // gateway: { order: ["bedrock", "vertex"] },
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    }
  }

  return {
    model: customModel(modelId, customerId),
    temperature:0,
  }
}
