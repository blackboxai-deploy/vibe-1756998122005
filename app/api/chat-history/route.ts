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

// GET - Fetch all chat sessions for a user with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    
    // Validate pagination parameters
    const validPage = Math.max(1, page)
    const validLimit = Math.min(Math.max(1, limit), 20) // Max 20 items per page, default 5

    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Get all session IDs for this user
    const sessionIds = await kvUser.smembers(sessionIdsKey) || []
    
    if (sessionIds.length === 0) {
      return NextResponse.json({ 
        sessions: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          totalPages: 0
        }
      })
    }

    // Calculate pagination indices
    const total = sessionIds.length
    const totalPages = Math.ceil(total / validLimit)
    const startIndex = (validPage - 1) * validLimit
    const endIndex = startIndex + validLimit

    // Sort session IDs by creation time (since they contain timestamp) and truncate
    // Session IDs are in format: session_{timestamp}_{random}
    const sortedSessionIds = sessionIds.sort((a, b) => {
      // Extract timestamp from session ID format: session_{timestamp}_{random}
      const timestampA = parseInt(a.split('_')[1]) || 0
      const timestampB = parseInt(b.split('_')[1]) || 0
      return timestampB - timestampA // Descending order (newest first)
    })

    // Get only the session IDs for this page
    const paginatedSessionIds = sortedSessionIds.slice(startIndex, endIndex)

    // Fetch only the sessions for this page in parallel
    const sessionPromises = paginatedSessionIds.map(async (sessionId) => {
      const sessionData = await kvUser.get(`chat-session:${sessionId}`)
      return sessionData ? (sessionData as ChatSession) : null
    })
    
    const sessionResults = await Promise.all(sessionPromises)
    const sessions = sessionResults.filter(Boolean) as ChatSession[]

    // Sort by actual lastUpdated to be more accurate (since we only have a few sessions now)
    sessions.sort((a, b) => b.lastUpdated - a.lastUpdated)

    return NextResponse.json({ 
      sessions,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update a chat session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, sessionId, sandboxId } = await request.json()
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages data' }, { status: 400 })
    }

    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Generate session ID if not provided
    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Generate title from first user message
    const firstUserMessage = messages.find((msg: ChatUIMessage) => msg.role === 'user')
    let title = `Chat ${new Date().toLocaleDateString()}`
    
    if (firstUserMessage && firstUserMessage.parts && firstUserMessage.parts.length > 0) {
      const firstPart = firstUserMessage.parts[0]
      if (firstPart.type === 'text' && 'text' in firstPart) {
        const content = firstPart.text
        title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      }
    }

    const chatSession: ChatSession = {
      id: finalSessionId,
      timestamp: Date.now(),
      messages,
      title,
      lastUpdated: Date.now()
    }

    // Save session data
    await kvUser.set(`chat-session:${finalSessionId}`, chatSession)
    
    // Add session ID to user's session list
    await kvUser.sadd(sessionIdsKey, finalSessionId)

    // Save sandbox files asynchronously if sandboxId is provided (non-blocking)
    if (sandboxId) {
      // Import and call file saving function asynchronously
      import('@/lib/services/fileCollection').then(({ saveSessionFiles }) => {
        saveSessionFiles(finalSessionId, sandboxId).catch(error => {
          console.error('Failed to save sandbox files for session:', finalSessionId, error)
        })
      }).catch(error => {
        console.error('Failed to import file collection service:', error)
      })
      
      console.log('Initiated async file saving for session:', finalSessionId, 'sandbox:', sandboxId)
    }

    return NextResponse.json({ 
      success: true, 
      sessionId: finalSessionId,
      session: chatSession 
    })
  } catch (error) {
    console.error('Error saving chat session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Clear all chat history for a user
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const sessionIdsKey = `chat-history:${userEmail}`
    
    // Get all session IDs for this user
    const sessionIds = await kvUser.smembers(sessionIdsKey) || []
    
    // Delete all session data
    for (const sessionId of sessionIds) {
      await kvUser.del(`chat-session:${sessionId}`)
    }
    
    // Clear the session IDs set
    await kvUser.del(sessionIdsKey)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing chat history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
