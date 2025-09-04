'use client'

import { useState } from 'react'

export interface CollapsiblePanelState {
  fileExplorer: boolean
  logs: boolean
  terminalExplorer: boolean
}

export function useCollapsiblePanels() {
  const [collapsed, setCollapsed] = useState<CollapsiblePanelState>({
    fileExplorer: true, // collapsed by default
    logs: true, // collapsed by default
    terminalExplorer: true
  })

  const togglePanel = (panelId: keyof CollapsiblePanelState) => {
    setCollapsed(prev => ({
      ...prev,
      [panelId]: !prev[panelId]
    }))
  }

  const isCollapsed = (panelId: keyof CollapsiblePanelState) => collapsed[panelId]

  return {
    collapsed,
    togglePanel,
    isCollapsed,
  }
}
