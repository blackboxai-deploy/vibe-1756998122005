import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/model-selector/model-selector'
import { MoonLoader } from 'react-spinners'
import { ArrowUpIcon, SendIcon, Loader2 } from 'lucide-react'
import { memo, useCallback, useRef, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'
import { isSafari, requestNotificationPermission } from '@/lib/browser-notifications'
import { useSandboxStore } from '@/app/state'

interface Props {
  modelId: string
  input: string
  status: string
  onModelChange: (modelId: string) => void
  onInputChange: (value: string) => void
  onSubmit: (text: string) => void
  isMobile?: boolean;
}

export const ChatInput = memo(function ChatInput({ 
  modelId, 
  input, 
  status, 
  onModelChange, 
  onInputChange, 
  onSubmit,
  isMobile = false
}: Props) {
  const { isWelcomeScreen } = useSandboxStore()
  const isSubmittingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async (text: string) => {
    // Prevent duplicate submissions
    if (isSubmittingRef.current || status !== 'ready' || !text.trim()) {
      return
    }

    if (isSafari()) {
      requestNotificationPermission()
    }

    isSubmittingRef.current = true
    try {
      await onSubmit(text)
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false
      }, 500)
    }
  }, [onSubmit, status])

  // Global keyboard capture effect
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only capture when chat is ready and textarea exists
      if (status !== 'ready' || !textareaRef.current) {
        return
      }

      // Don't capture if textarea is already focused
      if (document.activeElement === textareaRef.current) {
        return
      }

      // Don't capture if user is typing in another input/textarea
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      )) {
        return
      }

      // Don't capture modifier keys, function keys, or special keys
      if (
        event.ctrlKey || 
        event.metaKey || 
        event.altKey || 
        event.key.length > 1 || // Function keys, arrows, etc.
        event.key === ' ' // Handle space separately to avoid conflicts
      ) {
        return
      }

      // Capture printable characters
      if (event.key.match(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]$/)) {
        event.preventDefault()
        
        // Focus the textarea and add the character
        textareaRef.current.focus()
        const newValue = input + event.key
        onInputChange(newValue)
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleGlobalKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [status, input, onInputChange])

  return (
    <div className={`bg-white m-2 border border-border rounded-xl ${
      isMobile ? 
        isWelcomeScreen ? 
          'block mt-8' : 
          'fixed bottom-[-10px] left-[-4px] right-[-4px] z-40' 
        : 
        ''
      }
    `}>
      <form
        className="h-full flex flex-col p-2 items-start gap-x-2"
        onSubmit={async (event) => {
          event.preventDefault()
          await handleSubmit(input)
        }}
      >
        <Textarea
          ref={textareaRef}
          autoResize={true}
          rows={2}
          minRows={2}
          maxRows={5}
          className={`${isMobile ? "flex-1 text-xs min-h-[2.25rem] font-mono rounded-sm" : "w-full text-sm border-0 bg-background font-mono rounded-sm"}`}
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={"Type your message..."}
          value={input}
          style={{
            fontSize: isMobile ? 16 : 14
          }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              await handleSubmit(input)
            }
          }}
        />
        <div className='pt-5 w-full flex item-center justify-between gap-y-2'>
          <ModelSelector
            modelId={modelId}
            onModelChange={(newModelId: string) => {
              onModelChange(newModelId)
            }}
          />
           <Button size={'sm'} type="submit" className={'rounded-full'}>
            {status === 'streaming' || status === 'submitted' ? (
              <Loader2 className='ml-[2px] animate-spin' color="currentColor" size={12} />
            ) : (
              <ArrowUpIcon className={"ml-[2px]"} />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
})
