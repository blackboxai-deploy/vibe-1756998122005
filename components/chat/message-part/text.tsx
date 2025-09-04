import type { TextUIPart } from 'ai'
import { MarkdownRenderer } from '@/components/markdown-renderer/markdown-renderer'
import { memo } from 'react'

export const Text = memo(function Text({ part }: { part: TextUIPart }) {
  // console.log(`[TEXT_COMPONENT] Rendering text content:`, {
  //   textLength: part.text?.length || 0,
  //   preview: part.text?.substring(0, 200) + (part.text && part.text.length > 200 ? '...' : ''),
  //   fullText: part.text
  // })
  
  return (
    <div className="text-sm px-2 sm:px-3.5 py-2 sm:py-3 border text-secondary-foreground border-border rounded-md font-mono w-full min-w-0 overflow-hidden">
      <MarkdownRenderer content={part.text} />
    </div>
  )
})
