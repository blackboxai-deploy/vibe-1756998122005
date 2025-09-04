import { logger } from '@/lib/logger'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}

export interface RefreshStatus {
  stage: 'idle' | 'connecting' | 'fetching' | 'processing' | 'complete' | 'error'
  message: string
  progress?: number
  fileCount?: number
  duration?: number
  timestamp: number
}

interface RefreshResult {
  success: boolean
  files: FileItem[]
  error?: string
  status: RefreshStatus
}

export class FileRefreshService {
  private static instance: FileRefreshService | null = null
  private statusCallbacks: Set<(status: RefreshStatus) => void> = new Set()

  static getInstance(): FileRefreshService {
    if (!FileRefreshService.instance) {
      FileRefreshService.instance = new FileRefreshService()
    }
    return FileRefreshService.instance
  }

  onStatusChange(callback: (status: RefreshStatus) => void) {
    this.statusCallbacks.add(callback)
    return () => this.statusCallbacks.delete(callback)
  }

  private updateStatus(status: Partial<RefreshStatus>) {
    const fullStatus: RefreshStatus = {
      stage: 'idle',
      message: '',
      timestamp: Date.now(),
      ...status
    }
    
    this.statusCallbacks.forEach(callback => callback(fullStatus))
  }

  async refreshFiles(sandboxId: string, path: string = '.', recursive: boolean = true): Promise<RefreshResult> {
    const startTime = Date.now()
    
    logger.info('Starting on-demand file refresh', {
      sandboxId,
      path,
      recursive
    })

    // Update status: Connecting
    this.updateStatus({
      stage: 'connecting',
      message: 'Connecting to sandbox...',
      progress: 10
    })

    try {
      // Update status: Fetching
      this.updateStatus({
        stage: 'fetching',
        message: 'Fetching file list...',
        progress: 30
      })

      const response = await fetch('/api/list-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sandboxId,
          path,
          recursive
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        const errorMessage = `Request failed: ${response.status} ${response.statusText}`
        
        logger.error('File refresh API request failed', new Error(errorText), {
          sandboxId,
          path,
          status: response.status,
          statusText: response.statusText
        })

        const errorStatus: RefreshStatus = {
          stage: 'error',
          message: errorMessage,
          timestamp: Date.now(),
          duration: Date.now() - startTime
        }

        this.updateStatus(errorStatus)
        
        return {
          success: false,
          files: [],
          error: errorMessage,
          status: errorStatus
        }
      }

      // Update status: Processing
      this.updateStatus({
        stage: 'processing',
        message: 'Processing files...',
        progress: 70
      })

      const result = await response.json()
      const duration = Date.now() - startTime

      if (result.success && result.files) {
        const successStatus: RefreshStatus = {
          stage: 'complete',
          message: `Loaded ${result.files.length} items`,
          progress: 100,
          fileCount: result.files.length,
          duration,
          timestamp: Date.now()
        }

        this.updateStatus(successStatus)

        logger.info('File refresh completed successfully', {
          sandboxId,
          path,
          recursive,
          fileCount: result.files.length,
          duration
        })

        return {
          success: true,
          files: result.files,
          status: successStatus
        }
      } else {
        const errorMessage = result.error || 'Unknown error occurred'
        const errorStatus: RefreshStatus = {
          stage: 'error',
          message: errorMessage,
          timestamp: Date.now(),
          duration
        }

        this.updateStatus(errorStatus)

        logger.warn('File refresh returned unsuccessful result', {
          sandboxId,
          path,
          result,
          duration
        })

        return {
          success: false,
          files: [],
          error: errorMessage,
          status: errorStatus
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred'
      
      const errorStatus: RefreshStatus = {
        stage: 'error',
        message: errorMessage,
        timestamp: Date.now(),
        duration
      }

      this.updateStatus(errorStatus)

      logger.error('File refresh failed with exception', error, {
        sandboxId,
        path,
        recursive,
        duration
      })

      return {
        success: false,
        files: [],
        error: errorMessage,
        status: errorStatus
      }
    }
  }
}

export const fileRefreshService = FileRefreshService.getInstance()
