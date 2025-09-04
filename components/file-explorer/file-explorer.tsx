'use client'

import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FileIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from 'lucide-react'
import { FileContent } from '@/components/file-explorer/file-content'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { buildFileTree, type FileNode } from './build-file-tree'
import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { RefreshStatus } from '@/lib/file-refresh-service'
import { CollapsiblePanel, CollapsiblePanelHeader } from '../panels/collapsible-panel'

interface Props {
  className: string
  disabled?: boolean
  paths: string[]
  sandboxId?: string
  onRefresh?: (isRetry?: boolean) => void
  isRefreshing?: boolean
  refreshError?: string | null
  refreshStatus?: RefreshStatus | null
  sandboxUrl?: string
  onRetry?: () => void
  canRetry?: boolean
  isCollapsed: boolean
  onToggle: () => void
}

export function FileExplorer({ 
  className, 
  disabled, 
  paths, 
  sandboxId, 
  onRefresh,
  isRefreshing,
  refreshError,
  refreshStatus,
  sandboxUrl,
  onRetry,
  canRetry,
  isCollapsed, 
  onToggle
}: Props) {
  const fileTree = useMemo(() => buildFileTree(paths), [paths])
  const [selected, setSelected] = useState<FileNode | null>(null)
  const [fs, setFs] = useState<FileNode[]>(fileTree)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Reset file tree when paths change, but preserve expanded state
  useEffect(() => {
    const preserveExpandedState = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => ({
        ...node,
        expanded: expandedPaths.has(node.path),
        children: node.children ? preserveExpandedState(node.children) : undefined
      }))
    }
    
    setFs(preserveExpandedState(fileTree))
  }, [fileTree, paths, expandedPaths])

  // Clear selection if selected file no longer exists
  useEffect(() => {
    if (selected && !paths.includes(selected.path)) {
      setSelected(null)
    }
  }, [paths, selected])

  const toggleFolder = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })

    const updateNode = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.path === path && node.type === 'directory') {
          return { ...node, expanded: !node.expanded }
        } else if (node.children) {
          return { ...node, children: updateNode(node.children) }
        } else {
          return node
        }
      })
    setFs(updateNode(fs))
  }

  const selectFile = (node: FileNode) => {
    if (node.type === 'file') {
      setSelected(node)
    }
  }

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={cn(
            `flex items-center py-1 sm:py-0.5 px-2 sm:px-1 cursor-pointer touch-manipulation`,
            {'bg-white': selected?.path === node.path }
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleFolder(node.path)
            } else {
              selectFile(node)
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              {node.expanded ? (
                <ChevronDownIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
              ) : (
                <ChevronRightIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
              )}
              <FolderIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
            </>
          ) : (
            <>
              <div className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
              <FileIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
            </>
          )}
          <span className="text-xs sm:text-sm truncate min-w-0 flex-1">{node.name}</span>
        </div>

        {node.type === 'directory' && node.expanded && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ))
  }

  return (
    <CollapsiblePanel
      className={className}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      header={
        <CollapsiblePanelHeader>
          <FileIcon className="w-4 mr-2" />
          <span className="font-mono uppercase font-semibold">
            Sandbox Remote Filesystem
          </span>
          <div className="ml-2 flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            {/* Enhanced refresh status indicator */}
            {refreshStatus && refreshStatus.stage !== 'idle' && (
              <div className="flex items-center gap-1 text-xs min-w-0">
                {refreshStatus.stage === 'complete' ? (
                  <CheckCircleIcon className="w-3 h-3 text-green-600 flex-shrink-0" />
                ) : refreshStatus.stage === 'error' ? (
                  <AlertCircleIcon className="w-3 h-3 text-red-600 flex-shrink-0" />
                ) : (
                  <RefreshCwIcon className={cn("w-3 h-3 text-blue-600 flex-shrink-0", {
                    "animate-spin": isRefreshing
                  })} />
                )}
                <span className={cn("truncate min-w-0", {
                  "text-green-600": refreshStatus.stage === 'complete',
                  "text-red-600": refreshStatus.stage === 'error',
                  "text-blue-600": refreshStatus.stage !== 'complete' && refreshStatus.stage !== 'error'
                })}>
                  {refreshStatus.message}
                </span>
                {refreshStatus.duration && (
                  <span className="text-gray-400 hidden sm:inline flex-shrink-0">
                    ({refreshStatus.duration}ms)
                  </span>
                )}
              </div>
            )}
            
            {/* Fallback error display if no refreshStatus */}
            {refreshError && (!refreshStatus || refreshStatus.stage === 'idle') && (
              <span className="text-xs text-red-600 flex-shrink-0 flex items-center gap-1" title={`Refresh error: ${refreshError}`}>
                <AlertCircleIcon className="w-3 h-3" />
                Error
              </span>
            )}
            
            {onRefresh && !disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRefresh()
                }}
                disabled={isRefreshing}
                className="px-1.5 sm:px-2 py-1 text-xs bg-white hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex-shrink-0"
                title={isRefreshing ? "Refreshing..." : "Refresh file list"}
              >
                {isRefreshing ? (
                  <RefreshCwIcon className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCwIcon className="w-3 h-3" />
                )}
              </button>
            )}
            
            {selected && !disabled && (
              <span className="text-gray-500 text-xs sm:text-sm truncate min-w-0 hidden sm:inline" title={selected.path}>
                {selected.path}
              </span>
            )}
          </div>
        </CollapsiblePanelHeader>
      }
    >
      <div className="flex flex-col sm:flex-row text-sm h-full">
        <ScrollArea className="w-full sm:w-1/4 h-1/2 sm:h-full border-b sm:border-b-0 sm:border-r border-primary/18 flex-shrink-0">
          {fs.length === 0 ? (
            <div className="mt-6 flex flex-col justify-center items-center p-2 sm:p-4 text-center text-gray-500">
              <div className="mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm font-medium mb-1">No files found</p>
                <p className="text-xs text-gray-400 mb-2 sm:mb-4">
                  The sandbox filesystem appears to be empty or disconnected.
                </p>
              </div>
              
              {refreshError && (
                <div className="mb-2 sm:mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <div className="flex items-center gap-1 text-red-600 mb-1">
                    <AlertCircleIcon className="w-3 h-3" />
                    <span className="font-medium">Connection Error</span>
                  </div>
                  <p className="text-red-500 break-words">{refreshError}</p>
                  {canRetry && onRetry && (
                    <button
                      onClick={onRetry}
                      className="mt-2 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
                    >
                      Retry ({3 - (canRetry ? 0 : 3)} attempts left)
                    </button>
                  )}
                </div>
              )}

              {sandboxUrl && (
                <div className="mb-2 sm:mb-4">
                  <p className="text-xs text-gray-600 mb-2">Try reloading the sandbox:</p>
                  <button
                    onClick={() => window.open(sandboxUrl, '_blank')}
                    className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs transition-colors"
                  >
                    <ExternalLinkIcon className="w-3 h-3" />
                    Open Sandbox
                  </button>
                </div>
              )}

              {onRefresh && !disabled && (
                <button
                  onClick={() => onRefresh()}
                  disabled={isRefreshing}
                  className="px-2 sm:px-3 py-1 bg-white hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded text-xs transition-colors border border-border"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Files"}
                </button>
              )}
            </div>
          ) : (
            <div className="min-h-0">{renderFileTree(fs)}</div>
          )}
        </ScrollArea>
        {selected && sandboxId && !disabled && (
          <ScrollArea className="w-full sm:w-3/4 h-1/2 sm:h-full flex-shrink-0">
            <FileContent
              sandboxId={sandboxId}
              path={selected.path.substring(1)}
            />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </CollapsiblePanel>
  )
}
