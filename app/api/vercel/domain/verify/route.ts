import { getAuthSession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { promises as dns } from 'dns'
import z from 'zod/v3'

const VerifyDomainRequestSchema = z.object({
  projectName: z.string().min(1),
  domain: z.string().min(1),
})

const EXPECTED_IP = '76.76.21.21'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = VerifyDomainRequestSchema.safeParse(body)

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { domain } = validatedData.data

    try {
      // Perform DNS A record lookup
      const addresses = await dns.resolve4(domain)
      console.log(`DNS lookup for ${domain}:`, addresses)

      // Check if the expected IP address is in the A records
      const hasCorrectARecord = addresses.includes(EXPECTED_IP)

      if (hasCorrectARecord) {
        return NextResponse.json({
          success: true,
          verified: true,
        })
      } else {
        return NextResponse.json({
          success: true,
          verified: false,
          error: `Domain ${domain} does not point to ${EXPECTED_IP}. Current A records: ${addresses.join(', ')}`,
        })
      }
    } catch (dnsError) {
      console.error('DNS lookup error:', dnsError)
      
      // Handle specific DNS errors
      if (dnsError instanceof Error) {
        if (dnsError.message.includes('ENOTFOUND')) {
          return NextResponse.json({
            success: true,
            verified: false,
            error: `Domain ${domain} not found. Please ensure the domain exists and A records are properly configured.`,
          })
        } else if (dnsError.message.includes('ENODATA')) {
          return NextResponse.json({
            success: true,
            verified: false,
            error: `No A records found for ${domain}. Please add an A record pointing to ${EXPECTED_IP}.`,
          })
        }
      }

      return NextResponse.json({
        success: true,
        verified: false,
        error: `DNS lookup failed for ${domain}. Please ensure A records are properly configured.`,
      })
    }

  } catch (error) {
    console.error('Domain verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error while verifying domain' },
      { status: 500 }
    )
  }
}
