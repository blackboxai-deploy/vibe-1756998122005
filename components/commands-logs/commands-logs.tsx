'use client'

import type { Command, CommandLog } from './types'
import { CommandLogs } from './command-logs'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SquareChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CollapsiblePanel, CollapsiblePanelHeader } from '../panels/collapsible-panel'

interface Props {
  className?: string
  commands: Command[]
  isCollapsed: boolean
  onToggle: () => void
  onLog: (data: { sandboxId: string; cmdId: string; log: CommandLog }) => void
  onCompleted: (data: Command) => void
}

export function CommandsLogs(props: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [props.commands])

  return (
    <CollapsiblePanel
      className={props.className}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
      header={
        <CollapsiblePanelHeader>
          <SquareChevronRight className="mr-2 w-4" />
          <span className="font-mono uppercase font-semibold">
            Sandbox Remote Output
          </span>
        </CollapsiblePanelHeader>
      }
    >
      <div className="h-full">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {props.commands.map((command) => (
              <CommandLogs
                key={command.cmdId}
                command={command}
                onLog={props.onLog}
                onCompleted={props.onCompleted}
              />
            ))}
          </div>
          <div ref={bottomRef} />
        </ScrollArea>
      </div>
    </CollapsiblePanel>
  )
}
