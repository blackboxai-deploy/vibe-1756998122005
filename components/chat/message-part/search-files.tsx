import type { DataPart } from '@/ai/messages/data-parts'
import { memo } from 'react'
import { SearchIcon, FileIcon } from 'lucide-react'

interface Props {
  message: DataPart['search-files']
}

export const SearchFiles = memo(function SearchFiles({ message }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg bg-white w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <div className="text-xs sm:text-sm font-medium flex-shrink-0 flex items-center gap-1">
          <SearchIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          Search Files
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground break-all min-w-0">
          {message.path} • Pattern: {message.regex}
          {message.filePattern && ` • Files: ${message.filePattern}`}
        </div>
      </div>
      
      {message.status === 'loading' && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-border border-t-transparent rounded-full flex-shrink-0" />
          Searching files...
        </div>
      )}
      
      {message.status === 'done' && message.error && (
        <div className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded break-words">
          Error: {message.error}
        </div>
      )}
      
      {message.status === 'done' && message.results && (
        <div className="text-xs sm:text-sm w-full min-w-0">
          <div className="text-xs sm:text-sm text-muted-foreground mb-2">
            Found {message.results.length} matches:
          </div>
          {message.results.length === 0 ? (
            <div className="text-muted-foreground italic">No matches found</div>
          ) : (
            <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-96 overflow-y-auto w-full min-w-0">
              {message.results.map((result, index) => (
                <div key={index} className="bg-background p-2 sm:p-3 rounded border border-border w-full min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                    <div className="text-xs sm:text-sm font-medium text-gray-600 break-all flex items-center gap-1">
                      <FileIcon className="w-3 h-3 flex-shrink-0" />
                      {result.file}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Line {result.line}
                    </div>
                  </div>
                  <pre className="text-xs bg-white p-2 rounded border-l-2 border-border overflow-x-auto w-full min-w-0">
                    <code className="break-words">{result.content}</code>
                  </pre>
                  {result.context && result.context.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Context:</div>
                      <div className="text-xs text-muted-foreground bg-white p-2 rounded break-words border border-border">
                        {result.context.join(' | ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
