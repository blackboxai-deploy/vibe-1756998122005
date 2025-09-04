import type { DataPart } from '@/ai/messages/data-parts'
import { Terminal, CheckCircle, AlertCircle, List } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { cn } from '@/lib/utils'
import Markdown from 'react-markdown'

export function ListTerminals(props: {
  className?: string
  message: DataPart['list-terminals']
}) {
  return (
    <ToolMessage className={cn(props.className, "w-full min-w-0")}>
      <ToolHeader>
        <List className="w-3.5 h-3.5" />
        {props.message.status === 'loading' ? (
          <span className="text-xs sm:text-sm">Listing Terminals</span>
        ) : (
          <span className="text-xs sm:text-sm">Terminal List</span>
        )}
      </ToolHeader>
      
      <div className="space-y-2 sm:space-y-3 w-full min-w-0">
        {props.message.status === 'loading' && <MessageSpinner />}
        
        {props.message.status === 'done' && !props.message.error && (
          <div className="space-y-2 sm:space-y-3 w-full min-w-0">
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm min-w-0">
                <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Terminal listing completed
                </div>
                <div className="text-blue-700 dark:text-blue-300 space-y-1">
                  {props.message.terminals && props.message.terminals.length > 0 ? (
                    <div className="w-full min-w-0">
                      <div className="mb-2">Found {props.message.terminals.length} terminal(s):</div>
                      <div className="space-y-2">
                        {props.message.terminals.map((terminal) => (
                          <div key={terminal.terminalId} className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-xs w-full min-w-0">
                            <div className="font-medium break-words">{terminal.name}</div>
                            <div className="text-blue-600 dark:text-blue-400 break-all">
                              ID: <code>{terminal.terminalId}</code>
                            </div>
                            <div className="text-blue-600 dark:text-blue-400 break-all">
                              Directory: <code>{terminal.workingDirectory}</code>
                            </div>
                            <div className="text-blue-600 dark:text-blue-400">
                              Status: <span className="capitalize">{terminal.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="break-words">No terminals found. Create terminals using the Terminal Explorer panel.</div>
                  )}
                  {props.message.duration && (
                    <div className="text-xs opacity-75 mt-2">Completed in {props.message.duration}ms</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {props.message.status === 'done' && props.message.error && (
          <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm min-w-0">
              <div className="font-medium text-red-800 dark:text-red-200 mb-1">
                Failed to list terminals
              </div>
              <div className="text-red-700 dark:text-red-300 break-words">
                <Markdown>{props.message.error}</Markdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolMessage>
  )
}
