import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { lintingService } from '@/lib/services/lintingService'
import description from './create-file.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  PathSchema, 
  ContentSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'
import { getCurrentSandboxIdCached } from '@/lib/services/sandboxCache'

interface LintResult {
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'error' | 'warning' | 'info';
}

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
}

export const createFile = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      path: PathSchema,
      content: ContentSchema,
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ path: PathSchema, content: ContentSchema })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('create-file', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-file',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('create-file')
      }

      const { path, content } = parsed.data

      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-create-file',
              data: { 
                path, 
                status: 'done', 
                sandboxId: '', 
                error: 'No valid sandbox found for this session' 
              },
            })

            return {
              success: false,
              error: 'No valid sandbox found for this session. Please create a sandbox first.',
              path,
            }
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-create-file',
            data: { 
              path, 
              status: 'done', 
              sandboxId: '', 
              error: 'Failed to resolve sandbox context' 
            },
          })

          return {
            success: false,
            error: 'Failed to resolve sandbox context. Please try again.',
            path,
          }
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-create-file',
          data: { 
            path, 
            status: 'done', 
            sandboxId: '', 
            error: 'No session ID provided' 
          },
        })

        return {
          success: false,
          error: 'No session ID provided. Cannot resolve sandbox context.',
          path,
        }
      }
      
      logger.tool('create-file', 'Starting file creation operation', {
        toolCallId,
        sandboxId,
        path,
        contentLength: content.length
      })

      writer.write({
        id: toolCallId,
        type: 'data-create-file',
        data: { path, status: 'loading', sandboxId },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file creation', {
          toolCallId,
          path
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Check if file already exists using a simpler approach
        logger.sandbox(sandboxId, 'Checking if file already exists', {
          toolCallId,
          path
        })

        let fileExists = false
        try {
          const existingFileStream = await sandbox.readFile({ path })
          if (existingFileStream) {
            // Try to read a small chunk to confirm file exists and has content
            for await (const chunk of existingFileStream) {
              if (chunk && chunk.length > 0) {
                fileExists = true
                break
              }
              // Only check first chunk
              break
            }
          }
        } catch (error) {
          // File doesn't exist or isn't readable, which is what we want for creating a new file
          logger.sandbox(sandboxId, 'File does not exist or is not readable, proceeding with creation', {
            toolCallId,
            path,
            error: error instanceof Error ? error.message : String(error)
          })
        }

        if (fileExists) {
          const duration = Date.now() - startTime
          logger.tool('create-file', 'File already exists', {
            toolCallId,
            sandboxId,
            path,
            duration
          })

          writer.write({
            id: toolCallId,
            type: 'data-create-file',
            data: { path: path.startsWith('/') ? path : `/${path}`, status: 'done', sandboxId, error: 'File already exists at this path' },
          })

          return {
            success: false,
            error: 'File already exists at this path',
            path,
          }
        }

        // Create the file with content
        logger.sandbox(sandboxId, 'Creating new file in sandbox', {
          toolCallId,
          path,
          contentLength: content.length
        })

        // Add timeout for file creation to prevent hanging
        const createFilePromise = sandbox.writeFiles([{
          path,
          content: Buffer.from(content, 'utf8')
        }])

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('File creation timeout after 30 seconds')), 30000)
        })

        await Promise.race([createFilePromise, timeoutPromise])

        // Perform linting after successful file creation
        let lintResults: LintResult[] = []
        try {
          logger.tool('create-file', 'Starting linting process', {
            toolCallId,
            sandboxId,
            path
          })

          lintResults = await lintingService.lintContent(path, content)

          console.log("lintResults",lintResults)
          
          if (lintResults.length > 0) {
            logger.tool('create-file', 'Linting completed with issues found', {
              toolCallId,
              sandboxId,
              path,
              issueCount: lintResults.length
            })
          } else {
            logger.tool('create-file', 'Linting completed with no issues', {
              toolCallId,
              sandboxId,
              path
            })
          }
        } catch (lintError) {
          logger.tool('create-file', 'Linting failed, but file creation succeeded', {
            toolCallId,
            sandboxId,
            path,
            lintError: lintError instanceof Error ? lintError.message : String(lintError)
          })
          // Don't fail the entire operation if linting fails
        }

        const duration = Date.now() - startTime
        logger.tool('create-file', 'File creation completed successfully', {
          toolCallId,
          sandboxId,
          path,
          contentLength: content.length,
          duration,
          lintIssues: lintResults.length
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-file',
          data: { 
            path: path.startsWith('/') ? path : `/${path}`, 
            status: 'done', 
            sandboxId,
            lintResults: lintResults.length > 0 ? lintResults : undefined
          },
        })

        // Format linting results for the message
        let message = `File created successfully at ${path}`
        if (lintResults.length > 0) {
          message += `\n\n🔍 Linting Results (${lintResults.length} issue${lintResults.length === 1 ? '' : 's'} found):`
          lintResults.forEach((result, index) => {
            const severityIcon = result.severity === 'error' ? '❌' : result.severity === 'warning' ? '⚠️' : 'ℹ️'
            message += `\n${index + 1}. ${severityIcon} Line ${result.line}, Column ${result.column}: ${result.message}`
            if (result.rule) {
              message += ` (${result.rule})`
            }
          })

          message += `
          **Next Steps: Recovery Actions:**
            - You should now carefully look into the issue
            - Edit the file to fix all the critical issues before proceeding further`
        } else if (await lintingService.isFileSupported(path)) {
          message += `\n\n✅ No linting issues found`
        }

        return {
          success: true,
          path,
          message,
          contentLength: content.length,
          lintResults: lintResults.length > 0 ? lintResults : undefined,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        logger.tool('create-file', 'File creation failed', {
          toolCallId,
          sandboxId,
          path,
          error: error instanceof Error ? error.message : String(error),
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-file',
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
