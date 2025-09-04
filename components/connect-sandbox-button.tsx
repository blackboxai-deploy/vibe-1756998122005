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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader2, Link, CheckCircle, XCircle } from 'lucide-react'
import { useSandboxStore } from '@/app/state'

interface ConnectResult {
  success: boolean
  error?: string
}

export function ConnectSandboxButton() {
  const [open, setOpen] = useState(false)
  const [sandboxId, setSandboxId] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectResult, setConnectResult] = useState<ConnectResult | null>(null)
  const { connectToExistingSandbox } = useSandboxStore()

  const handleConnect = async () => {
    if (!sandboxId.trim()) return

    setIsConnecting(true)
    setConnectResult(null)

    try {
      const response = await fetch('/api/sandboxes/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId: sandboxId.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        connectToExistingSandbox(sandboxId.trim())
        setConnectResult({ success: true })
        
        // Close modal after successful connection
        setTimeout(() => {
          setOpen(false)
          handleClose()
        }, 1500)
      } else {
        setConnectResult({
          success: false,
          error: result.error || 'Failed to connect to sandbox',
        })
      }
    } catch (error) {
      setConnectResult({
        success: false,
        error: 'Network error occurred while connecting',
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleClose = () => {
    if (!isConnecting) {
      setOpen(false)
      // Reset state after a delay to allow for smooth closing animation
      setTimeout(() => {
        setSandboxId('')
        setConnectResult(null)
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link className="mr-2 h-4 w-4" />
          Connect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Connect to Existing Sandbox
          </DialogTitle>
          <DialogDescription>
            Enter a sandbox ID to connect to an existing sandbox and restore your work.
          </DialogDescription>
        </DialogHeader>

        {connectResult ? (
          <div className="space-y-4">
            {connectResult.success ? (
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Successfully connected to sandbox!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your sandbox is now active and ready to use.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Failed to connect
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {connectResult.error}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="sandbox-id" className="text-sm font-medium">
                Sandbox ID
              </label>
              <Input
                id="sandbox-id"
                placeholder="sbx_abc123xyz..."
                value={sandboxId}
                onChange={(e) => setSandboxId(e.target.value)}
                disabled={isConnecting}
              />
              <p className="text-xs text-gray-500">
                Enter the full sandbox ID (starts with "sbx_")
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Connecting to an existing sandbox will restore your previous work and files.
                The sandbox ID is usually visible in the URL or chat messages.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isConnecting}>
            {connectResult ? 'Close' : 'Cancel'}
          </Button>
          {!connectResult && (
            <Button
              onClick={handleConnect}
              disabled={!sandboxId.trim() || isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
