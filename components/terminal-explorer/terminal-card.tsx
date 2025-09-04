'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Terminal as TerminalIcon,
  X, 
  Clock, 
  Folder,
  Activity,
  AlertCircle,
  CheckCircle,
  Pause
} from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { Terminal } from '@/app/types/terminal'
import { toast } from 'sonner'
import { useState } from 'react'

interface Props {
  terminal: Terminal
  onRemove: (terminalId: string) => void
  onOpen?: (terminal: Terminal) => void
  disabled?: boolean
}

const statusConfig = {
  created: {
    icon: Clock,
    color: 'text-yellow-600',
    dot: 'bg-yellow-500',
    label: 'Created'
  },
  ready: {
    icon: CheckCircle,
    color: 'text-green-600',
    dot: 'bg-green-500',
    label: 'Ready'
  },
  busy: {
    icon: Activity,
    color: 'text-blue-600',
    dot: 'bg-blue-500 animate-pulse',
    label: 'Running'
  },
  idle: {
    icon: Pause,
    color: 'text-gray-500',
    dot: 'bg-gray-400',
    label: 'Idle'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    dot: 'bg-red-500',
    label: 'Error'
  }
}

const getTerminalTypeIcon = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('build')) return ''
  if (lowerName.includes('test')) return ''
  if (lowerName.includes('dev') || lowerName.includes('server')) return ''
  if (lowerName.includes('main') || lowerName.includes('primary')) return ''
  return ''
}

export function TerminalCard({ terminal, onRemove, onOpen, disabled }: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { removeTerminal } = useSandboxStore()
  const status = statusConfig[terminal.status]
  const typeIcon = getTerminalTypeIcon(terminal.name)

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date'
    }
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getTimeSince = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date'
    }
    
    const now = new Date()
    const diff = now.getTime() - dateObj.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const handleDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    
    try {
      const response = await fetch('/api/terminals/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId: terminal.sandboxId,
          terminalId: terminal.terminalId
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete terminal')
      }

      if (result.success) {
        // Remove from store
        removeTerminal(terminal.terminalId)
        
        // Call the onRemove callback if provided
        onRemove(terminal.terminalId)
        
        toast.success(`Terminal "${terminal.name}" deleted successfully`)
      } else {
        throw new Error('Invalid response from server')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete terminal'
      toast.error(errorMessage)
      console.error('Error deleting terminal:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div 
      className={cn(
        "flex items-center py-2 px-3 hover:bg-white border-b border-gray-100 transition-colors cursor-pointer",
        terminal.status === 'error' && "bg-red-50 hover:bg-red-100",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => {
        if (!disabled && onOpen) {
          console.log('Opening terminal:', terminal.terminalId, terminal.name)
          onOpen(terminal)
        }
      }}
    >
      {/* Status indicator */}
      <div className="flex items-center flex-shrink-0 mr-2">
        <div className={cn("w-2 h-2 rounded-full", status.dot)} />
      </div>

      {/* Terminal info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate text-gray-800">{terminal.name}</span>
          {terminal.status === 'busy' && (
            <span className="text-xs text-white bg-blue-500 px-1.5 py-0.5 rounded text-[10px]">
              Running
            </span>
          )}
          {terminal.status === 'ready' && (
            <span className="text-xs text-white bg-green-500 px-1.5 py-0.5 rounded text-[10px]">Ready</span>
          )}
          {terminal.status === 'error' && (
            <span className="text-xs text-white bg-red-500 px-1.5 py-0.5 rounded text-[10px]">Error</span>
          )}
          {terminal.status === 'created' && (
            <span className="text-xs text-white bg-yellow-500 px-1.5 py-0.5 rounded text-[10px]">Created</span>
          )}
          {terminal.status === 'idle' && (
            <span className="text-xs text-black bg-white px-1.5 py-0.5 rounded text-[10px] border">Idle</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="text-gray-400 font-mono bg-white px-1 py-0.5 rounded text-[10px] border">
            {terminal.terminalId.slice(-4)}
          </span>
          <span className="text-gray-300">•</span>
          <span className="truncate">{formatTime(terminal.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center flex-shrink-0 ml-auto">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation() // Prevent triggering the card click
            handleDelete()
          }}
          disabled={disabled || isDeleting}
          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
          title="Kill terminal"
        >
          {isDeleting ? (
            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  )
}
