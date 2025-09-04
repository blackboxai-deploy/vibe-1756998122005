import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getStripeCustomerId, purchaseCredits } from '@/lib/credits'
import { telemetry } from '@/lib/telemetry'
import { eventTypes } from '@/lib/utils'

export async function POST(req: Request) {
  try {

    telemetry(eventTypes.other, '',{
      tag:'web-credit-purchase',
      status: 'request-done',
      product: 'vibe-coding-platform'
    })

    const session = await getAuthSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { amount } = await req.json()
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    const customerId = await getStripeCustomerId(session.user.email)
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log(">>>> Purchasing credits for ", customerId, amount)
    const result = await purchaseCredits(customerId, amount)
    
    if (result.requiresAction) {
      // Return 3DS authentication requirements to client
      return NextResponse.json({
        requiresAction: true,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        paymentMethodId: result.paymentMethodId
      })
    }
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to purchase credits' },
        { status: 500 }
      )
    }

    telemetry(eventTypes.other, '',{
      tag:'web-credit-purchase',
      status: 'request-success',
      product: 'vibe-coding-platform'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in purchase credits API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
