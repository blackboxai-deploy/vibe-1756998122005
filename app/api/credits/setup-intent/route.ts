import { getAuthSession } from '@/lib/auth'
import { createSetupIntent, getStripeCustomerId } from '@/lib/credits'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const authSession = await getAuthSession()
    const userEmail = authSession?.user?.email

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = await getStripeCustomerId(userEmail)
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const clientSecret = await createSetupIntent(customerId)
    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Failed to create setup intent' },
        { status: 500 }
      )
    }

    return NextResponse.json({ clientSecret })

  } catch (error) {
    console.error('Error creating setup intent:', error)
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    )
  }
}
