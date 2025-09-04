import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sandboxId = searchParams.get('sandboxId')

    if (!sandboxId) {
      return NextResponse.json(
        { error: 'Sandbox ID is required' },
        { status: 400 }
      )
    }

    logger.api('terminals/list', 'GET', 'Listing terminals', {
      sandboxId
    })

    // For now, we'll return an empty array since terminals are managed in client state
    // In a production system, you might want to store terminals in a database
    // or query the sandbox for active terminal sessions
    
    const terminals: any[] = []

    logger.api('terminals/list', 'GET', 'Terminals listed successfully', {
      sandboxId,
      terminalCount: terminals.length
    })

    return NextResponse.json({
      success: true,
      terminals
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.api('terminals/list', 'GET', 'Failed to list terminals', {
      error: errorMessage
    })

    return NextResponse.json(
      { error: `Failed to list terminals: ${errorMessage}` },
      { status: 500 }
    )
  }
}
