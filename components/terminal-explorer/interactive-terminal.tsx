'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { 
  Terminal as TerminalIcon, 
  X, 
  Minimize2,
  Maximize2,
  Copy,
  Trash2
} from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { Terminal, TerminalOutput } from '@/app/types/terminal'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'

interface Props {
  terminal: Terminal
  onClose: () => void
  className?: string
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

export function InteractiveTerminal({ 
  terminal, 
  onClose, 
  className,
  isMinimized = false,
  onToggleMinimize
}: Props) {
  const [command, setCommand] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isExecuting, setIsExecuting] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const isMobile = useIsMobile()
  
  // Generate unique IDs for terminal outputs to prevent React key conflicts
  const generateUniqueId = (type: string): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `${terminal.terminalId}-${type}-${timestamp}-${random}`
  }
  const { 
    updateTerminal, 
    addTerminalOutput, 
    addCommandToHistory, 
    updateWorkingDirectory,
    getTerminalHistory,
    getCommandHistory
  } = useSandboxStore()

  // Get persistent state from store
  const output = getTerminalHistory(terminal.terminalId)
  const commandHistory = getCommandHistory(terminal.terminalId)
  const currentDirectory = terminal.workingDirectory

  // Auto-focus input when terminal opens
  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isMinimized])

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Add welcome message on mount if no history exists
  useEffect(() => {
    if (output.length === 0) {
      const welcomeOutput: TerminalOutput = {
        id: generateUniqueId('welcome'),
        type: 'output',
        content: `Terminal "${terminal.name}" ready\nWorking directory: ${terminal.workingDirectory}\nType commands and press Enter to execute.\n`,
        timestamp: new Date()
      }
      addTerminalOutput(terminal.terminalId, welcomeOutput)
    }
  }, [terminal.name, terminal.workingDirectory, terminal.terminalId, output.length, addTerminalOutput])

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return

    const trimmedCmd = cmd.trim()
    
    // Add command to history
    addCommandToHistory(terminal.terminalId, trimmedCmd)
    setHistoryIndex(-1)

    // Add command to output
    const commandOutput: TerminalOutput = {
      id: generateUniqueId('cmd'),
      type: 'command',
      content: `${currentDirectory}$ ${trimmedCmd}`,
      timestamp: new Date()
    }
    addTerminalOutput(terminal.terminalId, commandOutput)

    // Clear input and set executing state
    setCommand('')
    setIsExecuting(true)
    updateTerminal(terminal.terminalId, { status: 'busy' })

    try {
      const response = await fetch('/api/terminals/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId: terminal.sandboxId,
          terminalId: terminal.terminalId,
          command: trimmedCmd,
          workingDirectory: currentDirectory
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to execute command')
      }

      // Add output to terminal
      const outputContent: TerminalOutput = {
        id: generateUniqueId('output'),
        type: result.exitCode === 0 ? 'output' : 'error',
        content: result.output || '',
        timestamp: new Date(),
        exitCode: result.exitCode
      }
      addTerminalOutput(terminal.terminalId, outputContent)

      // Update working directory if server provided it (for cd commands)
      if (result.workingDirectory) {
        updateWorkingDirectory(terminal.terminalId, result.workingDirectory)
      }

      updateTerminal(terminal.terminalId, { 
        status: 'ready',
        lastActivity: new Date()
      })

    } catch (error) {
      const errorOutput: TerminalOutput = {
        id: generateUniqueId('error'),
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      addTerminalOutput(terminal.terminalId, errorOutput)
      
      updateTerminal(terminal.terminalId, { 
        status: 'error',
        lastActivity: new Date()
      })
      
      toast.error('Command execution failed')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(command)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommand(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCommand('')
        } else {
          setHistoryIndex(newIndex)
          setCommand(commandHistory[newIndex])
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Basic tab completion could be implemented here
    }
  }

  const clearTerminal = () => {
    // Clear terminal history in store
    const terminalData = useSandboxStore.getState().getTerminal(terminal.terminalId)
    if (terminalData) {
      useSandboxStore.getState().updateTerminal(terminal.terminalId, { history: [] })
    }
  }

  const copyOutput = () => {
    const text = output.map(o => o.content).join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Terminal output copied to clipboard')
  }

  if (isMinimized) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 bg-white text-black border border-gray-300 rounded-lg",
        className
      )}>
        <TerminalIcon className="w-4 h-4" />
        <span className="text-sm font-mono">{terminal.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleMinimize}
            className="h-6 w-6 p-0 text-black hover:text-gray-600 hover:bg-white border"
          >
            <Maximize2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 text-black hover:text-red-400 hover:bg-white border"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col bg-white text-gray-800 border-0 rounded-none overflow-hidden",
      className
    )} style={{ minHeight: '200px' }}>
      {/* Terminal Output */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={outputRef} className="p-4 font-mono text-sm leading-relaxed bg-white">
          {output.map((item) => (
            <div key={item.id} className={cn(
              "whitespace-pre-wrap break-words mb-1",
              item.type === 'command' && "text-blue-600",
              item.type === 'output' && "text-gray-600",
              item.type === 'error' && "text-red-500"
            )}>
              {item.content}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Terminal Input */}
      <div className="flex items-center px-4 py-3 bg-white border-t border-gray-100">
        <span className="text-blue-600 font-mono text-sm mr-2">
          /$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          className="flex-1 bg-transparent text-gray-700 font-mono text-sm outline-none placeholder-gray-400 border-0 p-0"
          placeholder={isExecuting ? "Executing..." : "Type a command..."}
          autoComplete="off"
          spellCheck={false}
          style={{
            fontSize: isMobile ? 13 : 15
          }}
        />
        {isExecuting && (
          <div className="ml-2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  )
}
