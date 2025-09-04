'use client'

import { useSandboxStore } from '../state'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { History, Trash2, AlertTriangle, Loader2, ExternalLink, Globe } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { ChatUIMessage } from '@/components/chat/types'
import { Header } from '../header'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'
import { Preview } from '../preview'

interface ChatSession {
  id: string
  timestamp: number
  messages: ChatUIMessage[]
  title?: string
  lastUpdated: number
  sandbox?: {
    sandboxId: string
    createdAt: number
    expiresAt: number
  }
  latestDeploymentUrl?: string
  latestCustomDomain?: string
}

export default function ChatHistoryPage() {  
  const { data: session } = useSession()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { 
    chatSessions, 
    chatHistoryLoading, 
    pagination,
    deleteChatSession, 
    clearChatHistory, 
    loadChatHistory 
  } = useSandboxStore()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isResumingSandbox, setIsResumingSandbox] = useState(false)
  const [sandboxCreationSessionId, setSandboxCreationSessionId] = useState<string | null>(null)
  const itemsPerPage = isMobile ? 13 : 10

  // Load chat history on component mount and when page changes
  useEffect(() => {
    if (session?.user?.email) {
      loadChatHistory(currentPage, itemsPerPage)
    }
  }, [session?.user?.email, currentPage]) // Remove loadChatHistory from deps to avoid infinite loop

  const handleDeleteSession = (sessionId: string) => {
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      setIsDeleting(true)
      await deleteChatSession(sessionToDelete)
      // Reload current page after deletion
      await loadChatHistory(currentPage, itemsPerPage)
      setIsDeleting(false)
    }
    setDeleteDialogOpen(false)
    setSessionToDelete(null)
  }

  const confirmClearAllHistory = async () => {
    setIsClearing(true)
    await clearChatHistory()
    setCurrentPage(1) // Reset to first page after clearing
    setIsClearing(false)
    setClearAllDialogOpen(false)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = []
    const totalPages = pagination.totalPages
    const current = currentPage

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (current > 3) {
        pages.push('ellipsis-start')
      }

      // Show pages around current
      for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) {
        pages.push(i)
      }

      if (current < totalPages - 2) {
        pages.push('ellipsis-end')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  const handleResumeChat = async (session: ChatSession) => {
    try {
      setIsResumingSandbox(true)
      setSandboxCreationSessionId(session.id)
      
      // Create a sandbox using the API route
      const response = await fetch('/api/create-sandbox-for-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          ports: [3000], // Default port for Next.js
          runDevServer: true
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create sandbox')
      }
      
      // Redirect to homepage with the sandbox ID and session ID
      router.push(`/?sandboxId=${result.sandboxId}&sessionId=${result.sessionId}`)
      
    } catch (error) {
      console.error('Failed to create sandbox for chat session:', error)
      // Show error message or toast here if needed
    } finally {
      setIsResumingSandbox(false)
      setSandboxCreationSessionId(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const countStepStartParts = (messages: ChatUIMessage[]) => {
    let count = 0
    messages.forEach(message => {
      if (message.parts) {
        message.parts.forEach(part => {
          if (part.type !== 'step-start') {
            count++
          }
        })
      }
    })
    return count
  }

  return (
    <div className='h-screen max-h-screen'>
      <Header 
        isMobile={isMobile}
        previewContent={
          <Preview className="h-full flex-1 overflow-hidden" isMobile={isMobile} />
        }
      />
      <div className="h-[calc(100vh-110px)] mt-2 sm:h-[calc(100vh-110px)] flex flex-col pt-1 sm:pt-2 overflow-hidden mx-2 sm:mx-4 lg:mx-8 xl:mx-16 2xl:mx-auto 2xl:max-w-7xl">
        <Panel className="flex-1 overflow-hidden">
          <PanelHeader className="px-2 sm:px-2.5 py-1 sm:py-1.5">
            <div className="flex items-center font-mono uppercase font-semibold text-xs sm:text-sm min-w-0 overflow-hidden">
              <History className="mr-1.5 sm:mr-2 w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />
              <span className="hidden xs:inline truncate">Chat History</span>
              <span className="xs:hidden truncate">History</span>
            </div>
            <div className="ml-auto text-xs opacity-50 font-mono flex-shrink-0">
              <span className="hidden sm:inline">
                {pagination.total} session{pagination.total !== 1 ? 's' : ''}
              </span>
              <span className="sm:hidden">
                {pagination.total}
              </span>
            </div>
          </PanelHeader>

          <div className="flex-1 min-h-0">
            {chatHistoryLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-xs sm:text-sm text-muted-foreground font-mono px-4">
                <Loader2 color="#666" size={24} className="animate-spin" />
                <p className="text-center mt-3 sm:mt-4">Loading Chats</p>
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-xs sm:text-sm text-muted-foreground font-mono px-4">
                <History className="w-8 h-8 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-50" />
                <p className="text-center">No chat history yet</p>
                <p className="text-center text-xs mt-1 sm:mt-2 max-w-xs">
                  Start a conversation to see your chat history here
                </p>
                <Button
                  variant="outline"
                  className="mt-3 sm:mt-4 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
                  onClick={() => router.replace('/')}
                >
                  Start New Chat
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="">
                  {chatSessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "border-b border-border transition-colors group",
                        "px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5",
                        "touch-manipulation",
                        isResumingSandbox && sandboxCreationSessionId === session.id
                          ? "bg-gray-50 cursor-wait"
                          : "cursor-pointer hover:bg-gray-50 active:bg-gray-100"
                      )}
                      onClick={() => !isResumingSandbox && handleResumeChat(session)}
                    >
                      <div className="w-full flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`${isMobile ? 'max-w-[calc(100vw-180px)]' : ''} font-medium text-xs sm:text-sm font-mono uppercase tracking-tight truncate leading-tight overflow-hidden whitespace-nowrap text-ellipsis`}>
                              {session.title || 'Untitled Chat'}
                            </p>
                            {isResumingSandbox && sandboxCreationSessionId === session.id && (
                              <Loader2 color="#666" size={14} className="mb-1 flex-shrink-0 animate-spin" />
                            )}
                          </div>
                          {/* Deployment Links */}
                          {(session.latestDeploymentUrl || session.latestCustomDomain) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs gap-x-2">
                              {session.latestDeploymentUrl && (
                                <a
                                  href={session.latestDeploymentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 py-0.5 text-blue-700 hover:underline text-xs transition-colors"
                                  title={`Deployment: ${session.latestDeploymentUrl}`}
                                >
                                  <span className="truncate max-w-[120px] sm:max-w-[200px]">
                                    {session.latestDeploymentUrl.replace(/^https?:\/\//, '')}
                                  </span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {session.latestCustomDomain && (
                                <a
                                  href={`https://${session.latestCustomDomain}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-green-700 rounded text-xs hover:underline transition-colors"
                                  title={`Custom domain: ${session.latestCustomDomain}`}
                                >
                                  <Globe className="h-3 w-3" />
                                  <span className="truncate max-w-[120px] sm:max-w-[200px]">{session.latestCustomDomain}</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          )}
                          
                          <p className="mt-1 text-xs text-muted-foreground font-mono leading-tight">
                            {isResumingSandbox && sandboxCreationSessionId === session.id ? (
                              <span className="text-gray-600">Resuming sandbox...</span>
                            ) : (
                              <>
                                <span className="hidden xs:inline">
                                  {countStepStartParts(session.messages)} message{countStepStartParts(session.messages) !== 1 ? 's' : ''}
                                  {' • '}
                                </span>
                                {formatRelativeTime(session.lastUpdated)}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-7 w-7 sm:h-8 sm:w-8 p-0",
                              "opacity-60 sm:opacity-0 sm:group-hover:opacity-100",
                              "transition-opacity duration-200",
                              "touch-manipulation",
                              isResumingSandbox && "opacity-30 cursor-not-allowed"
                            )}
                            disabled={isResumingSandbox}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isResumingSandbox) {
                                handleDeleteSession(session.id)
                              }
                            }}
                            title="Delete session"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          
          
        </Panel>
        {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="fixed bg-white w-full left-0 right-0 bottom-0 px-3 py-2 sm:px-4 sm:py-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(currentPage - 1)}
                      className={cn(
                        currentPage === 1 && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                  
                  {generatePageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => handlePageChange(page as number)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => handlePageChange(currentPage + 1)}
                      className={cn(
                        currentPage === pagination.totalPages && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

        {/* Delete Session Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="w-[90vw] max-w-[400px] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
                <span className="truncate">Delete Chat Session</span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete this chat session? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteSession}
                disabled={isDeleting}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                {isDeleting ? (
                  <>
                    <Loader2 color="currentColor" size={14} className="animate-spin"  />
                    <span className="ml-2">Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear All History Confirmation Dialog */}
        <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
          <DialogContent className="w-[90vw] max-w-[400px] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
                <span className="truncate">Clear All Chat History</span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to clear all chat history? This will permanently delete all your chat sessions and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setClearAllDialogOpen(false)}
                disabled={isClearing}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmClearAllHistory}
                disabled={isClearing}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                {isClearing ? (
                  <>
                    <Loader2 color="#666" size={14} className="animate-spin"  />
                    <span className="ml-2">Clearing...</span>
                  </>
                ) : (
                  'Clear All'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
