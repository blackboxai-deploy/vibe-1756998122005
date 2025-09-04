import { memo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorMessageProps {
  message: {
    error: string
    retryCount?: number
    isHighDemand?: boolean
    onRetry?: () => void
  }
}

export const ErrorMessage = memo(function ErrorMessage({ message }: ErrorMessageProps) {
  const { error, retryCount = 0, isHighDemand = false, onRetry } = message

  return (
    <div className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 sm:py-3 border bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 border-red-300 dark:border-red-800 rounded-md font-mono w-full min-w-0">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold mb-1">
            {isHighDemand ? "We're experiencing high demand" : "Error occurred"}
          </div>
          <div className="text-xs sm:text-sm opacity-90 break-words">
            {isHighDemand 
              ? "We're currently experiencing high demand on our services. Please try again in a few moments or consider using a different model."
              : "An error occurred while processing your request:"}
          </div>
          {!isHighDemand && (
            <div className="mt-2 text-xs sm:text-sm opacity-80 break-words">
              {error}
            </div>
          )}
          {retryCount > 0 && retryCount < 3 && (
            <div className="mt-2 text-xs sm:text-sm opacity-70">
              Attempting retry {retryCount} of 3...
            </div>
          )}
          {onRetry && isHighDemand && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="mt-3 text-xs sm:text-sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
