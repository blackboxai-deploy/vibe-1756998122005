'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { IconSpinnerNew } from '@/components/ui/icons'
import { AlertTriangleIcon, CreditCardIcon } from 'lucide-react'
import { LazyThreeDSAuthentication } from './lazy-three-ds-authentication'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
import { LazyCardInput } from './lazy-card-input'
import { sleep } from '@/lib/utils'

interface CreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DISABLE_AUTO_REFILL = true
const DEFAULT_PURCHASE_CREDITS = 10
const CREDIT_WARNING_THRESHOLD = 5

export function CreditsDialog({ open, onOpenChange }: CreditsDialogProps) {
  const { data: session } = useSession()
  const { checkSubscription, invalidateSubscriptionCache } = useSubscriptionCheck()

  const [settings, setSettings] = useState({
    autoFill: {
      enabled: false,
      threshold: 10,
      fillAmount: 50
    }
  })
  const [isChanged, setIsChanged] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null)
  const [showCardInput, setShowCardInput] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [customAmount, setCustomAmount] = useState<number | ''>(DEFAULT_PURCHASE_CREDITS)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [threeDSData, setThreeDSData] = useState<{
    clientSecret: string
    paymentIntentId: string
    paymentMethodId?: string
  } | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (open) {
        setIsLoading(true)
        setError(null)
        try {
          const [creditsResponse] = await Promise.all([
            fetch('/api/credits/get'),
            // fetch('/api/credits/settings/get')
          ])

          if (!creditsResponse.ok) {
            throw new Error('Failed to fetch credits')
          }
          // if (!settingsResponse.ok) {
          //   throw new Error('Failed to fetch settings')
          // }

          const creditsData = await creditsResponse.json()
          // const settingsData = await settingsResponse.json()

          setCredits(creditsData.credits)
          setHasPaymentMethod(creditsData.hasPaymentMethod)
          // setSettings(settingsData.settings)
        } catch (error) {
          console.error('Error fetching data:', error)
          setError('Failed to load credits and settings')
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchData()
  }, [open])

  const handleAutoRefillChange = async (checked: boolean) => {
    const updatedSettings = {
      ...settings,
      autoFill: {
        ...settings.autoFill,
        enabled: checked
      }
    }
    setSettings(updatedSettings)
    setIsChanged(true)
    if (!checked) {
      // if disabled save the state directly
      handleSave(updatedSettings)
    }
  }

  const handleThresholdChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      autoFill: {
        ...prev.autoFill,
        threshold: value
      }
    }))
    setIsChanged(true)
  }

  const handleFillAmountChange = (value: number) => {
    setSettings(prev => ({
      ...prev,
      autoFill: {
        ...prev.autoFill,
        fillAmount: value
      }
    }))
    setIsChanged(true)
  }

  const handleSave = async (newSettings?: typeof settings) => {
    setIsSaving(true)
    try {
      console.log(">>>>>>>> Settings being saved", JSON.stringify(newSettings || settings))
      const response = await fetch('/api/credits/settings/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings || settings),
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      setIsChanged(false)
      toast.success("Successfully saved auto-refill configuration!")
    } catch (error) {
      console.error('Error saving settings:', error)
      setError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCardSuccess = async () => {
    setShowCardInput(false)
    setHasPaymentMethod(true)
    setError(null) // Clear any previous errors
    toast.success('Payment method added successfully!')
    
    // Refresh data to get updated payment method status
    try {
      const creditsResponse = await fetch('/api/credits/get')
      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json()
        setCredits(creditsData.credits)
        setHasPaymentMethod(creditsData.hasPaymentMethod)
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    }
  }

  const handleCardError = (error: string) => {
    // Only set error if it's not empty (to allow clearing)
    if (error) {
      setError(error)
      toast.error(error)
    } else {
      setError(null)
    }
  }

  const handlePurchaseCredits = async () => {
    if (customAmount === '' || Number(customAmount) <= 0) return

    // Check if user has payment method before allowing purchase
    if (!hasPaymentMethod) {
      setShowCardInput(true)
      return
    }

    setIsPurchasing(true)
    setError(null)
    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: customAmount }),
      })

      if (!response.ok) {
        throw new Error('Failed to purchase credits')
      }

      toast.info("Gathering payment information ...")
      invalidateSubscriptionCache()
      checkSubscription(session?.user.email)

      const data = await response.json()

      // Check if 3DS authentication is required
      if (data.requiresAction) {
        setThreeDSData({
          clientSecret: data.clientSecret,
          paymentIntentId: data.paymentIntentId,
          paymentMethodId: data.paymentMethodId
        })
        setIsPurchasing(false)
        return
      }

      // If successful without 3DS
      if (data.success) {
        await handlePurchaseSuccess()
      } else {
        throw new Error('Purchase failed')
      }
    } catch (error) {
      console.error('Error purchasing credits:', error)
      setError('Failed to purchase credits')
    } finally {
      setIsPurchasing(false)
    }
  }

  const handlePurchaseSuccess = async () => {
    try {
      // Refresh credits display after purchase
      await checkSubscription(session?.user.email, true)
      await sleep(5000) // minor sleep to ensure credits reflect by then
      const creditsResponse = await fetch('/api/credits/get')
      if (!creditsResponse.ok) {
        throw new Error('Failed to fetch updated credits')
      }
      const creditsData = await creditsResponse.json()
      setCredits(creditsData.credits)

      setCustomAmount(DEFAULT_PURCHASE_CREDITS) // Reset input after successful purchase
      setThreeDSData(null) // Clear 3DS data
      toast.success(`Successfully purchased ${customAmount} credits!`)
    } catch (error) {
      console.error('Error refreshing credits:', error)
      setError('Purchase completed but failed to refresh credits')
    }
  }

  const handle3DSSuccess = () => {
    handlePurchaseSuccess()
  }

  const handle3DSError = (error: string) => {
    setError(error)
    setThreeDSData(null)
  }

  const handle3DSCancel = () => {
    setThreeDSData(null)
    setError(null)
  }

  const formatCredits = (amount: number | null) => {
    if (amount === null) return 'N/A'
    return `$${amount.toFixed(2)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
        </DialogHeader>
        <div className="py-4 min-h-[160px]">
          {credits !== null && credits < CREDIT_WARNING_THRESHOLD && (
            <div className="mb-4 p-3 bg-transparent border rounded-md flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 text-slate-300 shrink-0" />
              <p className="text-sm font-medium">
                Warning: Add more credits before running out.
              </p>
            </div>
          )}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            {isLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <p className="text-2xl font-bold h-8">{formatCredits(credits)}</p>
            )}
          </div>

          {/* Payment Method Status */}
          {!isLoading && hasPaymentMethod === false && !showCardInput && (
            <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md flex items-center gap-2">
              <CreditCardIcon className="h-4 w-4 text-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  No payment method on file
                </p>
                <p className="text-xs text-muted-foreground">
                  Add a payment method to purchase credits
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCardInput(true)}
              >
                Add Card
              </Button>
            </div>
          )}

          {/* Card Input Section */}
          {showCardInput && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/30">
              <div className="mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CreditCardIcon className="h-4 w-4" />
                  Add Payment Method
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Your card information is securely processed by Stripe
                </p>
              </div>
              <LazyCardInput
                onSuccess={handleCardSuccess}
                onError={handleCardError}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCardInput(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* 3DS Authentication Section */}
          {threeDSData && (
            <div className="mb-4">
              <LazyThreeDSAuthentication
                clientSecret={threeDSData.clientSecret}
                paymentIntentId={threeDSData.paymentIntentId}
                paymentMethodId={threeDSData.paymentMethodId}
                onSuccess={handle3DSSuccess}
                onError={handle3DSError}
                onCancel={handle3DSCancel}
              />
            </div>
          )}

          <div className={`space-y-4 ${!DISABLE_AUTO_REFILL ? 'border-b pb-4 mb-4' : ''}`}>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {isLoading ? (
                  <div className="mb-1 h-4 w-28 bg-muted animate-pulse rounded" />
                ) : (
                  'Purchase Credits'
                )}
              </label>
              {isLoading ? (
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value
                      const nativeEvent = e.nativeEvent as InputEvent
                      if (nativeEvent.inputType === 'deleteContentBackward' && value === '') {
                        setCustomAmount('')
                      } else if (value === '') {
                        setCustomAmount(customAmount)
                      } else {
                        setCustomAmount(Number(value))
                      }
                    }}
                    className="flex-1 p-2 border rounded"
                    min="1"
                    step="1"
                    placeholder="Enter amount ($)"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isLoading ? (
                  <div className="h-4 w-60 bg-muted animate-pulse rounded" />
                ) : (
                  'Add custom amount of credits to your account'
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              {/* <Button
                variant="outline"
                onClick={() => window.open('/manage-subscriptions', '_blank')}
              >
                Manage Billing
              </Button> */}
              <Button
                onClick={handlePurchaseCredits}
                disabled={isPurchasing || customAmount === '' || Number(customAmount) <= 0 || threeDSData !== null}
              >
                {isPurchasing ? (
                  <>
                    <IconSpinnerNew />
                    <span className="ml-2">Purchasing...</span>
                  </>
                ) : threeDSData ? (
                  'Complete Authentication Above'
                ) : hasPaymentMethod === false ? (
                  'Add Card & Purchase'
                ) : (
                  'Purchase'
                )}
              </Button>
            </div>
          </div>
          {!DISABLE_AUTO_REFILL && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium">
                  {isLoading ? (
                    <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                  ) : (
                    'Auto-Refill'
                  )}
                </h3>
                <p className="text-sm text-muted-foreground h-5">
                  {isLoading ? (
                    <div className="h-4 w-64 bg-muted animate-pulse rounded" />
                  ) : (
                    'Automatically refill credits when balance is low'
                  )}
                </p>
              </div>
              {isLoading ? (
                <div className="h-6 w-11 bg-muted animate-pulse rounded-full" />
              ) : (
                <Switch
                  checked={settings.autoFill.enabled}
                  onCheckedChange={handleAutoRefillChange}
                />
              )}
            </div>

            {settings.autoFill.enabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {isLoading ? (
                      <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      'Threshold ($)'
                    )}
                  </label>
                  {isLoading ? (
                    <div className="h-10 w-full bg-muted animate-pulse rounded" />
                  ) : (
                    <input
                      type="number"
                      value={settings.autoFill.threshold}
                      onChange={(e) => handleThresholdChange(Number(e.target.value))}
                      className="w-full p-2 border rounded"
                      min="1"
                      step="1"
                    />
                  )}
                  <p className="text-xs text-muted-foreground h-4">
                    {isLoading ? (
                      <div className="h-4 w-60 bg-muted animate-pulse rounded" />
                    ) : (
                      'Refill when balance falls below this amount'
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {isLoading ? (
                      <div className="h-5 w-28 bg-muted animate-pulse rounded" />
                    ) : (
                      'Fill Amount ($)'
                    )}
                  </label>
                  {isLoading ? (
                    <div className="h-10 w-full bg-muted animate-pulse rounded" />
                  ) : (
                    <input
                      type="number"
                      value={settings.autoFill.fillAmount}
                      onChange={(e) => handleFillAmountChange(Number(e.target.value))}
                      className="w-full p-2 border rounded"
                      min="1"
                      step="1"
                    />
                  )}
                  <p className="text-xs text-muted-foreground h-4">
                    {isLoading ? (
                      <div className="h-4 w-44 bg-muted animate-pulse rounded" />
                    ) : (
                      'Amount to add when refilling'
                    )}
                  </p>
                </div>
              </>
            )}
          </div>}
          {!DISABLE_AUTO_REFILL && settings.autoFill.enabled && (
            <div className="flex justify-end gap-3 mt-4">
              <Button
                onClick={() => handleSave()}
                disabled={isSaving || !isChanged}
              >
                {isSaving ? (
                  <>
                    <IconSpinnerNew />
                    Saving...
                  </>
                ) : (
                  'Save Config'
                )}
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
