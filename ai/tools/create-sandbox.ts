import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { tool } from 'ai'
import description from './create-sandbox.md'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  PortSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'
import { initializeSandbox } from '@/lib/sandbox-initializer'
import { SANDBOX_EXPIRATION_TIME } from '../constants'
import kvUser from '@/lib/services/kvUser'

interface ChatSession {
  id: string
  timestamp: number
  messages: any[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
}

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
  github?: {
    repo: string;
    branch: string;
    accessToken: string;
  }
}

export const createSandbox = ({ writer, github, sessionId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      timeout: z
        .number()
        .optional()
        .describe(
          `Maximum time the Vercel Sandbox will remain active before automatically shutting down is ${SANDBOX_EXPIRATION_TIME} minutes. The sandbox will terminate all running processes when this timeout is reached.`
        ),
      ports: z
        .array(PortSchema)
        .max(1)
        .optional()
        .describe(
          'Array of network ports to expose and make accessible from outside the Vercel Sandbox. Only 1 port can be exposed per sandbox. Common ports include 3000 (Next.js), 8000 (Python servers), 5000 (Flask), etc.'
        )
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          timeout: z.number().optional(), 
          ports: z.array(PortSchema).max(1).optional() 
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('create-sandbox', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-sandbox',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('create-sandbox')
      }

      const { timeout, ports } = parsed.data
      
      logger.tool('create-sandbox', 'Starting sandbox creation', {
        toolCallId,
        timeout,
        ports,
        defaultTimeout: `${SANDBOX_EXPIRATION_TIME}m`
      })

      writer.write({
        id: toolCallId,
        type: 'data-create-sandbox',
        data: { status: 'loading' },
      })

      let existingSandbox = false
      try {
        // Check if session has existing valid sandbox first
        if (sessionId) {
          const sessionKey = `chat-session:${sessionId}`
          const existingSession = await kvUser.get<ChatSession>(sessionKey)

          if (existingSession && existingSession.sandbox) {
            existingSandbox = true
            const now = Date.now()
            const isValid = now < existingSession.sandbox.expiresAt

            if (isValid) {
              logger.tool('create-sandbox', 'Found existing valid sandbox, testing connection', {
                toolCallId,
                sessionId,
                sandboxId: existingSession.sandbox.sandboxId,
                timeRemaining: existingSession.sandbox.expiresAt - now
              })

              // Test if the sandbox is actually working by getting the sandbox instance
              try {
                const { getSandbox } = await import('@/lib/services/vercelSandbox')
                await getSandbox({ sandboxId: existingSession.sandbox.sandboxId })
                
                logger.tool('create-sandbox', 'Using existing valid sandbox', {
                  toolCallId,
                  sessionId,
                  sandboxId: existingSession.sandbox.sandboxId,
                  timeRemaining: existingSession.sandbox.expiresAt - now
                })

                // Send basic file listing data (we'll let other tools handle detailed file operations)
                writer.write({
                  id: toolCallId,
                  type: 'data-list-files',
                  data: {
                    path: '.',
                    sandboxId: existingSession.sandbox.sandboxId,
                    status: 'done',
                    recursive: true,
                    files: [] // Empty for now, other tools will populate this
                  },
                })

                writer.write({
                  id: toolCallId,
                  type: 'data-create-sandbox',
                  data: { sandboxId: existingSession.sandbox.sandboxId, status: 'done' },
                })

                const timeRemainingMinutes = Math.floor((existingSession.sandbox.expiresAt - now) / (1000 * 60))
                return `Using existing sandbox with ID: ${existingSession.sandbox.sandboxId}. Sandbox is valid and working (${timeRemainingMinutes} minutes remaining). You can continue working with your existing files and run commands.`
              } catch (testError) {
                logger.tool('create-sandbox', 'Existing sandbox failed connection test, creating new one', {
                  toolCallId,
                  sessionId,
                  sandboxId: existingSession.sandbox.sandboxId,
                  error: testError
                })
                // Continue to create new sandbox below
              }
            } else {
              logger.tool('create-sandbox', 'Existing sandbox expired, creating new one', {
                toolCallId,
                sessionId,
                sandboxId: existingSession.sandbox.sandboxId,
                expiredAt: existingSession.sandbox.expiresAt,
                timeExpired: now - existingSession.sandbox.expiresAt
              })
            }
          }
        }

        // Use the modular sandbox initializer (existing flow)
        const result = await initializeSandbox({
          timeout,
          ports,
          github,
          sessionId: existingSandbox ? sessionId : undefined,
          copyStarterFiles: !existingSandbox,
          runNpmInstall: true,
          contextId: toolCallId
        })

        const { sandbox, sandboxId, filePaths, starterFilesCopied, npmInstallCompleted } = result

        // Save sandbox metadata to the session if sessionId is provided
        if (sessionId) {
          try {
            const sessionKey = `chat-session:${sessionId}`
            const existingSession = await kvUser.get<ChatSession>(sessionKey)
            
            const sandboxMetadata = {
              sandboxId: sandboxId,
              createdAt: Date.now(),
              expiresAt: Date.now() + (SANDBOX_EXPIRATION_TIME * 60 * 1000)
            }

            const updatedSession = existingSession ? {
              ...existingSession,
              sandbox: sandboxMetadata
            } : {
              id: sessionId,
              timestamp: Date.now(),
              messages: [],
              lastUpdated: Date.now(),
              sandbox: sandboxMetadata
            }

            await kvUser.set(sessionKey, updatedSession)
            
            logger.tool('create-sandbox', 'Saved sandbox metadata to session', {
              toolCallId,
              sessionId,
              sandboxId,
              expiresAt: sandboxMetadata.expiresAt
            })
          } catch (sessionError) {
            logger.tool('create-sandbox', 'Failed to save sandbox metadata to session', {
              toolCallId,
              sessionId,
              sandboxId,
              error: sessionError
            })
          }
        }

        // Send UI updates for starter files if they were copied
        if (starterFilesCopied && !github?.repo) {
          writer.write({
            id: toolCallId,
            type: 'data-generating-files',
            data: { 
              paths: filePaths.filter(path => !path.includes('node_modules')), 
              status: 'uploaded' 
            },
          })
        }

        // Send file listing data to update the file explorer
        writer.write({
          id: toolCallId,
          type: 'data-list-files',
          data: {
            path: '.',
            sandboxId: sandboxId,
            status: 'done',
            recursive: true,
            files: filePaths.map(path => ({
              name: path.split('/').pop() || path,
              type: path.includes('.') && !path.endsWith('/') ? 'file' as const : 'directory' as const,
              path: path,
            }))
          },
        })

        writer.write({
          id: toolCallId,
          type: 'data-create-sandbox',
          data: { sandboxId: sandboxId, status: 'done' },
        })

        logger.tool('create-sandbox', 'Sandbox creation completed', {
          sandboxId: sandboxId,
          toolCallId,
          duration: result.duration,
          starterFilesCopied,
          npmInstallCompleted
        })

        return `Sandbox created with ID: ${sandboxId}. The sandbox has been initialized with a complete Next.js project template including shadcn/ui components and dependencies have been installed. You can now run 'npm run dev' to start the development server or access services on the exposed ports.`
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Failed to create sandbox', error, {
          toolCallId,
          timeout,
          ports,
          duration
        })

        // Send error status to UI
        writer.write({
          id: toolCallId,
          type: 'data-create-sandbox',
          data: { 
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          },
        })

        return `Failed to create sandbox: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
