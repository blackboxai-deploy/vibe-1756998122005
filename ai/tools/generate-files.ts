import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { generateText, tool } from 'ai'
import { getModelOptions } from '../gateway'
import description from './generate-files.md'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  SandboxIdSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'

interface Params {
  modelId: string
  customerId?: string
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const generateFiles = ({ writer, modelId, customerId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: SandboxIdSchema,
    }),
    execute: async (rawArgs, { toolCallId, messages }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ sandboxId: SandboxIdSchema })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('generate-files', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-generating-files',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('generate-files')
      }

      const { sandboxId } = parsed.data
      
      logger.tool('generate-files', 'Starting real-time file generation', {
        toolCallId,
        sandboxId,
        modelId,
        messagesCount: messages.length
      })

      writer.write({
        id: toolCallId,
        type: 'data-generating-files',
        data: { paths: [], status: 'generating' },
      })

      try {
        // First, get the list of files needed
        const fileListPrompt = `Based on our conversation, what files need to be created for this project? 

Return ONLY a JSON array of file paths, like this:
["package.json", "src/index.js", "README.md"]

Rules:
- Use relative paths from project root
- Include only essential files
- No explanations, just the JSON array`

        logger.tool('generate-files', 'Getting file list from AI', {
          toolCallId,
          sandboxId,
          modelId
        })

        const fileListResult = await generateText({
          ...getModelOptions(modelId, customerId),
          messages: [...messages, { role: 'user', content: fileListPrompt }],
          maxRetries: 1,
        })

        if (!fileListResult.text) {
          throw new Error('No file list received from AI')
        }

        // Parse the file list
        let filePaths: string[]
        try {
          const cleanText = fileListResult.text.trim()
          const start = cleanText.indexOf('[')
          const end = cleanText.lastIndexOf(']') + 1
          
          if (start === -1 || end === 0) {
            throw new Error('No JSON array found in response')
          }
          
          filePaths = JSON.parse(cleanText.substring(start, end))
          if (!Array.isArray(filePaths)) {
            throw new Error('Response is not an array')
          }
        } catch (parseError) {
          logger.error('Failed to parse file list', parseError, {
            toolCallId,
            responseText: fileListResult.text
          })
          throw new Error('Failed to parse file list from AI response')
        }

        if (filePaths.length === 0) {
          writer.write({
            id: toolCallId,
            type: 'data-generating-files',
            data: { paths: [], status: 'done' },
          })
          return 'No files were identified for creation.'
        }

        logger.tool('generate-files', `Creating ${filePaths.length} files in real-time`, {
          toolCallId,
          fileCount: filePaths.length,
          files: filePaths
        })

        // Get sandbox instance
        const sandbox = await getSandbox({ sandboxId })
        const createdFiles: string[] = []
        const failedFiles: Array<{ path: string; error: string }> = []

        // Create each file individually and update UI immediately
        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i]
          
          try {
            logger.tool('generate-files', `Generating content for file ${i + 1}/${filePaths.length}: ${filePath}`, {
              toolCallId,
              path: filePath
            })

            // Generate content for this specific file
            const contentPrompt = `Create the complete content for the file "${filePath}" based on our conversation context.

Return ONLY the file content, no explanations or markdown formatting. The content should be:
- Complete and functional code/configuration
- Ready to use without modifications
- Syntactically correct for the file type
- Appropriate for the project context

File content for ${filePath}:`

            const contentResult = await generateText({
              ...getModelOptions(modelId, customerId),
              messages: [...messages, { role: 'user', content: contentPrompt }],
              maxRetries: 1,
            })

            if (!contentResult.text) {
              throw new Error('No content received for file')
            }

            const fileContent = contentResult.text.trim()

            logger.tool('generate-files', `Writing file ${i + 1}/${filePaths.length}: ${filePath}`, {
              toolCallId,
              path: filePath,
              contentLength: fileContent.length
            })

            // Write file to sandbox immediately
            await sandbox.writeFiles([{
              path: filePath,
              content: Buffer.from(fileContent, 'utf8')
            }])

            // File created successfully - add to list and update UI immediately
            createdFiles.push(filePath)
            
            writer.write({
              id: toolCallId,
              type: 'data-generating-files',
              data: {
                paths: createdFiles.map(p => p.startsWith('/') ? p : `/${p}`),
                status: i === filePaths.length - 1 ? 'done' : 'uploading'
              },
            })

            logger.tool('generate-files', `Successfully created file ${i + 1}/${filePaths.length}: ${filePath}`, {
              toolCallId,
              path: filePath
            })

          } catch (fileError) {
            const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error'
            failedFiles.push({ path: filePath, error: errorMsg })
            
            logger.error(`Failed to create file ${i + 1}/${filePaths.length}: ${filePath}`, fileError, {
              toolCallId,
              path: filePath
            })

            // Continue to next file - don't block the entire process
          }
        }

        // Final results
        const duration = Date.now() - startTime
        
        logger.tool('generate-files', 'Real-time file generation completed', {
          toolCallId,
          duration,
          successfulFiles: createdFiles.length,
          failedFiles: failedFiles.length
        })

        // Build response message
        let message = `Generated ${createdFiles.length} files in real-time`
        if (failedFiles.length > 0) {
          message += ` (${failedFiles.length} failed)`
        }
        
        message += ':\n' + createdFiles.map(f => `✓ ${f}`).join('\n')

        if (failedFiles.length > 0) {
          message += '\n\nFailed:\n' + failedFiles.map(f => `✗ ${f.path}: ${f.error}`).join('\n')
        }

        return message

      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Real-time file generation failed', error, {
          toolCallId,
          sandboxId,
          modelId,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-generating-files',
          data: {
            paths: [],
            status: 'done',
            error: error instanceof Error ? error.message : 'Unknown error'
          },
        })

        return `Failed to generate files: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    },
  })
