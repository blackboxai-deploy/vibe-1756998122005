interface VercelDeployment {
  uid?: string
  id?: string
  deploymentId?: string
  name: string
  url: string
  state?: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'
  createdAt?: number
  readyState?: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'
  [key: string]: unknown
}

interface VercelProject {
  id: string
  name: string
  framework: string | null
}

interface VercelEvent {
  type: string
  text?: string
  payload?: {
    text?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}


interface DeploymentResult {
  success: boolean
  deployment?: VercelDeployment
  error?: string
}

interface FileUpload {
  path: string
  content: string
}

interface DeploymentPayload {
  name: string
  files: Array<{
    file: string
    data: string
  }>
  target: 'production'
  builds?: Array<{
    src: string
    use: string
    config: {
      buildCommand: string
      outputDirectory: string
    }
  }>
}

interface VercelProjectResponse {
  id: string
  name: string
  framework: string | null
  [key: string]: unknown
}

interface ProjectCreateParams {
  name: string
  gitRepository: {
    type: 'github'
    repo: string
  }
}

export class VercelService {
  private token: string
  private baseUrl = 'https://api.vercel.com'

  constructor(token: string) {
    this.token = token
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Vercel API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async getProject(name: string): Promise<{ success: boolean; project?: VercelProjectResponse; error?: string }> {
    try {
      const project = await this.makeRequest(`/v9/projects/${name}`)
      return {
        success: true,
        project,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Project not found',
      }
    }
  }

  async createProject(params: ProjectCreateParams): Promise<{ success: boolean; project?: VercelProjectResponse; error?: string }> {
    try {
      const projectPayload = {
        name: params.name,
        gitRepository: params.gitRepository,
      }

      const project = await this.makeRequest('/v9/projects', {
        method: 'POST',
        body: JSON.stringify(projectPayload),
      })

      return {
        success: true,
        project,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateProjectSettings(projectName: string, settings: {
    buildCommand?: string
    outputDirectory?: string
    installCommand?: string
    devCommand?: string
    framework?: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const updatePayload = {
        buildCommand: settings.buildCommand,
        outputDirectory: settings.outputDirectory,
        installCommand: settings.installCommand,
        devCommand: settings.devCommand,
        framework: settings.framework,
      }

      await this.makeRequest(`/v9/projects/${projectName}`, {
        method: 'PATCH',
        body: JSON.stringify(updatePayload),
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project settings',
      }
    }
  }

  async createDeployment(params: {
    name: string
    gitSource: {
      type: 'github'
      repo: string
      repoId: number
      ref: string
    }
    projectSettings?: {
      framework?: string
      buildCommand?: string
      outputDirectory?: string
      installCommand?: string
      devCommand?: string
    }
  }): Promise<DeploymentResult> {
    try {
      // First, try to get existing project
      const existingProject = await this.getProject(params.name)
      
      if (!existingProject.success) {
        // Create project with GitHub integration
        const createProjectResult = await this.createProject({
          name: params.name,
          gitRepository: {
            type: 'github',
            repo: params.gitSource.repo,
          },
        })
        
        if (!createProjectResult.success) {
          return {
            success: false,
            error: `Failed to create project: ${createProjectResult.error}`,
          }
        }
      }

      // Update project settings if provided
      if (params.projectSettings) {
        const updateResult = await this.updateProjectSettings(params.name, params.projectSettings)
        if (!updateResult.success) {
          console.warn('Failed to update project settings:', updateResult.error)
          // Continue with deployment even if settings update fails
        }
      }

      // Create deployment for the project
      const deploymentPayload = {
        name: params.name,
        gitSource: {
          type: 'github',
          repoId: params.gitSource.repoId,
          ref: params.gitSource.ref,
        },
      }

      const deployment = await this.makeRequest('/v6/deployments', {
        method: 'POST',
        body: JSON.stringify(deploymentPayload),
      })

      return {
        success: true,
        deployment,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async createDirectDeployment(params: {
    name: string
    files: FileUpload[]
    projectSettings?: {
      framework?: string
      buildCommand?: string
      outputDirectory?: string
      installCommand?: string
      devCommand?: string
    }
  }): Promise<DeploymentResult> {
    try {
      // Prepare files for upload - Vercel expects an array of file objects
      const filesPayload = params.files.map(file => ({
        file: file.path,
        data: Buffer.from(file.content, 'utf8').toString('base64')
      }))

      // Create deployment payload
      const deploymentPayload: DeploymentPayload = {
        name: params.name,
        files: filesPayload,
        target: 'production',
        ...(params.projectSettings?.buildCommand && {
          builds: [{
            src: "**",
            use: "@vercel/static-build",
            config: {
              buildCommand: params.projectSettings.buildCommand,
              outputDirectory: params.projectSettings.outputDirectory || 'dist'
            }
          }]
        })
      }

      const deployment = await this.makeRequest('/v13/deployments', {
        method: 'POST',
        body: JSON.stringify(deploymentPayload),
      })

      return {
        success: true,
        deployment,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getDeployment(deploymentId: string): Promise<DeploymentResult> {
    try {
      // Try v6 endpoint first, then fallback to v13
      let deployment
      try {
        deployment = await this.makeRequest(`/v6/deployments/${deploymentId}`)
      } catch (v6Error) {
        // Fallback to v13 endpoint
        deployment = await this.makeRequest(`/v13/deployments/${deploymentId}`)
      }
      
      return {
        success: true,
        deployment,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getBuildErrorLogs(deploymentId: string): Promise<string | void> {
    try {
      // Try to get build logs from Vercel API
      const response = await this.makeRequest(`/v2/deployments/${deploymentId}/events`) as VercelEvent[]
      
      if (response) {
        // Filter for stderr events which contain build error logs
        const buildEvents = response.filter((event: VercelEvent) => event?.type === 'stderr')
        
        if (buildEvents.length > 0) {
          const errorMessages = buildEvents.map((event: VercelEvent) => {
            if (event?.payload?.text) {
              return event?.payload?.text
            }
            return event?.text || JSON.stringify(event)
          }).join('\n')
          
          return errorMessages
        }
      }
    } catch (error) {
      // no need to handle this
    }
  }

  async waitForDeployment(
    deploymentId: string,
    maxWaitTime = 300000, // 5 minutes
    pollInterval = 5000 // 5 seconds
  ): Promise<DeploymentResult> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getDeployment(deploymentId)
      
      if (!result.success) {
        return result
      }

      const deployment = result.deployment!
      
      // Check both readyState and state fields for deployment status
      const deploymentState = deployment.readyState || deployment.state
      
      if (deploymentState === 'READY') {
        return { success: true, deployment }
      }
      
      if (deploymentState === 'ERROR' || deploymentState === 'CANCELED') {
        // Try to get detailed build logs for failed deployments
        const errorMessage = await this.getBuildErrorLogs(deploymentId)

        return {
          success: false,
          error: `Build failed:\n${errorMessage}`,
        }
      }

      // If still building or queued, continue polling
      if (deploymentState === 'BUILDING' || deploymentState === 'QUEUED') {
        console.log(`Deployment ${deploymentId} is still ${deploymentState}, waiting...`)
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    return {
      success: false,
      error: 'Deployment timeout - took longer than expected',
    }
  }

  // Domain management methods
  async removeDomainFromProject(projectId: string, domain: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      await this.makeRequest(`/v9/projects/${projectId}/domains/${domain}`, {
        method: 'DELETE',
      })

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove domain',
      }
    }
  }

  async getDomainConfig(domain: string): Promise<{
    success: boolean
    config?: {
      configuredBy?: string
      acceptedChallenges?: Array<{
        type: string
        domain: string
        value: string
      }>
      misconfigured?: boolean
    }
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v4/domains/${domain}/config`)
      console.log('Domain Config Result:', result)
      
      return {
        success: true,
        config: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain config',
      }
    }
  }

  async addDomainToProject(projectName: string, domain: string): Promise<{
    success: boolean
    domain?: {
      name: string
      verification: Array<{
        type: string
        domain: string
        value: string
        reason: string
      }>
    }
    error?: string
    conflictProjectId?: string
  }> {
    try {
      const domainPayload = {
        name: domain,
      }

      const result = await this.makeRequest(`/v9/projects/${projectName}/domains`, {
        method: 'POST',
        body: JSON.stringify(domainPayload),
      })

      return {
        success: true,
        domain: result,
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('409')) {
        // Parse the error to extract the existing project ID
        try {
          const errorMatch = error.message.match(/{"error":({.*})}/);
          if (errorMatch) {
            const errorObj = JSON.parse(errorMatch[1]);
            if (errorObj.code === 'domain_already_in_use' && errorObj.projectId) {
              return {
                success: false,
                error: error.message,
                conflictProjectId: errorObj.projectId,
              }
            }
          }
        } catch (parseError) {
          // If parsing fails, return the original error
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add domain',
      }
    }
  }

  async transferDomainToProject(fromProjectId: string, toProjectName: string, domain: string): Promise<{
    success: boolean
    domain?: {
      name: string
      verification: Array<{
        type: string
        domain: string
        value: string
        reason: string
      }>
    }
    error?: string
  }> {
    try {
      // First, remove domain from the existing project
      const removeResult = await this.removeDomainFromProject(fromProjectId, domain)
      if (!removeResult.success) {
        return {
          success: false,
          error: `Failed to remove domain from existing project: ${removeResult.error}`,
        }
      }

      // Wait a moment for the removal to propagate
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Then add it to the new project
      const addResult = await this.addDomainToProject(toProjectName, domain)
      return addResult
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transfer domain',
      }
    }
  }

  async verifyDomain(projectName: string, domain: string): Promise<{
    success: boolean
    verified?: boolean
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v9/projects/${projectName}/domains/${domain}/verify`, {
        method: 'POST',
      })

      console.log('Verify Domain Result:', result)

      return {
        success: true,
        verified: result.verified || false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify domain',
      }
    }
  }

  async getDomainConfiguration(projectName: string, domain: string): Promise<{
    success: boolean
    verification?: Array<{
      type: string
      domain: string
      value: string
      reason: string
    }>
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v9/projects/${projectName}/domains/${domain}`)
      console.log('Domain Configuration Result:', result)
      
      return {
        success: true,
        verification: result.verification || [],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain configuration',
      }
    }
  }

  async getDomainStatus(projectName: string, domain: string): Promise<{
    success: boolean
    domain?: {
      name: string
      verified: boolean
      verification?: Array<{
        type: string
        domain: string
        value: string
        reason: string
      }>
    }
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v9/projects/${projectName}/domains/${domain}`)
      
      return {
        success: true,
        domain: result,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain status',
      }
    }
  }

  // Domain purchase methods
  async checkDomainAvailability(domain: string): Promise<{
    success: boolean
    available?: boolean
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v4/domains/status?name=${encodeURIComponent(domain)}`)
      
      return {
        success: true,
        available: result.available || false,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check domain availability',
      }
    }
  }

  async getDomainPrice(domain: string, type: 'new' | 'renewal' | 'transfer' | 'redemption' = 'new'): Promise<{
    success: boolean
    price?: number
    currency?: string
    error?: string
  }> {
    try {
      const result = await this.makeRequest(`/v4/domains/price?name=${encodeURIComponent(domain)}&type=${type}`)
      
      return {
        success: true,
        price: result.price || 0,
        currency: result.currency || 'USD',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain price',
      }
    }
  }

  async buyDomain(
    domain: string, 
    registrantDetails: {
      country: string,
      orgName: string,
      firstName: string,
      lastName: string,
      address1: string,
      city: string,
      state: string,
      postalCode: string,
      phone: string,
      email: string,
    }, 
    expectedPrice: number): Promise<{
      success: boolean
      domain: string
      id?: string
      error?: string
  }> {
    try {
      const payload = {
        name: domain,
        expectedPrice,
        renew: false,
        ...(registrantDetails || {})
      }

      console.log('Attempting to buy domain with payload:', JSON.stringify(payload, null, 2))

      const result = await this.makeRequest('/v5/domains/buy', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      console.log('Buy Domain from Vercel Result:', result)

      if (!result?.domain) {
        throw new Error('Buying domain failed')
      }

      await this.addDomainRecord(domain, {
        name: '@', 
        type: 'A',
        value: '76.76.21.21',
      })

      return {
        success: true,
        id: result?.domain?.uid,
        domain
      }
    } catch (error) {
      console.error('Domain purchase error details:', error)
      return {
        success: false,
        domain,
        error: error instanceof Error ? error.message : 'Failed to buy domain',
      }
    }
  }

  async addDomainRecord(domain: string, record: {
    name: string
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS'
    value: string
    ttl?: number
  }): Promise<{
    success: boolean
    record?: {
      id: string
      name: string
      type: string
      value: string
      ttl: number
    }
    error?: string
  }> {
    try {
      const recordPayload = {
        name: record.name,
        type: record.type,
        value: record.value,
        ttl: record.ttl || 60
      }

      const result = await this.makeRequest(`/v6/domains/${encodeURIComponent(domain)}/records`, {
        method: 'POST',
        body: JSON.stringify(recordPayload),
      })

      console.log('Domain Record Add Result:', result)

      console.log(`Successfully added ${record.type} record for ${domain}:`, result)
      return { 
        success: true,
        record: result
      }
    } catch (error) {
      console.error(`Failed to add ${record.type} record for ${domain}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to add ${record.type} record`
      }
    }
  }
}

// Framework detection utility
export function detectFramework(files: Array<{ path: string; content: string }>): {
  framework: string
  buildCommand: string
  outputDirectory: string
  installCommand: string
} {
  const packageJsonFile = files.find(f => f.path === 'package.json')
  
  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(packageJsonFile.content)
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
      
      // Next.js detection
      if (dependencies.next) {
        return {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          outputDirectory: '.next',
          installCommand: 'npm install',
        }
      }
      
      // React (Create React App) detection
      if (dependencies['react-scripts']) {
        return {
          framework: 'create-react-app',
          buildCommand: 'npm run build',
          outputDirectory: 'build',
          installCommand: 'npm install',
        }
      }
      
      // Vite detection
      if (dependencies.vite) {
        return {
          framework: 'vite',
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
          installCommand: 'npm install',
        }
      }
      
      // Vue CLI detection
      if (dependencies['@vue/cli-service']) {
        return {
          framework: 'vue',
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
          installCommand: 'npm install',
        }
      }
      
      // Nuxt.js detection
      if (dependencies.nuxt) {
        return {
          framework: 'nuxtjs',
          buildCommand: 'npm run build',
          outputDirectory: '.nuxt',
          installCommand: 'npm install',
        }
      }
    } catch (error) {
      console.error('Error parsing package.json:', error)
    }
  }
  
  // Check for index.html (static site)
  const hasIndexHtml = files.some(f => f.path === 'index.html' || f.path === 'public/index.html')
  if (hasIndexHtml) {
    return {
      framework: 'static',
      buildCommand: '',
      outputDirectory: '.',
      installCommand: '',
    }
  }
  
  // Default fallback
  return {
    framework: 'static',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    installCommand: 'npm install',
  }
}
