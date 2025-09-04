'use client'

import { CommandsLogs } from '@/components/commands-logs/commands-logs'
import { useSandboxStore } from './state'

interface Props {
  className?: string
  isCollapsed: boolean
  onToggle?: () => void
}


export function Logs(props: Props) {
  const { commands, addLog, upsertCommand } = useSandboxStore()
  return (
    <CommandsLogs
      className={props.className}
      commands={commands}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle || (() => {})}
      onLog={(data) => {
        addLog({
          sandboxId: data.sandboxId,
          cmdId: data.cmdId,
          log: data.log,
        })
      }}
      onCompleted={(data) => {
        upsertCommand(data)
      }}
    />
  )
}
