'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle,
  AlertTriangleIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BuildErrorDisplayProps {
  error: string
  className?: string
}

export function BuildErrorDisplay({ error, className }: BuildErrorDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [showFullError, setShowFullError] = useState(false)

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(error)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error:', err)
    }
  }

  const formatErrorForDisplay = (errorText: string) => {
    // Split by lines and format for better readability
    const lines = errorText.split('\n')
    return lines.map((line, index) => (
      <div key={index} className="font-mono text-xs text-white break-all">
        {line}
      </div>
    ))
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Error Display */}
      <div className="p-4 rounded-lg border bg-red-950">
        <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className='flex flex-row items-center gap-x-1'>
                  <AlertTriangleIcon className='text-red-600' size={16} />
                  <h3 className="font-semibold text-sm text-red-200">
                    Build Failed
                  </h3>
                </div>
                <p className="text-sm mt-1 text-red-300">
                  Your code has an issue that&apos;s preventing the build from completing successfully.
                </p>
              </div>
              <Button
                variant={'link'}
                size="sm"
                onClick={handleCopyError}
                className="text-gray-400"
                title="Copy full error"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Error Preview */}
            <div className="mt-3 px-4 py-3 bg-black rounded-md overflow-hidden border">
              <div className={`${showFullError ? 'max-h-80' : 'max-h-24'} overflow-auto`}>
                {formatErrorForDisplay(showFullError ? error : error.split('\n').slice(0, 3).join('\n'))}
              </div>
              {error.split('\n').length > 3 && (
                <Button
                  variant={'link'}
                  size="sm"
                  onClick={() => setShowFullError((prevShowFullError: boolean) => !prevShowFullError)}
                  className="mt-2 h-6 pr-2 text-xs text-white hover:text-gray-200"
                >
                  {showFullError ? (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      Show Full Error ({error.split('\n').length - 3} more lines)
                    </>
                  )}
                </Button>
              )}
            </div>
        </div>
      </div>
    </div>
  )
}
