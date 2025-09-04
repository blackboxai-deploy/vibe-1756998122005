import { getAuthSession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@vercel/kv'

interface StoredDomainData {
  domain: string
  purchaseDate: string
  price: number
  customerId: string
  vercelDomainId?: string
  userEmail: string
}

const kv = createClient({
  url: process.env.KV_RATE_URL as string,
  token: process.env.KV_RATE_TOKEN as string
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email
    const userDomainsKey = `user_domains:${userEmail}`
    
    const domains = await kv.get(userDomainsKey) as StoredDomainData[] || []

    return NextResponse.json({
      success: true,
      domains: domains.map(domain => ({
        domain: domain.domain,
        purchaseDate: domain.purchaseDate,
        price: domain.price,
        vercelDomainId: domain.vercelDomainId
      }))
    })

  } catch (error) {
    console.error('Error fetching user domains:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
