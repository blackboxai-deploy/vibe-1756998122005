export interface TerminalOutput {
  id: string
  type: 'command' | 'output' | 'error'
  content: string
  timestamp: Date
  exitCode?: number
}

export interface Terminal {
  terminalId: string
  name: string
  sandboxId: string
  workingDirectory: string
  status: 'created' | 'ready' | 'busy' | 'error' | 'idle'
  createdAt: Date | string
  lastActivity?: Date | string
  // Persistent terminal state
  history: TerminalOutput[]
  commandHistory: string[]
}

export interface TerminalSession {
  terminalId: string
  isOpen: boolean
  isMinimized: boolean
}
