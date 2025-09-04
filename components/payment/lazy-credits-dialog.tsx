'use client'

import { lazy, Suspense } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconSpinnerNew } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'

const CreditsDialog = lazy(() => import('./credits-dialog').then(module => ({ default: module.CreditsDialog })))

interface LazyCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreditsDialogFallback({ open, onOpenChange }: LazyCreditsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
        </DialogHeader>
        <div className="py-4 min-h-[160px] flex flex-col items-center justify-center space-y-4">
          <IconSpinnerNew className="h-8 w-8" />
          <div className="text-center">
            <p className="text-sm font-medium">Loading Credits...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preparing payment system...
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LazyCreditsDialog({ open, onOpenChange }: LazyCreditsDialogProps) {
  return (
    <Suspense fallback={<CreditsDialogFallback open={open} onOpenChange={onOpenChange} />}>
      <CreditsDialog open={open} onOpenChange={onOpenChange} />
    </Suspense>
  )
}
