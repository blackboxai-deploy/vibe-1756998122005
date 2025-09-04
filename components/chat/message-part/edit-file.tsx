import type { DataPart } from '@/ai/messages/data-parts'
import { memo } from 'react'
import { EditIcon, CheckCircleIcon } from 'lucide-react'

interface Props {
  message: DataPart['edit-file']
}

export const EditFile = memo(function EditFile({ message }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg w-full min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-xs sm:text-sm font-medium flex-shrink-0 flex items-center gap-1">
          <EditIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          Edit File
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground break-all min-w-0 flex-1">
          {message.path}
        </div>
      </div>
      
      {message.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />
          Editing file...
        </div>
      )}
      
      {message.status === 'done' && message.error && (
        <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded break-words">
          Error: {message.error}
        </div>
      )}
      
      {message.rawContent && (
        <div className="text-xs sm:text-sm w-full min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground mb-2">
            Raw Content:
          </div>
          <div className="bg-background p-2 sm:p-3 rounded-lg border border-border w-full min-w-0">
            <pre className="text-xs sm:text-sm bg-gray-50 p-2 sm:p-3 rounded-lg overflow-x-auto min-w-0 whitespace-pre-wrap break-words">
              <code className="break-words">{message.rawContent}</code>
            </pre>
          </div>
        </div>
      )}

      {message.edits && message.edits.length > 0 && (
        <div className="text-xs sm:text-sm w-full min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground mb-2">
            Edit operations ({message.edits.length}):
          </div>
          <div className="space-y-2 sm:space-y-3">
            {message.edits.map((edit, index) => (
              <div key={index} className="bg-background p-2 sm:p-3 rounded-lg border border-border w-full min-w-0">
                <div className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">Edit {index + 1}:</div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="w-full min-w-0">
                    <div className="text-xs sm:text-sm text-red-600 mb-1">- Search:</div>
                    <pre className="text-xs sm:text-sm bg-[#ffebe9] p-2 sm:p-3 rounded-lg border-l-2 border-red-200 overflow-x-auto min-w-0 whitespace-pre-wrap break-words">
                      <code className="break-words">{edit.search}</code>
                    </pre>
                  </div>
                  <div className="w-full min-w-0">
                    <div className="text-xs sm:text-sm text-green-600 mb-1">+ Replace:</div>
                    <pre className="text-xs sm:text-sm bg-[#dafbe1] p-2 sm:p-3 rounded-lg border-l-2 border-green-200 overflow-x-auto min-w-0 whitespace-pre-wrap break-words">
                      <code className="break-words">{edit.replace}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {message.status === 'done' && !message.error && (
        <div className="text-xs sm:text-sm text-green-600 bg-[#dafbe1] p-2 sm:p-3 rounded-lg flex items-center gap-1">
          <CheckCircleIcon className="w-3 h-3 flex-shrink-0" />
          File edited successfully
        </div>
      )}
    </div>
  )
})
