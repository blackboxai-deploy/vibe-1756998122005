import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './delete-file.md'
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

export const deleteFile = ({ writer, sessionId }: Params) =>
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
        logger.tool('delete-file', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-delete-file',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('delete-file')
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
              type: 'data-delete-file',
              data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId: '', error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-delete-file',
            data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId: '', error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-delete-file',
          data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId: '', error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('delete-file', 'Starting file deletion operation', {
        toolCallId,
        sandboxId,
        path
      })

      writer.write({
        id: toolCallId,
        type: 'data-delete-file',
        data: { path, status: 'loading', sandboxId },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file deletion', {
          toolCallId,
          path
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Check if file exists before attempting to delete
        logger.sandbox(sandboxId, 'Checking if file exists before deletion', {
          toolCallId,
          path
        })

        try {
          const existingFileStream = await sandbox.readFile({ path })
          if (!existingFileStream) {
            const duration = Date.now() - startTime
            logger.tool('delete-file', 'File not found for deletion', {
              toolCallId,
              sandboxId,
              path,
              duration
            })

            writer.write({
              id: toolCallId,
              type: 'data-delete-file',
              data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId, error: 'File not found' },
            })

            return {
              success: false,
              error: 'File not found',
              path,
            }
          }
        } catch (error) {
          const duration = Date.now() - startTime
          logger.tool('delete-file', 'File not found for deletion', {
            toolCallId,
            sandboxId,
            path,
            duration
          })

          writer.write({
            id: toolCallId,
            type: 'data-delete-file',
            data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId, error: 'File not found' },
          })

          return {
            success: false,
            error: 'File not found',
            path,
          }
        }

        // Delete the file using the runCommand tool functionality
        logger.sandbox(sandboxId, 'Deleting file from sandbox', {
          toolCallId,
          path
        })

        const command = await sandbox.runCommand({
          cmd: 'rm',
          args: [path],
          detached: true
        })

        // Wait for command completion
        const done = await command.wait()
        const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])

        if (done.exitCode !== 0) {
          const duration = Date.now() - startTime
          logger.tool('delete-file', 'File deletion failed', {
            toolCallId,
            sandboxId,
            path,
            exitCode: done.exitCode,
            stderr,
            stdout,
            duration
          })

          let errorMessage = 'Failed to delete file'
          if (stderr?.toLowerCase().includes('no such file')) {
            errorMessage = 'File not found'
          } else if (stderr?.toLowerCase().includes('permission denied')) {
            errorMessage = 'Permission denied'
          } else if (stderr && stderr.trim() !== '') {
            errorMessage = stderr.trim()
          }

          writer.write({
            id: toolCallId,
            type: 'data-delete-file',
            data: { 
              path: path.startsWith('/') ? path : `/${path}`, 
              status: 'done', 
              sandboxId, 
              error: errorMessage 
            },
          })

          return {
            success: false,
            error: errorMessage,
            path,
          }
        }

        const duration = Date.now() - startTime
        logger.tool('delete-file', 'File deletion completed successfully', {
          toolCallId,
          sandboxId,
          path,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-delete-file',
          data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId },
        })

        return {
          success: true,
          path,
          message: `File deleted successfully: ${path}`,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        logger.tool('delete-file', 'File deletion failed', {
          toolCallId,
          sandboxId,
          path,
          error: error instanceof Error ? error.message : String(error),
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-delete-file',
          data: { 
            path: path.startsWith('/') ? path : `/${path}`, 
            status: 'done', 
            sandboxId, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
          },
        })

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          path,
        }
      }
    },
  })
