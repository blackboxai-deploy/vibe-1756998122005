import z from 'zod/v3'

// Common schema definitions for tool input validation
export const SandboxIdSchema = z
  .string()
  .min(1)
  .regex(/^sbx_[a-zA-Z0-9]+$/, 'Sandbox ID must start with sbx_ and contain only alphanumeric characters')
  .describe('The ID of the Vercel Sandbox (e.g., sbx_abc123)')

export const PathSchema = z
  .string()
  .min(1)
  .refine(
    (path) => !path.includes('..') && !path.startsWith('/') && path.length > 0,
    'Path must be a safe relative path without ".." or leading "/"'
  )
  .or(z.literal('.'))  // Allow '.' for current directory
  .describe('Safe relative path without ".." or leading "/"')

export const TerminalIdSchema = z
  .string()
  .min(1)
  .describe('Terminal ID for command execution')

export const CommandSchema = z
  .string()
  .min(1)
  .describe('Command to execute')

export const PortSchema = z
  .number()
  .int()
  .min(1)
  .max(65535)
  .describe('Port number (1-65535)')

export const ContentSchema = z
  .string()
  .describe('File content')

// Common error types
export const VALIDATION_ERRORS = {
  INVALID_TOOL_INPUT: 'INVALID_TOOL_INPUT',
  INVALID_SANDBOX_ID: 'INVALID_SANDBOX_ID',
  INVALID_PATH: 'INVALID_PATH',
  INVALID_TERMINAL_ID: 'INVALID_TERMINAL_ID',
  INVALID_COMMAND: 'INVALID_COMMAND',
  INVALID_PORT: 'INVALID_PORT',
} as const

// Helper function to create validation error response
export function createValidationErrorData<T extends Record<string, any>>(
  rawArgs: any,
  error: z.ZodError
): T & {
  status: 'done'
  error: string
  issues: Record<string, string[] | undefined>
  hint: string
} {
  const issues = error.flatten().fieldErrors
  
  return {
    ...rawArgs,
    status: 'done' as const,
    error: VALIDATION_ERRORS.INVALID_TOOL_INPUT,
    issues,
    hint: `Check the issues field for specific validation errors.`,
  } as T & {
    status: 'done'
    error: string
    issues: Record<string, string[] | undefined>
    hint: string
  }
}

// Helper function to create validation error message
export function createValidationErrorMessage(toolName: string): string {
  return `Invalid input for ${toolName}. Please resend with valid parameters according to the tool's schema.`
}
