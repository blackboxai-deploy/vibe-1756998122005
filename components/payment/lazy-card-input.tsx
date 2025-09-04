'use client'

import { lazy, Suspense } from 'react'
import { IconSpinnerNew } from '@/components/ui/icons'

const CardInput = lazy(() => import('./card-input').then(module => ({ default: module.CardInput })))

interface LazyCardInputProps {
  onSuccess: () => void
  onError: (error: string) => void
}

function CardInputFallback() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-muted animate-pulse rounded border flex items-center justify-center">
        <IconSpinnerNew className="h-4 w-4" />
      </div>
      <div className="h-10 bg-muted animate-pulse rounded border flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading payment form...</span>
      </div>
    </div>
  )
}

export function LazyCardInput({ onSuccess, onError }: LazyCardInputProps) {
  return (
    <Suspense fallback={<CardInputFallback />}>
      <CardInput onSuccess={onSuccess} onError={onError} />
    </Suspense>
  )
}
