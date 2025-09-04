import { getAuthSession } from '@/lib/auth'
import { getStripeCustomerId } from '@/lib/credits'
import { VercelService } from '@/lib/vercel'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod/v3'
import { createClient } from '@vercel/kv'

const BuyRequestSchema = z.object({
  domain: z.string().min(1),
  expectedPrice: z.number().min(0),
})

interface StoredDomainData {
  domain: string
  purchaseDate: string
  price: number
  customerId: string
  vercelDomainId?: string
  userEmail: string
}

// Company registrant details (hardcoded as requested)
const COMPANY_REGISTRANT = {
  country: "US",
  orgName: "BLACKBOX AI Inc",
  firstName: 'Richard',
  lastName: 'Rizk',
  address1: "535 mission street",
  city: "San Francisco",
  state: "CA",
  postalCode: "94158",
  phone: "+1-438-883-8281",
  email: "domains@blackbox.ai"
}

const VERCEL_DEPLOY_TOKEN = process.env.VERCEL_DEPLOY_TOKEN
const PAYMENT_API_ENDPOINT = process.env.PAYMENT_API_ENDPOINT || 'https://payment.blackbox.ai'

const kv = createClient({
  url: process.env.KV_RATE_URL as string,
  token: process.env.KV_RATE_TOKEN as string
})

if (!VERCEL_DEPLOY_TOKEN) {
  console.error('Missing VERCEL_DEPLOY_TOKEN environment variable')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!VERCEL_DEPLOY_TOKEN) {
      return NextResponse.json(
        { error: 'Vercel integration is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const validatedData = BuyRequestSchema.safeParse(body)

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { domain, expectedPrice } = validatedData.data
    const userEmail = session.user.email

    // Get customer ID for credits
    const customerId = await getStripeCustomerId(userEmail)
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const vercelService = new VercelService(VERCEL_DEPLOY_TOKEN)

    // Check if domain is already purchased by any user
    const domainOwnershipKey = `domain_owner:${domain}`
    const existingOwnership = await kv.get(domainOwnershipKey) as { userEmail: string; customerId: string; purchaseDate: string } | null

    if (existingOwnership) {
      if (existingOwnership.userEmail === userEmail) {
        return NextResponse.json(
          { error: 'You have already purchased this domain' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'This domain has already been purchased by another user' },
          { status: 400 }
        )
      }
    }

    // First, verify domain is still available and price is correct
    const [availabilityResult, priceResult] = await Promise.all([
      vercelService.checkDomainAvailability(domain),
      vercelService.getDomainPrice(domain, 'new')
    ])

    if (!availabilityResult.success || !availabilityResult.available) {
      return NextResponse.json(
        { error: 'Domain is no longer available' },
        { status: 400 }
      )
    }

    if (!priceResult.success || priceResult.price !== expectedPrice) {
      return NextResponse.json(
        { error: 'Domain price has changed. Please refresh and try again.' },
        { status: 400 }
      )
    }

    // Consume credits first
    const consumeResponse = await fetch(`${PAYMENT_API_ENDPOINT}/api/consume-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId: customerId,
        amount: expectedPrice,
        description: `Domain purchase: ${domain}`
      })
    })

    if (!consumeResponse.ok) {
      const errorData = await consumeResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error || 'Insufficient credits or payment failed' },
        { status: 400 }
      )
    }

    const consumeData = await consumeResponse.json()
    if (!consumeData.success) {
      return NextResponse.json(
        { error: consumeData.error || 'Failed to consume credits' },
        { status: 400 }
      )
    }

    // Purchase domain via Vercel
    console.log(`Attempting to purchase domain ${domain} for ${expectedPrice}`)
    const purchaseResult = await vercelService.buyDomain(
      domain,
      COMPANY_REGISTRANT,
      expectedPrice,
    )

    if (!purchaseResult.success) {
      console.error('Domain purchase failed:', purchaseResult.error)
      
      // Check if it's a token/authorization issue
      if (purchaseResult.error?.includes('403') || purchaseResult.error?.includes('forbidden') || purchaseResult.error?.includes('Not authorized')) {
        return NextResponse.json(
          { error: 'Domain purchase is not available. The Vercel token does not have the required permissions for domain purchases. Please contact support.' },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { error: `Domain purchase failed: ${purchaseResult.error}` },
        { status: 500 }
      )
    }

    // Store domain in KV storage
    const domainData = {
      domain,
      purchaseDate: new Date().toISOString(),
      price: expectedPrice,
      customerId,
      vercelDomainId: purchaseResult?.id,
      userEmail
    }

    // Store in user's domain list
    const userDomainsKey = `user_domains:${userEmail}`
    const existingDomains = await kv.get(userDomainsKey) as StoredDomainData[] || []
    existingDomains.push(domainData)
    await kv.set(userDomainsKey, existingDomains, { ex: 86400 * 365 }) // 1 year TTL

    // Store domain ownership lookup
    const domainOwnerKey = `domain_owner:${domain}`
    await kv.set(domainOwnerKey, {
      userEmail,
      customerId,
      purchaseDate: domainData.purchaseDate
    }, { ex: 86400 * 365 }) // 1 year TTL

    return NextResponse.json({
      success: true,
      domain: {
        name: domain,
        id: purchaseResult?.id,
        purchaseDate: domainData.purchaseDate,
        price: expectedPrice
      },
    })

  } catch (error) {
    console.error('Domain purchase error:', error)
    return NextResponse.json(
      { error: 'Internal server error during domain purchase' },
      { status: 500 }
    )
  }
}
