'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { IconSpinnerNew } from '@/components/ui/icons'
import { toast } from 'sonner'

interface ThreeDSAuthenticationProps {
  clientSecret: string
  paymentIntentId: string
  paymentMethodId?: string
  onSuccess: () => void
  onError: (error: string) => void
  onCancel: () => void
}

export function ThreeDSAuthentication({
  clientSecret,
  paymentIntentId,
  paymentMethodId,
  onSuccess,
  onError,
  onCancel
}: ThreeDSAuthenticationProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [stripe, setStripe] = useState<any>(null)

  useEffect(() => {
    const initializeStripe = async () => {
      const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY!)
      const stripeInstance = await stripePromise
      setStripe(stripeInstance)
    }
    initializeStripe()
  }, [])

  const handleAuthenticate = async () => {
    if (!stripe) {
      onError('Stripe not initialized')
      return
    }

    setIsProcessing(true)
    onError('') // Clear any previous errors

    try {
      // Use confirmCardPayment with payment method if provided
      const confirmOptions: any = {}
      if (paymentMethodId) {
        confirmOptions.payment_method = paymentMethodId
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, confirmOptions)

      if (error) {
        onError(error.message || 'Authentication failed')
      } else if (paymentIntent?.status === 'succeeded') {
        // Confirm the payment on the server side
        const response = await fetch('/api/credits/confirm-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentIntentId }),
        })

        if (!response.ok) {
          throw new Error('Failed to confirm payment')
        }

        toast.success('Payment completed successfully!')
        onSuccess()
      } else {
        onError('Payment authentication incomplete')
      }
    } catch (err) {
      console.error('3DS authentication error:', err)
      onError('An unexpected error occurred during authentication')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="text-center">
        <h3 className="text-sm font-medium mb-2">Additional Authentication Required</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Your bank requires additional verification to complete this payment. 
          Click the button below to authenticate with your bank.
        </p>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleAuthenticate}
          disabled={!stripe || isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <IconSpinnerNew className="mr-2 h-4 w-4" />
              Authenticating...
            </>
          ) : (
            'Authenticate Payment'
          )}
        </Button>
      </div>
    </div>
  )
}
