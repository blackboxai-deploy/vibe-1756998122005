'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { IconSpinnerNew } from '@/components/ui/icons'
import { toast } from 'sonner'

interface CardFormProps {
  clientSecret: string
  onSuccess: () => void
  onError: (error: string) => void
}

function CardForm({ clientSecret, onSuccess, onError }: CardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    // Clear any previous errors when starting new submission
    onError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      onError('Card element not found')
      setIsProcessing(false)
      return
    }

    try {
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      })

      if (error) {
        onError(error.message || 'Failed to add payment method')
      } else if (setupIntent?.status === 'succeeded') {
        // Clear the card element after successful submission
        cardElement.clear()
        onSuccess()
      }
    } catch (err) {
      onError('An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-2 border rounded-md bg-background">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '12px',
                color: 'var(--foreground)',
                fontFamily: 'var(--font-mono)',
                fontWeight: '300',
                fontSmoothing: 'antialiased',
                '::placeholder': {
                  color: 'var(--muted-foreground)',
                },
                iconColor: 'var(--muted-foreground)',
              },
              invalid: {
                color: '#ef4444',
                iconColor: '#ef4444',
              },
            },
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <IconSpinnerNew className="mr-2 h-4 w-4" />
            Adding Card...
          </>
        ) : (
          'Add Payment Method'
        )}
      </Button>
    </form>
  )
}

interface CardInputProps {
  onSuccess: () => void
  onError: (error: string) => void
}

export function CardInput({ onSuccess, onError }: CardInputProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null)

  useEffect(() => {
    if (!stripePromise) {
      setStripePromise(loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY!))
    }
  }, [stripePromise])

  useEffect(() => {
    async function createSetupIntent() {
      try {
        const response = await fetch('/api/credits/setup-intent', {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to create setup intent')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret)
      } catch (error) {
        console.error('Error creating setup intent:', error)
        onError('Failed to initialize payment form')
      } finally {
        setIsLoading(false)
      }
    }

    createSetupIntent()
  }, [onError])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-white dark:bg-white rounded animate-pulse border" />
        <div className="h-10 bg-white dark:bg-white rounded animate-pulse border" />
      </div>
    )
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="text-center text-red-500">
        Failed to load payment form
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CardForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}
