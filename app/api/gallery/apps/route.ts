import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { PublishedApp } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '9', 9)
    const category = searchParams.get('category')

    // Validate pagination parameters
    const validPage = Math.max(1, page)
    const validLimit = Math.min(Math.max(1, limit), 9) // Max 9 items per page

    const db = await getDatabase()
    const collection = db.collection<PublishedApp>('published_apps')

    // Build query filter
    const filter: Record<string, any> = {}
    if (category && category !== 'all') {
      filter.category = category
    }

    // Calculate skip value for pagination
    const skip = (validPage - 1) * validLimit

    // Get total count for pagination info
    const total = await collection.countDocuments(filter)

    // Fetch apps with pagination, sorted by creation date (newest first)
    const apps = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .toArray()

    // Calculate pagination info
    const totalPages = Math.ceil(total / validLimit)
    const hasMore = validPage < totalPages

    return NextResponse.json({
      success: true,
      apps,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasMore
      }
    })

  } catch (error) {
    console.error('Error fetching published apps:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
