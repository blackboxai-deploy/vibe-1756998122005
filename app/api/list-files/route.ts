import { NextRequest, NextResponse } from 'next/server'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { logger } from '@/lib/logger'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, path = '.', recursive = true } = await request.json()

    if (!sandboxId) {
      return NextResponse.json(
        { success: false, error: 'Sandbox ID is required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    
    logger.info('API: Starting file listing operation', {
      sandboxId,
      path,
      recursive
    })

    const sandbox = await getSandbox({ sandboxId })
    
    // Build command - use find for recursive, ls -la for non-recursive with file type info
    let cmd
    if (recursive) {
      logger.info('API: Executing find command for recursive file listing', {
        sandboxId,
        path
      })
      
      cmd = await sandbox.runCommand({
        cmd: 'find',
        args: [
          path, 
          '-maxdepth', '10',
          // Exclude common directories that are not needed
          '-not', '-path', '*/node_modules*',
          '-not', '-path', '*/.git*', 
          '-not', '-path', '*/.next*',
          '-not', '-path', '*/dist*',
          '-not', '-path', '*/build*',
          '-not', '-path', '*/.cache*',
          '-not', '-path', '*/coverage*',
          '-not', '-path', '*/.nyc_output*',
          '-not', '-path', '*/logs*',
          '-not', '-path', '*/*.log*',
          '-not', '-name', '*.map',
          '-not', '-name', '*.tsbuildinfo',
          '-not', '-name', '.DS_Store',
          // Add type information to output: -printf '%p|%y\n'
          // %p = path, %y = file type (f=file, d=directory, l=link, etc.)
          '-printf', '%p|%y\n'
        ],
        detached: true
      })
    } else {
      logger.info('API: Executing ls command for detailed file listing', {
        sandboxId,
        path
      })

      cmd = await sandbox.runCommand({
        cmd: 'ls',
        args: ['-la', path],
        detached: true
      })
    }

    // Wait for command to complete and get output
    const done = await cmd.wait()
    const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()])

    if (done.exitCode !== 0) {
      const duration = Date.now() - startTime
      logger.error('API: Command failed', new Error(stderr || 'Unknown error'), {
        sandboxId,
        path,
        exitCode: done.exitCode,
        stderr,
        duration
      })

      // Try to provide more specific error messages
      let errorMessage = 'Directory listing failed'
      if (stderr?.toLowerCase().includes('no such file')) {
        errorMessage = 'Directory not found'
      } else if (stderr?.toLowerCase().includes('permission denied')) {
        errorMessage = 'Permission denied'
      } else if (stderr?.toLowerCase().includes('not a directory')) {
        errorMessage = 'Path is not a directory'
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        files: []
      })
    }

    const files = parseLsOutput(stdout || '', stderr || '', recursive, path)
    const duration = Date.now() - startTime

    logger.info('API: File listing completed successfully', {
      sandboxId,
      path,
      recursive,
      fileCount: files.length,
      duration
    })

    return NextResponse.json({
      success: true,
      files,
      path,
      recursive,
      duration
    })

  } catch (error) {
    logger.error('API: Failed to list files', error, {
      sandboxId: 'unknown',
      path: 'unknown'
    })

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        files: []
      },
      { status: 500 }
    )
  }
}

function parseLsOutput(stdout: string, stderr: string, recursive: boolean, basePath: string): FileItem[] {
  const files: FileItem[] = []
  
  // Normalize base path for consistent handling
  const normalizedBasePath = basePath.replace(/\/+$/, '') || '.'
  
  // If stderr contains errors, log them but try to continue
  if (stderr && stderr.trim()) {
    console.warn('Command stderr:', stderr)
  }
  
  // If stdout is empty, the directory might be empty (which is valid)
  if (!stdout || !stdout.trim()) {
    return files
  }
  
  const lines = stdout.split('\n').filter(line => line.trim())
  
  if (recursive) {
    // Handle find command output with type information: path|type
    for (const line of lines) {
      if (!line.trim()) continue
      
      const parts = line.split('|')
      if (parts.length !== 2) {
        console.warn('Invalid find output format:', line)
        continue
      }
      
      const [fullPath, fileType] = parts
      
      // Normalize path - remove base path prefix and leading slashes
      let relativePath = fullPath
      if (fullPath.startsWith(normalizedBasePath)) {
        relativePath = fullPath.substring(normalizedBasePath.length).replace(/^\/+/, '')
      }
      
      // Skip the base directory itself and empty paths
      if (!relativePath || relativePath === '.' || relativePath === normalizedBasePath) continue
      
      // Extract the filename from the path
      const pathParts = relativePath.split('/')
      const name = pathParts[pathParts.length - 1]
      
      // Skip hidden files and directories unless they're important
      // if (name.startsWith('.') && !['..', '.env', '.gitignore', '.gitkeep'].includes(name)) {
      //   continue
      // }
      
      // Determine file type from find output
      // f=file, d=directory, l=symbolic link, etc.
      const isDirectory = fileType === 'd'
      
      files.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        path: relativePath,
        size: undefined
      })
    }
  } else {
    // Handle ls -la output - parse detailed format
    for (const line of lines) {
      if (!line.trim()) continue
      
      // ls -la format: permissions links owner group size date time name
      // Example: drwxr-xr-x  3 user group  96 Dec 10 10:30 dirname
      // Example: -rw-r--r--  1 user group 123 Dec 10 10:30 filename.txt
      
      const parts = line.trim().split(/\s+/)
      if (parts.length < 9) continue // Skip invalid lines
      
      const permissions = parts[0]
      const name = parts.slice(8).join(' ') // Handle names with spaces
      
      // Skip current and parent directory entries
      if (name === '.' || name === '..') continue
      
      // Skip hidden files and directories unless they're important
      // if (name.startsWith('.') && !['..', '.env', '.gitignore', '.gitkeep'].includes(name)) {
      //   continue
      // }
      
      // Determine file type from permissions string
      // First character: d=directory, -=file, l=link, etc.
      const isDirectory = permissions.startsWith('d')
      
      // Extract file size for files
      let size: number | undefined
      if (!isDirectory && parts[4] && !isNaN(parseInt(parts[4]))) {
        size = parseInt(parts[4])
      }
      
      files.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        path: name,
        size
      })
    }
  }
  
  return files.sort((a, b) => {
    // Sort directories first, then files, then alphabetically
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}
