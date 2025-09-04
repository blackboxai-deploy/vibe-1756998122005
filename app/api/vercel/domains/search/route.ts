import { getAuthSession } from '@/lib/auth'
import { VercelService } from '@/lib/vercel'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod/v3'

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(50),
})

interface DomainSearchResult {
  domain: string
  available: boolean
  price: number | null
  currency: string
  error?: string
}

const VERCEL_DEPLOY_TOKEN = process.env.VERCEL_DEPLOY_TOKEN

if (!VERCEL_DEPLOY_TOKEN) {
  console.error('Missing VERCEL_DEPLOY_TOKEN environment variable')
}

// Generate domain variations from search query
function generateDomainVariations(query: string): string[] {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  const extensions = ['.com', '.net', '.org', '.io', '.co', '.app', '.dev', '.xyz', '.tech', '.online']
  const prefixes = ['', 'get-', 'try-', 'use-', 'my-']
  const suffixes = ['', '-app', '-web', '-site', '-hub', '-pro']
  
  const variations = new Set<string>()
  
  // Basic extensions
  extensions.forEach(ext => {
    variations.add(`${cleanQuery}${ext}`)
  })
  
  // With prefixes (limit to popular extensions)
  const popularExtensions = ['.com', '.io', '.app', '.dev']
  prefixes.slice(1).forEach(prefix => {
    popularExtensions.forEach(ext => {
      variations.add(`${prefix}${cleanQuery}${ext}`)
    })
  })
  
  // With suffixes (limit to .com and .io)
  suffixes.slice(1).forEach(suffix => {
    variations.add(`${cleanQuery}${suffix}.com`)
    variations.add(`${cleanQuery}${suffix}.io`)
  })
  
  // Convert to array and limit to 12 variations
  return Array.from(variations).slice(0, 12)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
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
    const validatedData = SearchRequestSchema.safeParse(body)

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { query } = validatedData.data
    const vercelService = new VercelService(VERCEL_DEPLOY_TOKEN)

    // Generate domain variations
    const domainVariations = generateDomainVariations(query)
    
    // Check availability and pricing for each domain
    const domainResults = await Promise.allSettled(
      domainVariations.map(async (domain) => {
        const [availabilityResult, priceResult] = await Promise.allSettled([
          vercelService.checkDomainAvailability(domain),
          vercelService.getDomainPrice(domain, 'new')
        ])

        const availability = availabilityResult.status === 'fulfilled' ? availabilityResult.value : { success: false, available: false }
        const pricing = priceResult.status === 'fulfilled' ? priceResult.value : { success: false, price: 0 }

        return {
          domain,
          available: availability.success ? availability.available : false,
          price: pricing.success ? pricing.price : null,
          currency: pricing.success ? pricing.currency : 'USD',
          error: !availability.success ? availability.error : (!pricing.success ? pricing.error : undefined)
        }
      })
    )

    // Filter successful results and available domains
    const availableDomains = domainResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<DomainSearchResult>).value)
      .filter(domain => domain.available && domain.price !== null)
      .slice(0, 10) // Limit to 10 results

    return NextResponse.json({
      success: true,
      query,
      domains: availableDomains,
      total: availableDomains.length
    })

  } catch (error) {
    console.error('Domain search error:', error)
    return NextResponse.json(
      { error: 'Internal server error during domain search' },
      { status: 500 }
    )
  }
}
