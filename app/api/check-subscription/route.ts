import { NextResponse } from 'next/server';
import stripe from '@/lib/services/stripe';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const startTime = Date.now()
  
  logger.api('/api/check-subscription', 'POST', 'Processing subscription check request')

  try {
    logger.info('Parsing subscription check request body', { endpoint: '/api/check-subscription' })
    const { email } = await request.json();
    
    if (!email) {
      logger.error('Email is required but not provided', undefined, {
        endpoint: '/api/check-subscription'
      })
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const maskedEmail = email.substring(0, 3) + '***' + email.substring(email.lastIndexOf('@'))
    logger.api('/api/check-subscription', 'POST', 'Checking subscription for email', {
      email: maskedEmail
    })

    // Search for customer by email
    logger.info('Searching for Stripe customers by email', {
      endpoint: '/api/check-subscription',
      email: maskedEmail
    })

    const customers = await stripe.customers.list({ email });
    
    logger.info('Stripe customers search completed', {
      endpoint: '/api/check-subscription',
      customerCount: customers.data.length,
      email: maskedEmail
    })
        
    if (customers.data.length === 0) {
        return NextResponse.json({ hasActiveSubscription: false });
    }

    // Check for active or trialing subscriptions for all customers
    let activeSubscription;
    let activeTrialSubscription;

    // Iterate through all customers found with the email
    for (const customer of customers.data) {
        // Check for active subscriptions
        const subscriptions:any = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
        });
        
        // Check for trial subscriptions
        const trialSubscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'trialing',
        });

        // Find active or trial subscription
        activeSubscription = subscriptions.data.find((sub:any) => sub.status === 'active');
        activeTrialSubscription = trialSubscriptions.data.find(sub => sub.status === 'trialing');

        // If we found either type of active subscription, break the loop
        if (activeSubscription || activeTrialSubscription) {
            break;
        }
    }

    // Get expiry timestamp and customerId from active subscription
    let expiryTimestamp = null;
    let customerId = null;

    if (activeSubscription && activeSubscription.current_period_end) {
        expiryTimestamp = activeSubscription.current_period_end;
        customerId = activeSubscription.customer as string;
    } else if (activeTrialSubscription && activeTrialSubscription.trial_end) {
        expiryTimestamp = activeTrialSubscription.trial_end;
        customerId = activeTrialSubscription.customer as string;
    } else {
      customerId = customers.data[0].id;
      expiryTimestamp = Math.floor((Date.now() + (6 * 60 * 60 * 1000)) / 1000); // Set dummy expiry timestamp for next 6 hours
    }

    // Fix the logic for hasActiveSubscription
    const hasActiveSubscription = !!(activeSubscription || activeTrialSubscription);
    const isTrialSubscription = !!activeTrialSubscription && !activeSubscription;
    
    logger.info('Processing subscription logic', {
      endpoint: '/api/check-subscription',
      email: maskedEmail,
      hasActiveSubscription,
      isTrialSubscription
    })

    let subscription_response: any = {
      hasActiveSubscription: hasActiveSubscription,
      isTrialSubscription: isTrialSubscription,
      customerId: customerId,
      expiryTimestamp: expiryTimestamp
    }
    
    const duration = Date.now() - startTime
    logger.performance('subscription-check', duration, {
      email: maskedEmail,
      hasActiveSubscription: subscription_response.hasActiveSubscription,
      isTrialSubscription: subscription_response.isTrialSubscription
    })

    logger.api('/api/check-subscription', 'POST', 'Subscription check completed successfully', {
      email: maskedEmail,
      hasActiveSubscription: subscription_response.hasActiveSubscription,
      customerId: subscription_response.customerId,
      duration
    })

    return NextResponse.json(subscription_response);
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Stripe API error during subscription check', error, {
      endpoint: '/api/check-subscription',
      duration,
      method: 'POST'
    })
    
    // Return 500 status on error so the client knows it's a server error
    return NextResponse.json({
      hasActiveSubscription: false,
      customerId: null,
      error: 'Failed to check subscription status'
    }, { status: 500 });
  }
}
