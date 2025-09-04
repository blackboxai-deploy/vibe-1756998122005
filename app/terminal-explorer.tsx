'use client'

import { TerminalExplorer as TerminalExplorerComponent } from '@/components/terminal-explorer/terminal-explorer'
import { useSandboxStore } from './state'

interface Props {
  className: string
  isCollapsed: boolean
  onToggle?: () => void
}

export function TerminalExplorer({ className, isCollapsed, onToggle }: Props) {
  const { sandboxId, status, terminals } = useSandboxStore()
  
  return (
    <TerminalExplorerComponent
      className={className}
      disabled={status === 'stopped'}
      sandboxId={sandboxId}
      terminals={terminals}
      isCollapsed={isCollapsed}
      onToggle={onToggle || (() => {})}
    />
  )
}
