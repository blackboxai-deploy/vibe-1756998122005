import type { DataPart } from '@/ai/messages/data-parts'
import { Search, Globe, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function FetchOnlineRefs(props: {
  className?: string
  message: DataPart['fetch-online-refs']
}) {
  const { 
    query, 
    preferred_domains, 
    status, 
    result, 
    error, 
    timestamp 
  } = props.message
  
  const [showFullResult, setShowFullResult] = useState(false)

  const getStatusIcon = () => {
    if (status === 'loading') return null
    if (error) {
      return <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
    }
    if (result) {
      return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
    }
    return null
  }

  const truncateResult = (text: string, maxLength: number = 1000) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ts
    }
  }

  return (
    <ToolMessage className={cn(props.className, "w-full min-w-0")}>
      <ToolHeader>
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-xs sm:text-sm">
          {status === 'loading' ? 'Searching' : 'Searched'} Online References
        </span>
        {getStatusIcon()}
      </ToolHeader>
      
      <div className="space-y-2 sm:space-y-3 w-full min-w-0">
        {status === 'loading' && (
          <div className="flex items-center gap-2">
            <MessageSpinner />
            <span className="text-xs sm:text-sm text-muted-foreground">
              Fetching latest information from online sources...
            </span>
          </div>
        )}
        
        {/* Query Details */}
        <div className="bg-white rounded-lg p-2 sm:p-3 space-y-2 w-full min-w-0 border">
          <div className="font-medium flex items-center gap-2 text-xs sm:text-sm">
            <Search className="w-3 h-3 sm:w-4 sm:h-4" />
            Search Query
          </div>
          <div className="text-xs sm:text-sm w-full min-w-0">
            <div className="bg-white px-2 sm:px-3 py-1 sm:py-2 rounded border-l-4 border-blue-500 overflow-x-auto border">
              <code className="text-xs sm:text-sm break-all">{query}</code>
            </div>
          </div>
          
          {preferred_domains && preferred_domains.length > 0 && (
            <div className="text-xs sm:text-sm space-y-1 w-full min-w-0">
              <div className="font-medium flex items-center gap-2">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                Preferred Sources
              </div>
              <div className="flex flex-wrap gap-1">
                {preferred_domains.map((domain, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-full break-all"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {timestamp && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(timestamp)}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-1">
              <AlertCircle className="w-4 h-4" />
              Search Error
            </div>
            <div className="text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg p-2 sm:p-3 space-y-2 w-full min-w-0 border">
            <div className="font-medium flex items-center gap-2 text-xs sm:text-sm">
              <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
              Search Results
            </div>
            
            <div className="text-xs sm:text-sm space-y-2 w-full min-w-0">
              <div className="bg-background rounded border p-2 sm:p-3 max-h-64 sm:max-h-96 overflow-y-auto w-full min-w-0 overflow-x-auto">
                <pre className="whitespace-pre-wrap text-xs sm:text-sm break-words">
                  {showFullResult ? result : truncateResult(result)}
                </pre>
                
                {result.length > 1000 && (
                  <button
                    onClick={() => setShowFullResult(!showFullResult)}
                    className="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                  >
                    {showFullResult ? 'Show less' : 'Show full results'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Summary */}
        {status === 'done' && result && !error && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-1">
              <CheckCircle className="w-4 h-4" />
              Search Complete
            </div>
            <div className="text-sm text-green-600 dark:text-green-300">
              Successfully retrieved current information from online sources.
            </div>
          </div>
        )}
      </div>
    </ToolMessage>
  )
}
