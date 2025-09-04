import { getAuthSession } from '@/lib/auth'
import { GitHubService } from '@/lib/github'
import { discoverSandboxFiles, readSandboxFiles } from '@/lib/sandbox-files'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { VercelService } from '@/lib/vercel'
import { NextRequest, NextResponse } from 'next/server'
import z from 'zod/v3'
import { createClient } from '@vercel/kv'


const DeployRequestSchema = z.object({
  sandboxId: z.string(),
  projectName: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  customDomain: z.string().optional(),
})

// Environment variables for deployment tokens
const GITHUB_DEPLOY_TOKEN = process.env.GITHUB_DEPLOY_TOKEN
const VERCEL_DEPLOY_TOKEN = process.env.VERCEL_DEPLOY_TOKEN
const GITHUB_DEPLOY_USERNAME = process.env.GITHUB_DEPLOY_USERNAME

const kv = createClient({
  url: process.env.KV_RATE_URL as string,
  token: process.env.KV_RATE_TOKEN as string
})

if (!GITHUB_DEPLOY_TOKEN || !VERCEL_DEPLOY_TOKEN || !GITHUB_DEPLOY_USERNAME) {
  console.error('Missing required environment variables for Vercel deployment')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!GITHUB_DEPLOY_TOKEN || !VERCEL_DEPLOY_TOKEN || !GITHUB_DEPLOY_USERNAME) {
      return NextResponse.json(
        { error: 'Vercel deployment is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const validatedData = DeployRequestSchema.safeParse(body)

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.errors },
        { status: 400 }
      )
    }

    const { sandboxId, customDomain } = validatedData.data

    const sandbox = await getSandbox({ sandboxId })
    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      )
    }

    const githubService = new GitHubService(GITHUB_DEPLOY_TOKEN)
    const vercelService = new VercelService(VERCEL_DEPLOY_TOKEN)

    // Discover files in the sandbox
    const fileDiscoveryResult = await discoverSandboxFiles(sandbox)
    if (!fileDiscoveryResult.success || fileDiscoveryResult.filePaths.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: fileDiscoveryResult.error || 'No files found in sandbox. Please ensure your project has files to deploy.',
        },
        { status: 400 }
      )
    }

    // Read file contents
    const githubFiles = await readSandboxFiles(sandbox, fileDiscoveryResult.filePaths)
    if (githubFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No readable files found in sandbox',
        },
        { status: 400 }
      )
    }
    
    const projectName = `vibe-${new Date().getTime()}`

    // Step 1: Create or get existing GitHub repository (public for Vercel access)
    const repoResult = await githubService.createRepository({
      name: projectName,
      description: `Deployed from Vibe Sandbox ${sandboxId}`,
      private: false, // Public repository for Vercel deployment access
    })

    if (!repoResult.success) {
      return NextResponse.json(
        { error: `Failed to create or access GitHub repository: ${repoResult.error}` },
        { status: 400 }
      )
    }

    // Step 2: Upload files to GitHub repository
    const uploadResult = await githubService.uploadFiles(
      GITHUB_DEPLOY_USERNAME,
      projectName,
      githubFiles
    )

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: `Failed to upload files to GitHub: ${uploadResult.error}` },
        { status: 400 }
      )
    }

    // Step 3: Create Vercel deployment with custom build commands
    const deploymentResult = await vercelService.createDeployment({
      name: projectName, // Use lowercase project name for Vercel
      gitSource: {
        type: 'github',
        repo: `${GITHUB_DEPLOY_USERNAME}/${projectName}`, // Use original casing for GitHub repo
        repoId: repoResult.repository!.id,
        ref: 'main',
      },
      projectSettings: {
        framework: 'nextjs',
        buildCommand: 'npm run build -- --no-lint',
        outputDirectory: '.next',
        installCommand: 'npm install',
        devCommand: 'npm start',
      },
    })

    if (!deploymentResult.success) {
      return NextResponse.json(
        { error: `Failed to create Vercel deployment: ${deploymentResult.error}` },
        { status: 400 }
      )
    }

    const deployment = deploymentResult.deployment!

    // Log deployment object for debugging
    console.log('Deployment object:', JSON.stringify(deployment, null, 2))

    // Step 4: Wait for deployment build to complete
    // Try different possible ID fields
    const deploymentId = deployment.id
    console.log('Deployment ID:', deploymentId)
    
    if (!deploymentId) {
      console.error('No deployment ID found in deployment object:', deployment)
      return NextResponse.json(
        { 
          success: false,
          error: 'Deployment created but no deployment ID found',
          buildFailed: true 
        },
        { status: 400 }
      )
    }

    const buildResult = await vercelService.waitForDeployment(deploymentId)

    console.log('Vercel Build Result:', buildResult)

    if (!buildResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: buildResult.error,
          buildFailed: true 
        },
        { status: 200 }
      )
    }

    // Step 5: Handle custom domain if provided
    let domainResult = null
    if (customDomain) {
      try {    
        const domainOwnerKey = `domain_owner:${customDomain}`
        const domainOwnership = await kv.get(domainOwnerKey) as { userEmail: string; customerId: string; purchaseDate: string } | null
        
        let isPurchased = false;

        if (domainOwnership) {
          // Domain is purchased - check if current user owns it
          if (domainOwnership.userEmail !== session.user.email) {
            // Domain is owned by someone else
            return NextResponse.json(
              { 
                success: false,
                error: `Domain "${customDomain}" is already owned by another user. Please purchase a different domain or use a domain you own.`,
                customDomain: {
                  domain: customDomain,
                  error: `This domain is owned by another user and cannot be used for your deployment.`,
                  isPurchased: false,
                }
              },
              { status: 403 }
            )
          }
          
          // User owns this purchased domain
          isPurchased = true
          console.log(`Using purchased domain: ${customDomain}`)
        }
          
        let domainAddResult = await vercelService.addDomainToProject(projectName, customDomain)
        console.log('Custom Domain Add Result:', JSON.stringify(domainAddResult, null, 2))

        // If domain is already in use, try to transfer it
        if (!domainAddResult.success && domainAddResult.conflictProjectId) {
          console.log(`Domain ${customDomain} is already in use by project ${domainAddResult.conflictProjectId}. Attempting to transfer...`)
          
          const transferResult = await vercelService.transferDomainToProject(
            domainAddResult.conflictProjectId,
            projectName,
            customDomain
          )

          console.log('Domain Transfer Result:', JSON.stringify(transferResult, null, 2))
          domainAddResult = transferResult
        }

        if (domainAddResult.success && domainAddResult.domain) {
          // Get domain configuration to retrieve TXT records
          const domainConfigResult = await vercelService.getDomainConfiguration(projectName, customDomain)

          const txtVerificationRecord = domainConfigResult?.verification?.[0];

          if (txtVerificationRecord) {
            await vercelService.addDomainRecord(customDomain, {
              type: txtVerificationRecord.type as 'TXT',
              name: txtVerificationRecord.domain,
              value: txtVerificationRecord.value,
            })
            
            await new Promise((res, rej) => setTimeout(() => res(true), 300_000))
          }
        
          domainResult = {
            domain: customDomain,
            verification: domainConfigResult.success ? domainConfigResult.verification || [] : domainAddResult.domain.verification || [],
            isPurchased,
            autoVerifying: isPurchased, // Purchased domains with Vercel registrar should auto-verify
          }
          console.log('Domain verification records:', JSON.stringify(domainResult.verification, null, 2))
        } else {
          console.warn('Failed to add custom domain:', domainAddResult.error)
          domainResult = {
            domain: customDomain,
            verification: [],
            error: domainAddResult.error,
            isPurchased,
            autoVerifying: false, // Failed to attach domain, so no auto-verification
          }
        }
      } catch (error) {
        console.warn('Error adding custom domain:', error)
        domainResult = {
          domain: customDomain,
          verification: [],
          error: error instanceof Error ? error.message : 'Unknown error adding domain',
          isPurchased: false,
          autoVerifying: false,
        }
      }
    }

    // Step 6: Return success with deployment URL and domain info
    return NextResponse.json({
      success: true,
      deploymentUrl: `https://${projectName}.vercel.app`,
      projectName: projectName,
      customDomain: domainResult,
    })

  } catch (error) {
    console.error('Vercel deployment error:', error)
    return NextResponse.json(
      { error: 'Internal server error during deployment' },
      { status: 500 }
    )
  }
}
