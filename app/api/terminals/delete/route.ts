import { NextRequest, NextResponse } from 'next/server'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { logger } from '@/lib/logger'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { sandboxId, terminalId } = body

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

    logger.api('terminals/delete', 'DELETE', 'Deleting terminal', {
      sandboxId,
      terminalId
    })

    try {
      // Get the sandbox instance and try to kill the terminal process
      const sandbox = await getSandbox({ sandboxId })
      
      // Try to kill the command/terminal process
      // Note: The exact method depends on the Sandbox API implementation
      // This is a best-effort attempt to clean up the process
      await sandbox.runCommand({
        cmd: 'kill',
        args: ['-TERM', terminalId],
      }).catch(() => {
        // Ignore errors if the process is already dead or doesn't exist
        logger.api('terminals/delete', 'DELETE', 'Terminal process may already be terminated', {
          terminalId
        })
      })
    } catch (killError) {
      // Log but don't fail the deletion if we can't kill the process
      logger.api('terminals/delete', 'DELETE', 'Could not kill terminal process', {
        terminalId,
        error: killError instanceof Error ? killError.message : String(killError)
      })
    }

    logger.api('terminals/delete', 'DELETE', 'Terminal deleted successfully', {
      sandboxId,
      terminalId
    })

    return NextResponse.json({
      success: true,
      terminalId
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.api('terminals/delete', 'DELETE', 'Failed to delete terminal', {
      error: errorMessage
    })

    return NextResponse.json(
      { error: `Failed to delete terminal: ${errorMessage}` },
      { status: 500 }
    )
  }
}
