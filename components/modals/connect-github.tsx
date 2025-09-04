'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Github, Loader2 } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

interface ConnectGitHubModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectGithubModal({ open, onOpenChange }: ConnectGitHubModalProps) {
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false)

  const handleConnectGitHub = async () => {
    setIsConnectingGitHub(true)
    try {
      const result = await signIn('github', { 
        callbackUrl: window.location.href,
        redirect: false 
      })
      
      if (result?.ok) {
        // Close modal on successful connection
        onOpenChange(false)
        // Reload the page to refresh session
        window.location.reload()
      } else {
        console.error('GitHub connection failed:', result?.error)
        setIsConnectingGitHub(false)
      }
    } catch (error) {
      console.error('GitHub connection error:', error)
      setIsConnectingGitHub(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub
          </DialogTitle>
          <DialogDescription>
            Bring your repositories here to experiment with them.
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={handleConnectGitHub}
          disabled={isConnectingGitHub}
          className="mt-2"
        >
          {isConnectingGitHub ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Github className="mr-2 h-4 w-4" />
              Connect to GitHub
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
