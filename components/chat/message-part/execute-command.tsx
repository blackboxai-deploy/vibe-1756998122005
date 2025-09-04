import type { DataPart } from '@/ai/messages/data-parts'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, Terminal, AlertCircle } from 'lucide-react'
import { memo } from 'react'

interface Props {
  message: DataPart['execute-command']
}

export const ExecuteCommand = memo(function ExecuteCommand({ message }: Props) {
  const { command, args, status, analysis, expectedBehavior, exitCode, success, isRunning, duration, error } = message

  const commandString = `${command} ${args?.join(' ') || ''}`

  const getStatusIcon = () => {
    if (status === 'loading') {
      return <Clock className="h-4 w-4 animate-pulse text-blue-500" />
    }
    if (success === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (success === false) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    return <Terminal className="h-4 w-4 text-gray-500" />
  }

  const getStatusText = () => {
    if (status === 'loading') {
      return 'Executing...'
    }
    if (success === true && isRunning) {
      return 'Running in background'
    }
    if (success === true && !isRunning) {
      return 'Completed successfully'
    }
    if (success === false) {
      return 'Failed'
    }
    return 'Processing'
  }

  const getStatusColor = () => {
    if (status === 'loading') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (success === true) return 'bg-green-50 text-green-700 border-green-200'
    if (success === false) return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-white text-gray-700 border-gray-200'
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border border-border w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-semibold text-gray-900 text-xs sm:text-sm">Command Execution</span>
        </div>
        <Badge variant="outline" className={`${getStatusColor()} text-xs w-fit`}>
          {getStatusText()}
        </Badge>
      </div>

      {/* Command */}
      <div className="bg-black text-green-400 p-2 sm:p-3 rounded-lg font-mono text-xs sm:text-sm overflow-x-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-500 flex-shrink-0">$</span>
          <span className="break-all">{commandString}</span>
        </div>
      </div>

      {/* Analysis and Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
        {analysis && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Command Type:</span>
            <Badge variant="secondary" className="w-fit capitalize text-xs">
              {analysis}
            </Badge>
          </div>
        )}
        
        {expectedBehavior && expectedBehavior !== analysis && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-gray-700 dark:text-gray-300">Behavior:</span>
            <Badge variant="outline" className="w-fit capitalize text-xs">
              {expectedBehavior}
            </Badge>
          </div>
        )}
        
        {duration && (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-black">Duration:</span>
            <span className="text-black">{(duration / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      {/* Exit Code */}
      {exitCode !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-700">Exit Code:</span>
          <Badge 
            style={{
              fontSize: 11
            }}
            variant={exitCode === 0 ? "default" : "destructive"}
            className="font-mono "
          >
            {exitCode}
          </Badge>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-red-700 text-sm">
            <div className="font-medium">Error:</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Running Status */}
      {isRunning && success && (
        <div className="flex items-center gap-2 p-3 bg-[#dafbe1] rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-700 text-sm font-medium">
              Process is running in background
            </span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {status === 'loading' && (
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded"></div>
        </div>
      )}
    </div>
  )
})
