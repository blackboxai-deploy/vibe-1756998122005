'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle, ExternalLink, Copy, Check, AlertCircle, Globe, ShoppingCart, AlertCircleIcon } from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { useSession } from 'next-auth/react'
import { BuyDomainModal } from './buy-domain'
import { BuildErrorDisplay } from '@/components/build-error-display'
import { PublishToGalleryModal } from './publish-to-gallery'

interface DeployVercelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DeploymentResult {
  success: boolean
  deploymentUrl?: string
  projectName?: string
  error?: string
  buildFailed?: boolean
  customDomain?: {
    domain: string
    verification: Array<{
      type: string
      domain: string
      value: string
      reason: string
    }>
    error?: string
    isPurchased?: boolean
    autoVerifying?: boolean
  }
}

interface DomainVerificationState {
  isVerifying: boolean
  verified: boolean
  error?: string
  attemptCount?: number
}

interface PublishedAppInfo {
  _id: string
  title: string
  description: string
  category: string
  createdAt: string
  updatedAt: string
}

export function DeployVercelModal({ open, onOpenChange }: DeployVercelModalProps) {
  const { data: session } = useSession()
  const { 
    sandboxId, 
    deploymentUrl, 
    setDeploymentUrl, 
    customDomain, 
    setCustomDomain, 
    verifyCustomDomain,
    getDisplayUrl,
    saveDeploymentUrlToSession
  } = useSandboxStore()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Local state for UI
  const [useCustomDomain, setUseCustomDomain] = useState(false)
  const [customDomainInput, setCustomDomainInput] = useState('')
  const [domainError, setDomainError] = useState('')
  
  // Domain purchase state
  const [showBuyDomainModal, setShowBuyDomainModal] = useState(false)
  const [purchasedDomains, setPurchasedDomains] = useState<Array<{
    domain: string
    purchaseDate: string
    price: number
    vercelDomainId?: string
  }>>([])
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [domainSelectionMode, setDomainSelectionMode] = useState<'input' | 'purchased'>('input')
  
  // Publish to gallery state
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [isAppPublished, setIsAppPublished] = useState(false)
  const [checkingPublishStatus, setCheckingPublishStatus] = useState(false)
  const [publishedAppInfo, setPublishedAppInfo] = useState<PublishedAppInfo | null>(null)
  
  const [domainVerification, setDomainVerification] = useState<DomainVerificationState>({
    isVerifying: false,
    verified: customDomain?.verified || false,
    attemptCount: 0,
  })

  // Polling control
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxAttempts = 200 // 200 attempts * 3 seconds = 10 minutes
  const pollingInterval = 3000 // 3 seconds

  // Load purchased domains
  const loadPurchasedDomains = async () => {
    if (!session?.user?.email) return
    
    setLoadingDomains(true)
    try {
      const response = await fetch('/api/vercel/domains/user')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPurchasedDomains(result.domains || [])
        }
      }
    } catch (error) {
      console.error('Failed to load purchased domains:', error)
    } finally {
      setLoadingDomains(false)
    }
  }

  // Check if app is already published
  const checkAppPublishStatus = async (appUrl: string) => {
    if (!appUrl) return

    setCheckingPublishStatus(true)
    try {
      const response = await fetch(`/api/gallery/check-published?appUrl=${encodeURIComponent(appUrl)}`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        setIsAppPublished(result.isPublished)
        setPublishedAppInfo(result.app)
      }
    } catch (error) {
      console.error('Failed to check app publish status:', error)
      // Default to false if check fails
      setIsAppPublished(false)
      setPublishedAppInfo(null)
    } finally {
      setCheckingPublishStatus(false)
    }
  }

  // Load from global state and sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUseCustomDomain = sessionStorage.getItem('useCustomDomain')
      const savedCustomDomain = sessionStorage.getItem('customDomain')
      
      if (savedUseCustomDomain) {
        setUseCustomDomain(JSON.parse(savedUseCustomDomain))
      }
      if (savedCustomDomain) {
        setCustomDomainInput(savedCustomDomain)
      }
      
      // Initialize from global state if available
      if (customDomain?.domain) {
        setCustomDomainInput(customDomain.domain)
        setUseCustomDomain(true)
        setDomainVerification(prev => ({
          ...prev,
          verified: customDomain.verified
        }))
      }
    }
  }, [customDomain])

  // Load purchased domains when modal opens
  useEffect(() => {
    if (open && session?.user?.email) {
      loadPurchasedDomains()
    }
  }, [open, session?.user?.email])

  // Auto-verify domain when modal opens if custom domain exists
  useEffect(() => {
    if (open && customDomain?.domain && customDomain?.projectName) {
      // Auto-verify the domain when modal opens
      handleAutoVerifyDomain()
    }
  }, [open, customDomain?.domain, customDomain?.projectName])

  // Check publish status when modal opens and there's a deployment URL
  useEffect(() => {
    if (open && session?.user?.email) {
      const currentUrl = deploymentUrl
      if (currentUrl) {
        checkAppPublishStatus(currentUrl)
      }
    }
  }, [open, session?.user?.email, deploymentUrl])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Domain validation function
  const validateDomain = (domain: string): string => {
    if (!domain.trim()) {
      return ''
    }

    // Check for protocols
    const protocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//
    if (protocolRegex.test(domain)) {
      return 'Domain should not include protocol (http://, https://, etc.)'
    }

    // Check for other protocols without ://
    const otherProtocolRegex = /^(ftp|ws|wss|file|mailto):/
    if (otherProtocolRegex.test(domain)) {
      return 'Domain should not include protocol'
    }

    // Basic domain format validation
    // No spaces, must contain at least one dot, valid characters only
    if (/\s/.test(domain)) {
      return 'Domain cannot contain spaces'
    }

    if (!domain.includes('.')) {
      return 'Domain must contain at least one dot (e.g., example.com)'
    }

    // Check for valid domain characters (letters, numbers, dots, hyphens)
    const validDomainRegex = /^[a-zA-Z0-9.-]+$/
    if (!validDomainRegex.test(domain)) {
      return 'Domain contains invalid characters'
    }

    // Check for subdomain (more than one level of dots indicates subdomain)
    const parts = domain.split('.')
    if (parts.length > 2) {
      return 'Only root domains are allowed (no subdomains)'
    }

    // Check that it doesn't start or end with dot or hyphen
    if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) {
      return 'Domain format is invalid'
    }

    // Check for consecutive dots or hyphens
    if (domain.includes('..') || domain.includes('--')) {
      return 'Domain format is invalid'
    }

    return ''
  }

  // Handle domain purchase completion
  const handleDomainPurchased = (domain: string) => {
    // Refresh the purchased domains list
    loadPurchasedDomains()
    // Switch to purchased domain mode and select the new domain
    setDomainSelectionMode('purchased')
    setCustomDomainInput(domain)
    // Close the buy domain modal
    setShowBuyDomainModal(false)
  }

  // Persist to sessionStorage when values change
  const handleSetUseCustomDomain = (use: boolean) => {
    setUseCustomDomain(use)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('useCustomDomain', JSON.stringify(use))
    }
    // Clear domain error when toggling off
    if (!use) {
      setDomainError('')
    }
  }

  const handleSetCustomDomain = (domain: string) => {
    setCustomDomainInput(domain)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('customDomain', domain)
    }
    // Clear error when user is typing (validation happens on deploy)
    if (domainError) {
      setDomainError('')
    }
  }

  // Auto-verify domain function
  const handleAutoVerifyDomain = async () => {
    if (!customDomain?.domain || !customDomain?.projectName) return

    setDomainVerification(prev => ({ 
      ...prev, 
      isVerifying: true, 
      error: undefined,
      attemptCount: 0
    }))

    try {
      const result = await verifyCustomDomain(customDomain.projectName, customDomain.domain)
      setDomainVerification(prev => ({
        ...prev,
        isVerifying: false,
        verified: result.verified,
        error: result.error
      }))
    } catch (error) {
      setDomainVerification(prev => ({
        ...prev,
        isVerifying: false,
        verified: false,
        error: 'Failed to verify domain'
      }))
    }
  }

  const verifyDomainOnce = async (): Promise<{ verified: boolean; error?: string }> => {
    if (!deploymentResult?.customDomain?.domain || !deploymentResult?.projectName) {
      return { verified: false, error: 'Missing domain or project information' }
    }

    try {
      const response = await fetch('/api/vercel/domain/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: deploymentResult.projectName,
          domain: deploymentResult.customDomain.domain,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        return {
          verified: result.verified,
          error: result.error
        }
      } else {
        return {
          verified: false,
          error: result.error || 'Failed to verify domain'
        }
      }
    } catch (error) {
      return {
        verified: false,
        error: 'Network error occurred while verifying domain'
      }
    }
  }

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    let attemptCount = 0

    const poll = async () => {
      attemptCount++
      
      setDomainVerification(prev => ({
        ...prev,
        attemptCount
      }))

      const result = await verifyDomainOnce()

      if (result.verified) {
        // Success - stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        
        setDomainVerification(prev => ({
          ...prev,
          isVerifying: false,
          verified: true,
          error: undefined,
          attemptCount
        }))
      } else if (attemptCount >= maxAttempts) {
        // Max attempts reached - stop polling and show error
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        
        setDomainVerification(prev => ({
          ...prev,
          isVerifying: false,
          verified: false,
          error: 'Domain verification failed after 10 minutes. Please ensure DNS records are properly configured and try again.',
          attemptCount
        }))
      }
      // If not verified and haven't reached max attempts, continue polling
    }

    // Start immediate first check
    poll()

    // Set up interval for subsequent checks
    pollingIntervalRef.current = setInterval(poll, pollingInterval)
  }

  const handleVerifyDomain = async () => {
    if (!deploymentResult?.customDomain?.domain || !deploymentResult?.projectName) return

    setDomainVerification(prev => ({ 
      ...prev, 
      isVerifying: true, 
      error: undefined,
      attemptCount: 0
    }))

    startPolling()
  }

  const handleCancelVerification = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setDomainVerification(prev => ({
      ...prev,
      isVerifying: false,
      error: undefined,
      attemptCount: 0
    }))
  }

  const handleDeploy = async () => {
    if (!sandboxId) return

    // Validate custom domain if enabled
    if (useCustomDomain) {
      const error = validateDomain(customDomainInput)
      if (error) {
        setDomainError(error)
        return
      }
    }

    setIsDeploying(true)
    setDeploymentResult(null)
    setDomainError('') // Clear any previous errors

    try {
      const deployPayload: {
        sandboxId: string
        customDomain?: string
      } = {
        sandboxId,
      }

      if (useCustomDomain && customDomainInput.trim()) {
        deployPayload.customDomain = customDomainInput.trim()
      }

      const response = await fetch('/api/vercel/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deployPayload),
      })

      const result = await response.json()

      if (response.ok) {
        setDeploymentResult(result)
        // Save deployment URL to state
        if (result.deploymentUrl) {
          setDeploymentUrl(result.deploymentUrl)
        }
        // Save custom domain to global state if domain was added
        if (result.customDomain && result.projectName) {
          setCustomDomain({
            domain: result.customDomain.domain,
            verified: false,
            projectName: result.projectName,
            lastVerified: undefined
          })
          setDomainVerification({
            isVerifying: false,
            verified: false,
            attemptCount: 0,
          })
        }

        // Save deployment URLs to current chat session
        const deploymentUrlToSave = result.deploymentUrl
        const customDomainToSave = result.customDomain?.domain
        if (deploymentUrlToSave || customDomainToSave) {
          saveDeploymentUrlToSession(deploymentUrlToSave, customDomainToSave)
            .catch(error => {
              console.error('Failed to save deployment URLs to chat session:', error)
            })
        }
      } else {
        setDeploymentResult({
          success: false,
          error: result.error || 'Failed to deploy to BLACKBOX',
        })
      }
    } catch (error) {
      setDeploymentResult({
        success: false,
        error: 'Network error occurred while deploying',
      })
    } finally {
      setIsDeploying(false)
    }
  }

  const handleClose = () => {
    if (!isDeploying && !domainVerification.isVerifying) {
      onOpenChange(false)
      // Reset state after a delay to allow for smooth closing animation
      // Note: We don't reset useCustomDomain and customDomain anymore to persist them
      setTimeout(() => {
        setDeploymentResult(null)
        setCopied(false)
        setDomainVerification({
          isVerifying: false,
          verified: false,
          attemptCount: 0,
        })
      }, 300)
    }
  }

  const handleCopyUrl = async () => {
    // Use the global state's display URL logic
    const urlToCopy = getDisplayUrl()

    if (urlToCopy) {
      try {
        await navigator.clipboard.writeText(urlToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy URL:', err)
      }
    }
  }

  const handleOpenUrl = () => {
    // Use the global state's display URL logic
    const urlToOpen = getDisplayUrl() || deploymentResult?.deploymentUrl

    if (urlToOpen) {
      window.open(urlToOpen, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Deploy
          </DialogTitle>
          <DialogDescription className='text-left'>
            Publish your app to show the entire world.
          </DialogDescription>
        </DialogHeader>

        {/* Custom Domain Configuration */}
        {!deploymentResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">Buy a Domain or use your own</span>
                </div>
                <p className="text-xs text-gray-500">
                  Buy a domain to deploy or use yours
                </p>
              </div>
              <Switch
                checked={useCustomDomain}
                onCheckedChange={handleSetUseCustomDomain}
                disabled={isDeploying}
              />
            </div>

            {useCustomDomain && (
              <div className="space-y-3">
                {/* Domain Input with Separate Dropdown */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="example.com"
                      value={customDomainInput}
                      onChange={(e) => handleSetCustomDomain(e.target.value)}
                      disabled={isDeploying}
                      className={`flex-1 rounded-sm text-sm ${domainError ? 'border-red-500 focus:border-red-500' : ''}`}
                    />
                    
                    {/* Dropdown for purchased domains */}
                    <Select
                      value=""
                      onValueChange={handleSetCustomDomain}
                      disabled={isDeploying}
                    >
                      <SelectTrigger className="pl-0 pr-2">
                        <SelectValue /> 
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDomains ? (
                          <div className="flex items-center gap-2 p-2 text-sm text-gray-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading purchased domains...</span>
                          </div>
                        ) : purchasedDomains.length > 0 ? (
                          purchasedDomains.map((domain) => (
                            <SelectItem key={domain.domain} value={domain.domain}>
                              <div className="flex items-center justify-between w-full">
                                <span>{domain.domain}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {new Date(domain.purchaseDate).toLocaleDateString()}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-3 text-sm text-gray-500 text-center">
                            No purchased domains found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <span className='mx-1 text-gray-600 text-xs text-center'>OR</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBuyDomainModal(true)}
                      disabled={isDeploying}
                      className="px-3"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Buy Domain
                    </Button>
                  </div>
                  
                  {domainError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {domainError}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    Enter your root domain without protocol (e.g., example.com) or select from dropdown
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show existing deployment URL if available */}
        {deploymentUrl && !deploymentResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-xs break-all">
                    {deploymentUrl}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="h-8 w-8 p-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(deploymentUrl, '_blank')}
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Publish to Gallery Button for existing deployments */}
            {session?.user?.email && (
              <div className="space-y-2">
                {/* Published Status Indicator */}
                {isAppPublished && publishedAppInfo && !checkingPublishStatus && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800 font-medium">Already Published in Gallery</p>
                      <p className="text-xs text-green-700"> {publishedAppInfo.title} - {publishedAppInfo.category}</p>
                    </div>
                  </div>
                )}
                
                {
                  !isAppPublished && 
                  <div className="flex items-center justify-center">
                    {checkingPublishStatus ? (
                      <Button
                        disabled
                        variant="outline"
                        className="w-full"
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking publish status...
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowPublishModal(true)}
                        variant="outline"
                        className="w-full"
                      >
                        Publish to Gallery
                      </Button>
                    )}
                  </div>
                }
              </div>
            )}
          </div>
        )}

        {deploymentResult ? (
          <div className="space-y-4">
            {deploymentResult.success ? (
              <div className="space-y-4">
                {/* Success Message */}
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Deployment successful!
                    </p>
                  </div>
                </div>

                {/* Live URL with copy functionality */}
                {deploymentResult.deploymentUrl && (
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="flex-1 items-center">
                      <p className="text-xs text-gray-600 break-all">
                        {getDisplayUrl() || deploymentResult.deploymentUrl}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyUrl}
                        className="h-8 w-8 p-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenUrl}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Publish to Gallery Button */}
                {deploymentResult.deploymentUrl && session?.user?.email && (
                  <div className="space-y-2">
                    {/* Published Status Indicator */}
                    {isAppPublished && publishedAppInfo && !checkingPublishStatus && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm text-green-800 font-medium">Already in Gallery</p>
                          <p className="text-xs text-green-700">{publishedAppInfo.title} - {publishedAppInfo.category}</p>
                        </div>
                      </div>
                    )}
                    
                    {
                      !isAppPublished && 
                      <div className="flex items-center justify-center">
                        {checkingPublishStatus ? (
                          <Button
                            disabled
                            variant="outline"
                            className="w-full"
                          >
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Checking publish status...
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setShowPublishModal(true)}
                            variant="outline"
                            className="w-full"
                          >
                            Publish to Gallery
                          </Button>
                        )}
                      </div>
                    }
                    
                  </div>
                )}

                {/* Custom Domain Configuration and Verification */}
                {deploymentResult.customDomain && (
                  <div className="space-y-4">
                    {/* Domain Status Header */}
                    {deploymentResult.customDomain.error ? (
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-red-800 dark:text-red-200">
                              Domain Setup Error: {deploymentResult.customDomain.domain}
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                              {deploymentResult.customDomain.error}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-lg border ${
                        deploymentResult.customDomain?.autoVerifying 
                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                          : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                      }`}>
                        <div className="flex items-start gap-3">
                          <Globe className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                            deploymentResult.customDomain?.autoVerifying
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`} />
                          <div className="flex-1">
                            <p className={`font-medium ${
                              deploymentResult.customDomain?.autoVerifying
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-blue-800 dark:text-blue-200'
                            }`}>
                              Custom Domain Added: {deploymentResult.customDomain.domain}
                            </p>
                            <p className={`text-sm mt-1 ${
                              deploymentResult.customDomain?.autoVerifying
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-blue-700 dark:text-blue-300'
                            }`}>
                              {deploymentResult.customDomain?.autoVerifying 
                                ? 'This domain was purchased with Vercel as registrar and should verify automatically within a few minutes.'
                                : 'Please add the following DNS records to your domain:'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DNS Records - A Records - Only show for non-auto-verifying domains */}
                    {!deploymentResult.customDomain.error && !deploymentResult.customDomain?.autoVerifying && (
                      <div className="space-y-3">
                        {/* A Record */}
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">Type: A</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText('76.76.21.21')}
                                className="h-6 w-6 p-0"
                                title="Copy A record value"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-600">Name: @ (or leave blank for root domain)</p>
                              <p className="text-xs text-gray-600 break-all font-mono bg-white p-1 rounded border">
                                Value: 76.76.21.21
                              </p>
                              <p className="text-xs text-gray-500">Points your domain to our servers</p>
                            </div>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-blue-800">
                              Add these DNS records to your domain provider&apos;s DNS settings.
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              DNS changes may take up to 24 hours to propagate. Once added, click verify below.
                            </p>
                          </div>
                        </div>

                        {/* Verification Status */}
                        <div className="space-y-3">
                          {domainVerification.verified ? (
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-800">Domain verified successfully!</span>
                            </div>
                          ) : domainVerification.error ? (
                            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                              <span className="text-sm text-red-800">{domainVerification.error}</span>
                            </div>
                          ) : domainVerification.isVerifying ? (
                            <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                              <Loader2 className="h-4 w-4 text-yellow-600 mt-0.5 animate-spin" />
                              <div className="flex-1">
                                <p className="text-sm text-yellow-800">
                                  Verifying domain...
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">
                                  This may take around 15-20 minutes, be patient. DNS changes can take time to propagate.
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {domainVerification.isVerifying ? (
                            <Button
                              onClick={handleCancelVerification}
                              className="w-full"
                              variant="outline"
                            >
                              Cancel Verification
                            </Button>
                          ) : (
                            <Button
                              onClick={handleVerifyDomain}
                              disabled={domainVerification.verified || !deploymentResult?.projectName}
                              className="w-full"
                              variant={domainVerification.verified ? "outline" : "default"}
                            >
                              {domainVerification.verified ? (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Verified
                                </>
                              ) : (
                                'Verify Domain'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Auto-verification message for purchased domains */}
                    {!deploymentResult.customDomain.error && deploymentResult.customDomain?.autoVerifying && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-green-800 font-medium">
                              Automatic Verification Enabled
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Since this domain was purchased with Vercel as the registrar, DNS records are automatically configured and the domain should verify within a few minutes. No manual DNS setup required!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {deploymentResult.buildFailed ? (
                  // Use the new BuildErrorDisplay component for build failures
                  <BuildErrorDisplay 
                    error={deploymentResult.error || 'Build failed with unknown error'} 
                  />
                ) : (
                  // Keep the existing simple error display for non-build failures
                  <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        Failed to deploy
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {deploymentResult.error}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !deploymentUrl ? (
          <div className="space-y-4">
            {!sandboxId && (
              <div className="bg-red-50 flex flex-row items-center gap-x-2 p-3 border border-border rounded-lg">
                <AlertCircleIcon className='text-red-600' size={14} />
                <p className="text-sm text-red-600">
                  No active sandbox found. Please create a sandbox with files first.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isDeploying || domainVerification.isVerifying}
          >
            Cancel
          </Button>
            <Button
              onClick={handleDeploy}
              disabled={!sandboxId || isDeploying || (useCustomDomain && (!customDomainInput.trim() || !!domainError))}
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {deploymentUrl ? 'Redeploying...' : 'Deploying...'}
                </>
              ) : (
                <>
                  {deploymentUrl ? 'Redeploy to BLACKBOX' : deploymentResult ? 'Retry' : 'Deploy to BLACKBOX'}
                </>
              )}
            </Button>
        </DialogFooter>
      </DialogContent>

      {/* Buy Domain Modal */}
      <BuyDomainModal
        open={showBuyDomainModal}
        onOpenChange={setShowBuyDomainModal}
        onDomainPurchased={handleDomainPurchased}
      />

      {/* Publish to Gallery Modal */}
      <PublishToGalleryModal
        open={showPublishModal && !!deploymentResult?.deploymentUrl}
        onOpenChange={setShowPublishModal}
        appUrl={deploymentResult?.deploymentUrl || ''}
        sandboxId={sandboxId}
        onPublishSuccess={() => {
          // Update publish status to reflect that the app is now published
          const currentUrl = deploymentResult?.deploymentUrl
          if (currentUrl) {
            checkAppPublishStatus(currentUrl)
          }
        }}
      />
    </Dialog>
  )
}
