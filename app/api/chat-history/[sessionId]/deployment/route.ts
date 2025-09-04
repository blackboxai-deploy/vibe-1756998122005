import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import kvUser from '@/lib/services/kvUser'
import type { ChatUIMessage } from '@/components/chat/types'

interface ChatSession {
  id: string
  timestamp: number
  messages: ChatUIMessage[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
  latestDeploymentUrl?: string
  latestCustomDomain?: string
}

// POST - Update deployment URLs for a specific chat session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const { latestDeploymentUrl, latestCustomDomain } = await request.json()
    
    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Check if this session belongs to the user
    const userSessionIds = await kvUser.smembers(sessionIdsKey) || []
    if (!userSessionIds.includes(sessionId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get existing session data
    const existingSession = await kvUser.get(`chat-session:${sessionId}`) as ChatSession
    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update session with new deployment URLs
    const updatedSession: ChatSession = {
      ...existingSession,
      latestDeploymentUrl,
      latestCustomDomain,
      lastUpdated: Date.now()
    }

    // Save updated session
    await kvUser.set(`chat-session:${sessionId}`, updatedSession)

    return NextResponse.json({ 
      success: true, 
      session: updatedSession 
    })
  } catch (error) {
    console.error('Error updating deployment URLs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
