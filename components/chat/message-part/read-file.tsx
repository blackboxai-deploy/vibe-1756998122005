import type { DataPart } from '@/ai/messages/data-parts'
import { memo } from 'react'
import { FileIcon } from 'lucide-react'

interface Props {
  message: DataPart['read-file']
}

export const ReadFile = memo(function ReadFile({ message }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg w-full min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-xs sm:text-sm font-medium flex-shrink-0 flex items-center gap-1">
          <FileIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          Read File
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground break-all min-w-0 flex-1">
          {message.path}
        </div>
      </div>
      
      {message.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />
          Reading file...
        </div>
      )}
      
      {message.status === 'done' && message.error && (
        <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded-lg break-words">
          Error: {message.error}
        </div>
      )}
      
      {message.status === 'done' && message.content && (
        <div className="text-xs sm:text-sm w-full min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground mb-2">
            File content ({message.content.length} characters):
          </div>
          <pre className="w-full p-2 sm:p-3 rounded-lg border border-border text-xs sm:text-sm overflow-y-auto overflow-x-auto max-h-64 sm:max-h-96 whitespace-pre-wrap break-words">
            <code className="break-words w-full">{message.content}</code>
          </pre>
        </div>
      )}
    </div>
  )
})
