'use client'

import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { FolderIcon, ScrollTextIcon, XIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileSidePanelProps {
  fileExplorerContent: ReactNode
  logsContent: ReactNode
  className?: string
}

type PanelTab = 'file-explorer' | 'logs' | null

interface SidePanelButtonProps {
  tabId: PanelTab
  isActive: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}

function SidePanelButton({ tabId, isActive, onClick, icon, label }: SidePanelButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-2 text-xs font-mono transition-colors w-full',
        'hover:bg-secondary/50 border-r-2 border-transparent',
        isActive && 'border-primary bg-secondary text-primary font-semibold'
      )}
      title={label}
    >
      {icon}
      <span className="mt-1 text-xs">{label}</span>
    </button>
  )
}

export function MobileSidePanel({ 
  fileExplorerContent, 
  logsContent,
  className 
}: MobileSidePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const tabs = [
    {
      id: 'file-explorer' as PanelTab,
      label: 'Files',
      icon: <FolderIcon className="w-4 h-4" />,
      content: fileExplorerContent,
    },
    {
      id: 'logs' as PanelTab,
      label: 'Logs',
      icon: <ScrollTextIcon className="w-4 h-4" />,
      content: logsContent,
    },
  ]

  const handleTabClick = (tabId: PanelTab) => {
    if (activeTab === tabId) {
      // If clicking the same tab, toggle expansion
      setIsExpanded(!isExpanded)
    } else {
      // If clicking a different tab, open it and expand
      setActiveTab(tabId)
      setIsExpanded(true)
    }
  }

  const handleClose = () => {
    setActiveTab(null)
    setIsExpanded(false)
  }

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  return (
    <div className={cn('flex h-full', className)}>
      {/* Side Panel Tabs */}
      <div className="flex flex-col w-16 border-r border-border bg-background/95 backdrop-blur-sm">
        {tabs.map((tab) => (
          <SidePanelButton
            key={tab.id}
            tabId={tab.id}
            isActive={activeTab === tab.id}
            onClick={() => handleTabClick(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      {/* Expandable Panel Content */}
      {isExpanded && activeTabData && (
        <div className={cn(
          'flex flex-col bg-background border-r border-border transition-all duration-300 ease-in-out',
          'w-80 max-w-[80vw]'
        )}>
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
            <div className="flex items-center space-x-2 font-mono font-semibold text-sm">
              {activeTabData.icon}
              <span>{activeTabData.label}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
                title="Collapse"
              >
                <ChevronLeftIcon className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
                title="Close"
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTabData.content}
          </div>
        </div>
      )}
    </div>
  )
}
