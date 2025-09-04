import { getAuthSession } from '@/lib/auth'
import { createStripeCustomer, getCredits, getStripeCustomerId, hasPaymentMethods } from '@/lib/credits'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const authSession = await getAuthSession()
    const userEmail = authSession?.user?.email

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let customerId = await getStripeCustomerId(userEmail)
    if (!customerId) {
      // Initialize customer id here
      customerId = await createStripeCustomer(userEmail)
      if (!customerId) {
        return NextResponse.json(
          { error: 'Failed to initialize customer account' },
          { status: 500 }
        )
      }
    }

    const [credits, hasPaymentMethod] = await Promise.all([
      getCredits(customerId),
      hasPaymentMethods(customerId)
    ])

    return NextResponse.json({ 
      credits,
      hasPaymentMethod,
      customerId 
    })

  } catch (error) {
    console.error('Error fetching credits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
