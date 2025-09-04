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
import { Terminal, Plus, AlertCircle } from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sandboxId: string
}

export function CreateTerminalDialog({ open, onOpenChange, sandboxId }: Props) {
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const { addTerminal } = useSandboxStore()

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Terminal name is required')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/terminals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId,
          name: name.trim(),
          workingDirectory: workingDirectory.trim() || undefined
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create terminal')
      }

      if (result.success && result.terminal) {
        // Add the terminal to the store
        addTerminal(result.terminal)
        
        // Show success message
        toast.success(`Terminal "${name.trim()}" created successfully`)
        
        // Reset form and close dialog
        setName('')
        setWorkingDirectory('')
        onOpenChange(false)
      } else {
        throw new Error('Invalid response from server')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create terminal'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Error creating terminal:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
      setWorkingDirectory('')
      setError('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Create New Terminal
          </DialogTitle>
          <DialogDescription>
            Create a new terminal session in the sandbox for running commands and managing processes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="terminal-name" className="text-sm font-medium">
              Terminal Name *
            </label>
            <Input
              id="terminal-name"
              placeholder="e.g., build-terminal, test-terminal, dev-server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
            <p className="text-xs text-gray-500">
              <strong>Recommended names:</strong> build-terminal (for builds), test-terminal (for testing), dev-server (for development servers)
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="working-directory" className="text-sm font-medium">
              Working Directory (Optional)
            </label>
            <Input
              id="working-directory"
              placeholder="e.g., src, backend, frontend"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              disabled={isCreating}
            />
            <p className="text-xs text-gray-500">
              Initial directory for the terminal (defaults to sandbox root)
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Terminal Management Best Practices:</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                <li><strong>build-terminal</strong>: For builds, compilation, and installation (prevents blocking)</li>
                <li><strong>test-terminal</strong>: For running tests and test suites (isolated testing)</li>
                <li><strong>dev-server</strong>: For development servers and long-running processes</li>
                <li>Multiple terminals enable parallel operations and better process monitoring</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Terminal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
