import type { DataPart } from '@/ai/messages/data-parts'
import { LinkIcon } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { cn } from '@/lib/utils'

export function GetSandboxURL(props: {
  className?: string
  message: DataPart['get-sandbox-url']
}) {
  return (
    <ToolMessage className={cn(props.className, "w-full min-w-0")}>
      <ToolHeader>
        <LinkIcon className="w-3.5 h-3.5" />
        {!props.message.url ? (
          <span className="text-xs sm:text-sm">Getting Sandbox URL</span>
        ) : (
          <span className="text-xs sm:text-sm">Got Sandbox URL</span>
        )}
      </ToolHeader>
      <div className="space-y-2 sm:space-y-3 w-full min-w-0">
        {!props.message.url && <MessageSpinner />}
        {props.message.url && (
          <a 
            href={props.message.url} 
            target="_blank"
            className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline break-all block"
          >
            {props.message.url}
          </a>
        )}
      </div>
    </ToolMessage>
  )
}
