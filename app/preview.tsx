'use client'

import { Preview as PreviewComponent } from '@/components/preview/preview'
import { useSandboxStore } from './state'

interface Props {
  className?: string
  isMobile?: boolean
  disablePointerEvents?: boolean
}

export function Preview({ className, isMobile, disablePointerEvents }: Props) {    
  return (
    <PreviewComponent
      className={className}
      isMobile={isMobile}
      disablePointerEvents={disablePointerEvents}
    />
  )
}
