import type { DataPart } from '@/ai/messages/data-parts'
import { CloudUploadIcon } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'

export function GenerateFiles(props: {
  className?: string
  message: DataPart['generating-files']
}) {
  const generated =
    props.message.status === 'generating'
      ? props.message.paths.slice(0, props.message.paths.length - 1)
      : props.message.paths

  const generating =
    props.message.status === 'generating'
      ? props.message.paths[props.message.paths.length - 1]
      : null

  return (
    <ToolMessage className={`${props.className} w-full min-w-0`}>
      <ToolHeader>
        <CloudUploadIcon className="w-3.5 h-3.5" />
        <span className="text-xs sm:text-sm">
          {props.message.status === 'done'
            ? 'Uploaded files'
            : 'Generating files'}
        </span>
      </ToolHeader>

      <div className="pl-2 sm:pl-3 space-y-0.5 sm:space-y-1 w-full min-w-0">
        {generated.map((path) => (
          <div className="text-xs sm:text-sm break-all" key={'gen' + path}>
            ✔︎ {path}
          </div>
        ))}
        {generating && (
          <div className="text-xs sm:text-sm break-all">
            <span>{`  ${generating}`}</span>
          </div>
        )}
        {props.message.status !== 'done' && <MessageSpinner />}
      </div>
    </ToolMessage>
  )
}
