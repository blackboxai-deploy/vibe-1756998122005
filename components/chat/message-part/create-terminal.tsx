import type { DataPart } from '@/ai/messages/data-parts'
import { Terminal, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { cn } from '@/lib/utils'
import Markdown from 'react-markdown'

export function CreateTerminal(props: {
  className?: string
  message: DataPart['create-terminal']
}) {
  return (
    <ToolMessage className={cn(props.className, "w-full min-w-0")}>
      <ToolHeader>
        <Terminal className="w-3.5 h-3.5" />
        {props.message.status === 'loading' ? (
          <span className="text-xs sm:text-sm">Creating Terminal</span>
        ) : (
          <span className="text-xs sm:text-sm">Terminal Created</span>
        )}
      </ToolHeader>
      
      <div className="space-y-2 sm:space-y-3 w-full min-w-0">
        {props.message.status === 'loading' && <MessageSpinner />}
        
        {props.message.status === 'done' && !props.message.error && (
          <div className="space-y-2 sm:space-y-3 w-full min-w-0">
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm min-w-0">
                <div className="font-medium text-green-800 dark:text-green-200 mb-1 break-words">
                  Terminal &ldquo;{props.message.name}&rdquo; created successfully
                </div>
                <div className="text-green-700 dark:text-green-300 space-y-1">
                  {props.message.terminalId && (
                    <div className="break-all">Terminal ID: <code className="bg-green-100 dark:bg-green-900 px-1 rounded text-xs">{props.message.terminalId}</code></div>
                  )}
                  {props.message.workingDirectory && (
                    <div className="break-all">Working Directory: <code className="bg-green-100 dark:bg-green-900 px-1 rounded text-xs">{props.message.workingDirectory}</code></div>
                  )}
                  {props.message.duration && (
                    <div className="text-xs opacity-75">Created in {props.message.duration}ms</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              <Markdown>
                {`The terminal session is now ready for commands. You can use the \`executeCommand\` tool to run commands in this specific terminal.`}
              </Markdown>
            </div>
          </div>
        )}
        
        {props.message.status === 'done' && props.message.error && (
          <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm min-w-0">
              <div className="font-medium text-red-800 dark:text-red-200 mb-1 break-words">
                Failed to create terminal &ldquo;{props.message.name}&rdquo;
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
