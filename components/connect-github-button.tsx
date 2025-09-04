'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Github } from 'lucide-react'
import { ConnectGithubModal } from '@/components/modals/connect-github'
import { ImportGitHubRepoModal } from '@/components/modals/import-github-repo'
import { useSession } from 'next-auth/react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'
import { useSandboxStore } from '@/app/state'

interface Props {
  className?: string
}

export function ConnectGitHubButton(props: Props) {
  const { className } = props;
  const { data: session } = useSession()
  const isMobile = useIsMobile()
  const { selectedGitHubRepo } = useSandboxStore()
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const isConnected = !!(session?.githubAccessToken)
  const hasRepoSelected = !!(selectedGitHubRepo?.repository && selectedGitHubRepo?.branch)

  // Determine current state
  const getButtonState = () => {
    if (!isConnected) {
      return 'not-connected'
    } else if (!hasRepoSelected) {
      return 'connected-no-repo'
    } else {
      return 'repo-selected'
    }
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  const getButtonText = () => {
    const state = getButtonState()
    switch (state) {
      case 'not-connected':
        return 'Connect to GitHub'
      case 'connected-no-repo':
        return 'Select Repository'
      case 'repo-selected':
        // Extract repo name from full name (owner/repo)
        const repoName = selectedGitHubRepo?.repository?.split('/').pop() || selectedGitHubRepo?.repository || ''
        const branchName = selectedGitHubRepo?.branch || ''
        
        // Truncate repo and branch names to keep button text reasonable
        const maxRepoLength = isMobile ? 12 : 20
        const maxBranchLength = isMobile ? 8 : 20
        
        const truncatedRepo = truncateText(repoName, maxRepoLength)
        const truncatedBranch = truncateText(branchName, maxBranchLength)
        
        return `${truncatedRepo}/${truncatedBranch}`
      default:
        return 'Connect to GitHub'
    }
  }

  const getButtonVariant = () => {
    const state = getButtonState()
    return state === 'not-connected' ? isMobile ? 'ghost' : 'outline' : 'default'
  }

  const getButtonClassName = () => {
    const state = getButtonState()
    const baseClasses = className || ''
    
    if (state === 'not-connected') {
      return baseClasses
    } else {
      return `${baseClasses} bg-black text-white hover:bg-black`
    }
  }

  const handleButtonClick = () => {
    if (!isConnected) {
      setShowConnectModal(true)
    } else {
      setShowImportModal(true)
    }
  }

  return (
    <>
      <Button
        size={'sm'}
        onClick={handleButtonClick}
        variant={getButtonVariant()}
        className={getButtonClassName()}
      >
        {!isMobile && <Github /> }
        <span className={!isMobile ? 'ml-1' : ''}>
          {getButtonText()}
        </span>
      </Button>
      
      <ConnectGithubModal 
        open={showConnectModal} 
        onOpenChange={setShowConnectModal} 
      />
      
      <ImportGitHubRepoModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal} 
      />
    </>
  )
}
