import type { DataPart } from '@/ai/messages/data-parts'
import { ImageIcon, SearchIcon, WandIcon } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'

export function ProcessPlaceholderImages(props: {
  className?: string
  message: DataPart['process-placeholder-images']
}) {
  const getStatusIcon = () => {
    switch (props.message.status) {
      case 'scanning':
        return <SearchIcon className="w-3.5 h-3.5" />
      case 'generating':
        return <WandIcon className="w-3.5 h-3.5" />
      case 'replacing':
        return <ImageIcon className="w-3.5 h-3.5" />
      default:
        return <ImageIcon className="w-3.5 h-3.5" />
    }
  }

  const getStatusText = () => {
    switch (props.message.status) {
      case 'scanning':
        return 'Scanning for placeholder images'
      case 'generating':
        return 'Generating replacement images'
      case 'replacing':
        return 'Replacing placeholder images'
      case 'done':
        return 'Processed placeholder images'
      default:
        return 'Processing placeholder images'
    }
  }

  return (
    <ToolMessage className={`${props.className} w-full min-w-0`}>
      <ToolHeader>
        {getStatusIcon()}
        <span className="text-xs sm:text-sm">{getStatusText()}</span>
      </ToolHeader>

      <div className="pl-2 sm:pl-3 space-y-2 sm:space-y-3 w-full min-w-0">
        {props.message.status !== 'done' && (
          <div className="flex items-center gap-2">
            <MessageSpinner />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              {props.message.status === 'scanning' && 'Searching workspace for placehold.co URLs...'}
              {props.message.status === 'generating' && 'Creating AI-generated replacement images...'}
              {props.message.status === 'replacing' && 'Updating files with generated images...'}
            </span>
          </div>
        )}

        {props.message.currentFile && (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-all">
            Processing: {props.message.currentFile.split('/').pop()}
          </div>
        )}

        {props.message.status === 'done' && !props.message.error && (
          <div className="space-y-2 sm:space-y-3 w-full min-w-0">
            {props.message.totalPlaceholders === 0 ? (
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                ✅ No placeholder images found in workspace
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 w-full min-w-0">
                <div className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ Processing completed successfully
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Found:</span> {props.message.totalPlaceholders} placeholders
                  </div>
                  <div>
                    <span className="font-medium">Replaced:</span> {props.message.successfulReplacements}
                  </div>
                  <div>
                    <span className="font-medium">Failed:</span> {props.message.failedReplacements}
                  </div>
                  <div>
                    <span className="font-medium">Files:</span> {props.message.processedFiles?.length || 0}
                  </div>
                </div>

                {props.message.processedFiles && props.message.processedFiles.length > 0 && (
                  <div className="mt-2 sm:mt-3 w-full min-w-0">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Updated files:
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {props.message.processedFiles.slice(0, 5).map((file, idx) => (
                        <div key={idx} className="break-all">
                          📄 {file.split('/').pop()}
                        </div>
                      ))}
                      {props.message.processedFiles.length > 5 && (
                        <div className="text-gray-500 dark:text-gray-400">
                          ... and {props.message.processedFiles.length - 5} more files
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {props.message.status === 'done' && props.message.error && (
          <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 break-words">
            ❌ Processing failed: {props.message.error}
          </div>
        )}

        {props.message.duration && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Completed in {(props.message.duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </ToolMessage>
  )
}
