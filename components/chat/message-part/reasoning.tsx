import type { ReasoningUIPart } from 'ai'
import { MarkdownRenderer } from '@/components/markdown-renderer/markdown-renderer'
import { MessageSpinner } from '../message-spinner'
import { memo } from 'react'

export const Reasoning = memo(function Reasoning({ part }: { part: ReasoningUIPart }) {
  console.log(`[REASONING_COMPONENT] Rendering reasoning:`, {
    state: part.state,
    textLength: part.text?.length || 0,
    preview: part.text?.substring(0, 200) + (part.text && part.text.length > 200 ? '...' : ''),
    isStreaming: part.state === 'streaming'
  })

  if (part.state === 'done' && !part.text) {
    console.log(`[REASONING_COMPONENT] Skipping render - done with no text`)
    return null
  }

  return (
    <div className="text-xs sm:text-sm px-3 sm:px-3.5 py-2 sm:py-3 border border-border bg-background rounded-md w-full min-w-0">
      <div className="text-secondary-foreground mb-1 font-mono leading-normal break-words">
        <MarkdownRenderer content={part.text || '_Thinking_'} />
        {part.state === 'streaming' && <MessageSpinner />}
      </div>
    </div>
  )
})
