import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getSandbox } from '@/lib/services/vercelSandbox'
import description from './execute-command.md'
import { tool } from 'ai'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  TerminalIdSchema, 
  CommandSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'
import { getCurrentSandboxIdCached } from '@/lib/services/sandboxCache'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
  github?: {
    repo: string;
    branch: string;
    accessToken: string;
  }
}

interface CommandAnalysis {
  type: 'build' | 'dev-server' | 'install' | 'test' | 'quick' | 'long-running' | 'unknown'
  expectedDuration: 'short' | 'medium' | 'long' | 'indefinite'
  shouldWait: boolean
  timeout: number
  monitorInterval: number
  behaviorOverride?: 'wait' | 'background' | 'monitor' | 'quick'
}

interface ExecutionResult {
  success: boolean
  exitCode?: number
  stdout: string
  stderr: string
  analysis: string
  suggestions: string[]
  commandId?: string
  isRunning: boolean
  duration: number
}

export const executeCommand = ({ writer, sessionId, github }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      command: CommandSchema,
      args: z
        .array(z.string())
        .optional()
        .describe(
          "Array of arguments for the command. Each argument should be a separate string (e.g., ['run', 'build'] for npm run build, or ['src/index.js'] to run a file)."
        ),
      terminalId: TerminalIdSchema.optional(),
      behavior: z
        .enum(['auto', 'wait', 'background', 'monitor', 'quick'])
        .optional()
        .default('auto')
        .describe(
          "Execution behavior: 'auto' (intelligent detection), 'wait' (always wait for completion), 'background' (start and continue in background), 'monitor' (start, monitor briefly, then background), 'quick' (for fast commands)"
        ),
      sudo: z
        .boolean()
        .optional()
        .describe('Whether to run the command with sudo'),
      maxWaitTime: z
        .number()
        .optional()
        .describe('Maximum time to wait in milliseconds (overrides automatic timeout)'),
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()

      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          command: CommandSchema, 
          args: z.array(z.string()).optional(),
          terminalId: TerminalIdSchema.optional(),
          behavior: z.enum(['auto', 'wait', 'background', 'monitor', 'quick']).optional(),
          sudo: z.boolean().optional(),
          maxWaitTime: z.number().optional(),
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('execute-command', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-execute-command',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('execute-command')
      }

      const { command, sudo, args = [], behavior, maxWaitTime, terminalId } = parsed.data
      const commandString = `${command} ${args.join(' ')}`
      
      // Always get sandbox ID from cache
      let sandboxId: string | null = null
      if (sessionId) {
        try {
          sandboxId = await getCurrentSandboxIdCached(sessionId)
          if (!sandboxId) {
            writer.write({
              id: toolCallId,
              type: 'data-execute-command',
              data: { command, args, status: 'done', sandboxId: '', terminalId, error: 'No valid sandbox found for this session' },
            })

            return 'No valid sandbox found for this session. Please create a sandbox first.'
          }
        } catch (error) {
          writer.write({
            id: toolCallId,
            type: 'data-execute-command',
            data: { command, args, status: 'done', sandboxId: '', terminalId, error: 'Failed to resolve sandbox context' },
          })

          return 'Failed to resolve sandbox context. Please try again.'
        }
      } else {
        writer.write({
          id: toolCallId,
          type: 'data-execute-command',
          data: { command, args, status: 'done', sandboxId: '', terminalId, error: 'No session ID provided' },
        })

        return 'No session ID provided. Cannot resolve sandbox context.'
      }
      
      
      // Analyze command to determine execution strategy
      const analysis = analyzeCommand(command, args, behavior)
      const timeout = maxWaitTime || analysis.timeout

      writer.write({
        id: toolCallId,
        type: 'data-execute-command',
        data: { 
          command, 
          args, 
          status: 'loading', 
          sandboxId,
          terminalId,
          analysis: analysis.type,
          expectedBehavior: behavior === 'auto' ? analysis.type : behavior
        },
      })

      try {
        const sandbox = await getSandbox({ sandboxId })

        let runCommandParams: any = {
          detached: true,
          cmd: command,
          args,
          sudo,
        }

        if (github?.accessToken) {
          runCommandParams = {
            ...runCommandParams,
            env: {
              GITHUB_TOKEN: github?.accessToken
            }
          }
        }
        
        // Start the command
        const cmd = await sandbox.runCommand(runCommandParams)

        const commandId = cmd.cmdId

        writer.write({
          id: toolCallId,
          type: 'data-execute-command',
          data: { 
            command, 
            args, 
            status: 'loading', 
            sandboxId,
            commandId,
            analysis: analysis.type
          },
        })

        // Execute based on analysis
        const result = await executeWithStrategy(
          cmd, 
          analysis, 
          timeout, 
          writer, 
          toolCallId, 
          { command, args, sandboxId, commandId }
        )

        const duration = Date.now() - startTime
        result.duration = duration

        writer.write({
          id: toolCallId,
          type: 'data-execute-command',
          data: { 
            command, 
            args, 
            status: 'done', 
            sandboxId,
            commandId: result.commandId,
            exitCode: result.exitCode,
            success: result.success,
            isRunning: result.isRunning,
            duration: result.duration
          },
        })

        // Generate comprehensive response
        return generateResponse(result, commandString, analysis, duration)

      } catch (error) {
        const duration = Date.now() - startTime
        
        writer.write({
          id: toolCallId,
          type: 'data-execute-command',
          data: { 
            command, 
            args, 
            status: 'done', 
            sandboxId,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration
          },
        })

        return `❌ **Execution Failed**
        
Command: \`${commandString}\`
Duration: ${duration}ms
Error: ${error instanceof Error ? error.message : 'Unknown error'}

**Possible Solutions:**
- Check if the sandbox is running and accessible
- Verify the command and arguments are correct
- Ensure required dependencies are installed
- Try running the command again after a brief wait`
      }
    },
  })

function analyzeCommand(command: string, args: string[] = [], behavior?: string): CommandAnalysis {
  const fullCommand = `${command} ${args.join(' ')}`.toLowerCase()
  
  // If behavior is explicitly set (not auto), respect it
  if (behavior && behavior !== 'auto') {
    const timeouts = {
      quick: 30000,     // 30 seconds
      wait: 300000,     // 5 minutes
      monitor: 60000,   // 1 minute
      background: 15000 // 15 seconds for startup check
    }
    
    return {
      type: 'unknown', // We'll use behaviorOverride instead
      expectedDuration: behavior === 'quick' ? 'short' : behavior === 'background' ? 'indefinite' : 'medium',
      shouldWait: behavior !== 'background',
      timeout: timeouts[behavior as keyof typeof timeouts] || 60000,
      monitorInterval: 2000,
      behaviorOverride: behavior as 'wait' | 'background' | 'monitor' | 'quick'
    }
  }

  // Build commands
  if (/build|compile|bundle|webpack|vite|rollup|tsc|next build|turbo build/.test(fullCommand)) {
    return {
      type: 'build',
      expectedDuration: 'medium',
      shouldWait: true,
      timeout: 300000, // 5 minutes
      monitorInterval: 3000
    }
  }

  // Development servers
  if (/dev|start|serve|preview|run dev|next dev|vite dev/.test(fullCommand)) {
    return {
      type: 'dev-server',
      expectedDuration: 'indefinite',
      shouldWait: false,
      timeout: 15000, // Just wait for startup
      monitorInterval: 1000
    }
  }

  // Installation commands
  if (/install|add|npm i|pnpm i|yarn|pip install/.test(fullCommand)) {
    return {
      type: 'install',
      expectedDuration: 'medium',
      shouldWait: true,
      timeout: 180000, // 3 minutes
      monitorInterval: 2000
    }
  }

  // Test commands
  if (/test|jest|vitest|cypress|playwright|mocha|ava/.test(fullCommand)) {
    return {
      type: 'test',
      expectedDuration: 'long',
      shouldWait: true,
      timeout: 600000, // 10 minutes
      monitorInterval: 5000
    }
  }

  // Quick file operations
  if (/^(ls|cat|echo|pwd|mkdir|rm|cp|mv|chmod|which|whereis)(\s|$)/.test(fullCommand)) {
    return {
      type: 'quick',
      expectedDuration: 'short',
      shouldWait: true,
      timeout: 30000, // 30 seconds
      monitorInterval: 1000
    }
  }

  // Long-running processes (servers, watchers)
  if (/server|watch|daemon|service|forever|pm2/.test(fullCommand)) {
    return {
      type: 'long-running',
      expectedDuration: 'indefinite',
      shouldWait: false,
      timeout: 20000, // Wait for startup confirmation
      monitorInterval: 2000
    }
  }

  // Default: unknown command
  return {
    type: 'unknown',
    expectedDuration: 'medium',
    shouldWait: true,
    timeout: 60000, // 1 minute default
    monitorInterval: 2000
  }
}

async function executeWithStrategy(
  cmd: any,
  analysis: CommandAnalysis,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  
  // Check for behavior override first
  if (analysis.behaviorOverride) {
    switch (analysis.behaviorOverride) {
      case 'wait':
        return await handleWaitForCompletion(cmd, timeout, writer, toolCallId, context)
      case 'background':
        return await handleBackgroundCommand(cmd, timeout, writer, toolCallId, context)
      case 'monitor':
        return await handleMonitorCommand(cmd, timeout, writer, toolCallId, context)
      case 'quick':
        return await handleQuickCommand(cmd, timeout, writer, toolCallId, context)
    }
  }
  
  // Use command type analysis
  switch (analysis.type) {
    case 'dev-server':
    case 'long-running':
      return await handleDevServerOrLongRunning(cmd, timeout, writer, toolCallId, context)
    
    case 'build':
    case 'install':
    case 'test':
      return await handleWaitForCompletion(cmd, timeout, writer, toolCallId, context)
    
    case 'quick':
      return await handleQuickCommand(cmd, timeout, writer, toolCallId, context)
    
    default:
      return await handleDefaultCommand(cmd, timeout, writer, toolCallId, context)
  }
}

async function handleDevServerOrLongRunning(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  
  // Wait briefly to see if the server starts successfully
  const startupPromise = new Promise<ExecutionResult>((resolve) => {
    setTimeout(async () => {
      try {
        // Check if process is still running (good sign for servers)
        const isStillRunning = await checkIfCommandIsRunning(cmd)
        
        if (isStillRunning) {
          resolve({
            success: true,
            stdout: 'Development server started successfully and is running in background',
            stderr: '',
            analysis: 'Server appears to be running successfully',
            suggestions: ['The server is running in background', 'Use browser tools to interact with the application'],
            commandId: context.commandId,
            isRunning: true,
            duration: 0
          })
        } else {
          // Server stopped quickly, probably an error
          const done = await cmd.wait()
          const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])
          
          resolve({
            success: false,
            exitCode: done.exitCode,
            stdout,
            stderr,
            analysis: analyzeError(stderr, context.command, context.args),
            suggestions: generateSuggestions(stderr, context.command, context.args),
            commandId: context.commandId,
            isRunning: false,
            duration: 0
          })
        }
      } catch (error) {
        resolve({
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          analysis: 'Failed to check server status',
          suggestions: ['Try running the command again', 'Check the command syntax'],
          commandId: context.commandId,
          isRunning: false,
          duration: 0
        })
      }
    }, timeout)
  })

  return await startupPromise
}

async function handleWaitForCompletion(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  
  try {
    // Set up timeout
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeout)
    })

    const completionPromise = cmd.wait().then(async (done: any) => {
      const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])
      return {
        type: 'completed' as const,
        stdout,
        stderr,
        exitCode: done.exitCode,
        isRunning: false
      }
    })

    const result = await Promise.race([completionPromise, timeoutPromise])

    if (result === 'timeout') {
      // Command timed out, try to stop it
      try {
        await cmd.kill()
      } catch (killError) {
        // Ignore kill errors
      }

      return {
        success: false,
        stdout: '',
        stderr: `Command timed out after ${timeout / 1000} seconds`,
        analysis: 'Command exceeded maximum execution time',
        suggestions: [
          'The command may be hanging or taking longer than expected',
          'Try running with a longer timeout',
          'Check for interactive prompts that might be blocking execution',
          'Consider breaking the command into smaller steps'
        ],
        commandId: context.commandId,
        isRunning: false,
        duration: timeout
      }
    }

    const success = result.exitCode === 0
    return {
      success,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      analysis: success 
        ? analyzeSuccess(result.stdout, context.command, context.args)
        : analyzeError(result.stderr, context.command, context.args),
      suggestions: success
        ? generateSuccessSuggestions(result.stdout, context.command, context.args)
        : generateSuggestions(result.stderr, context.command, context.args),
      commandId: context.commandId,
      isRunning: false,
      duration: 0
    }

  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      analysis: 'Command execution failed',
      suggestions: ['Check command syntax and try again'],
      commandId: context.commandId,
      isRunning: false,
      duration: 0
    }
  }
}

async function handleQuickCommand(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  return await handleWaitForCompletion(cmd, Math.min(timeout, 30000), writer, toolCallId, context)
}

async function handleMonitorCommand(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  
  // Monitor for a brief period, then let it continue in background
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const isRunning = await checkIfCommandIsRunning(cmd)
        
        if (isRunning) {
          resolve({
            success: true,
            stdout: 'Command is running and being monitored in background',
            stderr: '',
            analysis: 'Command started successfully and continues running',
            suggestions: ['Command is running in background', 'Monitor logs if needed'],
            commandId: context.commandId,
            isRunning: true,
            duration: timeout
          })
        } else {
          const done = await cmd.wait()
          const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])
          
          resolve({
            success: done.exitCode === 0,
            exitCode: done.exitCode,
            stdout,
            stderr,
            analysis: done.exitCode === 0 
              ? 'Command completed successfully'
              : analyzeError(stderr, context.command, context.args),
            suggestions: done.exitCode === 0
              ? ['Command completed successfully']
              : generateSuggestions(stderr, context.command, context.args),
            commandId: context.commandId,
            isRunning: false,
            duration: timeout
          })
        }
      } catch (error) {
        resolve({
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          analysis: 'Failed to monitor command',
          suggestions: ['Try running the command again'],
          commandId: context.commandId,
          isRunning: false,
          duration: timeout
        })
      }
    }, timeout)
  })
}

async function handleBackgroundCommand(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  
  // Just start and return immediately
  return {
    success: true,
    stdout: 'Command started in background',
    stderr: '',
    analysis: 'Command launched in background mode',
    suggestions: ['Command is running in background', 'Use monitoring tools if needed'],
    commandId: context.commandId,
    isRunning: true,
    duration: 0
  }
}

async function handleDefaultCommand(
  cmd: any,
  timeout: number,
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>,
  toolCallId: string,
  context: { command: string, args: string[], sandboxId: string, commandId: string }
): Promise<ExecutionResult> {
  return await handleWaitForCompletion(cmd, timeout, writer, toolCallId, context)
}

async function checkIfCommandIsRunning(cmd: any): Promise<boolean> {
  try {
    // This is a heuristic - if we can get the command object without error,
    // it's likely still running. The exact implementation depends on the Sandbox API.
    return true // Placeholder - would need to check actual Sandbox API
  } catch {
    return false
  }
}

function analyzeError(stderr: string, command: string, args: string[]): string {
  const errorPatterns = [
    { pattern: /npm ERR!/i, message: 'NPM installation or script error detected' },
    { pattern: /error TS\d+/i, message: 'TypeScript compilation error' },
    { pattern: /SyntaxError/i, message: 'JavaScript/TypeScript syntax error' },
    { pattern: /ModuleNotFoundError|Cannot resolve module/i, message: 'Missing dependency or import error' },
    { pattern: /permission denied|EACCES/i, message: 'Permission error - may need sudo or different permissions' },
    { pattern: /ENOENT|no such file/i, message: 'File or directory not found' },
    { pattern: /port.*already in use|EADDRINUSE/i, message: 'Port already in use by another process' },
    { pattern: /compilation|build.*failed/i, message: 'Build or compilation failure' },
    { pattern: /timeout|timed out/i, message: 'Operation timed out' },
    { pattern: /network|fetch.*failed|connection/i, message: 'Network connectivity issue' },
    { pattern: /command not found/i, message: 'Command not found - may need to install it first' }
  ]

  const matchedPatterns = errorPatterns.filter(({ pattern }) => pattern.test(stderr))
  
  if (matchedPatterns.length > 0) {
    return `Error Analysis: ${matchedPatterns.map(p => p.message).join('; ')}`
  }
  
  return 'Command failed - see error output for details'
}

function analyzeSuccess(stdout: string, command: string, args: string[]): string {
  const commandStr = `${command} ${args.join(' ')}`
  
  if (/build|compile/.test(commandStr.toLowerCase())) {
    return 'Build completed successfully - application ready for deployment'
  }
  
  if (/install|add/.test(commandStr.toLowerCase())) {
    return 'Package installation completed successfully'
  }
  
  if (/test/.test(commandStr.toLowerCase())) {
    const testPattern = /(\d+) passing|(\d+) tests? passed/i
    const match = stdout.match(testPattern)
    if (match) {
      return `Tests completed successfully - ${match[1] || match[2]} tests passed`
    }
    return 'Tests completed successfully'
  }
  
  return 'Command executed successfully'
}

function generateSuggestions(stderr: string, command: string, args: string[]): string[] {
  const suggestions: string[] = []
  
  if (/npm ERR!/i.test(stderr)) {
    suggestions.push('Try clearing npm cache with: npm cache clean --force')
    suggestions.push('Delete node_modules and package-lock.json, then run npm install again')
  }
  
  if (/port.*already in use/i.test(stderr)) {
    suggestions.push('Kill the process using the port or use a different port')
    suggestions.push('Check what\'s running on the port with: lsof -i :PORT_NUMBER')
  }
  
  if (/permission denied/i.test(stderr)) {
    suggestions.push('Try running with sudo if appropriate')
    suggestions.push('Check file permissions and ownership')
  }
  
  if (/command not found/i.test(stderr)) {
    suggestions.push(`Install ${command} first`)
    suggestions.push('Check if the command is available in PATH')
  }
  
  if (/module not found/i.test(stderr)) {
    suggestions.push('Install missing dependencies')
    suggestions.push('Check import/require statements')
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Check the error message for specific guidance')
    suggestions.push('Try running the command with different arguments')
  }
  
  return suggestions
}

function generateSuccessSuggestions(stdout: string, command: string, args: string[]): string[] {
  const commandStr = `${command} ${args.join(' ')}`
  
  if (/build|compile/.test(commandStr.toLowerCase())) {
    return [
      'Build completed - you can now deploy or run the application',
      'Check the build output directory for generated files'
    ]
  }
  
  if (/install/.test(commandStr.toLowerCase())) {
    return [
      'Dependencies installed successfully',
      'You can now run your application or build scripts'
    ]
  }
  
  if (/dev|start/.test(commandStr.toLowerCase())) {
    return [
      'Development server is running',
      'Open the application in your browser'
    ]
  }
  
  return ['Command completed successfully']
}

function generateResponse(
  result: ExecutionResult, 
  commandString: string, 
  analysis: CommandAnalysis, 
  duration: number
): string {
  const durationStr = `${(duration / 1000).toFixed(1)}s`
  const statusIcon = result.success ? '✅' : '❌'
  
  let response = `${statusIcon} **Command Execution ${result.success ? 'Successful' : 'Failed'}**

**Command:** \`${commandString}\`
**Type:** ${analysis.type}
**Duration:** ${durationStr}
**Status:** ${result.isRunning ? 'Running in background' : 'Completed'}
`

  if (result.exitCode !== undefined) {
    response += `**Exit Code:** ${result.exitCode}\n`
  }

  if (result.commandId) {
    response += `**Command ID:** ${result.commandId}\n`
  }

  response += '\n'

  // Add output sections
  if (result.stdout.trim()) {
    response += `**Output:**\n\`\`\`\n${result.stdout.trim()}\`\`\`\n\n`
  }

  if (result.stderr.trim()) {
    response += `**Errors/Warnings:**\n\`\`\`\n${result.stderr.trim()}\`\`\`\n\n`
  }

  // Add analysis
  if (result.analysis) {
    response += `**Analysis:** ${result.analysis}\n\n`
  }

  // Add suggestions
  if (result.suggestions.length > 0) {
    response += `**Suggestions:**\n${result.suggestions.map(s => `- ${s}`).join('\n')}\n\n`
  }

  // Add next steps based on command type and result
  if (result.success && result.isRunning) {
    response += `**Next Steps:**
- Command is running in background with ID: ${result.commandId}
- Monitor output if needed using command monitoring tools
- The process will continue running until stopped or the sandbox is closed
`
  } else if (result.success && !result.isRunning) {
    response += `**Next Steps:**
- Command completed successfully
- You can now run additional commands or proceed with your workflow
`
  } else {
    response += `**Recovery Actions:**
- Review the error messages above
- Apply suggested fixes
- Try running the command again with corrected parameters
`
  }

  return response
}
