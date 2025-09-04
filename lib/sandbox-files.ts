import { Sandbox } from '@vercel/sandbox'

export interface FileDiscoveryResult {
  success: boolean
  filePaths: string[]
  error?: string
}

export interface FileFilterOptions {
  excludeGitignore?: boolean
  excludeEnvFiles?: boolean
}

/**
 * Filter function to exclude build artifacts and unwanted files
 */
export const shouldIncludeFile = (filePath: string, options: FileFilterOptions = {}): boolean => {
  const { excludeGitignore = false, excludeEnvFiles = true } = options
  
  const excludePatterns = [
    // Node.js
    /^node_modules\//,
    /^\.npm\//,
    /^npm-debug\.log/,
    /^yarn-error\.log/,
    /^yarn-debug\.log/,
    /^\.yarn\//,
    /^\.pnp\./,
    /^\.pnpm-store\//,
    
    // Build artifacts
    /^dist\//,
    /^build\//,
    /^out\//,
    /^\.next\//,
    /^\.nuxt\//,
    /^\.output\//,
    /^\.vercel\//,
    /^\.netlify\//,
    
    // Cache directories
    /^\.cache\//,
    /^\.parcel-cache\//,
    /^\.turbo\//,
    /^\.swc\//,
    
    // IDE and editor files
    /^\.vscode\//,
    /^\.idea\//,
    /^\.vs\//,
    /^\.sublime-/,
    /^\.atom\//,
    
    // OS files
    /^\.DS_Store$/,
    /^Thumbs\.db$/,
    /^desktop\.ini$/,
    
    // Git
    /^\.git\//,
    
    // Logs
    /\.log$/,
    /^logs\//,
    
    // Coverage
    /^coverage\//,
    /^\.nyc_output\//,
    
    // Temporary files
    /^tmp\//,
    /^temp\//,
    /~$/,
    /\.tmp$/,
    /\.temp$/,
  ]

  // Conditionally add patterns based on options
  if (excludeGitignore) {
    excludePatterns.push(/^\.gitignore$/)
  }

  if (excludeEnvFiles) {
    excludePatterns.push(
      /^\.env$/,
      /^\.env\.local$/,
      /^\.env\.development$/,
      /^\.env\.production$/,
      /^\.local$/
    )
  }
  
  return !excludePatterns.some(pattern => pattern.test(filePath))
}

/**
 * Dynamically discover all files in a sandbox using find command with ls fallback
 */
export const discoverSandboxFiles = async (sandbox: Sandbox, filterOptions: FileFilterOptions = {}): Promise<FileDiscoveryResult> => {
  let filePaths: string[] = []

  try {
    // Use find command to get all files in the sandbox
    const findCmd = await sandbox.runCommand({
      detached: true,
      cmd: 'find',
      args: ['.', '-type', 'f'],
    })

    // Wait for the command to complete and get the output
    const findResult = await findCmd.wait()
    const stdout = await findResult.stdout()
    
    if (findResult.exitCode === 0) {
      // Parse the find output to get file paths
      const discoveredPaths = stdout
        .split('\n')
        .map(path => path.trim())
        .filter(path => path.length > 0)
        .map(path => path.startsWith('./') ? path.slice(2) : path) // Remove leading './'
        .filter(path => path.length > 0 && !path.startsWith('/')) // Ensure relative paths
      
      // Filter out unwanted files using the filter function
      filePaths = discoveredPaths.filter(path => shouldIncludeFile(path, filterOptions))
      
      console.log('Discovered files:', discoveredPaths.length)
      console.log('Filtered files:', filePaths.length)
      
      return {
        success: true,
        filePaths,
      }
    } else {
      // Fallback: if find command fails, try ls -la -R as backup
      console.warn('Find command failed, trying ls as fallback')
      const lsCmd = await sandbox.runCommand({
        detached: true,
        cmd: 'ls',
        args: ['-la', '-R'],
      })
      
      const lsResult = await lsCmd.wait()
      const lsStdout = await lsResult.stdout()
      
      if (lsResult.exitCode === 0) {
        // Parse ls -la -R output (more complex parsing needed)
        const lines = lsStdout.split('\n')
        let currentDir = ''
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          
          // Check if this is a directory header (ends with :)
          if (trimmedLine.endsWith(':')) {
            currentDir = trimmedLine.slice(0, -1).replace(/^\.\//, '') // Remove leading './' and trailing ':'
            if (currentDir === '.') currentDir = ''
            continue
          }
          
          // Skip empty lines and total lines
          if (!trimmedLine || trimmedLine.startsWith('total ')) continue
          
          // Parse file line (starts with permissions)
          if (trimmedLine.match(/^[-rwxd]/)) {
            const parts = trimmedLine.split(/\s+/)
            if (parts.length >= 9) {
              const fileName = parts.slice(8).join(' ') // Handle filenames with spaces
              if (fileName !== '.' && fileName !== '..') {
                const fullPath = currentDir ? `${currentDir}/${fileName}` : fileName
                if (parts[0].startsWith('-')) { // Only files, not directories
                  if (shouldIncludeFile(fullPath, filterOptions)) {
                    filePaths.push(fullPath)
                  }
                }
              }
            }
          }
        }
        
        console.log('Discovered files via ls:', filePaths.length)
        
        return {
          success: true,
          filePaths,
        }
      } else {
        console.error('Both find and ls commands failed')
        return {
          success: false,
          filePaths: [],
          error: 'Both find and ls commands failed to discover files',
        }
      }
    }
  } catch (error) {
    console.error('Error discovering files:', error)
    return {
      success: false,
      filePaths: [],
      error: `Error discovering files: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Read file contents from discovered file paths
 */
export const readSandboxFiles = async (
  sandbox: Sandbox, 
  filePaths: string[]
): Promise<Array<{ path: string; content: string }>> => {
  const files = []
  
  for (const filePath of filePaths) {
    try {
      const fileStream = await sandbox.readFile({ path: filePath })
      if (fileStream) {
        const chunks: Buffer[] = []
        for await (const chunk of fileStream) {
          chunks.push(Buffer.from(chunk))
        }
        const content = Buffer.concat(chunks).toString('utf8')
        files.push({
          path: filePath,
          content,
        })
      }
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error)
      // Continue with other files
    }
  }
  
  return files
}
