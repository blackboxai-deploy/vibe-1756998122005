import { NextRequest, NextResponse } from 'next/server'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sandboxId, name, workingDirectory } = body

    if (!sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID is required' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Terminal name is required' },
        { status: 400 }
      )
    }

    logger.api('terminals/create', 'POST', 'Creating terminal', {
      sandboxId,
      name: name.trim(),
      workingDirectory
    })

    // Get the sandbox instance
    const sandbox = await getSandbox({ sandboxId })
    
    // Create a terminal session by running a simple command that establishes the session
    const cmd = await sandbox.runCommand({
      detached: true,
      cmd: 'bash',
      args: ['-c', `cd ${workingDirectory || '.'} && echo "Terminal '${name.trim()}' created at $(pwd)" && pwd`],
    })

    const terminalId = cmd.cmdId || `term_${Date.now()}`
    const currentDir = workingDirectory || '.'
    
    const terminal = {
      terminalId,
      name: name.trim(),
      sandboxId,
      workingDirectory: currentDir,
      status: 'ready' as const,
      createdAt: new Date(),
    }

    logger.api('terminals/create', 'POST', 'Terminal created successfully', {
      terminalId,
      name: name.trim(),
      sandboxId,
      workingDirectory: currentDir
    })

    return NextResponse.json({
      success: true,
      terminal
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.api('terminals/create', 'POST', 'Failed to create terminal', {
      error: errorMessage
    })

    return NextResponse.json(
      { error: `Failed to create terminal: ${errorMessage}` },
      { status: 500 }
    )
  }
}
