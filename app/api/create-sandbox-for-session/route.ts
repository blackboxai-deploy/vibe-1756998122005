import { NextRequest, NextResponse } from 'next/server'
import { initializeSandbox } from '@/lib/sandbox-initializer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import kvUser from '@/lib/services/kvUser'
import { SANDBOX_EXPIRATION_TIME } from '@/ai/constants'

interface ChatSession {
  id: string
  timestamp: number
  messages: any[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, ports = [3000], runDevServer = false } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Check if session has existing valid sandbox
    const sessionKey = `chat-session:${sessionId}`
    const existingSession = await kvUser.get<ChatSession>(sessionKey)

    if (existingSession && existingSession.sandbox) {
      const now = Date.now()
      const isValid = now < existingSession.sandbox.expiresAt

      if (isValid) {
        console.log('Using existing valid sandbox for session:', {
          sessionId,
          sandboxId: existingSession.sandbox.sandboxId,
          timeRemaining: existingSession.sandbox.expiresAt - now
        })

        return NextResponse.json({
          success: true,
          sandboxId: existingSession.sandbox.sandboxId,
          sessionId: sessionId,
          duration: 0, // No creation time since we're reusing
          starterFilesCopied: false,
          npmInstallCompleted: false,
          fileCount: 0,
          filesRestored: false,
          restoredFileCount: 0,
          devServerStarted: false, // Existing sandbox, dev server status unknown
          reused: true
        })
      } else {
        console.log('Existing sandbox expired, creating new one:', {
          sessionId,
          expiredSandboxId: existingSession.sandbox.sandboxId,
          expiredAt: existingSession.sandbox.expiresAt
        })
      }
    }

    // Create new sandbox using the modular function
    const result = await initializeSandbox({
      ports,
      copyStarterFiles: false,
      runNpmInstall: runDevServer, // Run npm install if dev server is requested
      contextId: `chat-history-${sessionId}`,
      sessionId: sessionId, // Pass sessionId to enable file restoration
      runDevServer: runDevServer // Pass flag to start dev server
    })

    // Save sandbox metadata to the session
    const sandboxMetadata = {
      sandboxId: result.sandboxId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (SANDBOX_EXPIRATION_TIME * 60 * 1000) // 45 minutes from now
    }

    // Update the session with sandbox metadata
    if (existingSession) {
      const updatedSession = {
        ...existingSession,
        sandbox: sandboxMetadata
      }
      await kvUser.set(sessionKey, updatedSession)
    }

    console.log('Created new sandbox for session:', {
      sessionId,
      sandboxId: result.sandboxId,
      expiresAt: sandboxMetadata.expiresAt
    })

    return NextResponse.json({
      success: true,
      sandboxId: result.sandboxId,
      sessionId: sessionId,
      duration: result.duration,
      starterFilesCopied: result.starterFilesCopied,
      npmInstallCompleted: result.npmInstallCompleted,
      fileCount: result.filePaths.length,
      filesRestored: result.filesRestored,
      restoredFileCount: result.restoredFileCount,
      devServerStarted: result.devServerStarted,
      reused: false
    })

  } catch (error) {
    console.error('Failed to create sandbox for session:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sandbox'
    }, { status: 500 })
  }
}
