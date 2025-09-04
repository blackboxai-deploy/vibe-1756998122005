import type { Sandbox } from '@vercel/sandbox'
import type { CreateSandboxParams } from '@vercel/sandbox/dist/sandbox'
import ms from 'ms'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import { SANDBOX_EXPIRATION_TIME, SANDBOX_RETRY_CONFIG } from '@/ai/constants'
import { createSandbox as _createSandbox } from '@/lib/services/vercelSandbox'
import { restoreSessionFilesToSandbox } from '@/lib/services/fileCollection'

export interface SandboxInitializationOptions {
  timeout?: number
  ports?: number[]
  github?: {
    repo: string
    branch: string
    accessToken: string
  }
  copyStarterFiles?: boolean
  runNpmInstall?: boolean
  contextId?: string // Optional context ID for logging (replaces toolCallId)
  sessionId?: string // Optional session ID for file restoration
  runDevServer?: boolean // Optional flag to start dev server after setup
}

export interface SandboxInitializationResult {
  sandbox: Sandbox
  sandboxId: string
  duration: number
  starterFilesCopied: boolean
  npmInstallCompleted: boolean
  filePaths: string[]
  filesRestored: boolean
  restoredFileCount: number
  devServerStarted: boolean
}

function buildRemoteWithToken(repoCloneUrl: string, githubToken: string) {
  if (!repoCloneUrl) throw new Error("repoCloneUrl is required");
  // Convert SSH → HTTPS if needed (git@github.com:owner/repo.git → https://github.com/owner/repo.git)
  const httpsish = repoCloneUrl.startsWith("git@")
    ? repoCloneUrl.replace(/^git@([^:]+):/, "https://$1/")
    : repoCloneUrl;

  const url = new URL(httpsish);
  url.username = "x-access-token";
  url.password = githubToken; // URL will handle encoding
  return url.toString();
}

// Helper function to recursively read all files from a directory
async function readStarterFiles(dirPath: string, basePath: string = ''): Promise<Array<{ path: string; content: Buffer }>> {
  const files: Array<{ path: string; content: Buffer }> = []
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.join(basePath, entry.name)
      
      // Skip .DS_Store files and other hidden files
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
        continue
      }
      
      if (entry.isDirectory()) {
        // Recursively read subdirectories
        const subFiles = await readStarterFiles(fullPath, relativePath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        // Read file content
        const content = await fs.promises.readFile(fullPath)
        // Handle special case for gitignore.txt -> .gitignore
        const finalPath = entry.name === 'gitignore.txt' ? path.join(basePath, '.gitignore') : relativePath
        files.push({
          path: finalPath,
          content
        })
      }
    }
  } catch (error) {
    logger.error('Failed to read starter files', error, { dirPath, basePath })
    throw error
  }
  
  return files
}

// Helper function to create sandbox with retry logic and exponential backoff
async function createSandboxWithRetry(
  config: CreateSandboxParams,
  contextId?: string,
) {
  let retryCount = 0
  let backoffTime: number = SANDBOX_RETRY_CONFIG.INITIAL_DELAY

  while (retryCount <= SANDBOX_RETRY_CONFIG.MAX_RETRIES) {
    try {
      logger.info(`Attempt ${retryCount + 1}/${SANDBOX_RETRY_CONFIG.MAX_RETRIES + 1} to create sandbox`, {
        contextId,
        retryCount,
        backoffTime: retryCount > 0 ? backoffTime : 0
      })

      if (retryCount > 0) {
        logger.info(`Retrying in ${backoffTime}ms... (Attempt ${retryCount + 1}/${SANDBOX_RETRY_CONFIG.MAX_RETRIES + 1})`, {
          contextId
        })
        
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }

      // Log the exact config being sent to debug 400 errors
      logger.info('Sandbox config being sent to API', {
        contextId,
        config: JSON.stringify(config, null, 2),
        configKeys: Object.keys(config)
      })
      
      const sandbox = await _createSandbox(config)
      
      if (retryCount > 0) {
        logger.info(`Sandbox creation succeeded after ${retryCount + 1} attempts`, {
          contextId,
          sandboxId: sandbox.sandboxId
        })
      }
      
      return sandbox

    } catch (error: any) {
      const isRateLimited = error?.message?.includes('429') || 
                           error?.status === 429 || 
                           error?.response?.status === 429 ||
                           error?.message?.toLowerCase().includes('too many requests') ||
                           error?.message?.toLowerCase().includes('rate limit')

      logger.error(`Sandbox creation attempt ${retryCount + 1} failed`, error, {
        contextId,
        retryCount,
        isRateLimited,
        willRetry: retryCount < SANDBOX_RETRY_CONFIG.MAX_RETRIES
      })

      // If this is the last attempt or not a rate limit error, throw the error
      if (retryCount >= SANDBOX_RETRY_CONFIG.MAX_RETRIES || !isRateLimited) {
        if (isRateLimited) {
          const enhancedError = new Error(
            `Sandbox creation failed after ${retryCount + 1} attempts due to rate limiting. Please try again in a few minutes.`
          )
          enhancedError.cause = error
          throw enhancedError
        }
        throw error
      }

      retryCount++
      const nextBackoffTime = backoffTime * SANDBOX_RETRY_CONFIG.BACKOFF_MULTIPLIER
      backoffTime = Math.min(nextBackoffTime, SANDBOX_RETRY_CONFIG.MAX_DELAY)
    }
  }

  // This should never be reached, but just in case
  throw new Error('Sandbox creation failed after maximum retry attempts')
}

async function getFileListingFromSandbox(sandbox: Sandbox, contextId?: string): Promise<string[]> {
  try {
    const listCmd = await sandbox.runCommand({
      detached: false,
      cmd: 'find',
      args: ['.', '-maxdepth', '3', '-type', 'f', '!', '-path', './node_modules/*', '!', '-path', './.git/*', '!', '-name', '.*'],
    })

    const listResult = await listCmd.wait()
    const [listStdout] = await Promise.all([listResult.stdout()])

    if (listResult.exitCode === 0 && listStdout) {
      const filePaths = listStdout.split('\n')
        .filter(line => line.trim())
        .map(path => path.startsWith('./') ? path.substring(1) : path)
        .filter(path => path && path !== '.')

      logger.info('File listing completed', {
        contextId,
        sandboxId: sandbox.sandboxId,
        fileCount: filePaths.length
      })

      return filePaths
    }
  } catch (listError) {
    logger.error('Failed to list files, but continuing', listError, {
      sandboxId: sandbox.sandboxId,
      contextId
    })
  }
  
  return []
}

async function runNpmInstallInSandbox(sandbox: Sandbox, contextId?: string): Promise<boolean> {
  try {
    logger.info('Starting npm install', {
      contextId,
      sandboxId: sandbox.sandboxId
    })

    const installCmd = await sandbox.runCommand({
      detached: false,
      cmd: 'npm',
      args: ['install'],
    })

    // Wait for npm install to complete (with 3 minute timeout)
    const installResult = await Promise.race([
      installCmd.wait(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('npm install timeout')), 180000)
      )
    ])

    const [stdout, stderr] = await Promise.all([
      installResult.stdout(),
      installResult.stderr()
    ])

    if (installResult.exitCode === 0) {
      logger.info('npm install completed successfully', {
        contextId,
        sandboxId: sandbox.sandboxId,
        exitCode: installResult.exitCode
      })
      return true
    } else {
      logger.warn('npm install completed with warnings', {
        contextId,
        sandboxId: sandbox.sandboxId,
        exitCode: installResult.exitCode,
        stderr: stderr.substring(0, 500) // Log first 500 chars of stderr
      })
      return true // Consider warnings as success
    }
  } catch (installError) {
    logger.error('npm install failed', installError, {
      sandboxId: sandbox.sandboxId,
      contextId
    })
    return false
  }
}

async function startDevServerInSandbox(sandbox: Sandbox, contextId?: string): Promise<boolean> {
  try {
    logger.info('Starting dev server', {
      contextId,
      sandboxId: sandbox.sandboxId
    })

    // Start the dev server in detached mode (background process)
    const devCmd = await sandbox.runCommand({
      detached: true, // Run in background
      cmd: 'npm',
      args: ['run', 'dev'],
    })

    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    logger.info('Dev server started successfully', {
      contextId,
      sandboxId: sandbox.sandboxId
    })

    return true
  } catch (devError) {
    logger.error('Failed to start dev server', devError, {
      sandboxId: sandbox.sandboxId,
      contextId
    })
    return false
  }
}

/**
 * Initialize a sandbox with all the necessary setup steps
 * This function can be used both within tools and independently
 */
export async function initializeSandbox(options: SandboxInitializationOptions = {}): Promise<SandboxInitializationResult> {
  const {
    timeout,
    ports,
    github,
    copyStarterFiles = true,
    runNpmInstall = true,
    contextId,
    sessionId,
    runDevServer = false
  } = options

  const startTime = Date.now()
  
  logger.info('Starting sandbox initialization', {
    contextId,
    timeout,
    ports,
    copyStarterFiles,
    runNpmInstall,
    defaultTimeout: `${SANDBOX_EXPIRATION_TIME}m`
  })

  // Build sandbox configuration
  let sandboxConfig: CreateSandboxParams = {
    timeout: ms(`${SANDBOX_EXPIRATION_TIME}m`),
    ...(ports && ports.length > 0 ? { ports } : {})
  }

  if (github?.repo && github?.branch) {
    sandboxConfig = {
      ...sandboxConfig,
      source: {
        type: 'git',
        url: `https://github.com/${github.repo}.git`,
        username: 'x-access-token',   
        password: github.accessToken
      }
    }
  }

  // Create sandbox with retry logic
  const sandbox = await createSandboxWithRetry(sandboxConfig, contextId)

  const creationDuration = Date.now() - startTime
  logger.performance('sandbox-creation', creationDuration, {
    sandboxId: sandbox.sandboxId,
    contextId,
    ports
  })

  logger.info('Sandbox created successfully', {
    contextId,
    sandboxId: sandbox.sandboxId,
    exposedPorts: ports,
    creationTime: creationDuration
  })

  let starterFilesCopied = false
  let npmInstallCompleted = false
  let filePaths: string[] = []
  let filesRestored = false
  let restoredFileCount = 0
  let devServerStarted = false

  // Restore files from session if sessionId is provided and not using GitHub repo
  if (sessionId && !github?.repo) {
    try {
      logger.info('Attempting to restore files from session', {
        contextId,
        sandboxId: sandbox.sandboxId,
        sessionId
      })

      const restoreResult = await restoreSessionFilesToSandbox(sessionId, sandbox.sandboxId)
      
      if (restoreResult.success) {
        filesRestored = true
        restoredFileCount = restoreResult.restoredCount
        
        logger.info('Files restored from session successfully', {
          contextId,
          sandboxId: sandbox.sandboxId,
          sessionId,
          restoredCount: restoreResult.restoredCount
        })
      } else {
        logger.warn('Failed to restore files from session', {
          contextId,
          sandboxId: sandbox.sandboxId,
          sessionId,
          error: restoreResult.error
        })
      }
    } catch (error) {
      logger.error('Error during file restoration from session', error, {
        sandboxId: sandbox.sandboxId,
        contextId,
        sessionId
      })
    }
  }

  // Copy starter files if requested and not using GitHub repo and no files were restored
  if (copyStarterFiles && !github?.repo && !filesRestored) {
    try {
      logger.info('Starting to copy starter files', {
        contextId,
        sandboxId: sandbox.sandboxId
      })

      const starterFilesPath = path.join(process.cwd(), 'starter-files', 'user-workspace')
      const starterFiles = await readStarterFiles(starterFilesPath)
      
      logger.info(`Found ${starterFiles.length} starter files to copy`, {
        contextId,
        sandboxId: sandbox.sandboxId,
        fileCount: starterFiles.length
      })

      if (starterFiles.length > 0) {
        await sandbox.writeFiles(starterFiles)
        
        logger.info('Starter files copied successfully', {
          contextId,
          sandboxId: sandbox.sandboxId,
          fileCount: starterFiles.length
        })

        starterFilesCopied = true
      }
    } catch (error) {
      logger.error('Failed to copy starter files to sandbox', error, {
        sandboxId: sandbox.sandboxId,
        contextId
      })
      // Don't fail the entire operation if starter files can't be copied
      logger.info('Continuing without starter files due to copy error', {
        contextId,
        sandboxId: sandbox.sandboxId
      })
    }
  }

  // Get initial file listing
  filePaths = await getFileListingFromSandbox(sandbox, contextId)

  // Set up git configuration if GitHub repo is provided
  if (github?.accessToken && github?.branch && github?.repo) {
    try {
      const repoUrl = buildRemoteWithToken(`https://github.com/${github.repo}.git`, github.accessToken);

      logger.info('Setting up git config', {
        contextId,
        sandboxId: sandbox.sandboxId
      })

      await sandbox.runCommand('bash', ['-lc', `
        git config --global user.name "ai"
        git config --global user.email "ai@blackbox.ai"
        git remote set-url origin ${repoUrl}`])
    } catch (gitError) {
      logger.error('Failed to set up git configuration', gitError, {
        sandboxId: sandbox.sandboxId,
        contextId
      })
    }
  }

  // Run npm install and dev server in background if requested and not using GitHub repo
  if ((runNpmInstall || runDevServer) && !github?.repo) {
    // Start background process for npm install and dev server
    const backgroundProcess = (async () => {
      try {
        if (runNpmInstall) {
          const installSuccess = await runNpmInstallInSandbox(sandbox, contextId)
          if (installSuccess) {
            logger.info('Background npm install completed', {
              contextId,
              sandboxId: sandbox.sandboxId
            })
            
            // Start dev server after npm install if requested
            if (runDevServer) {
              const devServerSuccess = await startDevServerInSandbox(sandbox, contextId)
              logger.info('Background dev server start completed', {
                contextId,
                sandboxId: sandbox.sandboxId,
                success: devServerSuccess
              })
            }
          }
        }
      } catch (error) {
        logger.error('Background npm/dev server process failed', error, {
          sandboxId: sandbox.sandboxId,
          contextId
        })
      }
    })()

    // Don't await the background process - let it run independently
    backgroundProcess.catch(error => {
      logger.error('Unhandled error in background npm/dev server process', error, {
        sandboxId: sandbox.sandboxId,
        contextId
      })
    })

    // Set flags to indicate processes were started (not necessarily completed)
    npmInstallCompleted = runNpmInstall
    devServerStarted = runDevServer
  }

  const totalDuration = Date.now() - startTime
  logger.performance('sandbox-initialization-complete', totalDuration, {
    sandboxId: sandbox.sandboxId,
    contextId,
    ports,
    starterFilesCopied,
    npmInstallCompleted
  })

  logger.info('Sandbox initialization completed', {
    sandboxId: sandbox.sandboxId,
    contextId,
    duration: totalDuration,
    starterFilesCopied,
    npmInstallCompleted,
    fileCount: filePaths.length
  })

  return {
    sandbox,
    sandboxId: sandbox.sandboxId,
    duration: totalDuration,
    starterFilesCopied,
    npmInstallCompleted,
    filePaths,
    filesRestored,
    restoredFileCount,
    devServerStarted
  }
}
