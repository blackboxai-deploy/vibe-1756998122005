import { getSandbox } from './vercelSandbox'
import { getDB } from './mongodb'

interface SandboxFile {
  path: string
  content: string
  lastModified: number
}

interface SessionFiles {
  sessionId: string
  files: SandboxFile[]
  createdAt: Date
  updatedAt: Date
}

const EXCLUDED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /dist/,
  /build/,
  /\.cache/,
  /coverage/,
  /\.nyc_output/,
  /logs/,
  /\.log$/,
  /\.map$/,
  /\.tsbuildinfo$/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /desktop\.ini$/,
  /\.env\.local$/,
  /\.env\.development\.local$/,
  /\.env\.test\.local$/,
  /\.env\.production\.local$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/
]

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath))
}

export async function collectSandboxFiles(sandboxId: string): Promise<SandboxFile[]> {
  const sandbox = await getSandbox({ sandboxId })
  const files: SandboxFile[] = []

  const cmd = await sandbox.runCommand({
    cmd: 'find',
    args: [
      '.',
      '-type', 'f',
      '-not', '-path', '*/node_modules*',
      '-not', '-path', '*/.git*',
      '-not', '-path', '*/.next*',
      '-not', '-path', '*/dist*',
      '-not', '-path', '*/build*',
      '-not', '-path', '*/.cache*',
      '-not', '-path', '*/coverage*',
      '-not', '-path', '*/.nyc_output*',
      '-not', '-path', '*/logs*',
      '-not', '-name', '*.log',
      '-not', '-name', '*.map',
      '-not', '-name', '*.tsbuildinfo',
      '-not', '-name', '.DS_Store',
      '-not', '-name', 'Thumbs.db',
      '-not', '-name', 'desktop.ini',
      '-not', '-name', 'package-lock.json',
      '-not', '-name', 'yarn.lock',
      '-not', '-name', 'pnpm-lock.yaml'
    ],
    detached: true
  })

  const done = await cmd.wait()
  const stdout = await done.stdout()

  if (done.exitCode === 0 && stdout) {
    const filePaths = stdout.split('\n').filter(path => path.trim() && !shouldExcludeFile(path))

    for (const filePath of filePaths) {
      try {
        const cleanPath = filePath.replace(/^\.\//, '')
        const fileStream = await sandbox.readFile({ path: cleanPath })
        
        if (fileStream) {
          const content = await streamToString(fileStream)
          files.push({
            path: cleanPath,
            content,
            lastModified: Date.now()
          })
        }
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error)
      }
    }
  }

  return files
}

export async function saveSessionFiles(sessionId: string, sandboxId: string): Promise<void> {
  const files = await collectSandboxFiles(sandboxId)
  
  if (files.length === 0) {
    return
  }

  const db = await getDB()
  const collection = db.collection<SessionFiles>('session_files')

  const sessionFiles: SessionFiles = {
    sessionId,
    files,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  await collection.replaceOne(
    { sessionId },
    sessionFiles,
    { upsert: true }
  )
}

export async function getSessionFiles(sessionId: string): Promise<SandboxFile[]> {
  const db = await getDB()
  const collection = db.collection<SessionFiles>('session_files')
  
  const sessionFiles = await collection.findOne({ sessionId })
  return sessionFiles?.files || []
}

export async function restoreSessionFilesToSandbox(sessionId: string, sandboxId: string): Promise<{ success: boolean; restoredCount: number; error?: string }> {
  try {
    const files = await getSessionFiles(sessionId)
    
    if (files.length === 0) {
      return { success: true, restoredCount: 0 }
    }

    const sandbox = await getSandbox({ sandboxId })
    
    // Prepare files for writing to sandbox
    const filesToWrite = files.map(file => ({
      path: file.path,
      content: Buffer.from(file.content, 'utf8')
    }))

    // Write all files to the sandbox
    await sandbox.writeFiles(filesToWrite)

    console.log(`Restored ${files.length} files to sandbox ${sandboxId} from session ${sessionId}`)
    
    return { success: true, restoredCount: files.length }
  } catch (error) {
    console.error('Failed to restore session files to sandbox:', error)
    return { 
      success: false, 
      restoredCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

async function streamToString(stream: any): Promise<string> {
  if (typeof stream === 'string') {
    return stream
  }
  
  if (!stream) {
    return ''
  }
  
  // Handle async iterable streams (like from Vercel Sandbox)
  if (stream[Symbol.asyncIterator]) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf8')
  }
  
  // Handle ReadableStream with text() method
  if (stream && typeof stream.text === 'function') {
    return await stream.text()
  }
  
  // Handle ReadableStream with getReader() method
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
      }
      result += decoder.decode()
      return result
    } finally {
      reader.releaseLock()
    }
  }
  
  return String(stream)
}
