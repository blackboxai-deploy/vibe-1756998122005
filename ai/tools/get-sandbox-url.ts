import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandboxUrl } from '@/lib/sandbox-url-getter'
import { tool } from 'ai'
import description from './get-sandbox-url.md'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  PortSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'
import { getCurrentSandboxIdCached } from '@/lib/services/sandboxCache'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
}

export const getSandboxURL = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      port: PortSchema,
    }),
    execute: async (rawArgs, { toolCallId }) => {
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ port: PortSchema })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('get-sandbox-url', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-get-sandbox-url',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('get-sandbox-url')
      }

      const { port } = parsed.data
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-get-sandbox-url',
              data: { status: 'done', error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-get-sandbox-url',
            data: { status: 'done', error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-get-sandbox-url',
          data: { status: 'done', error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('get-sandbox-url', 'Starting to get sandbox URL', {
        toolCallId,
        sandboxId,
        port
      })

      writer.write({
        id: toolCallId,
        type: 'data-get-sandbox-url',
        data: { status: 'loading' },
      })

      try {
        // Use the standalone function
        const result = await getSandboxUrl({
          sandboxId,
          port,
          contextId: toolCallId
        })

        writer.write({
          id: toolCallId,
          type: 'data-get-sandbox-url',
          data: { url: result.url, status: 'done' },
        })

        logger.tool('get-sandbox-url', 'URL generation completed', {
          sandboxId,
          port,
          url: result.url,
          toolCallId,
          duration: result.duration
        })

        return { url: result.url }
      } catch (error) {
        logger.error('Failed to get sandbox URL', error, {
          toolCallId,
          sandboxId,
          port
        })

        throw error
      }
    },
  })
