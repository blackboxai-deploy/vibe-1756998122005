'use client'

import { useIntersectionSafariRepaint, useStreamingSafariRepaint, useWhiteScreenDetection } from './intersection-safari-repaint'
import type { ChatUIMessage } from '@/components/chat/types'
import { DEFAULT_MODEL, TEST_PROMPTS, MODEL_NAME_MAP } from '@/ai/constants'
import { MessageCircleIcon } from 'lucide-react'
import { ChatList } from '@/components/chat/chat-list'
import { ChatInput } from '@/components/chat/chat-input'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { createParser, useQueryState } from 'nuqs'
import { toast } from 'sonner'
import { mutate } from 'swr'
import { sleep } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { useDataStateMapper, useSandboxFromURL, useSandboxStore } from './state'
import { useLocalStorageValue } from '@/lib/use-local-storage-value'
import { useEffect, useCallback, Suspense, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import LoginDialog from '@/components/auth/login-dialog'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
import { LazyCreditsDialog } from '@/components/payment/lazy-credits-dialog'
import { ModelSelector } from '@/components/model-selector/model-selector'
import { telemetry } from '@/lib/telemetry'
import { getRepoPrompt } from './api/chat/prompt'
import { CommunityApps } from '@/components/community-apps'
import { useSoundNotification, useChatStatusNotification } from '@/lib/sound-notification'

const modelParser = createParser({
  parse: (value) => (value in MODEL_NAME_MAP ? value : DEFAULT_MODEL),
  serialize: (value) => value,
}).withDefault(DEFAULT_MODEL)

interface Props {
  className: string
  modelId?: string
  isMobile?: boolean
}

export function Chat({ className, isMobile = false }: Props) {
  const [modelId, setModelId] = useQueryState('modelId', modelParser)
  const [input, setInput] = useLocalStorageValue('prompt-input')
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const retryCountRef = useRef(0)
  const isRetryingRef = useRef(false)
  const [lastUserMessage, setLastUserMessage] = useState<{ text: string, modelId: string } | null>(null)
  const [errorMessages, setErrorMessages] = useState<ChatUIMessage[]>([])
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isLoadingHistoricalMessages, setIsLoadingHistoricalMessages] = useState(false)
  const searchParams = useSearchParams()
  
  // Ref to track current messages for onFinish callback
  const messagesRef = useRef<ChatUIMessage[]>([])
  
  // Sound notification hooks
  const { playNotificationSound } = useSoundNotification()
  
  // Initialize sandbox from URL parameter
  useSandboxFromURL()
  const { data: session } = useSession()
  const mapDataToState = useDataStateMapper()
  const { checkSubscription, subscriptionCache, invalidateSubscriptionCache } = useSubscriptionCheck()
  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false)
  const { 
    saveChatSession, 
    saveChatSessionImmediate, 
    currentSessionId, 
    setChatHistoryLoading, 
    resetCurrentSession, 
    getSelectedGitHubRepo, 
    saveSandboxToSession, 
    connectToExistingSandbox, 
    sandboxId, 
    triggerPreviewRefresh, 
    url, 
    isWelcomeScreen, 
    setIsWelcomeScreen 
  } = useSandboxStore()

  // Safari Intersection Observer optimizations
  const { isActive: isIntersectionActive, repaintCount, activeElements } = useIntersectionSafariRepaint()
  useWhiteScreenDetection()
  
  // Log Safari optimization status for debugging
  useEffect(() => {
    if (isIntersectionActive) {
      console.log(`🎯 Safari Intersection Observer: Active - ${repaintCount} total repaints, ${activeElements} elements monitored`)
    }
  }, [isIntersectionActive, repaintCount, activeElements])

  const { messages, setMessages, sendMessage, status, stop, clearError } = useChat<ChatUIMessage>({
    onToolCall: () => mutate('/api/auth/info'),
    onData: (data) => {
      const turnNumber = messages.length
      console.log(`[CHAT] Data received on turn ${turnNumber}:`, {
        dataType: data.type,
        turnNumber,
        messagesCount: messages.length,
        timestamp: new Date().toISOString(),
        data: data
      })

      try {
        mapDataToState(data)
      } catch (error) {
        console.error(`[CHAT] Error mapping data to state on turn ${turnNumber}:`, {
          error,
          data,
          turnNumber,
          timestamp: new Date().toISOString()
        })
      }
    },
    onError: async (error) => {
      const turnNumber = messages.length + 1
      console.log(`🚩 Error occurred on turn ${turnNumber}:`, {
        error: error.message,
        turnNumber,
        timestamp: new Date().toISOString()
      })

      if (error.message.includes("Insufficient credits. Please add more credits to continue.")) {
        setShowCreditsDialog(true)
        toast.error(`Communication error with the AI: ${error.message}`, { duration: 5000 })
        await stop()
        await sleep(1500)
        await clearError()
        return
      }

      const currentRetryCount = retryCountRef.current
      
      if (!error.message.includes("network error")) {
        const errorMessage: ChatUIMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          parts: [{
            type: 'text',
            text: currentRetryCount >= 3 
              ? `⚠️ **We're experiencing high demand**\n\nWe're currently experiencing high demand on our services. Please try again in a few moments or consider using a different model.\n\nError: ${error.message}`
              : `❌ **Error occurred**\n\nAn error occurred while processing your request:\n\n${error.message}\n\n${currentRetryCount < 3 ? `Attempting retry ${currentRetryCount + 1} of 3...` : ''}`
          }],
          metadata: {
            model: modelId
          }
        }

        setErrorMessages(prev => [...prev, errorMessage])
      }

      await stop()
      await sleep(1500)
      await clearError()

      console.log(`🚩 Retry check - retryCount: ${currentRetryCount}, lastUserMessage:`, lastUserMessage)
      if (currentRetryCount < 3) {
        await retryLastMessage()
      } else if (currentRetryCount >= 3) {
        console.log(`🚩 Max retries reached, resetting retry count`)
        retryCountRef.current = 0
        isRetryingRef.current = false
      }
    },
    onFinish: async (message) => {
      // Get current state values to avoid stale closures
      const currentState = useSandboxStore.getState()
      const currentSessionId = currentState.currentSessionId
      
      const turnNumber = messages.length
      console.log(`[CHAT] Message finished on turn ${turnNumber}:`, {
        messageId: message.message.id,
        role: message.message.role,
        partsCount: message.message.parts?.length || 0,
        turnNumber,
        timestamp: new Date().toISOString(),
        isLoadingHistoricalMessages,
        currentSessionId
      })
      
      // Clear retry state and error messages on successful completion
      retryCountRef.current = 0
      isRetryingRef.current = false
      setErrorMessages([])
      console.log('🚩 Successful completion - cleared retry state and error messages')
      
      // Skip saving if we're loading historical messages
      if (isLoadingHistoricalMessages) {
        console.log('[CHAT] Skipping save - loading historical messages')
        return
      }
      
      // ONLY save chat session when AI response is complete - this is the ONLY save point
      const currentMessages = messagesRef.current
      console.log('[CHAT] Saving chat session after AI response completion', {
        currentSessionId,
        messageCount: currentMessages.length + 1,
        lastMessageRole: message.message.role
      })
      
      // Use the store's saveChatSessionImmediate directly to ensure we have the latest state
      await currentState.saveChatSessionImmediate([...currentMessages, message.message], true)
    },
  })

  // // Handle auto-list-files event from file explorer
  // useEffect(() => {
  //   const handleAutoListFiles = (event: CustomEvent) => {
  //     const { sandboxId, reason } = event.detail
  //     console.log(`[CHAT] Auto-listing files for sandbox: ${sandboxId}, reason: ${reason}`)
      
  //     // Send a list-files command to populate the file explorer
  //     const reasonMessages = {
  //       'initial-auto-list': 'List files in the sandbox root directory to populate the file explorer.',
  //       'paths-became-empty': 'Re-list files in the sandbox root directory as the file explorer became empty.',
  //       'manual-refresh': 'Refresh the file list in the sandbox root directory.',
  //     }
      
  //     const listFilesMessage = (reason && reasonMessages[reason as keyof typeof reasonMessages]) || 
  //       'List files in the sandbox root directory to populate the file explorer.'
      
  //     sendMessage({ text: listFilesMessage }, { body: { modelId } })
  //   }

  //   window.addEventListener('auto-list-files', handleAutoListFiles as EventListener)
    
  //   return () => {
  //     window.removeEventListener('auto-list-files', handleAutoListFiles as EventListener)
  //   }
  // }, [sendMessage, modelId])

  // Keep messagesRef updated with current messages
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Handle chat status notifications
  useChatStatusNotification(status, playNotificationSound)

  // Safari streaming optimization
  useStreamingSafariRepaint(status !== 'ready')

  // Add Safari streaming body attribute for CSS optimization
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari) return;

    if (status !== 'ready') {
      document.body.setAttribute('data-safari-streaming', 'true');
    } else {
      document.body.removeAttribute('data-safari-streaming');
    }
  }, [status]);

  // Not needed anymore as called in header now
  // useEffect(() => {
  //   if (session?.user.email) {
  //     checkSubscription(session.user.email)
  //   }
  // }, [session?.user])

  // Load session data from URL parameters if sessionId is provided
  useEffect(() => {
    const sessionId = searchParams.get('sessionId')
    
    if (sessionId && session?.user?.email && messages.length === 0) {
      setIsLoadingSession(true)
      setIsLoadingHistoricalMessages(true)
      
      fetch(`/api/chat-history/${sessionId}`)
        .then(response => response.json())
        .then(data => {
          if (data.session && data.session.messages) {
            // Set the messages directly in useChat
            setMessages(data.session.messages)
            // Set the current session ID in the store
            useSandboxStore.setState({ currentSessionId: sessionId })
            
            // Check if session has a valid sandbox and connect to it
            const now = Date.now()
            if (data.session.sandbox) {
              const isValid = now < data.session.sandbox.expiresAt
              
              if (isValid) {
                // Connect to the existing sandbox
                connectToExistingSandbox(data.session.sandbox.sandboxId, true)
              }
            }
            
            console.log('[CHAT] Loaded session from URL:', {
              sessionId,
              messageCount: data.session.messages.length,
              title: data.session.title,
              hasSandbox: !!data.session.sandbox,
              sandboxValid: data.session.sandbox ? now < data.session.sandbox.expiresAt : false
            })
          }
        })
        .catch(error => {
          console.error('Failed to load session from URL:', error)
        })
        .finally(() => {
          setIsLoadingSession(false)
          // Reset the flag after a short delay to ensure setMessages has completed
          setTimeout(() => {
            setIsLoadingHistoricalMessages(false)
          }, 100)
        })
    }
  }, [searchParams, session?.user?.email, messages.length, setMessages])

  // Reset current session when starting a new chat (component mount)
  useEffect(() => {
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      resetCurrentSession()
    }
  }, [resetCurrentSession])

  // Update URL with sessionId when currentSessionId changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSessionId) {
      const url = new URL(window.location.href)
      const currentSessionIdInUrl = url.searchParams.get('sessionId')
      
      // Only update URL if sessionId is different from what's currently in URL
      if (currentSessionIdInUrl !== currentSessionId) {
        url.searchParams.set('sessionId', currentSessionId)
        window.history.replaceState({}, '', url.toString())
        
        console.log('[CHAT] Updated URL with sessionId:', {
          sessionId: currentSessionId,
          newUrl: url.toString()
        })
      }
    }
  }, [currentSessionId])

  // Track welcome screen state and update central state
  useEffect(() => {
    const isWelcome = messages.length === 0 && !isLoadingSession
    setIsWelcomeScreen(isWelcome)
  }, [messages.length, isLoadingSession, setIsWelcomeScreen])

  const messagePartsLength = messages?.map((message) => message?.parts).flat()?.length

  // Monitor messages for file manipulation tool calls and refresh preview
  useEffect(() => {
    if (messages.length === 0 || !url) {
      return
    }

    const lastMessage = messages?.[messages.length - 1]
    const totalMessageParts = lastMessage?.parts?.length

    if (totalMessageParts < 2) {
      return 
    }

    const secondLastMessagePart = lastMessage?.parts?.[totalMessageParts - 2]

    const isServerStartCommand = secondLastMessagePart?.type === 'data-execute-command' && secondLastMessagePart?.data?.command?.includes('pnpm') && secondLastMessagePart?.data?.args?.includes('start')

    if (isServerStartCommand) {
      console.log('[CHAT] pnpm start command executed, refreshing preview')
      // Add a small delay to ensure file operations are complete
      setTimeout(() => {
        triggerPreviewRefresh()
      }, 200)
    }
  }, [messagePartsLength, triggerPreviewRefresh])

  const retryLastMessage = useCallback(async () => {
    isRetryingRef.current = true
    const newRetryCount = retryCountRef.current + 1
    retryCountRef.current = newRetryCount
    console.log(`🚩 Retrying message, attempt ${newRetryCount} of 3`)

    try {
      const selectedGitHubRepo = getSelectedGitHubRepo()
      
      // Send retry message directly
      sendMessage(
        { text: lastUserMessage?.text || `Retrying message, attempt ${newRetryCount} of 3`}, 
        { 
          body: { 
            modelId: lastUserMessage?.modelId || modelId, 
            userEmail: session?.user.email, 
            customerId: subscriptionCache?.customerId,
            sandboxId: sandboxId,
            sessionId: currentSessionId,
            github: {
              repo: selectedGitHubRepo?.repository || 'openai/codex-universal',
              branch: selectedGitHubRepo?.branch || 'main',
              accessToken: session?.githubAccessToken
            }
          } 
        }
      )
      await sleep(2000)
      setErrorMessages([])
    } catch (retryError) {
      console.error(`🚩 Retry attempt ${newRetryCount} failed:`, retryError);
      isRetryingRef.current = false
    }
  }, [getSelectedGitHubRepo, sendMessage, lastUserMessage?.text, lastUserMessage?.modelId, modelId, session?.user.email, session?.githubAccessToken, subscriptionCache?.customerId])

  const validateAndSubmitMessage = useCallback(async (text: string) => {
    const repoCloneUrl = "https://github.com/openai/codex-universal"
    const repoBranchName = "main"

    if (!session?.user) {
      // redirect user to google signin
      toast.info("Login first to access the platform")
      invalidateSubscriptionCache()
      await signIn("google")
      // setShowLoginDialog(true) // TODO: We can enable this dialog later
      return
    }

    let confirmedSessionId = currentSessionId;

    if (text.trim()) {
      console.log(`[CHAT] Sending message:`, { text: text.trim(), modelId, githubToken:  session?.githubAccessToken? 'true' : 'false' })
      
      // Check if this is a retry message not to save it to chat history
      const isRetryMessage = text.includes('Retrying message, attempt') && text.includes('of 3')
      if (!isRetryMessage) {
        // Create the user message object matching the useChat message structure
        const userMessage: ChatUIMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          parts: [
            {
              type: 'text',
              text: text.trim(),
            }
          ],
        }
        
        // Save the user message immediately to chat history
        console.log('[CHAT] Saving user message to chat history (without files)')
        const { sessionId } = await saveChatSessionImmediate([...messages, userMessage], false)
        confirmedSessionId = sessionId
        
        // Only set lastUserMessage for non-retry messages
        const messageToSend = { text: text.trim(), modelId }
        setLastUserMessage(messageToSend)
        
        retryCountRef.current = 0
        isRetryingRef.current = false
        setErrorMessages([])
        
        // Trigger telemetry for message submission
        telemetry(
          'Other Engagement',
          session?.user.email || 'user',
          {
            tag: 'vibe_chat_message_sent',
            id: session?.user.email,
            modelId: modelId,
            messageLength: text.trim().length,
            timestamp: new Date().toISOString()
          }
        )
      } else {
        console.log('[CHAT] Skipping save retry message to chat history')
      }

      const selectedGitHubRepo = getSelectedGitHubRepo()
      
      sendMessage({ 
        text: text.trim()
      }, { 
        body: { 
          modelId, 
          userEmail: session?.user.email, 
          customerId: subscriptionCache?.customerId,
          sandboxId: sandboxId,
          sessionId: confirmedSessionId,
          github: {
            repo: selectedGitHubRepo?.repository,
            branch: selectedGitHubRepo?.branch,
            accessToken: session?.githubAccessToken
          } 
        } 
      })

      setInput('')
    }
  }, [sendMessage, modelId, setInput, session?.user, subscriptionCache, messages, saveChatSessionImmediate])

  if (isMobile) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 overflow-auto">
          {isLoadingSession ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground font-mono px-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mb-4"></div>
              <p className="text-center">Loading chat session...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className={`welcome-screen overflow-y-auto`}>
              <div className={`min-h-full flex flex-col ${isMobile ? 'p-4': 'p-8'}`}>
                {/* Centered Content */}
                <div className="mt-34 flex-1 flex flex-col items-center justify-center text-center">
                  <div className={`${isMobile ? 'w-full' : 'max-w-2xl mx-auto space-y-8'}`}>
                    <div className={isMobile ? 'space-y-1' : "space-y-2"}>
                      <h3 className="text-2xl font-bold text-foreground tracking-tight">
                        The best AI agent for builders
                      </h3>
                      <p className="text-base md:text-xl text-muted-foreground mx-auto">
                        AI Agent for developers and creators.
                      </p>
                    </div>
                    
                    <div className="w-full mx-auto">
                      <ChatInput
                        modelId={modelId}
                        input={input}
                        status={status}
                        onModelChange={setModelId}
                        onInputChange={setInput}
                        onSubmit={validateAndSubmitMessage}
                        isMobile={isMobile}
                      />
                    </div>

                    <div className={isMobile ? 'pt-2' : 'space-y-3'}>
                      <div className="flex flex-wrap gap-x-2 justify-center">
                        {TEST_PROMPTS.map((prompt, idx) => (
                          <button
                            key={idx}
                            className={`${isMobile ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} mb-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors cursor-pointer border border-border`}
                            onClick={() => validateAndSubmitMessage(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className='w-full mx-auto mt-28'>
                  <CommunityApps isMobile={isMobile} />
                </div>
              </div>
            </div>
          ) : (
            <ChatList 
              messages={messages.filter(msg => 
                !(msg.role === 'user' && 
                  msg.parts?.[0]?.type === 'text' && 
                  msg.parts[0].text.includes('Retrying message, attempt') && 
                  msg.parts[0].text.includes('of 3'))
              )} 
              isMobile={isMobile}
              status={status}
            />
          )}
        </div>

        {messages.length > 0 && (
          <ChatInput
            modelId={modelId}
            input={input}
            status={status}
            onModelChange={setModelId}
            onInputChange={setInput}
            onSubmit={validateAndSubmitMessage}
            isMobile={isMobile}
          />
        )}
      </div>
    )
  }

  return (
    <Panel 
      className={`${className} ${messages.length === 0 ? 'border-none' : ''}`}
      data-chat-container
      data-main-content
    >
      {messages.length > 0 && (
        <PanelHeader>
          <div className="flex items-center font-mono uppercase font-semibold">
            <MessageCircleIcon className="mr-2 w-4" />
            Chat
            {/* Safari optimization indicator */}
            {isIntersectionActive && (
              <span className="ml-2 text-xs opacity-30" title={`Safari optimization: ${repaintCount} repaints, ${activeElements} active elements`}>
                🎯
              </span>
            )}
          </div>
          <div className="ml-auto text-xs opacity-50 font-mono">[{status}]</div>
        </PanelHeader>
      )}

      {/* Messages Area */}
      <div className="flex-1 min-h-0">
        {isLoadingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground font-mono px-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mb-4"></div>
            <p className="text-center">Loading chat session...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="welcome-screen h-full overflow-y-auto">
            <div className="min-h-full flex flex-col pt-40">
              {/* Centered Content */}
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="mx-auto space-y-8">
                  <div className="space-y-4">
                    <h1 className="text-5xl font-bold mb-3 text-center leading-tight">
                      Agent for building AI Powered Apps.
                    </h1>
                    <p className='text-lg font-light text-muted-foreground text-center leading-relaxed mb-4'>
                      AI Agent for developers and creators to build full-stack AI Apps and UI components. <br/> Build production-ready software.
                    </p>
                  </div>
                  
                  <div className="w-full mx-auto">
                    <ChatInput
                      modelId={modelId}
                      input={input}
                      status={status}
                      onModelChange={setModelId}
                      onInputChange={setInput}
                      onSubmit={validateAndSubmitMessage}
                      isMobile={isMobile}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-medium">
                      Or try one of these:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {TEST_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          className="px-4 py-2 mb-2 text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors cursor-pointer border border-border"
                          onClick={() => validateAndSubmitMessage(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Community Apps Section - At Bottom with Wide Width */}
              <div className="w-8/12 mx-auto my-12">
                <CommunityApps isMobile={isMobile} />
              </div>
            </div>
          </div>
        ) : (
          <ChatList 
            messages={[
              ...messages.filter(msg => 
                !(msg.role === 'user' && 
                  msg.parts?.[0]?.type === 'text' && 
                  msg.parts[0].text.includes('Retrying message, attempt') && 
                  msg.parts[0].text.includes('of 3'))
              ), 
              ...errorMessages
            ]} 
            isMobile={isMobile}
            status={status}
          />
        )}
      </div>

      {messages.length > 0 && (
        <ChatInput
          modelId={modelId}
          input={input}
          status={status}
          onModelChange={setModelId}
          onInputChange={setInput}
          onSubmit={validateAndSubmitMessage}
          isMobile={isMobile}
        />
      )}

      <Suspense fallback={<></>}>
        <LoginDialog showLoginDialog={showLoginDialog} setShowLoginDialog={setShowLoginDialog} />
      </Suspense>

      <LazyCreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
      />
    </Panel>
  )
}
