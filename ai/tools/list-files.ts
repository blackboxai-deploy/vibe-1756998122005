import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './list-files.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { FIND_EXCLUDE_ARGS, DIRS_TO_IGNORE } from '../constants'
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

export const listFiles = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      path: PathSchema,
      recursive: z
        .boolean()
        .optional()
        .describe('Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.'),
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          path: PathSchema, 
          recursive: z.boolean().optional() 
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('list-files', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-list-files',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('list-files')
      }

      const { path, recursive } = parsed.data
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-list-files',
              data: { path, sandboxId: '', status: 'done', recursive, error: 'No valid sandbox found for this session', files: [] },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-list-files',
            data: { path, sandboxId: '', status: 'done', recursive, error: 'Failed to resolve sandbox context', files: [] },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-list-files',
          data: { path, sandboxId: '', status: 'done', recursive, error: 'No session ID provided', files: [] },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('list-files', 'Starting file listing operation', {
        toolCallId,
        sandboxId,
        path,
        recursive
      })

      writer.write({
        id: toolCallId,
        type: 'data-list-files',
        data: { 
          path, 
          sandboxId,
          status: 'loading',
          recursive
        },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for file listing', {
          toolCallId,
          path,
          recursive
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Build command - use find for recursive, ls -la for non-recursive with file type info
        let cmd
        if (recursive) {
          // Use find command for recursive listing with type information and exclusions
          logger.sandbox(sandboxId, 'Executing find command for recursive file listing with exclusions', {
            toolCallId,
            command: 'find',
            path
          })
          
          cmd = await sandbox.runCommand({
            cmd: 'find',
            args: [
              path, 
              '-maxdepth', '10',
              // Exclude common directories that are not needed
              '-not', '-path', '*/node_modules*',
              '-not', '-path', '*/.git*', 
              '-not', '-path', '*/.next*',
              '-not', '-path', '*/dist*',
              '-not', '-path', '*/build*',
              '-not', '-path', '*/.cache*',
              '-not', '-path', '*/coverage*',
              '-not', '-path', '*/.nyc_output*',
              '-not', '-path', '*/logs*',
              '-not', '-path', '*/*.log*',
              '-not', '-name', '*.map',
              '-not', '-name', '*.tsbuildinfo',
              '-not', '-name', '.DS_Store',
              // Add type information to output: -printf '%p|%y\n'
              // %p = path, %y = file type (f=file, d=directory, l=link, etc.)
              '-printf', '%p|%y\n'
            ],
            detached: true
          })
        } else {
          // Use ls -la for detailed listing with file type information
          logger.sandbox(sandboxId, 'Executing ls command for detailed file listing', {
            toolCallId,
            command: 'ls',
            args: ['-la', path]
          })

          cmd = await sandbox.runCommand({
            cmd: 'ls',
            args: ['-la', path],
            detached: true
          })
        }

        // Wait for command to complete and get output
        const done = await cmd.wait()
        const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])

        // Log the raw output for debugging
        logger.sandbox(sandboxId, 'Command output received', {
          toolCallId,
          exitCode: done.exitCode,
          stdoutLength: stdout?.length || 0,
          stderrLength: stderr?.length || 0,
          stdout: stdout ? stdout.substring(0, 500) : 'null', // First 500 chars for debugging
          stderr: stderr ? stderr.substring(0, 500) : 'null'
        })

        if (done.exitCode !== 0) {
          const duration = Date.now() - startTime
          logger.tool('list-files', 'Command failed', {
            toolCallId,
            sandboxId,
            path,
            exitCode: done.exitCode,
            stderr,
            stdout,
            duration
          })

          // Try to provide more specific error messages
          let errorMessage = 'Directory listing failed'
          if (stderr?.toLowerCase().includes('no such file')) {
            errorMessage = 'Directory not found'
          } else if (stderr?.toLowerCase().includes('permission denied')) {
            errorMessage = 'Permission denied'
          } else if (stderr?.toLowerCase().includes('not a directory')) {
            errorMessage = 'Path is not a directory'
          } else if (stderr?.toLowerCase().includes('too many levels')) {
            errorMessage = 'Directory structure too deep'
          }

          writer.write({
            id: toolCallId,
            type: 'data-list-files',
            data: { 
              path, 
              sandboxId,
              status: 'done',
              recursive,
              error: errorMessage,
              files: [] // Ensure files array is empty on error
            },
          })

          return `${errorMessage}: ${path}`
        }

        const files = parseLsOutput(stdout || '', stderr || '', recursive || false, path)

        const duration = Date.now() - startTime
        logger.performance('file-listing', duration, {
          sandboxId,
          path,
          recursive,
          fileCount: files.length,
          toolCallId
        })

        logger.sandbox(sandboxId, 'File listing completed', {
          toolCallId,
          path,
          recursive,
          fileCount: files.length,
          duration
        })

        // Ensure we always provide a valid files array, even if empty
        const validFiles = files || []

        writer.write({
          id: toolCallId,
          type: 'data-list-files',
          data: { 
            path, 
            sandboxId,
            status: 'done',
            recursive,
            files: validFiles,
            error: undefined // Explicitly clear any previous error state
          },
        })

        logger.tool('list-files', 'File listing operation completed', {
          sandboxId,
          path,
          recursive,
          toolCallId,
          fileCount: validFiles.length,
          duration
        })

        // Provide better response messages
        const responseMessage = validFiles.length === 0 
          ? `Directory "${path}" is empty or contains no accessible files.`
          : `Found ${validFiles.length} items in directory "${path}"${recursive ? ' (recursive)' : ''}:\n\n${formatFileList(validFiles)}`

        return responseMessage
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Failed to list files in sandbox', error, {
          toolCallId,
          sandboxId,
          path,
          recursive,
          duration
        })

        // Determine more specific error message
        let errorMessage = 'Listing failed'
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorMessage = 'Operation timed out'
          } else if (error.message.includes('connection')) {
            errorMessage = 'Connection error'
          } else if (error.message.includes('permission')) {
            errorMessage = 'Permission denied'
          }
        }

        writer.write({
          id: toolCallId,
          type: 'data-list-files',
          data: { 
            path, 
            sandboxId,
            status: 'done',
            recursive,
            error: errorMessage,
            files: [] // Ensure empty files array on error
          },
        })

        throw error
      }
    },
  })

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}

function parseLsOutput(stdout: string, stderr: string, recursive: boolean, basePath: string): FileItem[] {
  const files: FileItem[] = []
  
  // Normalize base path for consistent handling
  const normalizedBasePath = basePath.replace(/\/+$/, '') || '.'
  
  // If stderr contains errors, log them but try to continue
  if (stderr && stderr.trim()) {
    console.warn('Command stderr:', stderr)
  }
  
  // If stdout is empty, the directory might be empty (which is valid)
  if (!stdout || !stdout.trim()) {
    return files
  }
  
  const lines = stdout.split('\n').filter(line => line.trim())
  
  if (recursive) {
    // Handle find command output with type information: path|type
    for (const line of lines) {
      if (!line.trim()) continue
      
      const parts = line.split('|')
      if (parts.length !== 2) {
        console.warn('Invalid find output format:', line)
        continue
      }
      
      const [fullPath, fileType] = parts
      
      // Normalize path - remove base path prefix and leading slashes
      let relativePath = fullPath
      if (fullPath.startsWith(normalizedBasePath)) {
        relativePath = fullPath.substring(normalizedBasePath.length).replace(/^\/+/, '')
      }
      
      // Skip the base directory itself and empty paths
      if (!relativePath || relativePath === '.' || relativePath === normalizedBasePath) continue
      
      // Extract the filename from the path
      const pathParts = relativePath.split('/')
      const name = pathParts[pathParts.length - 1]
      
      // Skip hidden files and directories unless they're important
      // if (name.startsWith('.') && !['..', '.env', '.gitignore', '.gitkeep'].includes(name)) {
      //   continue
      // }
      
      // Determine file type from find output
      // f=file, d=directory, l=symbolic link, etc.
      const isDirectory = fileType === 'd'
      
      files.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        path: relativePath,
        size: undefined
      })
    }
  } else {
    // Handle ls -la output - parse detailed format
    for (const line of lines) {
      if (!line.trim()) continue
      
      // ls -la format: permissions links owner group size date time name
      // Example: drwxr-xr-x  3 user group  96 Dec 10 10:30 dirname
      // Example: -rw-r--r--  1 user group 123 Dec 10 10:30 filename.txt
      
      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue // Skip invalid lines
      
      const permissions = parts[0]
      const name = parts.slice(8).join(' ') // Handle names with spaces
      
      // Skip current and parent directory entries
      if (name === '.' || name === '..') continue
      
      // Skip hidden files and directories unless they're important
      // if (name.startsWith('.') && !['..', '.env', '.gitignore', '.gitkeep'].includes(name)) {
      //   continue
      // }
      
      // Determine file type from permissions string
      // First character: d=directory, -=file, l=link, etc.
      const isDirectory = permissions.startsWith('d')
      
      // Extract file size for files
      let size: number | undefined
      if (!isDirectory && parts[4] && !isNaN(parseInt(parts[4]))) {
        size = parseInt(parts[4])
      }
      
      files.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        path: name,
        size
      })
    }
  }
  
  return files.sort((a, b) => {
    // Sort directories first, then files, then alphabetically
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

function formatFileList(files: FileItem[]): string {
  if (files.length === 0) {
    return '(No files found)'
  }
  
  return files.map(file => {
    const typeIcon = file.type === 'directory' ? '📁' : '📄'
    const sizeInfo = file.size !== undefined ? ` (${file.size} bytes)` : ''
    return `${typeIcon} ${file.path}${sizeInfo}`
  }).join('\n')
}
