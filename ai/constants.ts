import { type GatewayModelId } from '@ai-sdk/gateway'

export const DEFAULT_MODEL: GatewayModelId[number] = 'openrouter/claude-sonnet-4'

export const MODEL_NAME_MAP: Record<string, string> = {
  'openrouter/claude-sonnet-4': 'Claude 4 Sonnet',
  'google/gemini-2.5-pro-preview': 'Gemini 2.5 Pro',
  'moonshotai/kimi-k2': 'Kimi K2',
  'gpt-4o-mini': 'GPT-4.1-mini',
  'gpt-5': 'GPT-5',
  'o4-mini': 'o4-mini',
  'grok-4': 'Grok 4',
}

export const TEST_PROMPTS = [
  'Chat App',
  'AI Image Generation App',
  'AI Video Generation App',
  'Uber-like Landing Page',
]

// Directories to ignore when listing or searching files
export const DIRS_TO_IGNORE = [
  "node_modules",
  "__pycache__",
  "env",
  "venv", 
  ".venv",
  "target/dependency",
  "build/dependencies",
  "dist",
  "build",
  "bundle",
  "vendor",
  "tmp",
  "temp",
  "deps",
  "pkg",
  "Pods",
  ".git",
  ".next",
  ".cache",
  ".nyc_output",
  "coverage",
  "logs",
  ".DS_Store",
  ".vscode",
  ".idea",
  ".pytest_cache",
  ".mypy_cache",
  ".tox",
  ".coverage",
]

// Files to ignore when listing or searching
export const FILES_TO_IGNORE = [
  "*.log",
  "*.map", 
  "*.tsbuildinfo",
  ".DS_Store",
  "thumbs.db",
  "*.tmp",
  "*.temp",
  ".env.local",
  ".env.development.local",
  ".env.test.local", 
  ".env.production.local",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  "*.so",
  "*.dylib",
  "*.dll",
]

// Convert to glob patterns for different use cases
export const IGNORE_PATTERNS = DIRS_TO_IGNORE.map((dir) => `**/${dir}/**`)

// For find command exclusions - improved with better patterns
export const FIND_EXCLUDE_ARGS = [
  // Directory exclusions
  ...DIRS_TO_IGNORE.flatMap((dir) => ['-not', '-path', `*/${dir}/*`]),
  // File exclusions
  ...FILES_TO_IGNORE.filter(file => !file.includes('*')).flatMap((file) => ['-not', '-name', file]),
  // Pattern-based file exclusions
  '-not', '-name', '*.log',
  '-not', '-name', '*.map',
  '-not', '-name', '*.tsbuildinfo',
  '-not', '-name', '*.tmp',
  '-not', '-name', '*.temp',
  '-not', '-name', '*.pyc',
  '-not', '-name', '*.pyo',
  '-not', '-name', '*.pyd',
]

// For grep command exclusions
export const GREP_EXCLUDE_DIRS = DIRS_TO_IGNORE.filter(dir => !dir.startsWith('.')).concat([
  '.*', // All hidden directories
])

export const SANDBOX_EXPIRATION_TIME = 45

// Sandbox creation retry configuration
export const SANDBOX_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2,
  MAX_DELAY: 10000, // 10 seconds max delay
} as const
