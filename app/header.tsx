'use client'

import { DeployVercelButton } from '@/components/deploy-vercel-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { FolderOpen, FolderOpenIcon, Package, ScrollTextIcon, ExternalLink, Monitor, Menu, MoreVertical, Terminal, Upload } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { ReactNode, useState } from 'react'
import { useSession } from 'next-auth/react'
import { UserMenu } from '@/components/auth/user-menu'
import { LoginButton } from '@/components/auth/login-button'
import { useSandboxStore } from './state'
import { History } from 'lucide-react'
import Link from 'next/link'
import { ConnectGitHubButton } from '@/components/connect-github-button'
import { PublishModal } from '@/components/modals/publish'

interface Props {
  className?: string
  previewContent?: ReactNode
  isMobile?: boolean
}

type PanelTab = 'preview' | null

export function Header({ className, previewContent, isMobile = false }: Props) {
  const { data } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { isWelcomeScreen } = useSandboxStore()

  const [activePanel, setActivePanel] = useState<PanelTab>(null)
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  // Check if we're on the chat-history page
  const isOnChatHistoryPage = pathname === '/chat-history'

  const handlePanelToggle = (panelId: PanelTab) => {
    setActivePanel(activePanel === panelId ? null : panelId)
  }

  const closePanel = () => {
    setActivePanel(null)
  }

  const activePanelData = activePanel === 'preview'
    ? { content: previewContent, title: 'Preview' }
    : null

  if (isMobile) {
    return (
      <>
        <header className={cn('flex flex-row items-center justify-between m-0 py-1 pl-3 pr-2 h-[49px]', className)}>
          <div
             onClick={() => {
              window.location.href = '/'
            }} 
            className="flex items-center cursor-pointer"
          >
            <span className="text-sm uppercase font-bold font-mono tracking-tight">
              B L A C K B O X . A I
            </span>
          </div>
          <div className="flex items-center gap-x-1">
            {/* Tools Dropdown Menu - Hide on chat-history page */}
            {!isOnChatHistoryPage && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-10 p-0 flex items-center justify-center touch-manipulation"
                    title="Tools"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[calc(100vw-2rem)] max-w-[240px] min-w-[200px]" 
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  alignOffset={-8}
                  avoidCollisions={true}
                  collisionPadding={16}
                >
                  <div className="space-y-1">
                    {
                      !isWelcomeScreen && 
                      <Button
                        size={'sm'}
                        variant={activePanel === 'preview' ? 'default' : 'ghost'}
                        onClick={() => handlePanelToggle('preview')}
                        className="w-full justify-start h-9 touch-manipulation"
                      >
                        <span className="truncate">Preview</span>
                      </Button>
                    }
                    {data?.user.email && (
                      <>
                        <Link href="/chat-history" target="_blank" rel="noopener noreferrer">
                          <Button
                            size={'sm'}
                            variant="ghost"
                            className="w-full justify-start h-9 touch-manipulation"
                          >
                            <span className="truncate">History</span>
                          </Button>
                        </Link>
                        <div>
                          <ConnectGitHubButton className="mt-1 w-full justify-start text-center h-9 touch-manipulation" />
                        </div>
                        {
                          !isWelcomeScreen && 
                          <div>
                            <Button
                              variant={'ghost'}
                              size={'sm'}
                              onClick={() => setPublishModalOpen(true)}
                              className="w-full justify-start text-center h-9 touch-manipulation"
                            >
                              Publish
                            </Button>
                          </div>
                        }
                        {
                          !isWelcomeScreen && 
                          <div>
                            <DeployVercelButton 
                              className="w-full justify-start text-center h-9 touch-manipulation" 
                            />
                          </div>
                        }
                      </>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* User Menu/Login - Keep separate for easy access */}
            {data?.user.email ? <UserMenu /> : <LoginButton text={''} mobileClassName="h-10 w-10 p-0 flex items-center justify-center" />}
          </div>
        </header>

        {/* Modal Dialog for Mobile Panels */}
        <Dialog open={!!activePanel} onOpenChange={closePanel}>
          <DialogContent className="max-w-[90vw] max-h-[70vh] w-[90vw] p-0 gap-0" showCloseButton={false}>
            <DialogTitle></DialogTitle>
            <div className="h-[70vh] overflow-hidden">
              {activePanelData?.content}
            </div>
          </DialogContent>
        </Dialog>

        {/* Publish Modal */}
        <PublishModal 
          open={publishModalOpen} 
          onOpenChange={setPublishModalOpen} 
        />
      </>
    )
  }

  return (
    <header className={cn('flex items-center justify-between py-1 px-4 m-0 h-[45px]', className)}>
      <div 
        onClick={() => {
          window.location.href = '/'
        }} 
        className="flex items-center cursor-pointer"
      >
        <span className="ml-2 text-sm uppercase font-mono font-bold tracking-tight">
          B L A C K B O X . A I
        </span>
      </div>
      <div className="flex items-center ml-auto space-x-1.5">
        {/* Hide all buttons except profile picture when on chat-history page */}
        {!isOnChatHistoryPage && (
          <>
            {/* <ConnectSandboxButton /> */}
            {!isWelcomeScreen && (
              <Button
                variant="outline"
                size={'sm'}
                onClick={() => handlePanelToggle('preview')}
              >
                Preview
              </Button>
            )}
            {data?.user.email && <ConnectGitHubButton /> }
            {data?.user.email && !isWelcomeScreen && (
              <Button
                variant="outline"
                size={'sm'}
                onClick={() => setPublishModalOpen(true)}
              >
                Publish
              </Button>
            )}
            {data?.user.email && !isWelcomeScreen && <DeployVercelButton />}
            {data?.user.email && (
              <Link href="/chat-history" target="_blank" rel="noopener noreferrer">
                <Button
                  variant={'outline'}
                  size={'sm'}
                  className={className}
                >
                  History
                </Button>
              </Link>
            )}
          </>
        )}
        {/* Always show user menu/login button (profile picture) */}
        {data?.user.email ? <UserMenu /> : (typeof data !== 'undefined' && <LoginButton />)}
      </div>

      {/* Modal Dialog for Desktop Preview */}
      <Dialog open={!!activePanel} onOpenChange={closePanel}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] w-[90vw] p-0 gap-0" showCloseButton={false}>
          <DialogTitle></DialogTitle>
          <div className="h-[80vh] overflow-hidden">
            {activePanelData?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Modal */}
      <PublishModal 
        open={publishModalOpen} 
        onOpenChange={setPublishModalOpen} 
      />
    </header>
  )
}
