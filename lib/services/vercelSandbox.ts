import { Sandbox } from '@vercel/sandbox'
import { CreateSandboxParams } from '@vercel/sandbox/dist/sandbox'

/**
 * Creates a new Vercel Sandbox with the provided configuration
 * @param config - Additional configuration options for the sandbox
 * @returns Promise<Sandbox> - The created sandbox instance
 */
export async function createSandbox(config: Partial<CreateSandboxParams> = {}) {
  const sandbox = await Sandbox.create({
    teamId: process.env.VERCEL_TEAM_ID!,
    projectId: process.env.VERCEL_PROJECT_ID!,
    token: process.env.VERCEL_TOKEN!,
    ...config,
  })
  
  return sandbox
}

/**
 * Gets an existing Vercel Sandbox by ID or with additional parameters
 * @param params - Either a sandboxId string or an object containing sandboxId and other parameters
 * @returns Promise<Sandbox> - The retrieved sandbox instance
 */
export async function getSandbox(params: { sandboxId: string; [key: string]: any }) {
  const sandbox = await Sandbox.get({
    teamId: process.env.VERCEL_TEAM_ID!,
    projectId: process.env.VERCEL_PROJECT_ID!,
    token: process.env.VERCEL_TOKEN!,
    ...params,
  })
  
  return sandbox
}
