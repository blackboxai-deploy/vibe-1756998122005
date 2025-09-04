import type { DataPart } from '@/ai/messages/data-parts'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, Terminal, AlertCircle } from 'lucide-react'

interface Props {
  message: DataPart['terminal-execute']
}

export function TerminalExecute({ message }: Props) {
  const { terminalId, command, status, output, exitCode, error, timestamp } = message

  const getStatusIcon = () => {
    if (status === 'loading' || status === 'streaming') {
      return <Clock className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse text-blue-500" />
    }
    if (exitCode === 0) {
      return <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
    }
    if (exitCode !== undefined && exitCode !== 0) {
      return <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
    }
    return <Terminal className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
  }

  const getStatusText = () => {
    if (status === 'loading') {
      return 'Executing...'
    }
    if (status === 'streaming') {
      return 'Running...'
    }
    if (exitCode === 0) {
      return 'Completed successfully'
    }
    if (exitCode !== undefined && exitCode !== 0) {
      return 'Failed'
    }
    return 'Processing'
  }

  const getStatusColor = () => {
    if (status === 'loading' || status === 'streaming') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
    if (exitCode === 0) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
    if (exitCode !== undefined && exitCode !== 0) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
    return 'bg-white text-gray-700 border-gray-200 dark:bg-white dark:text-gray-300 dark:border-gray-800'
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 bg-white dark:bg-white rounded-lg border w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {getStatusIcon()}
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">Terminal Command</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`${getStatusColor()} text-xs`}>
            {getStatusText()}
          </Badge>
          {terminalId && (
            <Badge variant="secondary" className="text-xs font-mono">
              {terminalId.slice(-8)}
            </Badge>
          )}
        </div>
      </div>

      {/* Command */}
      <div className="bg-black text-green-400 p-2 sm:p-3 rounded font-mono text-xs sm:text-sm overflow-x-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-500 flex-shrink-0">$</span>
          <span className="break-all">{command}</span>
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="bg-white text-black p-2 sm:p-3 rounded font-mono text-xs sm:text-sm max-h-48 sm:max-h-64 overflow-y-auto overflow-x-auto border">
          <pre className="whitespace-pre-wrap break-words">{output}</pre>
        </div>
      )}

      {/* Exit Code */}
      {exitCode !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Exit Code:</span>
          <Badge 
            variant={exitCode === 0 ? "default" : "destructive"}
            className="font-mono text-xs"
          >
            {exitCode}
          </Badge>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-red-700 dark:text-red-300 text-xs sm:text-sm min-w-0">
            <div className="font-medium">Error:</div>
            <div className="mt-1 break-words">{error}</div>
          </div>
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Executed at {new Date(timestamp).toLocaleString()}
        </div>
      )}

      {/* Loading State */}
      {(status === 'loading' || status === 'streaming') && (
        <div className="space-y-2">
          <div className="h-3 sm:h-4 w-3/4 bg-white dark:bg-white animate-pulse rounded border"></div>
          <div className="h-3 sm:h-4 w-1/2 bg-white dark:bg-white animate-pulse rounded border"></div>
        </div>
      )}
    </div>
  )
}
