'use client'

import { lazy, Suspense } from 'react'
import { IconSpinnerNew } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'

const ThreeDSAuthentication = lazy(() => import('./three-ds-authentication').then(module => ({ default: module.ThreeDSAuthentication })))

interface LazyThreeDSAuthenticationProps {
  clientSecret: string
  paymentIntentId: string
  paymentMethodId?: string
  onSuccess: () => void
  onError: (error: string) => void
  onCancel: () => void
}

function ThreeDSAuthenticationFallback() {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="text-center">
        <h3 className="text-sm font-medium mb-2">Loading Authentication...</h3>
        <div className="flex items-center justify-center mb-4">
          <IconSpinnerNew className="h-4 w-4 mr-2" />
          <p className="text-xs text-muted-foreground">
            Preparing secure authentication...
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          disabled
          className="flex-1"
        >
          <IconSpinnerNew className="mr-2 h-4 w-4" />
          Loading...
        </Button>
      </div>
    </div>
  )
}

export function LazyThreeDSAuthentication({
  clientSecret,
  paymentIntentId,
  paymentMethodId,
  onSuccess,
  onError,
  onCancel
}: LazyThreeDSAuthenticationProps) {
  return (
    <Suspense fallback={<ThreeDSAuthenticationFallback />}>
      <ThreeDSAuthentication
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        paymentMethodId={paymentMethodId}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Suspense>
  )
}
