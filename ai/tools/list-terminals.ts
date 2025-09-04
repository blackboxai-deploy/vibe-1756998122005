import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import description from './list-terminals.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  SandboxIdSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const listTerminals = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: SandboxIdSchema,
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ sandboxId: SandboxIdSchema })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('list-terminals', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-list-terminals',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('list-terminals')
      }

      const { sandboxId } = parsed.data
      
      logger.tool('list-terminals', 'Starting terminal listing', {
        toolCallId,
        sandboxId
      })

      writer.write({
        id: toolCallId,
        type: 'data-list-terminals',
        data: { 
          sandboxId,
          status: 'loading'
        },
      })

      try {
        // In a real implementation, you might query a database or the sandbox
        // For now, we'll return a message indicating that terminals are managed in the UI
        const duration = Date.now() - startTime

        writer.write({
          id: toolCallId,
          type: 'data-list-terminals',
          data: { 
            sandboxId,
            status: 'done',
            terminals: [], // Empty array since terminals are managed in UI
            duration
          },
        })

        logger.tool('list-terminals', 'Terminal listing completed', {
          toolCallId,
          sandboxId,
          duration
        })

        return `**Terminal Management Information**

Terminals in this coding platform are managed through the Terminal Explorer UI panel. Here's how the terminal system works:

**Current Terminal Status:**
- Terminals are created and managed independently through the UI
- Each terminal runs as a separate session in the sandbox
- Terminal sessions persist until manually deleted or sandbox is stopped

**Available Terminal Operations:**
- ✅ **Create Terminal**: Use the Terminal Explorer panel to create new terminals
- ✅ **Execute Commands**: Use the \`executeCommand\` tool with \`terminalId\` parameter to run commands in specific terminals
- ✅ **Delete Terminal**: Use the Terminal Explorer panel to remove terminals

**Best Practices:**
- Create dedicated terminals for different purposes (build, test, dev-server)
- Use the \`terminalId\` parameter in \`executeCommand\` to run commands in specific terminals
- This enables parallel operations without process conflicts

**To execute commands in a specific terminal:**
Use the \`executeCommand\` tool with the \`terminalId\` parameter from terminals created in the UI.

**Example:**
\`\`\`
executeCommand({
  sandboxId: "${sandboxId}",
  command: "npm",
  args: ["run", "build"],
  terminalId: "term_123456789" // Use actual terminal ID from UI
})
\`\`\`

The Terminal Explorer panel shows all active terminals with their IDs, names, and status.`

      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        logger.tool('list-terminals', 'Terminal listing failed', {
          toolCallId,
          sandboxId,
          error: errorMessage,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-list-terminals',
          data: { 
            sandboxId,
            status: 'done',
            error: errorMessage,
            duration
          },
        })

        return `Failed to list terminals for sandbox ${sandboxId}.

**Error:** ${errorMessage}

**Alternative Options:**
- Check the Terminal Explorer panel in the UI for active terminals
- Create new terminals using the Terminal Explorer if needed
- Use the \`executeCommand\` tool without \`terminalId\` for simple command execution`
      }
    },
  })
