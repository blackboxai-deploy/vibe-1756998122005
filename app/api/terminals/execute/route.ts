import { NextRequest, NextResponse } from 'next/server'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sandboxId, terminalId, command, workingDirectory } = body

    if (!sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID is required' },
        { status: 400 }
      )
    }

    if (!terminalId) {
      return NextResponse.json(
        { error: 'Terminal ID is required' },
        { status: 400 }
      )
    }

    if (!command || !command.trim()) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    logger.api('terminals/execute', 'POST', 'Executing command in terminal', {
      sandboxId,
      terminalId,
      command: command.trim(),
      workingDirectory
    })

    // Get the sandbox instance
    const sandbox = await getSandbox({ sandboxId })
    
    // Parse command and arguments
    const commandParts = command.trim().split(/\s+/)
    const cmd = commandParts[0]
    const args = commandParts.slice(1)

    // Determine the working directory to use
    const currentWorkingDir = workingDirectory || '.'
    
    // For cd commands, we need special handling
    let execution
    let finalWorkingDirectory = currentWorkingDir

    if (cmd === 'cd') {
      // Handle cd command specially - combine with pwd to get the final directory
      const targetDir = args.length > 0 ? args.join(' ') : '~'
      const cdCommand = `cd ${currentWorkingDir} && cd ${targetDir} && pwd`
      
      execution = await sandbox.runCommand({
        detached: false,
        cmd: 'bash',
        args: ['-c', cdCommand],
      })
    } else {
      // For all other commands, execute in the working directory context
      const fullCommand = `cd ${currentWorkingDir} && ${command.trim()}`
      
      execution = await sandbox.runCommand({
        detached: false,
        cmd: 'bash',
        args: ['-c', fullCommand],
      })
    }

    // Wait for command completion
    const result = await execution.wait()
    const [stdout, stderr] = await Promise.all([
      result.stdout(),
      result.stderr()
    ])

    let output = stdout + (stderr ? `\n${stderr}` : '')
    const exitCode = result.exitCode

    // Track working directory changes for cd commands
    let newWorkingDirectory = undefined
    if (cmd === 'cd' && exitCode === 0) {
      try {
        // For cd commands, the stdout should contain the new directory path
        const newDir = stdout.trim()
        if (newDir) {
          newWorkingDirectory = newDir
          finalWorkingDirectory = newDir
          // Don't include the pwd output in the final output for cd commands
          output = stderr || ''
        }
        
        logger.api('terminals/execute', 'POST', 'Working directory updated', {
          terminalId,
          previousWorkingDirectory: currentWorkingDir,
          newWorkingDirectory: newWorkingDirectory
        })
      } catch (error) {
        logger.api('terminals/execute', 'POST', 'Failed to process cd command result', {
          terminalId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Check for other directory-changing commands (pushd, popd, etc.)
    if ((cmd === 'pushd' || cmd === 'popd') && exitCode === 0) {
      try {
        // Get current working directory after pushd/popd command
        const pwdExecution = await sandbox.runCommand({
          detached: false,
          cmd: 'bash',
          args: ['-c', `cd ${finalWorkingDirectory} && pwd`],
        })
        const pwdResult = await pwdExecution.wait()
        const pwdOutput = await pwdResult.stdout()
        if (pwdOutput.trim()) {
          newWorkingDirectory = pwdOutput.trim()
          finalWorkingDirectory = newWorkingDirectory
        }
        
        logger.api('terminals/execute', 'POST', 'Working directory updated by pushd/popd', {
          terminalId,
          command: cmd,
          newWorkingDirectory: newWorkingDirectory
        })
      } catch (error) {
        logger.api('terminals/execute', 'POST', 'Failed to get working directory after pushd/popd', {
          terminalId,
          command: cmd,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    logger.api('terminals/execute', 'POST', 'Command executed successfully', {
      terminalId,
      sandboxId,
      command: command.trim(),
      exitCode,
      outputLength: output.length,
      workingDirectoryChanged: !!newWorkingDirectory,
      finalWorkingDirectory
    })

    return NextResponse.json({
      success: true,
      output,
      exitCode,
      workingDirectory: newWorkingDirectory,
      currentWorkingDirectory: finalWorkingDirectory,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.api('terminals/execute', 'POST', 'Failed to execute command', {
      error: errorMessage
    })

    return NextResponse.json(
      { error: `Failed to execute command: ${errorMessage}` },
      { status: 500 }
    )
  }
}
