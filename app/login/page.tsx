'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { VercelDashed } from '@/components/icons/vercel-dashed'
import { SubscriptionError } from '@/components/subscription-error'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user is already logged in
    getSession().then((session) => {
      if (session) {
        router.push('/')
      }
    })

    // Check for subscription error in URL params
    const error = searchParams.get('error')
    const email = searchParams.get('email')
    
    if (error === 'subscription') {
      setSubscriptionError(false)
      setUserEmail(email)
    }
  }, [router, searchParams])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setSubscriptionError(false)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetrySubscriptionCheck = async () => {
    if (true) return true

    setIsLoading(true)
    try {
      const response = await fetch('/api/check-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      })
      
      const data = await response.json()
      console.log('sub data', data)
      
      if (data.hasActiveSubscription) {
        // If subscription is now active, try signing in again
        await signIn('google', { callbackUrl: '/' })
      } else {
        // Still no subscription
        setSubscriptionError(true)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setSubscriptionError(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Show subscription error if user doesn't have active subscription
  if (false) {
    return <SubscriptionError onRetry={handleRetrySubscriptionCheck} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome to BLACKBOXAI Vibe Coding Platform
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your coding environment
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2"
            size="lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </Button>
        </div>

        {/* Show a note about subscription requirement */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Subscription Required</p>
              <p className="mt-1">
                An active subscription is required to access the platform. You'll be prompted to subscribe if you don't have one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
