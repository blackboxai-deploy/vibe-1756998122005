import type { ChatUIMessage } from './types'
import { useEffect, useRef, useState } from 'react'
import { Message } from './message'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'
import { ChatStatus } from 'ai'

interface Props {
  messages: ChatUIMessage[]
  isMobile?: boolean
  status?: ChatStatus
}

export function ChatList({ messages, isMobile = false, status }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef<number>(0)
  const lastScrollHeightRef = useRef<number>(0)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  
  // Log messages updates
  // useEffect(() => {
  //   console.log(`[CHAT] Messages updated. Total count: ${messages.length}`)
  //   if (messages.length > 0) {
  //     const lastMessage = messages[messages.length - 1]
  //     console.log(`[CHAT] Last message:`, {
  //       id: lastMessage.id,
  //       role: lastMessage.role,
  //       partsCount: lastMessage.parts.length,
  //       partTypes: lastMessage.parts.map(part => part.type)
  //     })
  //   }
  // }, [messages?.length])

  // Get the scroll element (same logic used in multiple places)
  const getScrollElement = () => {
    if (!scrollAreaRef.current) return null
    
    // Try multiple selectors for cross-browser compatibility
    let scrollElement = scrollAreaRef?.current?.querySelector('[data-radix-scroll-area-viewport]') || 
                       scrollAreaRef?.current?.querySelector('.scroll-area-viewport') || 
                       scrollAreaRef?.current?.querySelector('[data-scroll-area-viewport]')
    
    if (!scrollElement) {
      // Last resort: use the scroll area itself
      scrollElement = scrollAreaRef?.current
    }
    
    return scrollElement as HTMLElement | null
  }

  // Check if user is at or near the bottom of the scroll area
  const isAtBottom = () => {
    const scrollElement = getScrollElement()
    if (!scrollElement) return true
    
    const { scrollTop, scrollHeight, clientHeight } = scrollElement
    const threshold = 200 // Reduced threshold for more precise detection
    
    // Add Math.ceil to handle sub-pixel rendering differences across browsers
    return Math.ceil(scrollTop + clientHeight) >= scrollHeight - threshold
  }

  // Set up scroll direction detection with improved logic
  useEffect(() => {
    const scrollElement = getScrollElement()
    if (!scrollElement) {
      return
    }

    const handleScroll = () => {
      const currentScroll = scrollElement.scrollTop
      const currentScrollHeight = scrollElement.scrollHeight
      
      // Check if content height changed (new message added)
      const contentGrew = currentScrollHeight > lastScrollHeightRef.current
      
      if (currentScroll > lastScrollTopRef.current) {
        // Scrolling down
        if (isAtBottom()) {
          // User scrolled to bottom, enable auto-scroll
          setShouldAutoScroll(true)
        }
      } else if (currentScroll < lastScrollTopRef.current && !contentGrew) {
        // Scrolling up (but not due to content growth) - user manually scrolled up
        setShouldAutoScroll(false)
      }
      
      lastScrollTopRef.current = currentScroll <= 0 ? 0 : currentScroll
      lastScrollHeightRef.current = currentScrollHeight
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Auto-scroll if we should auto-scroll (user hasn't manually scrolled up)
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll])

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full" data-chat-list>
      <div className={`${isMobile ? "space-y-2 py-2 pb-40" : "p-4 space-y-4 pb-20"}`} data-chat-messages>
        <div className={isMobile ? "space-y-2" : "space-y-4"}>
          {messages.map((message, idx) => {
            return isMobile ? (
              <div key={`${message.id}-${idx}`} className="w-full">
                <Message message={message} isMobile={true} status={status} isLastMessage={(messages?.length - 1) === idx} />
              </div>
            ) : (
              <Message key={`${message.id}-${idx}`} message={message} status={status} isLastMessage={(messages?.length - 1) === idx} />
            )
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}
