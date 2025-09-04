import type { InferUITools, UIMessage, UIMessageStreamWriter } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { createSandbox } from './create-sandbox'
import { generateFiles } from './generate-files'
import { getSandboxURL } from './get-sandbox-url'
import { executeCommand } from './execute-command'
import { browserAction } from './browser-action'
import { readFile } from './read-file'
import { editFile } from './edit-file'
import { searchFiles } from './search-files'
import { listFiles } from './list-files'
import { fetchOnlineRefs } from './fetch-online-refs'
import { createFile } from './create-file'
import { deleteFile } from './delete-file'
import { createTerminal } from './create-terminal'
import { processPlaceholderImages } from './process-placeholder-images'

interface Params {
  modelId: string
  customerId?: string
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  sessionId?: string
  github?: {
    repo: string;
    branch: string;
    accessToken: string;
  }
}

export function tools({ modelId, customerId, writer, sessionId, github }: Params) {
  return {
    createSandbox: createSandbox({ writer, github, sessionId }),
    generateFiles: generateFiles({ writer, customerId, modelId }),
    getSandboxURL: getSandboxURL({ writer, sessionId }),
    executeCommand: executeCommand({ writer, sessionId, github }), // New universal command tool
    // browserAction: browserAction({ writer }),
    readFile: readFile({ writer, sessionId }),
    editFile: editFile({ writer, sessionId }),
    searchFiles: searchFiles({ writer, sessionId }),
    listFiles: listFiles({ writer, sessionId }),
    fetchOnlineRefs: fetchOnlineRefs({ writer }),
    createFile: createFile({ writer, sessionId }),
    deleteFile: deleteFile({ writer, sessionId }),
    createTerminal: createTerminal({ writer, sessionId }),
    processPlaceholderImages: processPlaceholderImages({ writer, modelId }),
  }
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>
