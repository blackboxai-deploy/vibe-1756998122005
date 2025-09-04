import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'

// GET - Check if an app URL is already published
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const appUrl = searchParams.get('appUrl')
    
    if (!appUrl) {
      return NextResponse.json({ error: 'App URL is required' }, { status: 400 })
    }

    const db = await getDatabase()
    
    // Check if app with this URL exists
    const existingApp = await db.collection('published_apps').findOne({
      appUrl: appUrl
    })

    return NextResponse.json({
      success: true,
      isPublished: !!existingApp,
      app: existingApp ? {
        _id: existingApp._id,
        title: existingApp.title,
        description: existingApp.description,
        category: existingApp.category,
        createdAt: existingApp.createdAt,
        updatedAt: existingApp.updatedAt
      } : null
    })
  } catch (error) {
    console.error('Error checking app publish status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
