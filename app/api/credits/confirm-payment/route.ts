import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { confirmPaymentIntent } from '@/lib/credits'
import { telemetry } from '@/lib/telemetry'
import { eventTypes } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { paymentIntentId } = await req.json()
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    console.log(">>>> Confirming payment intent:", paymentIntentId)
    const success = await confirmPaymentIntent(paymentIntentId)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Payment confirmation failed' },
        { status: 500 }
      )
    }

    telemetry(eventTypes.other, '', {
      tag: 'web-credit-purchase-3ds-confirmed',
      status: 'request-success',
      product: 'vibe-coding-platform'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in confirm payment API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
