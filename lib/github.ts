import { Octokit } from '@octokit/rest'

export interface GitHubFile {
  path: string
  content: string
}

export interface CreateRepoOptions {
  name: string
  description?: string
  private?: boolean
}

export class GitHubService {
  private octokit: Octokit

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    })
  }

  async getRepository(owner: string, repo: string) {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      })

      return {
        success: true,
        repository: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Repository not found',
      }
    }
  }

  async createRepository(options: CreateRepoOptions) {
    try {
      const response = await this.octokit.rest.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description || 'Repository created from Vibe Coding Platform',
        private: options.private || false,
        auto_init: true,
      })

      return {
        success: true,
        repository: response.data,
        created: true,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create repository',
        created: false,
      }
    }
  }

  async createOrGetRepository(owner: string, options: CreateRepoOptions) {
    // First, try to get the existing repository
    const existingRepo = await this.getRepository(owner, options.name)
    
    if (existingRepo.success) {
      return {
        success: true,
        repository: existingRepo.repository,
        created: false,
      }
    }

    // If repository doesn't exist, create it
    const createResult = await this.createRepository(options)
    return {
      success: createResult.success,
      repository: createResult.repository,
      created: createResult.success,
      error: createResult.error,
    }
  }

  async uploadFiles(owner: string, repo: string, files: GitHubFile[]) {
    try {
      const results = []

      for (const file of files) {
        try {
          // Create or update file
          const response = await this.octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.path,
            message: `Add ${file.path}`,
            content: Buffer.from(file.content, 'utf8').toString('base64'),
          })

          results.push({
            path: file.path,
            success: true,
            sha: response.data.content?.sha,
          })
        } catch (error: any) {
          results.push({
            path: file.path,
            success: false,
            error: error.message,
          })
        }
      }

      return {
        success: true,
        results,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to upload files',
      }
    }
  }

  async getUser() {
    try {
      const response = await this.octokit.rest.users.getAuthenticated()
      return {
        success: true,
        user: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get user information',
      }
    }
  }

  async getUserRepositories() {
    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      })
      return {
        success: true,
        repositories: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch repositories',
      }
    }
  }

  async getRepositoryBranches(owner: string, repo: string) {
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      })
      return {
        success: true,
        branches: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch branches',
      }
    }
  }
}
