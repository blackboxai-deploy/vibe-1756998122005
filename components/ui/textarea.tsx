import * as React from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends React.ComponentProps<'textarea'> {
  autoResize?: boolean
  minRows?: number
  maxRows?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize = false, minRows = 1, maxRows = 4, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const combinedRef = React.useMemo(() => {
      return (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }
    }, [ref])

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea || !autoResize) return

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      
      // Calculate the height based on content
      const scrollHeight = textarea.scrollHeight
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 20
      const paddingTop = parseInt(getComputedStyle(textarea).paddingTop, 10) || 0
      const paddingBottom = parseInt(getComputedStyle(textarea).paddingBottom, 10) || 0
      
      const minHeight = lineHeight * minRows + paddingTop + paddingBottom
      const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom
      
      let newHeight = Math.max(scrollHeight, minHeight)
      
      if (newHeight > maxHeight) {
        newHeight = maxHeight
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }
      
      textarea.style.height = `${newHeight}px`
    }, [autoResize, minRows, maxRows])

    React.useEffect(() => {
      adjustHeight()
    }, [props.value, adjustHeight])

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      adjustHeight()
      if (props.onInput) {
        props.onInput(e)
      }
    }

    return (
      <textarea
        ref={combinedRef}
        data-slot="textarea"
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary flex min-h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          // Ensure placeholder and textarea text have matching font sizes
          '[&::placeholder]:text-[length:inherit]',
          className
        )}
        onInput={handleInput}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
