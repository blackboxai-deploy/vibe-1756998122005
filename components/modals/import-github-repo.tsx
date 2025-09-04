'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Github, Loader2, Search, ChevronDown, FolderIcon, Unlink, Check } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { GitHubService } from '@/lib/github'
import { useSandboxStore } from '@/app/state'

interface ImportGitHubRepoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Repository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
}

interface Branch {
  name: string
}

export function ImportGitHubRepoModal({ open, onOpenChange }: ImportGitHubRepoModalProps) {
  const { data: session, update } = useSession()
  const { selectedGitHubRepo, setSelectedGitHubRepo, clearSelectedGitHubRepo } = useSandboxStore()
  
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>(selectedGitHubRepo?.repository || '')
  const [selectedBranch, setSelectedBranch] = useState<string>(selectedGitHubRepo?.branch || '')
  const [repoSearchTerm, setRepoSearchTerm] = useState('')
  const [branchSearchTerm, setBranchSearchTerm] = useState('')
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false)
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false)
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Fetch repositories when modal opens
  useEffect(() => {
    if (open && session?.githubAccessToken) {
      fetchRepositories()
    }
  }, [open, session?.githubAccessToken])

  // Initialize search terms from global state when modal opens
  useEffect(() => {
    if (open && selectedGitHubRepo) {
      // Don't set search terms to selected values - keep them separate
      setRepoSearchTerm('')
      setBranchSearchTerm('')
    }
  }, [open, selectedGitHubRepo])

  // Fetch branches when repository is selected
  useEffect(() => {
    if (open && selectedRepo && session?.githubAccessToken) {
      fetchBranches()
      // Only reset branch selection if it's a new repo selection (not from global state)
      if (selectedRepo !== selectedGitHubRepo?.repository) {
        setSelectedBranch('')
      }
    }
  }, [open, selectedRepo, session?.githubAccessToken])

  const fetchRepositories = async () => {
    if (!session?.githubAccessToken) return

    setIsLoadingRepos(true)
    try {
      const githubService = new GitHubService(session.githubAccessToken as string)
      const result = await githubService.getUserRepositories()
      
      if (result.success && result.repositories) {
        setRepositories(result.repositories)
      } else {
        console.error('Failed to fetch repositories:', result.error)
      }
    } catch (error) {
      console.error('Error fetching repositories:', error)
    } finally {
      setIsLoadingRepos(false)
    }
  }

  const fetchBranches = async () => {
    if (!selectedRepo || !session?.githubAccessToken) return

    const repo = repositories.find(r => r.full_name === selectedRepo)
    if (!repo) return

    setIsLoadingBranches(true)
    try {
      const githubService = new GitHubService(session.githubAccessToken as string)
      const result = await githubService.getRepositoryBranches(repo.owner.login, repo.name)
      
      if (result.success && result.branches) {
        setBranches(result.branches)
      } else {
        console.error('Failed to fetch branches:', result.error)
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    } finally {
      setIsLoadingBranches(false)
    }
  }

  const handleSave = async () => {
    // Ensure both repository and branch are selected
    if (!selectedRepo || !selectedBranch) return

    setIsSaving(true)
    try {
      // Store the selected repository and branch in global state
      setSelectedGitHubRepo(selectedRepo, selectedBranch)
      
      console.log('Saving repository:', selectedRepo, 'branch:', selectedBranch)
      
      // Close modal after successful save
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving repository:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await update({ disconnectGithub: true })  
      onOpenChange(false)
    } catch (error) {
      console.error('Error disconnecting GitHub:', error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(repoSearchTerm.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(repoSearchTerm.toLowerCase())
  )

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
  )

  // Helper function to get display value for inputs
  const getRepoDisplayValue = () => {
    if (isRepoDropdownOpen) return repoSearchTerm
    return selectedRepo || ''
  }

  const getBranchDisplayValue = () => {
    if (isBranchDropdownOpen) return branchSearchTerm
    return selectedBranch || ''
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset local state when closing (but keep global state)
    setSelectedRepo(selectedGitHubRepo?.repository || '')
    setSelectedBranch(selectedGitHubRepo?.branch || '')
    setRepoSearchTerm('')
    setBranchSearchTerm('')
    setBranches([])
    setIsRepoDropdownOpen(false)
    setIsBranchDropdownOpen(false)
    setIsDisconnecting(false)
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.relative')) {
        setIsRepoDropdownOpen(false)
        setIsBranchDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub
            </DialogTitle>
            <Button
              variant="link"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-gray-600 mr-5 text-sm"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  Disconnect
                </>
              )}
            </Button>
          </div>
          <DialogDescription className='text-left'>
            Select a repository and branch to import into your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Repository Selection */}
          <div className="space-y-2">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  placeholder={isLoadingRepos ? "Loading repositories..." : "Search and select repository..."}
                  value={getRepoDisplayValue()}
                  onChange={(e) => {
                    setRepoSearchTerm(e.target.value)
                    setIsRepoDropdownOpen(true)
                    setIsBranchDropdownOpen(false)
                  }}
                  onFocus={() => {
                    if (selectedRepo && !isRepoDropdownOpen) {
                      setRepoSearchTerm('')
                    }
                    setIsRepoDropdownOpen(true)
                    setIsBranchDropdownOpen(false)
                  }}
                  className="pl-10 pr-10 rounded-sm"
                  disabled={isLoadingRepos}
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer"
                  onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
                />
              </div>
              
              {isRepoDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
                  {isLoadingRepos ? (
                    <div className="flex items-center px-3 py-2 text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading repositories...
                    </div>
                  ) : (
                    <>
                      {/* None option */}
                      <div
                        className={`px-3 py-2 hover:bg-white cursor-pointer text-sm flex items-center justify-between ${
                          !selectedRepo ? 'bg-white border' : ''
                        }`}
                        onClick={() => {
                          setSelectedRepo('')
                          setSelectedBranch('')
                          setRepoSearchTerm('')
                          setIsRepoDropdownOpen(false)
                          // Clear global state when selecting None for repository
                          clearSelectedGitHubRepo()
                        }}
                      >
                        <span className="text-gray-500">Search and select respository...</span>
                        {!selectedRepo && (
                          <Check className="h-4 w-4 text-black" />
                        )}
                      </div>
                      
                      {filteredRepositories.length > 0 ? (
                        filteredRepositories.map((repo) => (
                          <div
                            key={repo.id}
                            className={`px-3 py-2 hover:bg-white cursor-pointer text-sm flex items-center justify-between ${
                              selectedRepo === repo.full_name ? 'bg-white border' : ''
                            }`}
                            onClick={() => {
                              setSelectedRepo(repo.full_name)
                              setRepoSearchTerm('')
                              setIsRepoDropdownOpen(false)
                            }}
                          >
                            <span>{repo.full_name}</span>
                            {selectedRepo === repo.full_name && (
                              <Check className="h-4 w-4 text-black" />
                            )}
                          </div>
                        ))
                      ) : repoSearchTerm && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No repositories found
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Branch Selection */}
          <div className="space-y-2">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  placeholder={
                    !selectedRepo 
                      ? "Select a repository first" 
                      : isLoadingBranches 
                      ? "Loading branches..." 
                      : "Search and select branch..."
                  }
                  value={getBranchDisplayValue()}
                  onChange={(e) => {
                    setBranchSearchTerm(e.target.value)
                    setIsRepoDropdownOpen(false)
                    setIsBranchDropdownOpen(true)
                  }}
                  onFocus={() => {
                    if (selectedRepo) {
                      if (selectedBranch && !isBranchDropdownOpen) {
                        setBranchSearchTerm('')
                      }
                      setIsBranchDropdownOpen(true)
                      setIsRepoDropdownOpen(false)
                    }
                  }}
                  className="pl-10 pr-10 rounded-sm"
                  disabled={!selectedRepo || isLoadingBranches}
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer"
                  onClick={() => selectedRepo && setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                />
              </div>
              
              {isBranchDropdownOpen && selectedRepo && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
                  {isLoadingBranches ? (
                    <div className="flex items-center px-3 py-2 text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading branches...
                    </div>
                  ) : (
                    <>
                      {/* None option */}
                      <div
                        className={`px-3 py-2 hover:bg-white cursor-pointer text-sm flex items-center justify-between ${
                          !selectedBranch ? 'bg-white border' : ''
                        }`}
                        onClick={() => {
                          setSelectedBranch('')
                          setBranchSearchTerm('')
                          setIsBranchDropdownOpen(false)
                          // Clear global state when selecting None for branch
                          clearSelectedGitHubRepo()
                        }}
                      >
                        <span className="text-gray-500 italic">Search and select branch...</span>
                        {!selectedBranch && (
                          <Check className="h-4 w-4 text-black" />
                        )}
                      </div>
                      
                      {filteredBranches.length > 0 ? (
                        filteredBranches.map((branch) => (
                          <div
                            key={branch.name}
                            className={`px-3 py-2 hover:bg-white cursor-pointer text-sm flex items-center justify-between ${
                              selectedBranch === branch.name ? 'bg-white border' : ''
                            }`}
                            onClick={() => {
                              setSelectedBranch(branch.name)
                              setBranchSearchTerm('')
                              setIsBranchDropdownOpen(false)
                            }}
                          >
                            <span>{branch.name}</span>
                            {selectedBranch === branch.name && (
                              <Check className="h-4 w-4 text-black" />
                            )}
                          </div>
                        ))
                      ) : branchSearchTerm && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No branches found
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleSave}
            disabled={!selectedRepo || !selectedBranch || isSaving}
            className="w-full mt-6 bg-black text-white hover:bg-black rounded-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FolderIcon className="mr-2 h-4 w-4" />
                Save Repository
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
