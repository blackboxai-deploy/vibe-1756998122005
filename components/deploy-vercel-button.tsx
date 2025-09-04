'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DeployVercelModal } from '@/components/modals/deploy-vercel'
import { useSandboxStore } from '@/app/state'
import { ExternalLink, Copy, Check, RocketIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'

interface DeployVercelButtonProps {
  className?: string
  openInMessage?: boolean
}

export function DeployVercelButton({ 
  className,
  openInMessage
}: DeployVercelButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { deploymentUrl, getDisplayUrl } = useSandboxStore()
  const isMobile = useIsMobile()

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    const urlToOpen = getDisplayUrl()
    if (urlToOpen) {
      window.open(urlToOpen, '_blank')
    }
  }

  if (deploymentUrl) {
    return (
      <>
        <div className={`flex items-center ${className}`}>
          <Button
            variant={'ghost'}
            size={'sm'}
            onClick={() => setIsModalOpen(true)}
            className={`${className} ${
              isMobile ? 
                openInMessage ? 
                'border border-border text-xs h-7 w-16' : 
                '' : 
              'border border-border hover:text-black hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Redeploy</span>
            </div>
          </Button>
          {
            !isMobile && !openInMessage && 
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyUrl}
                className="h-9 w-9 p-0"
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
                className="h-9 w-9 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </>
          }
        </div>
        
        <DeployVercelModal 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen} 
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant={'ghost'}
        size={'sm'}
        onClick={() => setIsModalOpen(true)}
        className={`${className} ${
          isMobile ? 
            openInMessage ? 
            'border border-border text-xs h-7 w-16' : 
            '' : 
          'border border-border hover:text-black hover:bg-gray-600'
        }`}
      >
        Deploy
      </Button>
      
      <DeployVercelModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    </>
  )
}
