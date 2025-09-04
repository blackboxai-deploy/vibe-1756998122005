import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { restoreSessionFilesToSandbox } from '@/lib/services/fileCollection'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, sandboxId } = await request.json()

    if (!sessionId || !sandboxId) {
      return NextResponse.json({ error: 'Session ID and Sandbox ID are required' }, { status: 400 })
    }

    const result = await restoreSessionFilesToSandbox(sessionId, sandboxId)

    return NextResponse.json({
      success: result.success,
      restoredCount: result.restoredCount,
      error: result.error
    })
  } catch (error) {
    console.error('Error restoring session files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
