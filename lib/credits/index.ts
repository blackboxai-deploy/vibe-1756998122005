'use server'

import { createClient } from '@vercel/kv'
import { sleep } from '@/lib/utils'
import stripe from '../services/stripe'


const PAYMENT_SERVER = process.env.PAYMENT_SERVER || 'https://payment.blackbox.ai'

const stripeKv = createClient({
  url: process.env.KV_RATE_URL as any,
  token: process.env.KV_RATE_TOKEN as any
})

/**
 * Creates a new Stripe customer with the provided email
 * @param email The user's email address
 * @returns The Stripe customer ID or null if creation fails
 */
export async function createStripeCustomer(email: string): Promise<string | null> {
  if (!email) return null

  try {
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        created_via: 'vibe-coding-platform',
        created_at: new Date().toISOString()
      }
    })

    // Cache the new customer ID
    const key = `stripe_customer:${email}`
    await stripeKv.set(key, customer.id, { ex: 900 }) // 15 minutes in seconds

    console.log('✅ Created new Stripe customer:', customer.id, 'for email:', email)
    return customer.id
  } catch (error) {
    console.error('Error creating Stripe customer:', error)
    return null
  }
}

export async function getStripeCustomerId(email: string): Promise<string | null> {
  if (!email) return null

  const key = `stripe_customer:${email}`

  try {
    const cached = await stripeKv.get(key)
    if (cached !== null) {
      return cached as string
    }

    const customers = await stripe.customers.search({
      query: `email:'${email}'`,
    })

    let customerId = customers.data[0]?.id
    if (customers.data.length === 0) {
      // Wait for 10s to allow Stripe's system to potentially update
      await sleep(10_000)

      // Recheck Stripe one more time
      const recheckCustomers = await stripe.customers.search({
        query: `email:'${email}'`,
      })

      if (recheckCustomers.data.length === 0) {
        // If still no customer found, cache negative result for a shorter duration (5 minutes)
        await stripeKv.set(key, '', { ex: 300 }) // Cache negative result for 5 minutes
        return null
      }

      // If customer found on recheck, update customerId
      customerId = recheckCustomers.data[0].id
    }

    // Cache the customer ID with 15 minute TTL
    await stripeKv.set(key, customerId, { ex: 900 }) // 15 minutes in seconds

    return customerId
  } catch (error) {
    console.error('Error checking Stripe customer:', error)
    return null
  }
}

/**
 * Fetches the current credit balance for a customer
 * @param customerId The unique identifier for the customer
 * @param existingCredits Optional parameter to validate against server-side credits
 * @returns The number of credits available or null if the request fails
 */
export async function getCredits(
  customerId: string,
  userEmail?: string,
): Promise<number | null> {
  try {

    // userEmail && await initializeCreditsSettings(userEmail);

    const params = new URLSearchParams();
    params.append('customerId', customerId);

    const response = await fetch(`${PAYMENT_SERVER}/api/get-credits?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${process.env.PAYMENT_API_KEY || ''}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch credits:', response.statusText);
      return null;
    }

    const data = await response.json();
    if (data && typeof data.credits === 'number') {
      return data.credits;
    } else {
      console.error('Invalid response data:', data);
      return null;
    }
  } catch (error) {
    console.error('Error fetching credits:', error);
    return null;
  }
}

/**
 * Purchases credits for a customer
 * @param customerId The unique identifier for the customer
 * @param amount The number of credits to purchase
 * @returns Purchase result with success status and potential 3DS requirements
 */
export async function purchaseCredits(
  customerId: string,
  amount: number
): Promise<{
  success: boolean;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${PAYMENT_SERVER}/api/purchase-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId,
        amount: amount * 100, // amount in cents
      })
    });

    if (!response.ok) {
      console.error('Failed to purchase credits:', response.statusText);
      return { success: false, error: 'Failed to purchase credits' };
    }

    const data = await response.json();

    if (data.requiresAction) {
      return {
        success: false,
        requiresAction: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        paymentMethodId: data.paymentMethodId
      };
    }

    return { success: data.success || false };
  } catch (error) {
    console.error('Error purchasing credits:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Confirms a payment intent that requires 3DS authentication
 * @param paymentIntentId The payment intent ID
 * @returns Boolean indicating success
 */
export async function confirmPaymentIntent(paymentIntentId: string): Promise<boolean> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    return false;
  }
}

/**
 * Checks if a customer has any payment methods attached
 * @param customerId The Stripe customer ID
 * @returns Boolean indicating if customer has payment methods
 */
export async function hasPaymentMethods(customerId: string): Promise<boolean> {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data.length > 0;
  } catch (error) {
    console.error('Error checking payment methods:', error);
    return false;
  }
}

/**
 * Creates a setup intent for adding a payment method
 * @param customerId The Stripe customer ID
 * @returns The client secret for the setup intent
 */
export async function createSetupIntent(customerId: string): Promise<string | null> {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return setupIntent.client_secret;
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return null;
  }
}

/**
 * Adds trial credits for a user email if they don't already have credits
 * @param email The user's email address
 * @returns A boolean indicating whether the trial credits were successfully added
 */
export async function addTrialCreditsForEmail(
  email: string
): Promise<boolean> {
  try {
    if (!email) {
      console.error('Email is required for adding trial credits');
      return false;
    }

    // Add trial credits via API
    const response = await fetch(`${PAYMENT_SERVER}/api/add-trial-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email
      })
    });

    if (!response.ok) {
      console.error('Failed to add trial credits:', response.statusText);
      return false;
    }

    const data = await response.json();
    if (data && data.success) {
      console.log('✅ Trial credits added successfully for:', email);
      return true;
    } else {
      console.error('Add trial credits API returned failure:', data);
      return false;
    }
  } catch (error) {
    console.error('Error adding trial credits:', error);
    return false;
  }
}
