import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveSessionFiles, getSessionFiles } from '@/lib/services/fileCollection'

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

    await saveSessionFiles(sessionId, sandboxId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving session files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const files = await getSessionFiles(sessionId)

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error retrieving session files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
