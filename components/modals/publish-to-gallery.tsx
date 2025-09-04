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
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { APP_CATEGORIES, PublishFormData } from '@/lib/types'
import { useSession } from 'next-auth/react'

interface PublishToGalleryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appUrl: string
  sandboxId?: string
  onPublishSuccess?: () => void
}

interface PublishResult {
  success: boolean
  error?: string
  app?: {
    _id: string
    title: string
    description: string
    category: string
    appUrl: string
    screenshotUrl?: string
    creatorEmail: string
    createdAt: Date
    updatedAt: Date
  }
}

export function PublishToGalleryModal({ 
  open, 
  onOpenChange, 
  appUrl, 
  sandboxId,
  onPublishSuccess 
}: PublishToGalleryModalProps) {
  const { data: session } = useSession()
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  
  const [formData, setFormData] = useState<PublishFormData>({
    title: '',
  })

  const [errors, setErrors] = useState<Partial<PublishFormData>>({})

  const validateForm = (): boolean => {
    const newErrors: Partial<PublishFormData> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters'
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePublish = async () => {
    if (!validateForm()) return

    setIsPublishing(true)
    setPublishResult(null)

    try {
      const response = await fetch('/api/gallery/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          appUrl,
          sandboxId
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setPublishResult({ success: true, app: result.app })
        onPublishSuccess?.()
      } else {
        setPublishResult({
          success: false,
          error: result.error || 'Failed to publish app'
        })
      }
    } catch (error) {
      setPublishResult({
        success: false,
        error: 'Network error occurred while publishing'
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleClose = () => {
    if (!isPublishing) {
      onOpenChange(false)
      // Reset form after a delay to allow for smooth closing animation
      setTimeout(() => {
        setFormData({ title: '' })
        setErrors({})
        setPublishResult(null)
      }, 300)
    }
  }

  const handleInputChange = (field: keyof PublishFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Publish to Gallery
          </DialogTitle>
          <DialogDescription>
            Share your app with the community. Your app will be visible to all users in the gallery.
          </DialogDescription>
        </DialogHeader>

        {publishResult ? (
          <div className="space-y-4">
            {publishResult.success ? (
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    App published successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your app is now visible in the community gallery.
                  </p>
                </div>
              </div>
            ) : (
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
          </div>
        ) : (
          <div className="space-y-4">
            {/* App URL Display */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">App URL:</p>
              <p className="text-xs text-gray-800 break-all font-mono">{appUrl}</p>
            </div>

            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter app title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                disabled={isPublishing}
                className={errors.title ? 'border-red-500 focus:border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-xs text-red-600">{errors.title}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isPublishing}
          >
            {publishResult ? 'Close' : 'Cancel'}
          </Button>
          {!publishResult && (
            <Button
              onClick={handlePublish}
              disabled={isPublishing || !session?.user?.email}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish to Gallery'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
