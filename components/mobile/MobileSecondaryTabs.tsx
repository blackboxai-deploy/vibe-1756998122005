'use client'

import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { FolderIcon, ScrollTextIcon, XIcon, MaximizeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileTaskbarProps {
  fileExplorerContent: ReactNode
  logsContent: ReactNode
  className?: string
}

type TaskbarTab = 'file-explorer' | 'logs' | null

interface TaskbarButtonProps {
  tabId: TaskbarTab
  isActive: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  hasNotification?: boolean
}

function TaskbarButton({ tabId, isActive, onClick, icon, label, hasNotification }: TaskbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center space-x-2 px-4 py-3 text-sm font-mono transition-colors relative',
        'hover:bg-secondary/50 border-t-2 border-transparent',
        isActive && 'border-primary bg-secondary text-primary font-semibold'
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {hasNotification && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  )
}

export function MobileTaskbar({ 
  fileExplorerContent, 
  logsContent,
  className 
}: MobileTaskbarProps) {
  const [activeTab, setActiveTab] = useState<TaskbarTab>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const tabs = [
    {
      id: 'file-explorer' as TaskbarTab,
      label: 'Files',
      icon: <FolderIcon className="w-4 h-4" />,
      content: fileExplorerContent,
    },
    {
      id: 'logs' as TaskbarTab,
      label: 'Logs',
      icon: <ScrollTextIcon className="w-4 h-4" />,
      content: logsContent,
    },
  ]

  const handleTabClick = (tabId: TaskbarTab) => {
    if (activeTab === tabId) {
      // If clicking the same tab, toggle fullscreen
      setIsFullscreen(!isFullscreen)
    } else {
      // If clicking a different tab, open it
      setActiveTab(tabId)
      setIsFullscreen(true)
    }
  }

  const handleClose = () => {
    setActiveTab(null)
    setIsFullscreen(false)
  }

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  return (
    <>
      {/* Fullscreen Overlay */}
      {isFullscreen && activeTabData && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/50">
            <div className="flex items-center space-x-2 font-mono font-semibold text-sm">
              {activeTabData.icon}
              <span>{activeTabData.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                className="h-6 w-6 p-0"
              >
                <MaximizeIcon className="w-3 h-3 rotate-180" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0"
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {/* Fullscreen Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTabData.content}
          </div>
        </div>
      )}

      {/* Taskbar */}
      <div className={cn(
        'flex items-center justify-center border-t border-border bg-background/95 backdrop-blur-sm',
        className
      )}>
        {tabs.map((tab) => (
          <TaskbarButton
            key={tab.id}
            tabId={tab.id}
            isActive={activeTab === tab.id}
            onClick={() => handleTabClick(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>
    </>
  )
}
