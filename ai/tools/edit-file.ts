import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './edit-file.md'
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

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
}

export const editFile = ({ writer, sessionId }: Params) =>
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
        logger.tool('edit-file', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-edit-file',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('edit-file')
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
              type: 'data-edit-file',
              data: { 
                path, 
                status: 'done', 
                sandboxId: '', 
                error: 'No valid sandbox found for this session' 
              },
            })

            return `No valid sandbox found for this session. Please create a sandbox first.`
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-edit-file',
            data: { 
              path, 
              status: 'done', 
              sandboxId: '', 
              error: 'Failed to resolve sandbox context' 
            },
          })

          return `Failed to resolve sandbox context. Please try again.`
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-edit-file',
          data: { 
            path, 
            status: 'done', 
            sandboxId: '', 
            error: 'No session ID provided' 
          },
        })

        return `No session ID provided. Cannot resolve sandbox context.`
      }
      
      logger.tool('edit-file', 'Starting file edit operation', {
        toolCallId,
        sandboxId,
        path
      })

      // Parse diff blocks from content
      const diffBlocks = parseDiffBlocks(content)
      
      writer.write({
        id: toolCallId,
        type: 'data-edit-file',
        data: { 
          path, 
          status: 'loading', 
          sandboxId,
          edits: diffBlocks.map(block => ({ search: block.search, replace: block.replace }))
        },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file edit', {
          toolCallId,
          path,
          editCount: diffBlocks.length
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Read the current file content
        logger.sandbox(sandboxId, 'Reading current file content', {
          toolCallId,
          path
        })

        const stream = await sandbox.readFile({ path })
        
        if (!stream) {
          const duration = Date.now() - startTime
          logger.tool('edit-file', 'File not found in sandbox', {
            toolCallId,
            sandboxId,
            path,
            duration
          })

          writer.write({
            id: toolCallId,
            type: 'data-edit-file',
            data: { path, status: 'done', sandboxId, error: 'File not found' },
          })

          return `File not found: ${path}`
        }

        // Convert stream to string
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        let fileContent = Buffer.concat(chunks).toString('utf8')

        // Apply each diff block
        let appliedEdits = 0
        for (const block of diffBlocks) {
          const originalContent = fileContent
          fileContent = fileContent.replace(block.search, block.replace)
          
          if (fileContent !== originalContent) {
            appliedEdits++
            logger.debug('Applied edit block', {
              toolCallId,
              sandboxId,
              path,
              searchLength: block.search.length,
              replaceLength: block.replace.length
            })
          } else {
            logger.warn('Edit block did not match any content', {
              toolCallId,
              sandboxId,
              path,
              searchPreview: block.search.substring(0, 100)
            })
          }
        }

        // Write the updated content back to the file
        logger.sandbox(sandboxId, 'Writing updated file content', {
          toolCallId,
          path,
          appliedEdits,
          totalEdits: diffBlocks.length
        })

        await sandbox.writeFiles([{
          path,
          content: Buffer.from(fileContent, 'utf8')
        }])

        const duration = Date.now() - startTime
        logger.performance('file-edit', duration, {
          sandboxId,
          path,
          appliedEdits,
          totalEdits: diffBlocks.length,
          toolCallId
        })

        logger.sandbox(sandboxId, 'File edited successfully', {
          toolCallId,
          path,
          appliedEdits,
          totalEdits: diffBlocks.length,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-edit-file',
          data: { 
            path, 
            status: 'done', 
            sandboxId,
            edits: diffBlocks.map(block => ({ search: block.search, replace: block.replace }))
          },
        })

        logger.tool('edit-file', 'File edit operation completed', {
          sandboxId,
          path,
          toolCallId,
          appliedEdits,
          totalEdits: diffBlocks.length,
          duration
        })

        return `Successfully edited file: ${path}\nApplied ${appliedEdits} out of ${diffBlocks.length} edit blocks.`
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Failed to edit file in sandbox', error, {
          toolCallId,
          sandboxId,
          path,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-edit-file',
          data: { path, status: 'done', sandboxId, error: 'Edit failed' },
        })

        throw error
      }
    },
  })

interface DiffBlock {
  search: string
  replace: string
}


export function parseDiffBlocks(content: string): DiffBlock[] {
  const blocks: DiffBlock[] = []
  const OPEN = '<<<<<<< SEARCH'
  const SEP = '======='
  const CLOSE = '>>>>>>> REPLACE'

  // Normalize line endings to simplify parsing
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Look for the start of a diff block
    if (line.startsWith(OPEN)) {
      const searchLines: string[] = []
      const replaceLines: string[] = []

      // Capture any trailing text on the same line as the OPEN marker,
      // e.g. "<<<<<<< SEARCH>}, ..." -> include "}, ..." in the search text.
      let trailingOpen = line.slice(OPEN.length)
      if (trailingOpen.length > 0) {
        // Drop a single leading '>' (with optional surrounding space) if present
        trailingOpen = trailingOpen.replace(/^\s*>\s?/, '')
        if (trailingOpen.length > 0) searchLines.push(trailingOpen)
      }

      i++

      // Accumulate search lines until the separator
      while (i < lines.length && !lines[i].startsWith(SEP)) {
        searchLines.push(lines[i])
        i++
      }

      if (i >= lines.length) break // malformed: no separator

      // Handle possible trailing text on the same line as the separator.
      const sepLine = lines[i]
      let trailingSep = sepLine.slice(SEP.length)
      i++

      if (trailingSep.length > 0) {
        // If someone put text after "=======" on the same line, treat it as start of replace
        replaceLines.push(trailingSep)
      }

      // Accumulate replace lines until the close marker
      while (i < lines.length && !lines[i].startsWith(CLOSE)) {
        replaceLines.push(lines[i])
        i++
      }

      if (i >= lines.length) break // malformed: no close

      // Skip the CLOSE marker line (ignore any trailing junk after it)
      i++

      // Join, and trim a single leading newline if produced by marker-only lines
      const search = searchLines.join('\n').replace(/^\n/, '')
      const replace = replaceLines.join('\n').replace(/^\n/, '')

      blocks.push({ search, replace })
      continue
    }

    i++
  }

  return blocks
}
