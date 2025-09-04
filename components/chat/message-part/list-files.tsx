import type { DataPart } from '@/ai/messages/data-parts'
import { memo } from 'react'
import { FolderIcon, FileIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'

interface Props {
  message: DataPart['list-files']
}

export const ListFiles = memo(function ListFiles({ message }: Props) {
  const isMobile = useIsMobile()
  
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg w-full min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-xs sm:text-sm font-medium flex-shrink-0 flex items-center gap-1">
          <FolderIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          List Files
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground break-all min-w-0 flex-1">
          {message.path}
          {message.recursive && ' (recursive)'}
        </div>
      </div>
      
      {message.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />
          Listing files...
        </div>
      )}
      
      {message.status === 'done' && message.error && (
        <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded break-words">
          Error: {message.error}
        </div>
      )}
      
      {message.status === 'done' && message.files && (
        <div className="text-xs sm:text-sm w-full min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground mb-2">
            Found {message.files.length} items:
          </div>
          {message.files.length === 0 ? (
            <div className="text-muted-foreground italic">Directory is empty</div>
          ) : (
            <div className="space-y-1 sm:space-y-2 max-h-64 sm:max-h-96 overflow-y-auto w-full min-w-0">
              {message.files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 sm:p-3 bg-white rounded-lg border border-border hover:bg-white transition-colors min-w-0">
                  <div className="flex-shrink-0">
                    {file.type === 'directory' ? (
                      <FolderIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <FileIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate">
                      {file.name}
                    </div>
                    <div className={`text-xs text-muted-foreground ${isMobile ? 'w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap' : ''}`}>
                      {file.path}
                    </div>
                  </div>
                  {file.size !== undefined && (
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(file.size)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {file.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
