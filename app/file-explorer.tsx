'use client'

import { FileExplorer as FileExplorerComponent } from '@/components/file-explorer/file-explorer'
import { useSandboxStore } from './state'
import { fileRefreshService, type RefreshStatus } from '@/lib/file-refresh-service'
import { useCallback, useState, useEffect } from 'react'
import { logger } from '@/lib/logger'

interface Props {
  className: string
  isCollapsed: boolean
  onToggle?: () => void
}

export function FileExplorer({ className, isCollapsed, onToggle }: Props) {
  const { 
    sandboxId, 
    status, 
    paths,
    updatePaths,
    url
  } = useSandboxStore()
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Subscribe to refresh status updates
  useEffect(() => {
    const unsubscribe = fileRefreshService.onStatusChange((status) => {
      setRefreshStatus(status)
      
      if (status.stage === 'complete') {
        setIsRefreshing(false)
        setRefreshError(null)
        setRetryCount(0)
      } else if (status.stage === 'error') {
        setIsRefreshing(false)
        setRefreshError(status.message)
      } else if (status.stage !== 'idle') {
        setIsRefreshing(true)
        setRefreshError(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Manual refresh functionality with retry logic
  const handleRefresh = useCallback(async (isRetry = false) => {
    if (!sandboxId || status !== 'running') {
      logger.warn('Cannot refresh files - sandbox not ready', {
        sandboxId,
        status
      })
      return
    }

    if (!isRetry) {
      setRetryCount(0)
    }

    setIsRefreshing(true)
    setRefreshError(null)

    logger.state('file-explorer', 'Manual refresh triggered', { 
      sandboxId,
      isRetry,
      retryCount
    })

    try {
      const result = await fileRefreshService.refreshFiles(sandboxId, '.', true)
      
      if (result.success) {
        // Convert file items to paths for consistency with existing data format
        const filePaths = result.files.map((file: any) => {
          // Ensure paths start with '/' for consistency
          return file.path.startsWith('/') ? file.path : `/${file.path}`
        })
        
        updatePaths(filePaths, 'refresh')
        
        logger.state('file-explorer', 'Manual refresh completed successfully', {
          sandboxId,
          fileCount: result.files.length,
          retryCount
        })
      } else {
        setRefreshError(result.error || 'Refresh failed')
        logger.error('Manual refresh failed', new Error(result.error), {
          sandboxId,
          retryCount
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setRefreshError(errorMessage)
      logger.error('Manual refresh failed with exception', error, {
        sandboxId,
        retryCount
      })
    }
  }, [sandboxId, status, updatePaths, retryCount])

  // Retry functionality with exponential backoff
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      setRetryCount(prev => prev + 1)
      
      setTimeout(() => {
        handleRefresh(true)
      }, delay)
    }
  }, [retryCount, handleRefresh])

  return (
    <FileExplorerComponent
      className={className}
      disabled={status === 'stopped'}
      sandboxId={sandboxId}
      paths={paths}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      refreshError={refreshError}
      refreshStatus={refreshStatus}
      sandboxUrl={url}
      onRetry={handleRetry}
      canRetry={retryCount < 3}
      isCollapsed={isCollapsed}
      onToggle={onToggle || (() => {})}
    />
  )
}
