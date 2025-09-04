'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CollapsiblePanel, CollapsiblePanelHeader } from '@/components/panels/collapsible-panel'
import { cn } from '@/lib/utils'
import { 
  Terminal as TerminalIcon, 
  Plus, 
  Trash2,
  AlertCircle
} from 'lucide-react'
import { useSandboxStore } from '@/app/state'
import { Terminal } from '@/app/types/terminal'
import { CreateTerminalDialog } from './create-terminal-dialog'
import { TerminalCard } from './terminal-card'
import { InteractiveTerminal } from './interactive-terminal'

interface Props {
  className?: string
  disabled?: boolean
  sandboxId?: string
  terminals: Terminal[]
  isCollapsed: boolean
  onToggle: () => void
}

export function TerminalExplorer({ className, disabled, sandboxId, terminals, isCollapsed, onToggle }: Props) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { 
    removeTerminal, 
    clearTerminals, 
    terminalSessions,
    openTerminal,
    closeTerminal,
    toggleMinimizeTerminal,
    getTerminal
  } = useSandboxStore()

  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null)

  const handleRemoveTerminal = (terminalId: string) => {
    if (selectedTerminalId === terminalId) {
      setSelectedTerminalId(null)
    }
    removeTerminal(terminalId)
  }

  const handleClearAllTerminals = () => {
    setSelectedTerminalId(null)
    clearTerminals()
  }

  const handleOpenTerminal = (terminal: Terminal) => {
    setSelectedTerminalId(terminal.terminalId)
    openTerminal(terminal.terminalId)
  }

  const handleCloseTerminal = (terminalId: string) => {
    setSelectedTerminalId(null)
    closeTerminal(terminalId)
  }

  const handleToggleMinimize = (terminalId: string) => {
    toggleMinimizeTerminal(terminalId)
  }

  // Get open terminal sessions
  const openSessions = terminalSessions.filter(session => session.isOpen)
  

  if (!sandboxId) {
    return (
      <CollapsiblePanel
        className={className}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        header={
          <CollapsiblePanelHeader>
            <TerminalIcon className="w-4 mr-2 text-gray-500" />
            <span className="font-mono uppercase font-semibold">
              Terminal Explorer
            </span>
          </CollapsiblePanelHeader>
        }
      >
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <TerminalIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-2">No sandbox connected</p>
            <p className="text-xs text-gray-400">
              Connect to a sandbox to manage terminals
            </p>
          </div>
        </div>
      </CollapsiblePanel>
    )
  }

  return (
    <CollapsiblePanel
      className={className}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      header={
        <CollapsiblePanelHeader>
          <TerminalIcon className="w-4 mr-2" />
          <span className="font-mono uppercase font-semibold">
            Terminal Sessions
          </span>
          <div className="ml-2 flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            {terminals.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearAllTerminals}
                className="text-xs h-7 px-2 text-gray-600"
                disabled={disabled}
                title="Clear all terminals"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={disabled}
              className="text-xs h-7 px-2 text-gray-600"
              title="Create new terminal"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </CollapsiblePanelHeader>
      }
    >
      {disabled && (
        <div className="p-3 border-b border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 text-orange-700 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>Sandbox stopped - terminals unavailable</span>
          </div>
        </div>
      )}

      {/* Main Content Area - Responsive Layout */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Top Pane on Mobile / Left Pane on Desktop - Terminal List */}
        <div className={cn(
          "flex-shrink-0 bg-white",
          "md:w-1/4 md:border-r md:border-primary/18",
          "w-full h-auto md:h-full",
          "max-h-[200px] md:max-h-none overflow-y-auto"
        )}>
          {terminals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
              <div className="text-center text-gray-500">
                <TerminalIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm mb-3 font-medium">No terminals created</p>
                <Button
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={disabled}
                  className="text-xs h-8 bg-white hover:bg-white text-gray-600 border border-border"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Terminal
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-0">
                {terminals.map((terminal) => (
                  <TerminalCard
                    key={terminal.terminalId}
                    terminal={terminal}
                    onRemove={handleRemoveTerminal}
                    onOpen={handleOpenTerminal}
                    disabled={disabled}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Bottom Pane on Mobile / Right Pane on Desktop - Selected Terminal */}
        <div className={cn(
          "flex-1 min-w-0 overflow-hidden bg-white",
          "w-full h-auto md:h-full",
          "border-t md:border-t-0 md:border-l md:border-primary/18"
        )}>
          {!selectedTerminalId ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center text-gray-400">
                <TerminalIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm mb-2 font-medium text-gray-600">No terminal selected</p>
                <p className="text-xs text-gray-500">
                  Click on a terminal to open it here
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              {(() => {
                const terminal = getTerminal(selectedTerminalId)
                
                if (!terminal) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <div className="text-center text-red-600">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-sm mb-2 font-medium">Terminal not found</p>
                        <p className="text-xs text-gray-500">
                          The selected terminal may have been deleted
                        </p>
                      </div>
                    </div>
                  )
                }

                // Ensure createdAt is a Date object
                const normalizedTerminal = {
                  ...terminal,
                  createdAt: typeof terminal.createdAt === 'string' ? new Date(terminal.createdAt) : terminal.createdAt,
                  lastActivity: terminal.lastActivity 
                    ? (typeof terminal.lastActivity === 'string' ? new Date(terminal.lastActivity) : terminal.lastActivity)
                    : undefined
                }

                return (
                  <InteractiveTerminal
                    key={selectedTerminalId}
                    terminal={normalizedTerminal}
                    onClose={() => handleCloseTerminal(selectedTerminalId)}
                    className="h-full"
                  />
                )
              })()}
            </div>
          )}
        </div>
      </div>

      <CreateTerminalDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        sandboxId={sandboxId}
      />
    </CollapsiblePanel>
  )
}
