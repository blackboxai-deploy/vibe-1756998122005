'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle, AlertCircleIcon } from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { useSession } from 'next-auth/react'
import { BuildErrorDisplay } from '@/components/build-error-display'
import { APP_CATEGORIES, PublishFormData } from '@/lib/types'

interface PublishModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DeploymentResult {
  success: boolean
  deploymentUrl?: string
  error?: string
  buildFailed?: boolean
}

interface PublishResult {
  success: boolean
  error?: string
}

type Step = 'publish-form' | 'deploying' | 'publishing' | 'complete'

export function PublishModal({ open, onOpenChange }: PublishModalProps) {
  const { data: session } = useSession()
  const { sandboxId, setDeploymentUrl } = useSandboxStore()

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('publish-form')
  
  // Deploy state
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  
  // Publish state
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [publishFormData, setPublishFormData] = useState<PublishFormData>({
    title: '',
  })
  const [publishErrors, setPublishErrors] = useState<Partial<PublishFormData>>({})

  // Validate publish form
  const validatePublishForm = (): boolean => {
    const newErrors: Partial<PublishFormData> = {}

    if (!publishFormData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (publishFormData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters'
    } else if (publishFormData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters'
    }

    setPublishErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle publish - first deploy, then publish
  const handlePublish = async () => {
    if (!validatePublishForm() || !sandboxId) {
      return
    }

    // Step 1: Deploy the app
    setCurrentStep('deploying')
    setDeploymentResult(null)
    setPublishResult(null)
    
    try {
      const deployResponse = await fetch('/api/vercel/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sandboxId }),
      })

      const deployResult = await deployResponse.json()

      if (!deployResponse.ok || !deployResult.success) {
        setDeploymentResult({
          success: false,
          error: deployResult.error || 'Failed to deploy app',
          buildFailed: deployResult.buildFailed
        })
        setCurrentStep('publish-form')
        return
      }

      // Deployment successful
      setDeploymentResult(deployResult)
      if (deployResult.deploymentUrl) {
        setDeploymentUrl(deployResult.deploymentUrl)
      }

      // Step 2: Publish to gallery
      setCurrentStep('publishing')

      const publishResponse = await fetch('/api/gallery/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...publishFormData,
          appUrl: deployResult.deploymentUrl,
          sandboxId
        }),
      })

      const publishResult = await publishResponse.json()

      if (publishResponse.ok && publishResult.success) {
        setPublishResult({ success: true })
        setCurrentStep('complete')
      } else {
        setPublishResult({
          success: false,
          error: publishResult.error || 'Failed to publish app'
        })
        setCurrentStep('publish-form')
      }
    } catch (error) {
      setPublishResult({
        success: false,
        error: 'Network error occurred during deployment or publishing'
      })
      setCurrentStep('publish-form')
    }
  }

  // Handle close
  const handleClose = () => {
    if (currentStep === 'deploying' || currentStep === 'publishing') {
      return // Don't allow closing during operations
    }
    
    onOpenChange(false)
    // Reset state after a delay
    setTimeout(() => {
      setCurrentStep('publish-form')
      setDeploymentResult(null)
      setPublishResult(null)
      setPublishFormData({ title: '' })
      setPublishErrors({})
    }, 300)
  }

  // Handle publish form input change
  const handlePublishInputChange = (field: keyof PublishFormData, value: string) => {
    setPublishFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (publishErrors[field]) {
      setPublishErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className='text-left'>
            Publish to Gallery
          </DialogTitle>
          <DialogDescription className='text-left'>
            Publish your app to the community gallery for everyone to see.
          </DialogDescription>
        </DialogHeader>

        {/* Publish Form Step */}
        {currentStep === 'publish-form' && (
          <div className="space-y-4">
            {/* Title Field */}
            <div className="space-y-2">
              <Input
                id="title"
                placeholder="Enter app title"
                value={publishFormData.title}
                onChange={(e) => handlePublishInputChange('title', e.target.value)}
                className={publishErrors.title ? 'border-red-500 focus:border-red-500' : ''}
              />
              {publishErrors.title && (
                <p className="text-xs text-red-600">{publishErrors.title}</p>
              )}
            </div>

            {/* Deployment Error */}
            {deploymentResult && !deploymentResult.success && (
              <div className="space-y-4">
                {deploymentResult.buildFailed ? (
                  <BuildErrorDisplay 
                    error={deploymentResult.error || 'Build failed with unknown error'} 
                  />
                ) : (
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

            {/* Publish Error */}
            {publishResult && !publishResult.success && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Failed to publish app
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {publishResult.error}
                  </p>
                </div>
              </div>
            )}

            {!sandboxId && (
              <div className="bg-red-50 flex flex-row items-center gap-x-2 p-3 border border-border rounded-lg">
                <AlertCircleIcon className='text-red-600' size={14} />
                <p className="text-sm text-red-600">
                  No active sandbox found. Please create a sandbox with files first.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Deploying Step */}
        {(currentStep === 'deploying' || currentStep === 'publishing') && (
          <div className="flex items-center justify-center gap-x-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
            <div className="text-sm text-gray-600">Please wait, it will take 5-10 minutes...</div>
          </div>
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Successfully published!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your app is now live and visible in the community gallery.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={currentStep === 'deploying' || currentStep === 'publishing'}
          >
            {currentStep === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          
          {
            currentStep !== 'complete' && 
            <Button
              onClick={handlePublish}
              disabled={currentStep === 'deploying' || currentStep === 'publishing' || !session?.user?.email || !sandboxId}
            >
              {(currentStep === 'deploying' || currentStep === 'publishing') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(currentStep === 'deploying' || currentStep === 'publishing') ? 'Publishing...' : 'Publish'}
            </Button>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
