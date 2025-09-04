import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { PublishedApp, PublishFormData } from '@/lib/types'
import puppeteer from 'puppeteer-core'
import { chromium } from 'playwright'
import { getUser } from '@/app/auth/login'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, appUrl, sandboxId }: PublishFormData & { appUrl: string; sandboxId?: string } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate screenshot of the app
    let screenshotUrl: string | undefined

    try {
      const browser = await chromium.launch()
      const page = await browser.newPage()
      
      // Set viewport for consistent screenshots
      await page.setViewportSize({ width: 1200, height: 800 })
      
      // Navigate to the app URL
      await page.goto(appUrl, { waitUntil: 'networkidle' })
      
      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(2000)
      
      // Take screenshot
      const screenshot = await page.screenshot({ 
        type: 'jpeg', 
        quality: 80,
        fullPage: false 
      })
      
      await browser.close()

      // Convert screenshot to base64 data URL for now
      // In production, you'd want to upload this to a cloud storage service
      screenshotUrl = `data:image/jpeg;base64,${screenshot.toString('base64')}`
      
    } catch (error) {
      console.error('Failed to generate screenshot:', error)
      // Continue without screenshot if it fails
    }

    // Get user information for creator details
    let creatorName: string | undefined
    let creatorAvatar: string | undefined

    // Try to get name from session first (OAuth providers)
    if (session.user.name) {
      creatorName = session.user.name
    } else {
      // Fallback to getting fullname from user record
      try {
        const user = await getUser(session.user.email)
        if (user?.fullname) {
          creatorName = user.fullname
        }
      } catch (error) {
        console.error('Error fetching user details:', error)
      }
    }

    // Get avatar from session (OAuth providers)
    if (session.user.image) {
      creatorAvatar = session.user.image
    }

    // Save to MongoDB
    const db = await getDatabase()
    const collection = db.collection<PublishedApp>('published_apps')

    const publishedApp: Omit<PublishedApp, '_id'> = {
      title,
      appUrl,
      screenshotUrl,
      creatorEmail: session.user.email,
      creatorName,
      creatorAvatar,
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: 0,
      views: 0,
      sandboxId,
      deploymentUrl: appUrl
    }

    const result = await collection.insertOne(publishedApp)

    return NextResponse.json({ 
      success: true, 
      id: result.insertedId,
      app: { ...publishedApp, _id: result.insertedId }
    })

  } catch (error) {
    console.error('Error publishing app:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
