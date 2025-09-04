import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './read-file.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  PathSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'
import { getCurrentSandboxIdCached } from '@/lib/services/sandboxCache'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
}

export const readFile = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      path: PathSchema,
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ path: PathSchema })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('read-file', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-read-file',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('read-file')
      }

      const { path } = parsed.data
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-read-file',
              data: { path, status: 'done', sandboxId: '', error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-read-file',
            data: { path, status: 'done', sandboxId: '', error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-read-file',
          data: { path, status: 'done', sandboxId: '', error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('read-file', 'Starting file read operation', {
        toolCallId,
        sandboxId,
        path
      })

      writer.write({
        id: toolCallId,
        type: 'data-read-file',
        data: { path, status: 'loading', sandboxId },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file read', {
          toolCallId,
          path
        })

        const sandbox = await getSandbox({ sandboxId })
        
        logger.sandbox(sandboxId, 'Reading file from sandbox', {
          toolCallId,
          path
        })

        const stream = await sandbox.readFile({ path })
        
        if (!stream) {
          const duration = Date.now() - startTime
          logger.tool('read-file', 'File not found in sandbox', {
            toolCallId,
            sandboxId,
            path,
            duration
          })

          writer.write({
            id: toolCallId,
            type: 'data-read-file',
            data: { path, status: 'done', sandboxId, error: 'File not found' },
          })

          return `File not found: ${path}`
        }

        // Convert stream to string
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        const content = Buffer.concat(chunks).toString('utf8')

        const duration = Date.now() - startTime
        logger.performance('file-read', duration, {
          sandboxId,
          path,
          contentLength: content.length,
          toolCallId
        })

        logger.sandbox(sandboxId, 'File read successfully', {
          toolCallId,
          path,
          contentLength: content.length,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-read-file',
          data: { path, status: 'done', sandboxId, content },
        })

        logger.tool('read-file', 'File read operation completed', {
          sandboxId,
          path,
          toolCallId,
          contentLength: content.length,
          duration
        })

        return `Successfully read file: ${path}\n\nContent:\n${content}`
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Failed to read file from sandbox', error, {
          toolCallId,
          sandboxId,
          path,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-read-file',
          data: { path, status: 'done', sandboxId, error: 'Read failed' },
        })

        throw error
      }
    },
  })
