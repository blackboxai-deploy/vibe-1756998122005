'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface SubscriptionErrorProps {
  onRetry?: () => void
}

export function SubscriptionError({ onRetry }: SubscriptionErrorProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <div className="flex justify-center mb-6">
          <AlertCircle className="w-16 h-16 text-red-500" />
        </div>
        
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Subscription Required
          </h2>
          <p className="mt-4 text-muted-foreground">
            You need an active subscription to access the Vibe Coding Platform. 
            Please subscribe to continue using our services.
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={() => window.open('https://www.blackbox.ai/pricing', '_blank')}
            className="w-full"
            size="lg"
          >
            Get Subscription
          </Button>
          
          {onRetry && (
            <Button 
              onClick={onRetry}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Try Again
            </Button>
          )}

          <Button 
            onClick={handleSignOut}
            variant="ghost"
            className="w-full flex items-center justify-center space-x-2"
            size="lg"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Try Different Account</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Already have a subscription? It may take a few minutes for your subscription status to update.
        </p>
      </div>
    </div>
  )
}
