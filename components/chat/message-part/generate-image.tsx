import type { DataPart } from '@/ai/messages/data-parts'
import { ImageIcon } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'

export function GenerateImage(props: {
  className?: string
  message: DataPart['generate-image']
}) {
  return (
    <ToolMessage className={`${props.className} w-full min-w-0`}>
      <ToolHeader>
        <ImageIcon className="w-3.5 h-3.5" />
        <span className="text-xs sm:text-sm">
          {props.message.status === 'done'
            ? 'Generated image'
            : props.message.status === 'generating'
            ? 'Generating image'
            : 'Loading'}
        </span>
      </ToolHeader>

      <div className="pl-2 sm:pl-3 space-y-2 sm:space-y-3 w-full min-w-0">
        {props.message.status === 'generating' && (
          <div className="flex items-center gap-2">
            <MessageSpinner />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              Creating image: &ldquo;{props.message.prompt.substring(0, 60)}
              {props.message.prompt.length > 60 ? '...' : ''}&rdquo;
            </span>
          </div>
        )}

        {props.message.status === 'done' && !props.message.error && props.message.markdown && (
          <div className="space-y-2 sm:space-y-3 w-full min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
              Generated image for: &ldquo;{props.message.prompt.substring(0, 60)}
              {props.message.prompt.length > 60 ? '...' : ''}&rdquo;
            </div>
            {props.message.imageUrl && (
              <div className="w-full max-w-md">
                <img 
                  src={props.message.imageUrl} 
                  alt={props.message.prompt}
                  className="rounded-lg shadow-md w-full h-auto"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {props.message.status === 'done' && props.message.error && (
          <div className="text-xs sm:text-sm text-red-600 break-words">
            ❌ Failed to generate image: {props.message.error}
          </div>
        )}

        {props.message.duration && (
          <div className="text-xs text-gray-400">
            Completed in {(props.message.duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </ToolMessage>
  )
}
