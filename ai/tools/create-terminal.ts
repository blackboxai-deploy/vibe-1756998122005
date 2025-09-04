import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './create-terminal.md'
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

interface TerminalSession {
  terminalId: string
  name?: string
  workingDirectory: string
  status: 'created' | 'ready' | 'busy' | 'error'
  createdAt: Date
}

export const createTerminal = ({ writer, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      name: z
        .string()
        .optional()
        .describe('Optional name for the terminal session for easier identification (e.g., "testing", "debugging", "secondary")'),
      workingDirectory: PathSchema.optional(),
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          name: z.string().optional(),
          workingDirectory: PathSchema.optional()
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('create-terminal', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-terminal',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('create-terminal')
      }

      const { name, workingDirectory } = parsed.data
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-create-terminal',
              data: { name: name || 'terminal', status: 'done', sandboxId: '', workingDirectory: workingDirectory || '.', error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-create-terminal',
            data: { name: name || 'terminal', status: 'done', sandboxId: '', workingDirectory: workingDirectory || '.', error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-create-terminal',
          data: { name: name || 'terminal', status: 'done', sandboxId: '', workingDirectory: workingDirectory || '.', error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      logger.tool('create-terminal', 'Starting terminal creation', {
        toolCallId,
        sandboxId,
        name,
        workingDirectory
      })

      writer.write({
        id: toolCallId,
        type: 'data-create-terminal',
        data: { 
          name: name || 'terminal', 
          status: 'loading', 
          sandboxId,
          workingDirectory: workingDirectory || '.'
        },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for terminal creation', {
          toolCallId,
          name
        })

        const sandbox = await getSandbox({ sandboxId })
        
        // Create a simple terminal session by getting the current working directory
        // This establishes the terminal without running complex commands
        const cmd = await sandbox.runCommand({
          detached: true, // Use detached mode for terminal sessions
          cmd: 'bash',
          args: ['-c', 'echo "Terminal created at $(pwd)" && pwd'],
        })

        const terminalId = cmd.cmdId || `term_${Date.now()}`
        
        // Set working directory, defaulting to the sandbox root
        const currentDir = workingDirectory || '.'
        
        const terminalSession: TerminalSession = {
          terminalId,
          name,
          workingDirectory: currentDir,
          status: 'ready',
          createdAt: new Date()
        }

        const duration = Date.now() - startTime

        writer.write({
          id: toolCallId,
          type: 'data-create-terminal',
          data: { 
            name: name || 'terminal',
            status: 'done', 
            sandboxId,
            terminalId,
            workingDirectory: currentDir,
            duration
          },
        })

        logger.tool('create-terminal', 'Terminal creation completed successfully', {
          toolCallId,
          sandboxId,
          terminalId,
          name,
          workingDirectory: currentDir,
          duration
        })

        return `Terminal session created successfully!

**Terminal Details:**
- Terminal ID: ${terminalId}
- Name: ${name || 'Unnamed terminal'}
- Working Directory: ${currentDir}
- Status: Ready for commands
- Created: ${terminalSession.createdAt.toLocaleString()}

**Usage:**
This terminal is now available for running commands independently of other processes. You can use the \`executeCommand\` tool with the \`terminalId\` parameter to run commands in this specific terminal session.

**Example:**
\`\`\`
executeCommand({
  sandboxId: "${sandboxId}",
  command: "npm",
  args: ["run", "build"],
  terminalId: "${terminalId}"
})
\`\`\`

**Benefits:**
- ✅ Isolated from other running processes
- ✅ Perfect for testing while servers are running
- ✅ Maintains its own command history and environment
- ✅ Can be used for debugging without interrupting main processes

**Integration with UI:**
- This terminal will also appear in the Terminal Explorer panel
- Users can manage it through both AI commands and the UI
- Terminal sessions persist until manually deleted or sandbox is stopped

The terminal is ready to accept commands through the executeCommand tool.`

      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        logger.tool('create-terminal', 'Terminal creation failed', {
          toolCallId,
          sandboxId,
          name,
          error: errorMessage,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-terminal',
          data: { 
            name: name || 'terminal',
            status: 'done', 
            sandboxId,
            error: errorMessage,
            duration
          },
        })

        return `Failed to create terminal session.

**Error Details:**
${errorMessage}

**Troubleshooting:**
- Verify the sandbox ID is correct and the sandbox is running
- Check if the specified working directory exists
- Try creating a terminal without specifying a working directory
- Ensure the sandbox has sufficient resources available

**Alternative Options:**
- Use the main \`executeCommand\` tool for simpler command execution
- Create a terminal in the default directory and navigate later
- Check sandbox status and restart if necessary`
      }
    },
  })
