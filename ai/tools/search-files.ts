import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './search-files.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { GREP_EXCLUDE_DIRS } from '../constants'
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

export const searchFiles = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      path: PathSchema,
      regex: z
        .string()
        .min(1)
        .describe('The regular expression pattern to search for. Uses grep regex syntax.'),
      filePattern: z
        .string()
        .optional()
        .describe('Glob pattern to filter files (e.g., \'*.ts\' for TypeScript files). If not provided, it will search all files (*).'),
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          path: PathSchema,
          regex: z.string().min(1),
          filePattern: z.string().optional()
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('search-files', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-search-files',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('search-files')
      }

      const { path, regex, filePattern } = parsed.data
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-search-files',
              data: { path, regex, sandboxId: '', status: 'done', filePattern, error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-search-files',
            data: { path, regex, sandboxId: '', status: 'done', filePattern, error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-search-files',
          data: { path, regex, sandboxId: '', status: 'done', filePattern, error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('search-files', 'Starting file search operation', {
        toolCallId,
        sandboxId,
        path,
        regex,
        filePattern
      })

      writer.write({
        id: toolCallId,
        type: 'data-search-files',
        data: { 
          path, 
          regex,
          sandboxId,
          status: 'loading',
          filePattern
        },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file search', {
          toolCallId,
          path,
          regex,
          filePattern
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Build grep command with context
        const grepArgs = [
          '-rn', // recursive, show line numbers
          '-C', '2', // show 2 lines of context before and after
          '--color=never', // disable color output
        ]

        // Add exclusions for ignored directories
        GREP_EXCLUDE_DIRS.forEach(dir => {
          grepArgs.push('--exclude-dir', dir)
        })

        // Add file pattern if specified
        if (filePattern) {
          grepArgs.push('--include', filePattern)
        }

        grepArgs.push(regex, path)

        logger.sandbox(sandboxId, 'Executing grep command for file search', {
          toolCallId,
          command: 'grep',
          args: grepArgs
        })

        const cmd = await sandbox.runCommand({
          cmd: 'grep',
          args: grepArgs,
          detached: true
        })

        // Wait for command to complete and get output
        const done = await cmd.wait()
        const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])

        const results = parseGrepOutput(stdout || '')

        const duration = Date.now() - startTime
        logger.performance('file-search', duration, {
          sandboxId,
          path,
          regex,
          filePattern,
          resultCount: results.length,
          toolCallId
        })

        logger.sandbox(sandboxId, 'File search completed', {
          toolCallId,
          path,
          regex,
          filePattern,
          resultCount: results.length,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-search-files',
          data: { 
            path, 
            regex,
            sandboxId,
            status: 'done',
            filePattern,
            results
          },
        })

        logger.tool('search-files', 'File search operation completed', {
          sandboxId,
          path,
          regex,
          filePattern,
          toolCallId,
          resultCount: results.length,
          duration
        })

        if (results.length === 0) {
          return `No matches found for pattern "${regex}" in directory "${path}"${filePattern ? ` (files: ${filePattern})` : ''}`
        }

        return `Found ${results.length} matches for pattern "${regex}" in directory "${path}"${filePattern ? ` (files: ${filePattern})` : ''}:\n\n${formatSearchResults(results)}`
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Failed to search files in sandbox', error, {
          toolCallId,
          sandboxId,
          path,
          regex,
          filePattern,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-search-files',
          data: { 
            path, 
            regex,
            sandboxId,
            status: 'done', 
            filePattern,
            error: 'Search failed' 
          },
        })

        throw error
      }
    },
  })

interface SearchResult {
  file: string
  line: number
  content: string
  context?: string[]
}

function parseGrepOutput(output: string): SearchResult[] {
  const results: SearchResult[] = []
  const lines = output.split('\n').filter(line => line.trim())
  
  let currentFile = ''
  let contextLines: string[] = []
  
  for (const line of lines) {
    // Skip separator lines
    if (line === '--') {
      contextLines = []
      continue
    }
    
    // Parse grep output format: filename:linenumber:content or filename-linenumber-content (for context)
    const matchLine = line.match(/^([^:]+):(\d+):(.*)$/)
    const contextLine = line.match(/^([^-]+)-(\d+)-(.*)$/)
    
    if (matchLine) {
      const [, file, lineNum, content] = matchLine
      results.push({
        file,
        line: parseInt(lineNum, 10),
        content,
        context: contextLines.length > 0 ? [...contextLines] : undefined
      })
      contextLines = []
      currentFile = file
    } else if (contextLine) {
      const [, file, , content] = contextLine
      if (file === currentFile) {
        contextLines.push(content)
      }
    }
  }
  
  return results
}

function formatSearchResults(results: SearchResult[]): string {
  return results.map(result => {
    let output = `${result.file}:${result.line}: ${result.content}`
    if (result.context && result.context.length > 0) {
      output += `\n  Context: ${result.context.join(' | ')}`
    }
    return output
  }).join('\n\n')
}
