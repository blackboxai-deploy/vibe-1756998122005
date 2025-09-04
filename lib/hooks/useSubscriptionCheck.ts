import { useState, useRef } from 'react'
import { useGlobalLocalStorage } from './use-global-local-storage'

interface SubscriptionCache {
  status: string
  customerId: string | null
  expiryTimestamp: number | null // epoch timestamp for subscription expiry
  lastChecked: number // timestamp of last API check
  isTrialSubscription: boolean
}

interface SubscriptionResult {
  status: string
  customerId: string | null
  isTrialSubscription: boolean
}

export function useSubscriptionCheck() {
  const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  const [subscriptionCache, setSubscriptionCache] =
    useGlobalLocalStorage<SubscriptionCache | null>('subscription-cache', null)

  // Locking mechanism to prevent duplicate API calls
  const pendingRequests = useRef<Map<string, Promise<SubscriptionResult>>>(new Map())

  async function checkSubscription(
    userEmail: string | null | undefined,
    forceCheck = false
  ): Promise<SubscriptionResult> {
    try {
      if (!userEmail) {
        return { status: 'FREE', customerId: null, isTrialSubscription: false }
      }

      // Create a unique key for this user's request
      const requestKey = `${userEmail}-${forceCheck}`

      // Check if there's already a pending request for this user
      const existingRequest = pendingRequests.current.get(requestKey)
      if (existingRequest) {
        // console.log('>>> Returning existing pending request for user:', userEmail)
        return await existingRequest
      }

      const now = Date.now()

      // Check cache
      if (subscriptionCache && !forceCheck) {
        const isWithinCacheDuration = now - subscriptionCache.lastChecked < CACHE_DURATION;

        // For FREE users, only check cache duration
        if (subscriptionCache.status !== 'PREMIUM' && isWithinCacheDuration) {
          //console.log('>>> Returning cached FREE status');
          return {
            status: subscriptionCache.status,
            customerId: subscriptionCache.customerId,
            isTrialSubscription: subscriptionCache.isTrialSubscription || false
          };
        }

        // For PREMIUM users, check both cache duration and expiry
        if (subscriptionCache.status === 'PREMIUM') {
          const hasValidExpiry = subscriptionCache.expiryTimestamp && 
            subscriptionCache.expiryTimestamp * 1000 > now;

          if (isWithinCacheDuration && hasValidExpiry) {
            return {
              status: subscriptionCache.status,
              customerId: subscriptionCache.customerId,
              isTrialSubscription: subscriptionCache.isTrialSubscription || false
            };
          }
        }
      }

      // Create and store the API request promise
      const apiRequest = (async (): Promise<SubscriptionResult> => {
        try {
          console.log('[useSubscriptionCheck] Cache miss or expired - checking subscription via API for:', userEmail)
          const response = await fetch(`/api/check-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: userEmail })
          })

          if (!response.ok) {
            console.error('[useSubscriptionCheck] API response not ok:', response.status, response.statusText)
            throw new Error(`API request failed with status ${response.status}`)
          }

          const data = await response.json()
          console.log('[useSubscriptionCheck] API response data:', data)

          // Update cache with expiry information
          const status = (data.hasActiveSubscription || data?.isTrialSubscription) ? 'PREMIUM' : 'FREE'
          const newCache = {
            status,
            customerId: data?.customerId,
            expiryTimestamp: data.expiryTimestamp || null,
            lastChecked: now,
            isTrialSubscription: data.isTrialSubscription || false
          }
          setSubscriptionCache(newCache)
          console.log('[useSubscriptionCheck] Cache updated with status:', status)

          return { 
            status, 
            customerId: data?.customerId,
            isTrialSubscription: data.isTrialSubscription || false 
          }
        } catch (error) {
          console.error('[useSubscriptionCheck] Error in API request:', error)
          throw error // Re-throw to be handled by the outer try-catch
        } finally {
          // Clean up the pending request when done
          pendingRequests.current.delete(requestKey)
        }
      })()

      // Store the promise so concurrent requests can use it
      pendingRequests.current.set(requestKey, apiRequest)

      return await apiRequest
    } catch (error) {
      console.error('[useSubscriptionCheck] Error checking subscription:', error)
      // Clean up the pending request on error
      const requestKey = `${userEmail}-${forceCheck}`
      pendingRequests.current.delete(requestKey)
      
      // If we have a valid cache entry for a PREMIUM user, return it even if the API call failed
      // This prevents false negatives due to temporary network issues
      if (subscriptionCache && subscriptionCache.status === 'PREMIUM') {
        console.log('[useSubscriptionCheck] Returning cached PREMIUM status due to API error')
        return {
          status: subscriptionCache.status,
          customerId: subscriptionCache.customerId,
          isTrialSubscription: subscriptionCache.isTrialSubscription || false
        }
      }
      
      // Only default to FREE if we have no cache or the cache shows FREE
      return { status: 'FREE', customerId: null, isTrialSubscription: false }
    }
  }

  const updateSubscriptionCache = (
    userEmail: string | null | undefined,
    subscriptionResult: {
      status: string;
      customerId: string | null;
      expiryTimestamp: number | null;
      isTrialSubscription?: boolean;
    }
  ) => {
    if (!userEmail) return;
    
    const now = Date.now();
    const newCache = {
      status: subscriptionResult.status,
      customerId: subscriptionResult.customerId,
      expiryTimestamp: subscriptionResult.expiryTimestamp,
      lastChecked: now,
      isTrialSubscription: subscriptionResult.isTrialSubscription || false
    };
    setSubscriptionCache(newCache);
    // console.log(`>>> Subscription cache updated for user ${userEmail}`);
  }

  // should ideally be called on signin, signout, before redirecting to payment page
  const invalidateSubscriptionCache = () => {
    setSubscriptionCache(null)
    // console.log('>>> Subscription cache invalidated')
  }

  return {
    checkSubscription,
    subscriptionCache,
    updateSubscriptionCache,
    invalidateSubscriptionCache
  }
}
