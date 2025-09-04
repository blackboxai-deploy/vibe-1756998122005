// Re-export the enhanced cached functions for backward compatibility
export { 
  getOrCreateSandboxForSession as getSandboxContext,
  getCurrentSandboxIdCached as getCurrentSandboxId,
  formatSandboxContextCached as formatSandboxContext,
  invalidateSandboxCache,
  getCacheStats
} from './sandboxCache'

// Legacy function for backward compatibility
export async function getSandboxContextLegacy(sessionId: string) {
  const { getOrCreateSandboxForSession } = await import('./sandboxCache')
  return getOrCreateSandboxForSession(sessionId, { autoCreate: false })
}
