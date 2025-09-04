import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { GitHubService } from '@/lib/github'
import { getSandbox } from '@/lib/services/vercelSandbox'
import z from 'zod/v3'
import { logger } from '@/lib/logger'

const PublishRequestSchema = z.object({
  sandboxId: z.string(),
  repositoryName: z.string().min(1).max(100),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
  filePaths: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  logger.api('/api/github/publish', 'POST', 'Starting GitHub publish request')

  try {
    logger.info('Checking authentication for GitHub publish', { endpoint: '/api/github/publish' })

    // Check authentication
    const session = await getAuthSession()
    if (!session?.user) {
      logger.warn('Authentication required for GitHub publish', { endpoint: '/api/github/publish' })
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!session.githubAccessToken) {
      logger.warn('GitHub authentication required', { 
        endpoint: '/api/github/publish',
        userEmail: session.user.email 
      })
      return NextResponse.json(
        { error: 'GitHub authentication required. Please sign in with GitHub.' },
        { status: 401 }
      )
    }

    logger.info('Parsing GitHub publish request body', { 
      endpoint: '/api/github/publish',
      userEmail: session.user.email 
    })

    // Parse request body
    const body = await request.json()
    const validatedData = PublishRequestSchema.safeParse(body)

    if (!validatedData.success) {
      logger.warn('Invalid GitHub publish request data', {
        endpoint: '/api/github/publish',
        errors: validatedData.error.errors,
        userEmail: session.user.email
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { sandboxId, repositoryName, description, isPrivate, filePaths } = validatedData.data

    logger.api('/api/github/publish', 'POST', 'GitHub publish request validated', {
      sandboxId,
      repositoryName,
      isPrivate,
      hasDescription: !!description,
      filePathsProvided: filePaths?.length || 0,
      userEmail: session.user.email
    })

    // Initialize GitHub service
    const githubService = new GitHubService(session.githubAccessToken)

    // Get user information
    const userResult = await githubService.getUser()
    if (!userResult.success) {
      return NextResponse.json(
        { error: 'Failed to get GitHub user information' },
        { status: 400 }
      )
    }

    // Get sandbox
    const sandbox = await getSandbox({ sandboxId })
    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      )
    }

    // Filter function to exclude build artifacts and unwanted files
    const shouldIncludeFile = (filePath: string): boolean => {
      const excludePatterns = [
        // Node.js
        /^node_modules\//,
        /^\.npm\//,
        /^npm-debug\.log/,
        /^yarn-error\.log/,
        /^yarn-debug\.log/,
        /^\.yarn\//,
        /^\.pnp\./,
        
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
        /^\.gitignore$/,
        
        // Environment and config
        /^\.env/,
        /^\.local$/,
        
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
        
        // Lock files (optional - you might want to include these)
        // /^package-lock\.json$/,
        // /^yarn\.lock$/,
        // /^pnpm-lock\.yaml$/,
      ]
      
      return !excludePatterns.some(pattern => pattern.test(filePath))
    }

    // Use provided file paths or try to discover files
    let finalFilePaths: string[] = []
    
    if (filePaths && filePaths.length > 0) {
      // Filter provided file paths
      finalFilePaths = filePaths.filter(shouldIncludeFile)
    } else {
      // Try to get files by reading common directories and files
      try {
        const commonPaths = [
          // Root files
          'package.json',
          'README.md',
          'index.html',
          'index.js',
          'index.ts',
          'app.js',
          'app.ts',
          'server.js',
          'server.ts',
          'main.js',
          'main.ts',
          
          // Styles
          'style.css',
          'styles.css',
          'main.css',
          'index.css',
          'global.css',
          'globals.css',
          
          // Config files
          'tsconfig.json',
          'jsconfig.json',
          'next.config.js',
          'next.config.ts',
          'vite.config.js',
          'vite.config.ts',
          'webpack.config.js',
          'tailwind.config.js',
          'tailwind.config.ts',
          'postcss.config.js',
          'eslint.config.js',
          '.eslintrc.js',
          '.eslintrc.json',
          '.prettierrc',
          'prettier.config.js',
          
          // Source directories - we'll need to recursively check these
          'src/',
          'public/',
          'components/',
          'pages/',
          'app/',
          'lib/',
          'utils/',
          'styles/',
          'assets/',
        ]
        
        // Try to discover all files by attempting to read from common patterns
        const allPossibleFiles = []
        
        // Add individual files
        const individualFiles = commonPaths.filter(path => !path.endsWith('/'))
        allPossibleFiles.push(...individualFiles)
        
        // For directories, try to discover files with various extensions
        const directories = commonPaths.filter(path => path.endsWith('/'))
        const commonExtensions = [
          'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss', 'sass', 'less',
          'md', 'txt', 'xml', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp',
          'woff', 'woff2', 'ttf', 'eot', 'otf', 'mp4', 'webm', 'mp3', 'wav',
          'pdf', 'zip', 'tar', 'gz', 'yml', 'yaml', 'toml', 'ini', 'env'
        ]
        
        const commonFileNames = [
          'index', 'main', 'app', 'App', 'server', 'client', 'config', 'setup',
          'README', 'LICENSE', 'CHANGELOG', 'package', 'tsconfig', 'jsconfig',
          'webpack.config', 'vite.config', 'next.config', 'tailwind.config',
          'postcss.config', 'eslint.config', '.eslintrc', '.prettierrc',
          'favicon', 'logo', 'icon', 'manifest', 'robots', 'sitemap',
          'browserconfig', 'site.webmanifest', 'apple-touch-icon'
        ]
        
        // Generate possible file paths for each directory
        for (const dir of directories) {
          // Try common file patterns
          for (const fileName of commonFileNames) {
            for (const ext of commonExtensions) {
              allPossibleFiles.push(`${dir}${fileName}.${ext}`)
            }
            // Also try without extension
            allPossibleFiles.push(`${dir}${fileName}`)
          }
          
          // Try some additional patterns for specific directories
          if (dir === 'public/') {
            // Add more specific public file patterns
            const publicSpecific = [
              'file.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'window.svg',
              'android-chrome-192x192.png', 'android-chrome-512x512.png',
              'favicon-16x16.png', 'favicon-32x32.png', 'mstile-150x150.png',
              'safari-pinned-tab.svg'
            ]
            for (const file of publicSpecific) {
              allPossibleFiles.push(`${dir}${file}`)
            }
          }
        }
        
        // Try to read each possible file
        for (const filePath of allPossibleFiles) {
          if (shouldIncludeFile(filePath)) {
            try {
              const fileStream = await sandbox.readFile({ path: filePath })
              if (fileStream) {
                finalFilePaths.push(filePath)
              }
            } catch {
              // File doesn't exist, continue
            }
          }
        }
      } catch (error) {
        logger.error('Error getting file paths during GitHub publish', error, {
          endpoint: '/api/github/publish',
          sandboxId,
          userEmail: session.user.email
        })
      }
    }

    if (finalFilePaths.length === 0) {
      return NextResponse.json(
        { error: 'No files found in sandbox. Please ensure your project has files to publish.' },
        { status: 400 }
      )
    }

    // Read file contents
    const githubFiles = []
    for (const filePath of finalFilePaths) {
      try {
        const fileStream = await sandbox.readFile({ path: filePath })
        if (fileStream) {
          const chunks: Buffer[] = []
          for await (const chunk of fileStream) {
            chunks.push(Buffer.from(chunk))
          }
          const content = Buffer.concat(chunks).toString('utf8')
          githubFiles.push({
            path: filePath,
            content,
          })
        }
      } catch (error) {
        logger.error(`Failed to read file during GitHub publish`, error, {
          endpoint: '/api/github/publish',
          filePath,
          sandboxId,
          userEmail: session.user.email
        })
        // Continue with other files
      }
    }

    // Add a .gitignore file if it doesn't exist
    const hasGitignore = githubFiles.some(file => file.path === '.gitignore')
    if (!hasGitignore) {
      const gitignoreContent = `# Dependencies
node_modules/
.npm/
.yarn/
.pnp.*
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.output/
.vercel/
.netlify/

# Cache directories
.cache/
.parcel-cache/
.turbo/
.swc/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
.vs/
*.sublime-*
.atom/

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Logs
*.log
logs/

# Coverage
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
*~
*.tmp
*.temp

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity
`
      githubFiles.push({
        path: '.gitignore',
        content: gitignoreContent,
      })
    }

    if (githubFiles.length === 0) {
      return NextResponse.json(
        { error: 'No readable files found in sandbox' },
        { status: 400 }
      )
    }

    // Create repository
    const repoResult = await githubService.createRepository({
      name: repositoryName,
      description,
      private: isPrivate,
    })

    if (!repoResult.success) {
      return NextResponse.json(
        { error: `Failed to create repository: ${repoResult.error}` },
        { status: 400 }
      )
    }

    // Upload files to repository
    const uploadResult = await githubService.uploadFiles(
      userResult.user!.login,
      repositoryName,
      githubFiles
    )

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: `Failed to upload files: ${uploadResult.error}` },
        { status: 400 }
      )
    }

    // Count successful uploads
    const successfulUploads = uploadResult.results?.filter(r => r.success).length || 0
    const failedUploads = uploadResult.results?.filter(r => !r.success) || []

    const duration = Date.now() - startTime
    logger.performance('github-publish', duration, {
      repositoryName,
      totalFiles: githubFiles.length,
      uploadedFiles: successfulUploads,
      failedFiles: failedUploads.length,
      userEmail: session.user.email
    })

    logger.api('/api/github/publish', 'POST', 'GitHub publish completed successfully', {
      repositoryName,
      repositoryUrl: repoResult.repository!.html_url,
      owner: userResult.user!.login,
      totalFiles: githubFiles.length,
      uploadedFiles: successfulUploads,
      failedFiles: failedUploads.length,
      duration,
      userEmail: session.user.email
    })

    return NextResponse.json({
      success: true,
      repository: {
        name: repositoryName,
        url: repoResult.repository!.html_url,
        owner: userResult.user!.login,
      },
      files: {
        total: githubFiles.length,
        uploaded: successfulUploads,
        failed: failedUploads.length,
        failedFiles: failedUploads,
      },
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('GitHub publish error', error, {
      endpoint: '/api/github/publish',
      duration,
      method: 'POST'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
