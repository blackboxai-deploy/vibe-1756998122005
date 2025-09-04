'use server'

import { getSandbox } from '@/lib/services/vercelSandbox'
import { logger } from '@/lib/logger'
import { SandboxIdSchema, PortSchema } from '@/ai/tools/schemas'
import z from 'zod/v3'

export interface SandboxUrlOptions {
  sandboxId: string
  port: number
  contextId?: string // Optional context ID for logging (replaces toolCallId)
}

export interface SandboxUrlResult {
  url: string
  duration: number
  sandboxId: string
  port: number
}

/**
 * Get the URL for a sandbox port
 * This function can be used both within tools and independently
 */
export async function getSandboxUrl(options: SandboxUrlOptions): Promise<SandboxUrlResult> {
  const { sandboxId, port, contextId } = options
  const startTime = Date.now()

  // Validate input parameters
  const validationResult = z
    .object({ 
      sandboxId: SandboxIdSchema, 
      port: PortSchema 
    })
    .safeParse({ sandboxId, port })

  if (!validationResult.success) {
    const error = new Error(`Invalid input parameters: ${validationResult.error.message}`)
    logger.error('getSandboxUrl validation failed', error, {
      contextId,
      sandboxId,
      port,
      issues: validationResult.error.flatten().fieldErrors
    })
    throw error
  }

  logger.info('Starting to get sandbox URL', {
    contextId,
    sandboxId,
    port
  })

  try {
    logger.sandbox(sandboxId, 'Getting sandbox instance for URL generation', {
      contextId,
      port
    })

    const sandbox = await getSandbox({ sandboxId })
    
    logger.sandbox(sandboxId, 'Generating domain URL for port', {
      contextId,
      port
    })

    const url = sandbox.domain(port)

    const duration = Date.now() - startTime
    logger.performance('get-sandbox-url', duration, {
      sandboxId,
      port,
      url,
      contextId
    })

    logger.sandbox(sandboxId, 'Sandbox URL generated successfully', {
      contextId,
      port,
      url,
      duration
    })

    logger.info('URL generation completed', {
      sandboxId,
      port,
      url,
      contextId,
      duration
    })

    return {
      url,
      duration,
      sandboxId,
      port
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Failed to get sandbox URL', error, {
      contextId,
      sandboxId,
      port,
      duration
    })

    throw error
  }
}

/**
 * Validate sandbox URL parameters without executing the operation
 * Useful for pre-validation in tools or APIs
 */
export async function validateSandboxUrlParams(params: { sandboxId: string; port: number }): Promise<{
  success: boolean
  error?: z.ZodError
}> {
  const result = z
    .object({ 
      sandboxId: SandboxIdSchema, 
      port: PortSchema 
    })
    .safeParse(params)

  return {
    success: result.success,
    error: result.success ? undefined : result.error
  }
}

/**
 * Check if a dev server is ready by making HTTP requests
 */
export async function checkDevServerReady(url: string, contextId?: string): Promise<boolean> {
  try {
    logger.info('Checking if dev server is ready', {
      contextId,
      url
    })

    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    const isReady = response.ok
    
    logger.info('Dev server readiness check completed', {
      contextId,
      url,
      status: response.status,
      isReady
    })

    return isReady
  } catch (error) {
    logger.info('Dev server not ready yet', {
      contextId,
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

/**
 * Wait for dev server to be ready with polling
 */
export async function waitForDevServerReady(
  url: string, 
  options: {
    maxAttempts?: number
    intervalMs?: number
    contextId?: string
  } = {}
): Promise<{ ready: boolean; attempts: number; duration: number }> {
  const { maxAttempts = 30, intervalMs = 5000, contextId } = options
  const startTime = Date.now()
  
  logger.info('Starting to wait for dev server to be ready', {
    contextId,
    url,
    maxAttempts,
    intervalMs,
    maxWaitTime: maxAttempts * intervalMs
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isReady = await checkDevServerReady(url, contextId)
    
    if (isReady) {
      const duration = Date.now() - startTime
      logger.info('Dev server is ready!', {
        contextId,
        url,
        attempts: attempt,
        duration
      })
      return { ready: true, attempts: attempt, duration }
    }

    if (attempt < maxAttempts) {
      logger.info(`Dev server not ready, waiting ${intervalMs}ms before attempt ${attempt + 1}/${maxAttempts}`, {
        contextId,
        url,
        attempt
      })
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  const duration = Date.now() - startTime
  logger.warn('Dev server readiness timeout', {
    contextId,
    url,
    maxAttempts,
    duration
  })

  return { ready: false, attempts: maxAttempts, duration }
}

/**
 * Get sandbox URL and wait for dev server to be ready
 */
export async function getSandboxUrlWhenReady(options: SandboxUrlOptions & {
  waitForReady?: boolean
  maxAttempts?: number
  intervalMs?: number
}): Promise<SandboxUrlResult & { ready: boolean; readinessAttempts?: number }> {
  const { waitForReady = false, maxAttempts = 30, intervalMs = 5000, ...urlOptions } = options
  
  // First get the URL
  const urlResult = await getSandboxUrl(urlOptions)
  
  if (!waitForReady) {
    return { ...urlResult, ready: true }
  }

  // Then wait for the server to be ready
  const readinessResult = await waitForDevServerReady(urlResult.url, {
    maxAttempts,
    intervalMs,
    contextId: urlOptions.contextId
  })

  return {
    ...urlResult,
    ready: readinessResult.ready,
    readinessAttempts: readinessResult.attempts
  }
}

/**
 * Get multiple sandbox URLs in parallel
 * Useful when you need URLs for multiple ports on the same sandbox
 */
export async function getMultipleSandboxUrls(
  sandboxId: string, 
  ports: number[], 
  contextId?: string
): Promise<SandboxUrlResult[]> {
  logger.info('Getting multiple sandbox URLs', {
    contextId,
    sandboxId,
    ports,
    portCount: ports.length
  })

  const promises = ports.map(port => 
    getSandboxUrl({ sandboxId, port, contextId })
  )

  try {
    const results = await Promise.all(promises)
    
    logger.info('Multiple sandbox URLs generated successfully', {
      contextId,
      sandboxId,
      portCount: ports.length,
      urls: results.map(r => ({ port: r.port, url: r.url }))
    })

    return results
  } catch (error) {
    logger.error('Failed to get multiple sandbox URLs', error, {
      contextId,
      sandboxId,
      ports
    })
    throw error
  }
}
