import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import kvUser from '@/lib/services/kvUser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params;
    const body = await request.json()
    const { sandbox } = body

    if (!sandbox || !sandbox.sandboxId) {
      return NextResponse.json({ error: 'Sandbox metadata is required' }, { status: 400 })
    }

    // Get the existing session
    const sessionKey = `chat-session:${sessionId}`
    const existingSession = await kvUser.get(sessionKey)

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update the session with sandbox metadata
    const updatedSession = {
      ...existingSession,
      sandbox
    }

    // Save back to KV
    await kvUser.set(sessionKey, updatedSession)

    return NextResponse.json({
      success: true,
      session: updatedSession
    })

  } catch (error) {
    console.error('Failed to save sandbox metadata to session:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save sandbox metadata'
    }, { status: 500 })
  }
}
