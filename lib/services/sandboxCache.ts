import kvUser from '@/lib/services/kvUser'
import { SANDBOX_EXPIRATION_TIME } from '@/ai/constants'
import { logger } from '@/lib/logger'
import { initializeSandbox } from '@/lib/sandbox-initializer'

interface ChatSession {
  id: string
  timestamp: number
  messages: any[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
}

interface SandboxCacheEntry {
  sandboxId: string
  expiresAt: number
  createdAt: number
  lastAccessed: number
}

interface SandboxContext {
  sandboxId: string | null
  isValid: boolean
  expiresAt?: number
  timeRemaining?: number
  error?: string
  fromCache?: boolean
  fromRedis?: boolean
  created?: boolean
}

// In-memory cache for sandbox contexts
const sandboxCache = new Map<string, SandboxCacheEntry>()

// Cache cleanup interval (every 5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes in memory cache

// Cleanup expired entries from memory cache
function cleanupExpiredCache() {
  const now = Date.now()
  for (const [sessionId, entry] of sandboxCache.entries()) {
    if (now > entry.expiresAt || (now - entry.lastAccessed) > CACHE_TTL) {
      sandboxCache.delete(sessionId)
      logger.debug('Cleaned up expired cache entry', { sessionId, sandboxId: entry.sandboxId })
    }
  }
}

// Start cleanup interval
setInterval(cleanupExpiredCache, CACHE_CLEANUP_INTERVAL)

/**
 * Enhanced sandbox context resolver with multi-level caching
 * 1. Check in-memory cache first (fastest)
 * 2. Check Redis if not in memory (medium speed)
 * 3. Create new sandbox if expired everywhere (slowest)
 */
export async function getOrCreateSandboxForSession(
  sessionId: string,
  options: {
    ports?: number[]
    runDevServer?: boolean
    autoCreate?: boolean
    github?: {
      repo: string
      branch: string
      accessToken: string
    }
  } = {}
): Promise<SandboxContext> {
  const { ports = [3000], runDevServer = false, autoCreate = true, github } = options

  try {
    if (!sessionId) {
      return {
        sandboxId: null,
        isValid: false,
        error: 'No session ID provided'
      }
    }

    const now = Date.now()

    // Step 1: Check in-memory cache first
    const cachedEntry = sandboxCache.get(sessionId)
    if (cachedEntry && now < cachedEntry.expiresAt) {
      // Update last accessed time
      cachedEntry.lastAccessed = now
      
      logger.info('Sandbox found in memory cache', {
        sessionId,
        sandboxId: cachedEntry.sandboxId,
        timeRemaining: cachedEntry.expiresAt - now
      })

      return {
        sandboxId: cachedEntry.sandboxId,
        isValid: true,
        expiresAt: cachedEntry.expiresAt,
        timeRemaining: cachedEntry.expiresAt - now,
        fromCache: true
      }
    }

    // Step 2: Check Redis if not in memory cache or expired
    logger.info('Checking Redis for sandbox context', { sessionId })
    
    const sessionKey = `chat-session:${sessionId}`
    const session = await kvUser.get<ChatSession>(sessionKey)

    if (session && session.sandbox) {
      const isValid = now < session.sandbox.expiresAt

      if (isValid) {
        // Cache in memory for future requests
        const cacheEntry: SandboxCacheEntry = {
          sandboxId: session.sandbox.sandboxId,
          expiresAt: session.sandbox.expiresAt,
          createdAt: session.sandbox.createdAt,
          lastAccessed: now
        }
        sandboxCache.set(sessionId, cacheEntry)

        logger.info('Sandbox found in Redis and cached in memory', {
          sessionId,
          sandboxId: session.sandbox.sandboxId,
          timeRemaining: session.sandbox.expiresAt - now
        })

        return {
          sandboxId: session.sandbox.sandboxId,
          isValid: true,
          expiresAt: session.sandbox.expiresAt,
          timeRemaining: session.sandbox.expiresAt - now,
          fromRedis: true
        }
      } else {
        logger.info('Sandbox expired in Redis', {
          sessionId,
          sandboxId: session.sandbox.sandboxId,
          expiredAt: session.sandbox.expiresAt,
          timeExpired: now - session.sandbox.expiresAt
        })
      }
    }

    // Step 3: Create new sandbox if not found or expired
    if (!autoCreate) {
      return {
        sandboxId: null,
        isValid: false,
        error: 'No valid sandbox found and auto-create is disabled'
      }
    }

    logger.info('Creating new sandbox for session', { sessionId, ports, runDevServer })

    const result = await initializeSandbox({
      ports,
      copyStarterFiles: false,
      runNpmInstall: runDevServer,
      contextId: `auto-session-${sessionId}`,
      sessionId: sessionId,
      runDevServer: runDevServer,
      github
    })

    // Save sandbox metadata to Redis
    const sandboxMetadata = {
      sandboxId: result.sandboxId,
      createdAt: now,
      expiresAt: now + (SANDBOX_EXPIRATION_TIME * 60 * 1000)
    }

    // Update the session with sandbox metadata
    const updatedSession = session ? {
      ...session,
      sandbox: sandboxMetadata
    } : {
      id: sessionId,
      timestamp: now,
      messages: [],
      lastUpdated: now,
      sandbox: sandboxMetadata
    }

    await kvUser.set(sessionKey, updatedSession)

    // Cache in memory
    const cacheEntry: SandboxCacheEntry = {
      sandboxId: result.sandboxId,
      expiresAt: sandboxMetadata.expiresAt,
      createdAt: sandboxMetadata.createdAt,
      lastAccessed: now
    }
    sandboxCache.set(sessionId, cacheEntry)

    logger.info('Created and cached new sandbox', {
      sessionId,
      sandboxId: result.sandboxId,
      expiresAt: sandboxMetadata.expiresAt
    })

    return {
      sandboxId: result.sandboxId,
      isValid: true,
      expiresAt: sandboxMetadata.expiresAt,
      timeRemaining: sandboxMetadata.expiresAt - now,
      created: true
    }

  } catch (error) {
    logger.error('Failed to get or create sandbox for session', error, { sessionId })
    
    // Remove from cache if there was an error
    sandboxCache.delete(sessionId)
    
    return {
      sandboxId: null,
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get current sandbox ID for a session (convenience function)
 * This will NOT auto-create a sandbox if none exists
 */
export async function getCurrentSandboxIdCached(sessionId: string): Promise<string | null> {
  const context = await getOrCreateSandboxForSession(sessionId, { autoCreate: false })
  return context.isValid ? context.sandboxId : null
}

/**
 * Invalidate cache entry for a session (useful when sandbox is manually deleted)
 */
export function invalidateSandboxCache(sessionId: string): void {
  sandboxCache.delete(sessionId)
  logger.info('Invalidated sandbox cache', { sessionId })
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const now = Date.now()
  const entries = Array.from(sandboxCache.entries())
  
  return {
    totalEntries: entries.length,
    validEntries: entries.filter(([_, entry]) => now < entry.expiresAt).length,
    expiredEntries: entries.filter(([_, entry]) => now >= entry.expiresAt).length,
    oldEntries: entries.filter(([_, entry]) => (now - entry.lastAccessed) > CACHE_TTL).length
  }
}

/**
 * Format sandbox context information for display
 */
export function formatSandboxContextCached(context: SandboxContext): string {
  if (!context.sandboxId) {
    return `No sandbox available${context.error ? `: ${context.error}` : ''}`
  }

  if (!context.isValid) {
    return `Sandbox ${context.sandboxId} is expired or invalid${context.error ? `: ${context.error}` : ''}`
  }

  const timeRemainingMinutes = context.timeRemaining ? Math.floor(context.timeRemaining / (1000 * 60)) : 0
  const source = context.fromCache ? ' (cached)' : context.fromRedis ? ' (redis)' : context.created ? ' (new)' : ''
  
  return `Active sandbox: ${context.sandboxId} (${timeRemainingMinutes} minutes remaining)${source}`
}
