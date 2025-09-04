'use client'

import { useQueryState } from 'nuqs'

export type PrimaryTab = 'split' // For mobile split view
export type SecondaryTab = 'file-explorer' | 'logs'

export function useMobileTabState() {
  // Primary tab state - for mobile we'll use 'split' to show the split view
  const [primaryTab, setPrimaryTab] = useQueryState('tab', { 
    defaultValue: 'split' as PrimaryTab 
  })
  
  // Secondary tab state - for file explorer and logs
  const [secondaryTab, setSecondaryTab] = useQueryState('secondaryTab', { 
    defaultValue: 'file-explorer' as SecondaryTab 
  })

  return {
    primaryTab,
    setPrimaryTab,
    secondaryTab,
    setSecondaryTab,
  } as const
}
