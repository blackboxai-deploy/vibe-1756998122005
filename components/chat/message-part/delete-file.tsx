import type { DataPart } from '@/ai/messages/data-parts'
import { Trash2Icon, CheckCircleIcon } from 'lucide-react'

interface Props {
  message: DataPart['delete-file']
}

export function DeleteFile({ message }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg bg-white w-full min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-xs sm:text-sm font-medium flex-shrink-0 flex items-center gap-1">
          <Trash2Icon className="w-3 h-3 sm:w-4 sm:h-4" />
          Delete File
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground break-all min-w-0 flex-1">
          {message.path}
        </div>
      </div>
      
      {message.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />
          Deleting file...
        </div>
      )}
      
      {message.status === 'done' && message.error && (
        <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded break-words">
          Error: {message.error}
        </div>
      )}
      
      {message.status === 'done' && !message.error && (
        <div className="text-xs sm:text-sm text-green-600 bg-[#dafbe1]  p-2 sm:p-3 rounded-lg break-words flex items-center gap-1">
          <CheckCircleIcon className="w-3 h-3 flex-shrink-0" />
          File deleted successfully: {message.path}
        </div>
      )}
    </div>
  )
}
