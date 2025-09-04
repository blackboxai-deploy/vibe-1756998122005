import type { Metadata } from '@/ai/messages/metadata'
import type { DataPart } from '@/ai/messages/data-parts'
import type { ToolSet } from '@/ai/tools'
import type { UIMessage } from 'ai'
import { memo } from 'react'

import { GenerateFiles } from './generate-files'
import { CreateSandbox } from './create-sandbox'
import { GetSandboxURL } from './get-sandbox-url'
import { ExecuteCommand } from './execute-command'
import { BrowserAction } from './browser-action'
import { ReadFile } from './read-file'
import { EditFile } from './edit-file'
import { SearchFiles } from './search-files'
import { ListFiles } from './list-files'
import { FetchOnlineRefs } from './fetch-online-refs'
import { CreateFile } from './create-file'
import { DeleteFile } from './delete-file'
import { CreateTerminal } from './create-terminal'
import { ProcessPlaceholderImages } from './process-placeholder-images'
import { ListTerminals } from './list-terminals'
import { TerminalExecute } from './terminal-execute'
import { Reasoning } from './reasoning'
import { Text } from './text'
import { ErrorMessage } from './error'

interface Props {
  part: UIMessage<Metadata, DataPart, ToolSet>['parts'][number]
}

export const MessagePart = memo(function MessagePart({ part }: Props) {
  // console.log(`[MESSAGE_PART] Rendering component type: ${part.type}`)
  
  if (part.type === 'data-generating-files') {
    // console.log(`[MESSAGE_PART] GenerateFiles data:`, part.data)
    return <GenerateFiles message={part.data} />
  } else if (part.type === 'data-create-sandbox') {
    // console.log(`[MESSAGE_PART] CreateSandbox data:`, part.data)
    return <CreateSandbox message={part.data} />
  } else if (part.type === 'data-get-sandbox-url') {
    // console.log(`[MESSAGE_PART] GetSandboxURL data:`, part.data)
    return <GetSandboxURL message={part.data} />
  } else if (part.type === 'data-execute-command') {
    // console.log(`[MESSAGE_PART] ExecuteCommand data:`, part.data)
    return <ExecuteCommand message={part.data} />
  } else if (part.type === 'data-browser-action') {
    return <BrowserAction message={part.data} />
  } else if (part.type === 'data-read-file') {
    // console.log(`[MESSAGE_PART] ReadFile data:`, part.data)
    return <ReadFile message={part.data} />
  } else if (part.type === 'data-edit-file') {
    // console.log(`[MESSAGE_PART] EditFile data:`, part.data)
    return <EditFile message={part.data} />
  } else if (part.type === 'data-search-files') {
    // console.log(`[MESSAGE_PART] SearchFiles data:`, part.data)
    return <SearchFiles message={part.data} />
  } else if (part.type === 'data-list-files') {
    // console.log(`[MESSAGE_PART] ListFiles data:`, part.data)
    return <ListFiles message={part.data} />
  } else if (part.type === 'data-fetch-online-refs') {
    // console.log(`[MESSAGE_PART] FetchOnlineRefs data:`, part.data)
    return <FetchOnlineRefs message={part.data} />
  } else if (part.type === 'data-create-file') {
    // console.log(`[MESSAGE_PART] CreateFile data:`, part.data)
    return <CreateFile message={part.data} />
  } else if (part.type === 'data-delete-file') {
    // console.log(`[MESSAGE_PART] DeleteFile data:`, part.data)
    return <DeleteFile message={part.data} />
  } else if (part.type === 'data-create-terminal') {
    // console.log(`[MESSAGE_PART] CreateTerminal data:`, part.data)
    return <CreateTerminal message={part.data} />
  } else if (part.type === 'data-process-placeholder-images') {
    // console.log(`[MESSAGE_PART] ProcessPlaceholderImages data:`, part.data)
    return <ProcessPlaceholderImages message={part.data} />
  } else if (part.type === 'data-list-terminals') {
    // console.log(`[MESSAGE_PART] ListTerminals data:`, part.data)
    return <ListTerminals message={part.data} />
  } else if (part.type === 'data-terminal-execute') {
    // console.log(`[MESSAGE_PART] TerminalExecute data:`, part.data)
    return <TerminalExecute message={part.data} />
  } else if (part.type === 'data-error-message') {
    return <ErrorMessage message={part.data} />
  } else if (part.type === 'reasoning') {
    // console.log(`[MESSAGE_PART] Reasoning part:`, part)
    return <Reasoning part={part as any} />
  } else if (part.type === 'text') {
    // console.log(`[MESSAGE_PART] Text part:`, part)
    return <Text part={part as any} />
  } else {
    // console.log(`[MESSAGE_PART] Unknown part type:`, part.type)
    return null
  }

  return null
})
