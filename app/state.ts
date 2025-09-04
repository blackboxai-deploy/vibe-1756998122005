import type { Command, CommandLog } from '@/components/commands-logs/types'
import type { DataPart } from '@/ai/messages/data-parts'
import type { DataUIPart } from 'ai'
import type { Terminal, TerminalOutput, TerminalSession } from '@/app/types/terminal'
import type { ChatUIMessage } from '@/components/chat/types'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { logger } from '@/lib/logger'
import { SANDBOX_EXPIRATION_TIME } from '@/ai/constants'
import { getSandboxUrlWhenReady } from '@/lib/sandbox-url-getter'

interface ChatSession {
  id: string
  timestamp: number
  messages: ChatUIMessage[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
  latestDeploymentUrl?: string
  latestCustomDomain?: string
}
// Helper functions for path normalization and validation
function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '.' || basePath === '/') {
    return ''
  }
  
  // Ensure leading slash, remove trailing slash
  const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`
  return normalized.replace(/\/+$/, '')
}

function normalizeFilePath(filePath: string, normalizedBasePath: string): string {
  if (!filePath) return ''
  
  let fullPath = filePath
  
  // Combine base path with file path if needed
  if (normalizedBasePath) {
    if (!filePath.startsWith('/')) {
      fullPath = `${normalizedBasePath}/${filePath}`
    } else {
      fullPath = filePath
    }
  } else {
    // For root directory, ensure leading slash
    fullPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  }
  
  // Clean up any double slashes
  return fullPath.replace(/\/+/g, '/')
}

function isValidPath(path: string): boolean {
  return !!(
    path && 
    typeof path === 'string' && 
    path.length > 1 && // More than just '/'
    path !== '/.' &&
    path !== '/..'
  )
}

// Removed debounce utility - no longer needed since we only save on completion

// Helper functions for chat history KV store management
async function saveChatSessionToKV(messages: ChatUIMessage[], sessionId?: string, sandboxId?: string): Promise<{ success: boolean; sessionId?: string; session?: ChatSession }> {
  try {
    const response = await fetch('/api/chat-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, sessionId, sandboxId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to save chat session')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Failed to save chat session to KV store:', error)
    return { success: false }
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface LoadChatHistoryResult {
  sessions: ChatSession[]
  pagination: PaginationInfo
}

async function loadChatHistoryFromKV(page: number = 1, limit: number = 10): Promise<LoadChatHistoryResult> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })
    
    const response = await fetch(`/api/chat-history?${params}`)
    
    if (!response.ok) {
      throw new Error('Failed to load chat history')
    }
    
    const data = await response.json()
    return {
      sessions: data.sessions || [],
      pagination: data.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      }
    }
  } catch (error) {
    console.error('Failed to load chat history from KV store:', error)
    return {
      sessions: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      }
    }
  }
}

async function updateChatSessionInKV(sessionId: string, messages: ChatUIMessage[], sandboxId?: string): Promise<{ success: boolean; session?: ChatSession }> {
  try {
    const response = await fetch(`/api/chat-history/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, sandboxId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to update chat session')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Failed to update chat session in KV store:', error)
    return { success: false }
  }
}

async function deleteChatSessionFromKV(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/chat-history/${sessionId}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete chat session')
    }
    
    return true
  } catch (error) {
    console.error('Failed to delete chat session from KV store:', error)
    return false
  }
}

async function clearChatHistoryFromKV(): Promise<boolean> {
  try {
    const response = await fetch('/api/chat-history', {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error('Failed to clear chat history')
    }
    
    return true
  } catch (error) {
    console.error('Failed to clear chat history from KV store:', error)
    return false
  }
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}


interface CustomDomainState {
  domain: string
  verified: boolean
  projectName?: string
  lastVerified?: number
}

interface GitHubRepoSelection {
  repository: string | null
  branch: string | null
}

// Session storage key for GitHub repo selection
const GITHUB_REPO_SESSION_KEY = 'github-repo-selection'

// Helper functions for session storage
function saveGitHubRepoToSession(selection: GitHubRepoSelection | undefined) {
  if (typeof window !== 'undefined') {
    try {
      if (selection) {
        sessionStorage.setItem(GITHUB_REPO_SESSION_KEY, JSON.stringify(selection))
      } else {
        sessionStorage.removeItem(GITHUB_REPO_SESSION_KEY)
      }
    } catch (error) {
      console.error('Failed to save GitHub repo selection to session storage:', error)
    }
  }
}

function loadGitHubRepoFromSession(): GitHubRepoSelection | undefined {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(GITHUB_REPO_SESSION_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load GitHub repo selection from session storage:', error)
    }
  }
  return undefined
}

interface SandboxStore {
  addLog: (data: { sandboxId: string; cmdId: string; log: CommandLog }) => void
  addPaths: (paths: string[]) => void
  removePath: (path: string) => void
  clearPaths: () => void
  replacePaths: (paths: string[]) => void
  commands: Command[]
  paths: string[]
  setCreatingSandbox: (creating: boolean) => void
  creatingSandbox: boolean
  sandboxId?: string
  setSandboxId: (id: string) => void
  setStatus: (status: 'running' | 'stopped') => void
  setUrl: (url: string) => void
  status?: 'running' | 'stopped'
  upsertCommand: (command: Command) => void
  url?: string
  deploymentUrl?: string
  setDeploymentUrl: (url: string) => void
  connectToExistingSandbox: (id: string, shouldGetPreview?: boolean) => void
  previewLoading: boolean
  setPreviewLoading: (loading: boolean) => void
  // Welcome screen state
  isWelcomeScreen: boolean
  setIsWelcomeScreen: (isWelcome: boolean) => void
  // Custom domain management
  customDomain?: CustomDomainState
  setCustomDomain: (domain: CustomDomainState | undefined) => void
  verifyCustomDomain: (projectName: string, domain: string) => Promise<{ verified: boolean; error?: string }>
  getDisplayUrl: () => string | undefined
  // GitHub repository selection management
  selectedGitHubRepo?: GitHubRepoSelection
  setSelectedGitHubRepo: (repository: string, branch: string) => void
  clearSelectedGitHubRepo: () => void
  getSelectedGitHubRepo: () => GitHubRepoSelection | undefined
  // Terminal management
  terminals: Terminal[]
  addTerminal: (terminal: Terminal) => void
  removeTerminal: (terminalId: string) => void
  updateTerminal: (terminalId: string, updates: Partial<Terminal>) => void
  getTerminal: (terminalId: string) => Terminal | undefined
  clearTerminals: () => void
  // Terminal history management
  addTerminalOutput: (terminalId: string, output: TerminalOutput) => void
  addCommandToHistory: (terminalId: string, command: string) => void
  updateWorkingDirectory: (terminalId: string, directory: string) => void
  getTerminalHistory: (terminalId: string) => TerminalOutput[]
  getCommandHistory: (terminalId: string) => string[]
  // Terminal session management
  terminalSessions: TerminalSession[]
  openTerminal: (terminalId: string) => void
  closeTerminal: (terminalId: string) => void
  toggleMinimizeTerminal: (terminalId: string) => void
  getTerminalSession: (terminalId: string) => TerminalSession | undefined
  // File management
  lastFileUpdate: number | null
  setLastFileUpdate: (timestamp: number) => void
  updatePaths: (paths: string[], source: 'refresh' | 'tool') => void
  // Chat history management
  chatSessions: ChatSession[] // This will hold the array of chat sessions
  currentSessionId: string | null
  chatHistoryLoading: boolean
  pagination: PaginationInfo // This will hold pagination information
  saveChatSession: (messages: ChatUIMessage[]) => Promise<void>
  saveChatSessionImmediate: (messages: ChatUIMessage[], saveFiles?: boolean) => Promise<{ sessionId: string | null }>
  loadChatHistory: (page?: number, limit?: number) => Promise<void> // Update to accept pagination parameters
  clearChatHistory: () => Promise<void>
  deleteChatSession: (sessionId: string) => Promise<void>
  setChatHistoryLoading: (loading: boolean) => void
  resetCurrentSession: () => void
  saveSandboxToSession: (sessionId: string, sandboxId: string) => Promise<void>
  getSandboxFromSession: (sessionId: string) => { sandboxId: string; isValid: boolean } | null
  // Preview refresh management
  previewRefreshTrigger: number
  triggerPreviewRefresh: () => void
  // Deployment URL management
  saveDeploymentUrlToSession: (deploymentUrl?: string, customDomain?: string) => Promise<void>
}

export const useSandboxStore = create<SandboxStore>()(
  subscribeWithSelector((set, get) => ({
    // Welcome screen state
    isWelcomeScreen: true,
    setIsWelcomeScreen: (isWelcome: boolean) => {
      logger.state('ui', 'Setting welcome screen state', { isWelcome })
      set(() => ({ isWelcomeScreen: isWelcome }))
    },
    addLog: (data) => {
      logger.state('sandbox', 'Adding log to command', {
        sandboxId: data.sandboxId,
        cmdId: data.cmdId,
        logStream: data.log.stream,
        logDataLength: data.log.data.length
      })

      set((state) => {
        const idx = state.commands.findIndex((c) => c.cmdId === data.cmdId)
        if (idx === -1) {
          logger.warn('Command not found when adding log', {
            cmdId: data.cmdId,
            sandboxId: data.sandboxId,
            availableCommands: state.commands.map(c => c.cmdId)
          })
          return state
        }
        const updatedCmds = [...state.commands]
        updatedCmds[idx] = {
          ...updatedCmds[idx],
          logs: [...(updatedCmds[idx].logs ?? []), data.log],
        }

        logger.state('sandbox', 'Log added to command successfully', {
          sandboxId: data.sandboxId,
          cmdId: data.cmdId,
          totalLogs: updatedCmds[idx].logs?.length ?? 0
        })

        return { ...state, commands: updatedCmds }
      })
    },
    addPaths: (paths) => {
      logger.state('sandbox', 'Adding paths to sandbox', {
        newPaths: paths,
        pathCount: paths.length
      })

      set((state) => {
        const updatedPaths = [...new Set([...state.paths, ...paths])]
        
        logger.state('sandbox', 'Paths added successfully', {
          totalPaths: updatedPaths.length,
          addedPaths: paths.length
        })

        return { paths: updatedPaths }
      })
    },
    removePath: (path) => {
      logger.state('sandbox', 'Removing path from sandbox', { path })

      set((state) => {
        const updatedPaths = state.paths.filter(p => p !== path)
        
        logger.state('sandbox', 'Path removed successfully', {
          removedPath: path,
          totalPaths: updatedPaths.length
        })

        return { paths: updatedPaths }
      })
    },
    clearPaths: () => {
      logger.state('sandbox', 'Clearing all paths from sandbox')

      set((state) => {
        logger.state('sandbox', 'All paths cleared successfully', {
          clearedCount: state.paths.length
        })

        return { paths: [] }
      })
    },
    replacePaths: (paths) => {
      logger.state('sandbox', 'Replacing all paths in sandbox', {
        newPaths: paths,
        pathCount: paths.length
      })

      set((state) => {
        const updatedPaths = [...new Set(paths)]
        
        logger.state('sandbox', 'Paths replaced successfully', {
          totalPaths: updatedPaths.length,
          previousCount: state.paths.length
        })

        return { paths: updatedPaths }
      })
    },
    commands: [],
    paths: [],
    creatingSandbox: false,
    setCreatingSandbox: (creating: boolean) => {
      set(() => ({
        creatingSandbox: creating
      }))
    },
    previewLoading: false,
    setSandboxId: (sandboxId) => {
      logger.state('sandbox', 'Setting new sandbox ID', {
        sandboxId,
        previousState: 'reset'
      })

      set(() => ({
        sandboxId,
        creatingSandbox: false,
        status: 'running',
        commands: [],
        paths: [],
        url: undefined,
      }))
      
      // Update URL when sandbox ID changes
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('sandbox', sandboxId)
        window.history.replaceState({}, '', url.toString())
        
        logger.state('sandbox', 'Browser URL updated with sandbox ID', {
          sandboxId,
          newUrl: url.toString()
        })
      }

      logger.state('sandbox', 'Sandbox ID set successfully', {
        sandboxId,
        status: 'running'
      })
    },
    setStatus: (status) => {
      logger.state('sandbox', 'Updating sandbox status', { status })
      set(() => ({ status }))
    },
    setUrl: (url) => {
      logger.state('sandbox', 'Setting sandbox URL', { url })
      set(() => ({ url }))
    },
    setPreviewLoading: (previewLoading) => {
      logger.state('sandbox', 'Setting preview loading state', { previewLoading })
      set(() => ({ previewLoading }))
    },
    setDeploymentUrl: (deploymentUrl) => {
      logger.state('sandbox', 'Setting deployment URL', { deploymentUrl })
      set(() => ({ deploymentUrl }))
    },
    upsertCommand: (cmd) => {
      logger.state('sandbox', 'Upserting command', {
        cmdId: cmd.cmdId,
        sandboxId: cmd.sandboxId,
        command: cmd.command,
        args: cmd.args
      })

      set((state) => {
        const existingIdx = state.commands.findIndex((c) => c.cmdId === cmd.cmdId)
        const idx = existingIdx !== -1 ? existingIdx : state.commands.length
        const prev = state.commands[idx] ?? { startedAt: Date.now(), logs: [] }
        const cmds = [...state.commands]
        cmds[idx] = { ...prev, ...cmd }

        logger.state('sandbox', 'Command upserted successfully', {
          cmdId: cmd.cmdId,
          isNew: existingIdx === -1,
          totalCommands: cmds.length
        })

        return { commands: cmds }
      })
    },
    connectToExistingSandbox: async (sandboxId, shouldGetPreview) => {
      logger.state('sandbox', 'Connecting to existing sandbox', {
        sandboxId,
        preserveState: true
      })

      set(() => ({
        sandboxId,
        status: 'running',
        // Don't reset commands and paths when connecting to existing sandbox
        // commands: [],
        // paths: [],
        // url: undefined,
      }))
      
      // Update URL when connecting to existing sandbox
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('sandbox', sandboxId)
        window.history.replaceState({}, '', url.toString())
        
        logger.state('sandbox', 'Browser URL updated for existing sandbox', {
          sandboxId,
          newUrl: url.toString()
        })
      }

      if (shouldGetPreview) {
        // Set loading state before starting the readiness check
        set(() => ({ previewLoading: true }))
        
        try {
          // Get sandbox URL and wait for dev server to be ready
          const result = await getSandboxUrlWhenReady({
            sandboxId,
            port: 3000,
            contextId: `connect-existing-${sandboxId}`,
            waitForReady: true,
            maxAttempts: 16, // 16 attempts * 15 seconds = 4 minutes max wait
            intervalMs: 15000
          })

          // Update the URL in the store (check if still current sandbox)
          const currentState = get()
          if (currentState.sandboxId === sandboxId) {
            set(() => ({ 
              url: result.url,
              previewLoading: false // Reset loading state when ready
            }))
            logger.state('sandbox', 'Sandbox URL retrieved and updated for existing sandbox', {
              sandboxId,
              url: result.url,
              duration: result.duration,
              ready: result.ready,
              readinessAttempts: result.readinessAttempts
            })
          }
        } catch (error) {
          logger.error('Failed to get sandbox URL for existing sandbox', error, {
            sandboxId,
            contextId: `connect-existing-${sandboxId}`
          })
          
          // Reset loading state on error
          const currentState = get()
          if (currentState.sandboxId === sandboxId) {
            set(() => ({ previewLoading: false }))
          }
        }

        logger.state('sandbox', 'Connected to existing sandbox successfully', {
          sandboxId
        })
      }
    },
    // Terminal management
    terminals: [],
    addTerminal: (terminal) => {
      logger.state('sandbox', 'Adding terminal to sandbox', {
        terminalId: terminal.terminalId,
        name: terminal.name,
        sandboxId: terminal.sandboxId
      })

      set((state) => {
        // Ensure terminal has required arrays
        const normalizedTerminal = {
          ...terminal,
          history: terminal.history || [],
          commandHistory: terminal.commandHistory || []
        }

        // Check for duplicates
        const existingTerminal = state.terminals.find(t => t.terminalId === terminal.terminalId)
        if (existingTerminal) {
          const terminals = state.terminals.map(t => 
            t.terminalId === terminal.terminalId ? normalizedTerminal : t
          )
          return { terminals }
        }
        
        const terminals = [...state.terminals, normalizedTerminal]
        
        logger.state('sandbox', 'Terminal added successfully', {
          terminalId: terminal.terminalId,
          totalTerminals: terminals.length
        })

        return { terminals }
      })
    },
    removeTerminal: (terminalId) => {
      logger.state('sandbox', 'Removing terminal from sandbox', { terminalId })

      set((state) => {
        const terminals = state.terminals.filter(t => t.terminalId !== terminalId)
        const terminalSessions = state.terminalSessions.filter(s => s.terminalId !== terminalId)
        
        logger.state('sandbox', 'Terminal removed successfully', {
          terminalId,
          remainingTerminals: terminals.length
        })

        return { terminals, terminalSessions }
      })
    },
    updateTerminal: (terminalId, updates) => {
      logger.state('sandbox', 'Updating terminal', {
        terminalId,
        updates: Object.keys(updates)
      })

      set((state) => {
        const terminals = state.terminals.map(t => 
          t.terminalId === terminalId 
            ? { 
                ...t, 
                ...updates, 
                lastActivity: new Date(),
                // Ensure arrays exist
                history: t.history || [],
                commandHistory: t.commandHistory || []
              }
            : t
        )

        logger.state('sandbox', 'Terminal updated successfully', {
          terminalId,
          updatedFields: Object.keys(updates)
        })

        return { terminals }
      })
    },
    getTerminal: (terminalId) => {
      const state = get()
      return state.terminals.find(t => t.terminalId === terminalId)
    },
    clearTerminals: () => {
      logger.state('sandbox', 'Clearing all terminals')

      set((state) => {
        logger.state('sandbox', 'All terminals cleared', {
          clearedCount: state.terminals.length
        })

        return { terminals: [], terminalSessions: [] }
      })
    },
    // Terminal session management
    terminalSessions: [],
    openTerminal: (terminalId) => {
      logger.state('terminal-session', 'Opening terminal', { terminalId })

      set((state) => {
        const existingSession = state.terminalSessions.find(s => s.terminalId === terminalId)
        
        if (existingSession) {
          // Update existing session
          const terminalSessions = state.terminalSessions.map(s =>
            s.terminalId === terminalId
              ? { ...s, isOpen: true, isMinimized: false }
              : s
          )
          return { terminalSessions }
        } else {
          // Create new session
          const newSession: TerminalSession = {
            terminalId,
            isOpen: true,
            isMinimized: false
          }
          const terminalSessions = [...state.terminalSessions, newSession]
          return { terminalSessions }
        }
      })
    },
    closeTerminal: (terminalId) => {
      logger.state('terminal-session', 'Closing terminal', { terminalId })

      set((state) => {
        const terminalSessions = state.terminalSessions.filter(s => s.terminalId !== terminalId)
        return { terminalSessions }
      })
    },
    toggleMinimizeTerminal: (terminalId) => {
      logger.state('terminal-session', 'Toggling minimize terminal', { terminalId })

      set((state) => {
        const terminalSessions = state.terminalSessions.map(s =>
          s.terminalId === terminalId
            ? { ...s, isMinimized: !s.isMinimized }
            : s
        )
        return { terminalSessions }
      })
    },
    getTerminalSession: (terminalId) => {
      const state = get()
      return state.terminalSessions.find(s => s.terminalId === terminalId)
    },
    // Terminal history management
    addTerminalOutput: (terminalId, output) => {
      logger.state('terminal-history', 'Adding output to terminal', {
        terminalId,
        outputType: output.type,
        contentLength: output.content.length
      })

      set((state) => {
        const terminals = state.terminals.map(t =>
          t.terminalId === terminalId
            ? { ...t, history: [...(t.history || []), output], lastActivity: new Date() }
            : t
        )
        return { terminals }
      })
    },
    addCommandToHistory: (terminalId, command) => {
      logger.state('terminal-history', 'Adding command to history', {
        terminalId,
        command
      })

      set((state) => {
        const terminals = state.terminals.map(t =>
          t.terminalId === terminalId
            ? { ...t, commandHistory: [...(t.commandHistory || []), command] }
            : t
        )
        return { terminals }
      })
    },
    updateWorkingDirectory: (terminalId, directory) => {
      logger.state('terminal-history', 'Updating working directory', {
        terminalId,
        directory
      })

      set((state) => {
        const terminals = state.terminals.map(t =>
          t.terminalId === terminalId
            ? { ...t, workingDirectory: directory, lastActivity: new Date() }
            : t
        )
        return { terminals }
      })
    },
    getTerminalHistory: (terminalId) => {
      const state = get()
      const terminal = state.terminals.find(t => t.terminalId === terminalId)
      return terminal?.history || []
    },
    getCommandHistory: (terminalId) => {
      const state = get()
      const terminal = state.terminals.find(t => t.terminalId === terminalId)
      return terminal?.commandHistory || []
    },
    // File management
    lastFileUpdate: null,
    setLastFileUpdate: (timestamp: number) => {
      logger.state('file-refresh', 'Setting last file update timestamp', { timestamp })
      set(() => ({ lastFileUpdate: timestamp }))
    },
    updatePaths: (paths: string[], source: 'refresh' | 'tool') => {
      logger.state('file-refresh', 'Updating paths from refresh', {
        pathCount: paths.length,
        source
      })

      set((state) => {
        const updatedPaths = [...new Set(paths)]
        
        logger.state('file-refresh', 'Paths updated from refresh', {
          totalPaths: updatedPaths.length,
          source,
          previousCount: state.paths.length
        })

        return { 
          paths: updatedPaths,
          lastFileUpdate: Date.now()
        }
      })
    },
    // Chat history management
    chatSessions: [],
    currentSessionId: null,
    chatHistoryLoading: false,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    },
    setChatHistoryLoading: (loading: boolean) => {
      set(() => ({ chatHistoryLoading: loading }))
    },
    saveChatSession: async (messages: ChatUIMessage[]) => {
      // Do nothing - we only save on completion now
      console.log('[CHAT] saveChatSession called but ignored - only saving on completion')
    },
    saveChatSessionImmediate: async (messages: ChatUIMessage[], saveFiles: boolean = false) => {
      // Non-debounced version for immediate saves (e.g., on completion, user message)
      if (messages.length === 0) return { sessionId: null }

      const state = get()
      
      try {
        if (state.currentSessionId) {
          // Update existing session
          const sandboxIdToSend = saveFiles ? state.sandboxId : undefined
          const result = await updateChatSessionInKV(state.currentSessionId, messages, sandboxIdToSend)
          if (result.success && result.session) {
            set((state) => ({
              chatSessions: state.chatSessions.map(s => 
                s.id === state.currentSessionId ? result.session! : s
              )
            }))
            
            logger.state('chat-history', 'Chat session updated (immediate)', {
              sessionId: state.currentSessionId,
              messageCount: messages.length,
              sandboxId: state.sandboxId,
              saveFiles
            })
          }

          return { sessionId: state.currentSessionId || null }
        } else {
          // Create new session
          const sandboxIdToSend = saveFiles ? state.sandboxId : undefined
          const result = await saveChatSessionToKV(messages, undefined, sandboxIdToSend)
          if (result.success && result.session && result.sessionId) {
            set((state) => ({
              chatSessions: [result.session!, ...state.chatSessions],
              currentSessionId: result.sessionId,
              // Update pagination total when adding new session
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1,
                totalPages: Math.ceil((state.pagination.total + 1) / state.pagination.limit)
              }
            }))
            
            logger.state('chat-history', 'New chat session created (immediate)', {
              sessionId: result.sessionId,
              messageCount: messages.length,
              sandboxId: state.sandboxId,
              saveFiles
            })
          }

          return { sessionId: result.sessionId || null }
        }

      } catch (error) {
        console.error('Failed to save chat session (immediate):', error)
      }

      return { sessionId: state.currentSessionId || null }
    },
    loadChatHistory: async (page: number = 1, limit: number = 10) => {
      set(() => ({ chatHistoryLoading: true }))
      
      try {
        const result = await loadChatHistoryFromKV(page, limit)
        set(() => ({ 
          chatSessions: result.sessions,
          pagination: result.pagination,
          chatHistoryLoading: false 
        }))
        
        logger.state('chat-history', 'Chat history loaded', {
          sessionCount: result.sessions.length,
          page: result.pagination.page,
          totalPages: result.pagination.totalPages
        })
      } catch (error) {
        console.error('Failed to load chat history:', error)
        set(() => ({ chatHistoryLoading: false }))
      }
    },
    clearChatHistory: async () => {
      set(() => ({ chatHistoryLoading: true }))
      
      try {
        const success = await clearChatHistoryFromKV()
        if (success) {
          set(() => ({ 
            chatSessions: [],
            currentSessionId: null,
            chatHistoryLoading: false 
          }))
          
          logger.state('chat-history', 'Chat history cleared')
        } else {
          set(() => ({ chatHistoryLoading: false }))
        }
      } catch (error) {
        console.error('Failed to clear chat history:', error)
        set(() => ({ chatHistoryLoading: false }))
      }
    },
    deleteChatSession: async (sessionId: string) => {
      try {
        const success = await deleteChatSessionFromKV(sessionId)
        if (success) {
          set((state) => ({
            chatSessions: state.chatSessions.filter(s => s.id !== sessionId),
            currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId
          }))
          
          logger.state('chat-history', 'Chat session deleted', { sessionId })
        }
      } catch (error) {
        console.error('Failed to delete chat session:', error)
      }
    },
    resetCurrentSession: () => {
      set(() => ({ currentSessionId: null }))
      logger.state('chat-history', 'Current session reset')
    },
    saveSandboxToSession: async (sessionId: string, sandboxId: string) => {
      try {
        const sandboxMetadata = {
          sandboxId,
          createdAt: Date.now(),
          expiresAt: Date.now() + (SANDBOX_EXPIRATION_TIME * 60 * 1000) // 45 minutes from now
        }

        const response = await fetch(`/api/chat-history/${sessionId}/sandbox`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sandbox: sandboxMetadata }),
        })

        if (response.ok) {
          // Update local state
          set((state) => ({
            chatSessions: state.chatSessions.map(session =>
              session.id === sessionId
                ? { ...session, sandbox: sandboxMetadata }
                : session
            )
          }))

          logger.state('chat-history', 'Sandbox metadata saved to session', {
            sessionId,
            sandboxId,
            expiresAt: sandboxMetadata.expiresAt
          })
        }
      } catch (error) {
        console.error('Failed to save sandbox metadata to session:', error)
      }
    },
    getSandboxFromSession: (sessionId: string) => {
      const state = get()
      const session = state.chatSessions.find(s => s.id === sessionId)
      
      if (!session?.sandbox) {
        return null
      }

      const now = Date.now()
      const isValid = now < session.sandbox.expiresAt

      logger.state('chat-history', 'Retrieved sandbox from session', {
        sessionId,
        sandboxId: session.sandbox.sandboxId,
        isValid,
        expiresAt: session.sandbox.expiresAt,
        timeRemaining: isValid ? session.sandbox.expiresAt - now : 0
      })

      return {
        sandboxId: session.sandbox.sandboxId,
        isValid
      }
    },
    // Custom domain management
    customDomain: undefined,
    setCustomDomain: (customDomain) => {
      logger.state('custom-domain', 'Setting custom domain state', {
        domain: customDomain?.domain,
        verified: customDomain?.verified,
        projectName: customDomain?.projectName
      })
      set(() => ({ customDomain }))
    },
    verifyCustomDomain: async (projectName: string, domain: string) => {
      logger.state('custom-domain', 'Verifying custom domain', { projectName, domain })
      
      try {
        const response = await fetch('/api/vercel/domain/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectName,
            domain,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          const verified = result.verified
          const error = result.error
          
          // Update the custom domain state
          const state = get()
          if (state.customDomain?.domain === domain) {
            set(() => ({
              customDomain: {
                ...state.customDomain!,
                verified,
                lastVerified: Date.now()
              }
            }))
          }
          
          logger.state('custom-domain', 'Domain verification completed', {
            domain,
            verified,
            error
          })
          
          return { verified, error }
        } else {
          const error = result.error || 'Failed to verify domain'
          logger.state('custom-domain', 'Domain verification failed', {
            domain,
            error
          })
          return { verified: false, error }
        }
      } catch (error) {
        const errorMessage = 'Network error occurred while verifying domain'
        logger.state('custom-domain', 'Domain verification network error', {
          domain,
          error: errorMessage
        })
        return { verified: false, error: errorMessage }
      }
    },
    getDisplayUrl: () => {
      const state = get()
      // Prioritize verified custom domain over deployment URL
      if (state.customDomain?.verified && state.customDomain?.domain) {
        return `https://${state.customDomain.domain}`
      }
      return state.deploymentUrl
    },
    // GitHub repository selection management
    selectedGitHubRepo: loadGitHubRepoFromSession(),
    setSelectedGitHubRepo: (repository: string, branch: string) => {
      const selection = { repository, branch }
      set(() => ({ selectedGitHubRepo: selection }))
      saveGitHubRepoToSession(selection)
    },
    clearSelectedGitHubRepo: () => {
      set(() => ({ selectedGitHubRepo: undefined }))
      saveGitHubRepoToSession(undefined)
    },
    getSelectedGitHubRepo: () => {
      const state = get()
      return state.selectedGitHubRepo
    },
    // Preview refresh management
    previewRefreshTrigger: 0,
    triggerPreviewRefresh: () => {
      logger.state('preview-refresh', 'Triggering preview refresh')
      set((state) => ({ previewRefreshTrigger: state.previewRefreshTrigger + 1 }))
    },
    // Deployment URL management
    saveDeploymentUrlToSession: async (deploymentUrl?: string, customDomain?: string) => {
      const state = get()
      if (!state.currentSessionId) {
        logger.warn('No current session to save deployment URL to')
        return
      }

      try {
        const response = await fetch(`/api/chat-history/${state.currentSessionId}/deployment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            latestDeploymentUrl: deploymentUrl,
            latestCustomDomain: customDomain
          }),
        })

        if (response.ok) {
          // Update local state
          set((state) => ({
            chatSessions: state.chatSessions.map(session =>
              session.id === state.currentSessionId
                ? { 
                    ...session, 
                    latestDeploymentUrl: deploymentUrl,
                    latestCustomDomain: customDomain,
                    lastUpdated: Date.now()
                  }
                : session
            )
          }))

          logger.state('chat-history', 'Deployment URLs saved to session', {
            sessionId: state.currentSessionId,
            deploymentUrl,
            customDomain
          })
        }
      } catch (error) {
        console.error('Failed to save deployment URLs to session:', error)
      }
    }
  }))
)

export function useDataStateMapper() {
  const { setSandboxId, upsertCommand, addPaths, removePath, replacePaths, clearPaths, setUrl, addTerminal, clearTerminals, saveSandboxToSession, currentSessionId } = useSandboxStore()
  
  return (data: DataUIPart<DataPart>) => {
    switch (data.type) {
      case 'data-create-sandbox':
        if (data.data.sandboxId) {
          setSandboxId(data.data.sandboxId)

          // Save sandbox metadata to current session if we have one
          if (currentSessionId) {
            saveSandboxToSession(currentSessionId, data.data.sandboxId)
              .catch(error => {
                console.error('Failed to save sandbox metadata to session:', error)
              })
          }
        }
        break
      case 'data-create-terminal':
        // Terminal created successfully, add to terminal list (but don't auto-open)
        if (data.data.status === 'done' && !data.data.error && data.data.terminalId) {
          const terminal: Terminal = {
            terminalId: data.data.terminalId,
            name: data.data.name,
            sandboxId: data.data.sandboxId,
            workingDirectory: data.data.workingDirectory || '.',
            status: 'ready',
            createdAt: new Date(),
            history: [],
            commandHistory: []
          }
          
          addTerminal(terminal)
          
          logger.state('terminal', 'Added created terminal to state', {
            terminalId: data.data.terminalId,
            name: data.data.name,
            sandboxId: data.data.sandboxId
          })
        }
        break
      case 'data-list-terminals':
        // Handle list-terminals results - convert string dates to Date objects if needed
        if (data.data.status === 'done' && !data.data.error && 'terminals' in data.data && data.data.terminals) {
          const terminals: Terminal[] = data.data.terminals.map((terminalData: any) => ({
            terminalId: terminalData.terminalId,
            name: terminalData.name,
            sandboxId: data.data.sandboxId,
            workingDirectory: terminalData.workingDirectory,
            status: terminalData.status,
            createdAt: typeof terminalData.createdAt === 'string' ? new Date(terminalData.createdAt) : terminalData.createdAt,
            history: terminalData.history || [],
            commandHistory: terminalData.commandHistory || []
          }))
          
          // Clear existing terminals and add the fetched ones (but don't auto-open)
          clearTerminals()
          terminals.forEach(terminal => addTerminal(terminal))
          // Note: We do NOT auto-open terminals when listing them
          
          logger.state('terminal', 'Updated terminals from list-terminals data (not auto-opened)', {
            terminalCount: terminals.length,
            sandboxId: data.data.sandboxId
          })
        }
        break
      case 'data-create-file':
        // File created successfully, add to paths so it shows in file explorer
        if (data.data.status === 'done' && !data.data.error && data.data.path) {
          const normalizedPath = data.data.path.startsWith('/') ? data.data.path : `/${data.data.path}`
          addPaths([normalizedPath])
          logger.state('file-explorer', 'Added created file to paths', {
            path: normalizedPath,
            sandboxId: data.data.sandboxId
          })
        }
        break
      case 'data-delete-file':
        // File deleted successfully, remove from paths so it disappears from file explorer
        if (data.data.status === 'done' && !data.data.error && data.data.path) {
          const normalizedPath = data.data.path.startsWith('/') ? data.data.path : `/${data.data.path}`
          removePath(normalizedPath)
          logger.state('file-explorer', 'Removed deleted file from paths', {
            path: normalizedPath,
            sandboxId: data.data.sandboxId
          })
        }
        break
      case 'data-execute-command':
        if (data.data.commandId) {
          upsertCommand({
            sandboxId: data.data.sandboxId,
            cmdId: data.data.commandId,
            command: data.data.command,
            args: data.data.args,
            startedAt: Date.now(),
          })
        }
        break
      case 'data-generating-files':
        // Files generated successfully, add to paths so they show in file explorer
        if (data.data.status === 'done' && !data.data.error && data.data.paths) {
          const normalizedPaths = data.data.paths.map(path => path.startsWith('/') ? path : `/${path}`)
          addPaths(normalizedPaths)
          logger.state('file-explorer', 'Added generated files to paths', {
            paths: normalizedPaths,
            pathCount: normalizedPaths.length
          })
        }
        break
      case 'data-list-files':
        // Handle list-files results - both success and error cases
        if (data.data.status === 'done') {
          if (data.data.error) {
            // On error, log but don't clear existing paths unless it's a root directory listing
            const basePath = data.data.path || ''
            const isRootListing = !basePath || basePath === '.' || basePath === '/'
            
            logger.warn('List-files operation failed', {
              basePath: data.data.path,
              error: data.data.error,
              isRootListing,
              sandboxId: data.data.sandboxId
            })
            
            // Only clear paths for root directory errors to avoid losing valid file tree state
            if (isRootListing) {
              logger.state('file-explorer', 'Clearing paths due to root directory listing error', {
                basePath: data.data.path,
                error: data.data.error
              })
              clearPaths()
            }
          } else if (data.data.files) {
            // Success case - process and normalize file paths
            const basePath = data.data.path || ''
            const normalizedBasePath = normalizeBasePath(basePath)
            
            const filePaths = data.data.files.map((file: any) => {
              return normalizeFilePath(file.path, normalizedBasePath)
            })
            
            // Filter out invalid paths and deduplicate
            const validPaths = [...new Set(filePaths.filter(isValidPath))]
            
            if (validPaths.length > 0) {
              const isRootListing = !basePath || basePath === '.' || basePath === '/'
              
              if (isRootListing) {
                // For root directory listings, replace all paths to ensure clean state
                replacePaths(validPaths)
                logger.state('file-explorer', 'Replaced all paths with root directory listing', {
                  basePath: data.data.path,
                  paths: validPaths,
                  pathCount: validPaths.length,
                  totalFilesFromListFiles: data.data.files.length
                })
              } else {
                // For subdirectory listings, add to existing paths
                addPaths(validPaths)
                logger.state('file-explorer', 'Added listed files to paths', {
                  basePath: data.data.path,
                  paths: validPaths,
                  pathCount: validPaths.length,
                  totalFilesFromListFiles: data.data.files.length
                })
              }
            } else {
              logger.warn('No valid paths found in list-files result', {
                basePath: data.data.path,
                filesCount: data.data.files.length,
                rawFiles: data.data.files,
                processedPaths: filePaths
              })
              
              // If this was a root listing and we got no valid paths, clear existing paths
              const isRootListing = !basePath || basePath === '.' || basePath === '/'
              if (isRootListing) {
                clearPaths()
                logger.state('file-explorer', 'Cleared paths due to empty root directory listing', {
                  basePath: data.data.path
                })
              }
            }
          } else {
            // No files array provided - treat as empty directory
            const basePath = data.data.path || ''
            const isRootListing = !basePath || basePath === '.' || basePath === '/'
            
            if (isRootListing) {
              clearPaths()
              logger.state('file-explorer', 'Cleared paths due to empty root directory', {
                basePath: data.data.path
              })
            }
          }
        }
        break
      case 'data-get-sandbox-url':
        if (data.data.url) {
          setUrl(data.data.url)
        }
        break
      default:
        break
    }
  }
}

// Hook to initialize sandbox from URL on page load
export function useSandboxFromURL() {
  const { connectToExistingSandbox, sandboxId } = useSandboxStore()
  
  // Initialize sandbox from URL parameter on mount
  if (typeof window !== 'undefined' && !sandboxId) {
    const urlParams = new URLSearchParams(window.location.search)
    const sandboxFromURL = urlParams.get('sandbox')
    
    if (sandboxFromURL) {
      // Verify the sandbox exists before connecting
      fetch('/api/sandboxes/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId: sandboxFromURL,
        }),
      })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          connectToExistingSandbox(sandboxFromURL)
        } else {
          console.warn('Failed to connect to sandbox from URL:', result.error)
          // Remove invalid sandbox from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('sandbox')
          window.history.replaceState({}, '', url.toString())
        }
      })
      .catch(error => {
        console.error('Error connecting to sandbox:', error)
        // Remove invalid sandbox from URL
        const url = new URL(window.location.href)
        url.searchParams.delete('sandbox')
        window.history.replaceState({}, '', url.toString())
      })
    }
  }
  
  return { sandboxId }
}
