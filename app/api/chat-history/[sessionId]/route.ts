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

// GET - Fetch a specific chat session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Check if this session belongs to the user
    const userSessionIds = await kvUser.smembers(sessionIdsKey) || []
    if (!userSessionIds.includes(sessionId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch session data
    const sessionData = await kvUser.get(`chat-session:${sessionId}`) as ChatSession
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if session has a valid sandbox and add "sandbox restored" message
    let messagesWithRestore = sessionData.messages
    if (sessionData.sandbox) {
      const now = Date.now()
      const isValid = now < sessionData.sandbox.expiresAt
      
      if (isValid) {
        // Create a "sandbox restored" message
        const sandboxRestoredMessage: ChatUIMessage = {
          id: `sandbox-restored-${Date.now()}`,
          role: 'assistant',
          parts: [{
            type: 'data-create-sandbox',
            data: {
              sandboxId: sessionData.sandbox.sandboxId,
              status: 'done' as const,
              restored: true
            }
          }],
          metadata: {
            model: 'system'
          }
        }
        
        // Append the sandbox restored message to the messages
        messagesWithRestore = [...sessionData.messages, sandboxRestoredMessage]
        
        console.log('[CHAT-HISTORY] Added sandbox restored message to session:', {
          sessionId,
          sandboxId: sessionData.sandbox.sandboxId,
          totalMessages: messagesWithRestore.length
        })
      }
    }

    // Return session with potentially modified messages
    const responseSession = {
      ...sessionData,
      messages: messagesWithRestore
    }

    return NextResponse.json({ session: responseSession })
  } catch (error) {
    console.error('Error fetching chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a specific chat session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const { messages, sandboxId } = await request.json()
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages data' }, { status: 400 })
    }

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

    // Update session with new messages
    const updatedSession: ChatSession = {
      ...existingSession,
      messages,
      lastUpdated: Date.now()
    }

    // Save updated session
    await kvUser.set(`chat-session:${sessionId}`, updatedSession)

    // Save sandbox files asynchronously if sandboxId is provided (non-blocking)
    if (sandboxId) {
      // Import and call file saving function asynchronously
      import('@/lib/services/fileCollection').then(({ saveSessionFiles }) => {
        saveSessionFiles(sessionId, sandboxId).catch(error => {
          console.error('Failed to save sandbox files for session:', sessionId, error)
        })
      }).catch(error => {
        console.error('Failed to import file collection service:', error)
      })
      
      console.log('Initiated async file saving for session update:', sessionId, 'sandbox:', sandboxId)
    }

    return NextResponse.json({ 
      success: true, 
      session: updatedSession 
    })
  } catch (error) {
    console.error('Error updating chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a specific chat session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params
    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Check if this session belongs to the user
    const userSessionIds = await kvUser.smembers(sessionIdsKey) || []
    if (!userSessionIds.includes(sessionId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Delete session data
    await kvUser.del(`chat-session:${sessionId}`)
    
    // Remove session ID from user's session list
    await kvUser.srem(sessionIdsKey, sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
