import type { ChatUIMessage } from './types'
import { MessagePart } from './message-part'
import { BotIcon, ExternalLink, UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JSX, memo, useMemo, useRef } from 'react'
import { DeployVercelButton } from '@/components/deploy-vercel-button'
import { useSandboxStore } from '@/app/state'
import { ChatStatus } from 'ai'
import { Button } from '../ui/button'

interface Props {
  message: ChatUIMessage
  isMobile?: boolean
  status?: ChatStatus
  isLastMessage?: boolean
}

// Create a stable hash for part content to detect changes
function createPartHash(part: ChatUIMessage['parts'][number], index: number): string {
  // Create a hash based on part type, content, and position
  const contentStr = JSON.stringify(part)
  return `${part.type}-${index}-${contentStr.length}-${contentStr.slice(0, 50)}`
}

export const Message = memo(function Message({ message, isMobile = false, status, isLastMessage = false }: Props) {
  // Use ref to store memoized parts to avoid infinite loops
  const memoizedPartsRef = useRef<Map<string, JSX.Element>>(new Map())
  
  // Get sandbox store state
  const { url } = useSandboxStore()

  // console.log(`[MESSAGE] Rendering message:`, {
  //   id: message.id,
  //   role: message.role,
  //   model: message.metadata?.model,
  //   partsCount: message.parts.length,
  //   partTypes: message.parts.map(part => part.type)
  // })

  const containerClassName = useMemo(() => cn({
    // Desktop margins
    'mr-20': message.role === 'assistant' && !isMobile,
    'ml-20': message.role === 'user' && !isMobile,
    // Mobile - full width with small padding
    'px-2': isMobile,
  }), [message.role])

  const headerContent = useMemo(() => {
    if (message.role === 'user') {
      return (
        <>
          <UserIcon className={cn("ml-auto", isMobile ? "w-3" : "w-4")} />
          <span>You</span>
        </>
      )
    } else {
      return (
        <>
          <BotIcon className={cn(isMobile ? "w-3" : "w-4")} />
          <span>Assistant ({message.metadata?.model})</span>
        </>
      )
    }
  }, [message.role, message.metadata?.model])

  // Render parts with memoization
  const renderedParts = useMemo(() => {
    const currentParts: JSX.Element[] = []
    const memoizedParts = memoizedPartsRef.current

    message.parts.forEach((part, index) => {
      const partHash = createPartHash(part, index)
      const stableId = `${message.id}-${partHash}`
      
      // Check if we already have this exact part memoized
      const existingPart = memoizedParts.get(stableId)
      
      if (existingPart) {
        // Reuse existing memoized part
        currentParts.push(existingPart)
        // console.log(`[MESSAGE] Reusing memoized part ${index}: ${part.type}`)
      } else {
        // Create new memoized part
        const newComponent = <MessagePart key={stableId} part={part} />
        memoizedParts.set(stableId, newComponent)
        currentParts.push(newComponent)
        // console.log(`[MESSAGE] Creating new memoized part ${index}: ${part.type}`)
      }
    })
    
    return currentParts
  }, [message.parts, message.id])

  // Helper function to check if a message contains relevant tool calls
  const hasRelevantToolCalls = useMemo(() => {
    return message.parts.some(part => 
      part.type === 'data-create-sandbox' ||
      part.type === 'data-create-file' ||
      part.type === 'data-edit-file' ||
      part.type === 'data-generating-files'
    )
  }, [message.parts])

  // Check if we should show the deploy button
  const shouldShowButtons = useMemo(() => {
    if (message.role !== 'assistant' || !url) return false

    if (isLastMessage && status !== 'ready') return false
    
    // Check if last part is text
    const lastPart = message.parts[message.parts.length - 1]
    if (lastPart?.type !== 'text') return false
    
    // Check if the message contains relevant tool calls
    return hasRelevantToolCalls
  }, [message.role, message.parts, status, url, hasRelevantToolCalls, isLastMessage])

  return (
    <div className={containerClassName}>
      {/* Message Header */}
      <div className={cn(
        "flex items-center gap-2 font-medium font-mono text-primary mb-1.5",
        isMobile ? "text-xs" : "text-sm"
      )}>
        {headerContent}
      </div>

      {/* Message Content */}
      <div className="space-y-1.5">
        {renderedParts}
        
        {/* Deploy button - show at the end when conditions are met */}
        {shouldShowButtons && (
          <div className={`${isMobile ? 'gap-x-1' : 'gap-x-2 mt-2'} flex flex-row items-center `}>
            <Button 
              size={'sm'} 
              variant={'outline'} 
              onClick={() => {
                window.open(url, '_blank')
              }}
              className={`${isMobile ? 'text-xs h-7' : ''}`}
            >
              <ExternalLink size={isMobile ? 12 : 16} />
              <span className='ml-1'>Open Website</span>
            </Button>
            <DeployVercelButton openInMessage={true} className={isMobile ? "w-full" : ""} />
          </div>
        )}
      </div>
    </div>
  )
})
