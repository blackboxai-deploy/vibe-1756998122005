'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader2, Search, Globe, CreditCard, AlertCircle, CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface BuyDomainModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDomainPurchased?: (domain: string) => void
}

interface DomainResult {
  domain: string
  available: boolean
  price: number | null
  currency: string
  error?: string
}

interface PurchaseResult {
  success: boolean
  domain?: {
    name: string
    id: string
    purchaseDate: string
    price: number
  }
  remainingCredits?: number
  error?: string
}

export function BuyDomainModal({ open, onOpenChange, onDomainPurchased }: BuyDomainModalProps) {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [domains, setDomains] = useState<DomainResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null)
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSearchQuery('')
        setDomains([])
        setSearchError('')
        setPurchasingDomain(null)
        setShowConfirmation(false)
        setSelectedDomain(null)
        setPurchaseResult(null)
      }, 300)
    }
  }, [open])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError('')
    setDomains([])

    try {
      const response = await fetch('/api/vercel/domains/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setDomains(result.domains || [])
        if (result.domains.length === 0) {
          setSearchError('No available domains found for your search term.')
        }
      } else {
        setSearchError(result.error || 'Failed to search domains')
      }
    } catch (error) {
      setSearchError('Network error occurred while searching domains')
    } finally {
      setIsSearching(false)
    }
  }

  const handleBuyClick = (domain: DomainResult) => {
    setSelectedDomain(domain)
    setShowConfirmation(true)
  }

  const handleConfirmPurchase = async () => {
    if (!selectedDomain) return

    setPurchasingDomain(selectedDomain.domain)

    try {
      const response = await fetch('/api/vercel/domains/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: selectedDomain.domain,
          expectedPrice: selectedDomain.price,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setPurchaseResult(result)
        onDomainPurchased?.(selectedDomain.domain)
        setShowConfirmation(false)
      } else {
        setPurchaseResult({
          success: false,
          error: result.error || 'Failed to purchase domain'
        })
        // Don't close confirmation dialog on failure - keep state intact
      }
    } catch (error) {
      setPurchaseResult({
        success: false,
        error: 'Network error occurred while purchasing domain'
      })
      // Don't close confirmation dialog on failure - keep state intact
    } finally {
      setPurchasingDomain(null)
    }
  }

  const handleRetryPurchase = () => {
    setPurchaseResult(null)
    // This will return to the confirmation dialog
  }

  const handleBackToSearch = () => {
    setPurchaseResult(null)
    setShowConfirmation(false)
    setSelectedDomain(null)
    // This will return to the search interface
  }

  const handleClose = () => {
    if (!isSearching && !purchasingDomain) {
      onOpenChange(false)
    }
  }

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null) return 'Price unavailable'
    return `$${price}`
  }

  // Show purchase result
  if (purchaseResult) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {purchaseResult.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Domain Purchased Successfully!
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Purchase Failed
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {purchaseResult.success ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800">
                    {purchaseResult.domain?.name}
                  </p>
                  <p className="text-sm text-green-700">
                    Purchased for ${purchaseResult.domain?.price}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Purchase Date: {purchaseResult.domain?.purchaseDate ? new Date(purchaseResult.domain.purchaseDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                {typeof purchaseResult.remainingCredits === 'number' && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      Remaining Balance: ${purchaseResult.remainingCredits}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">
                    Your domain is now available for use in deployments. DNS and SSL will be automatically configured when you deploy.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  {purchaseResult.error}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {purchaseResult.success ? (
              <Button onClick={handleClose}>
                Done
              </Button>
            ) : (
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={handleBackToSearch}>
                  Back to Search
                </Button>
                <Button onClick={handleRetryPurchase}>
                  Try Again
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Show confirmation dialog
  if (showConfirmation && selectedDomain) {
    return (
      <Dialog open={open} onOpenChange={purchasingDomain ? undefined : () => setShowConfirmation(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {purchasingDomain ? 'Processing Purchase...' : 'Confirm Purchase'}
            </DialogTitle>
            <DialogDescription>
              {purchasingDomain
                ? 'Please don\'t close this window while we process your domain purchase.'
                : 'Are you sure you want to purchase this domain?'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedDomain?.domain}</p>
                  <p className="text-sm text-gray-600">
                    Domain registration
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedDomain.price !== null ? formatPrice(selectedDomain.price, selectedDomain.currency) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">per year</p>
                </div>
              </div>
            </div>

            {purchasingDomain ? (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    Processing your domain purchase. This may take a few moments...
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-sm">
                  This amount will be deducted from your credits.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={!!purchasingDomain}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={!!purchasingDomain}
            >
              {purchasingDomain ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Purchase Domain'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Main search interface
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Buy Domain
          </DialogTitle>
          <DialogDescription>
            Search for available domains and purchase them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter domain name (e.g., myapp)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isSearching}
              className="flex-1"
            />
            <Button
              size={'sm'}
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className=""
            >
              {isSearching ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search />
              )}
            </Button>
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {searchError}
              </p>
            </div>
          )}

          {
            domains?.length > 0 && 
            <p className="text-sm text-gray-600">
              Found {domains.length} available domain{domains.length !== 1 ? 's' : ''}
            </p>
          }
          <div className="space-y-3 h-[400px] overflow-y-auto">
            {
              isSearching ? (
                <div className="flex items-center justify-center h-full py-8">
                  <div className="flex text-sm items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Searching for available domains...
                  </div>
                </div>
              ) : (
                <>
                  {
                    domains?.length > 0 ?
                      <>
                        {domains.map((domain) => (
                          <div
                            key={domain.domain}
                            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-lg text-gray-900">{domain.domain}</p>
                              <p className="text-sm text-gray-500">Available for registration</p>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900">
                                  {domain.price !== null ? formatPrice(domain.price, domain.currency) : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">per year</p>
                              </div>

                              <Button
                                onClick={() => handleBuyClick(domain)}
                                disabled={purchasingDomain === domain.domain || domain.price === null}
                              >
                                {purchasingDomain === domain.domain ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Buying...
                                  </>
                                ) : (
                                  'Buy'
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </> :
                      <div className='flex items-center justify-center h-full w-full'>
                        <div className='text-gray-600 text-xs'>No results found</div>
                      </div>
                  }
                </>
              )
            }
          </div>

          {/* Loading State */}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSearching || !!purchasingDomain}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
