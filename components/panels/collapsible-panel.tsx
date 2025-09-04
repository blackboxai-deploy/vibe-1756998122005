'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronRightIcon, MoveDiagonal, MoveDiagonalIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'

interface Props {
  className?: string
  children: ReactNode
  isCollapsed: boolean
  onToggle: () => void
  header: ReactNode
}

export function CollapsiblePanel({ className, children, isCollapsed, onToggle, header }: Props) {
  const isMobile = useIsMobile()

  return (
    <div
      className={cn(
        'flex flex-col relative border border-primary/18 w-full shadow-sm rounded-sm transition-all duration-200 ease-in-out',
        isCollapsed ? 'h-auto' : 'h-full',
        className
      )}
    >
      <div
        className={cn(
          'text-sm flex items-center border-b border-primary/18 px-2.5 py-1.5 text-secondary-foreground bg-white cursor-pointer hover:bg-secondary/80 transition-colors',
          isCollapsed && 'border-b-0'
        )}
        onClick={onToggle}
      >
        {
          !isMobile && 
            <MoveDiagonalIcon className="w-4 h-4 mr-1 flex-shrink-0" />
        }
        {header}
      </div>
      
      <div
        className={cn(
          'transition-all duration-200 ease-in-out overflow-hidden',
          isCollapsed ? 'h-0' : 'flex-1'
        )}
      >
        {!isCollapsed && (
          <div className="h-full">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export function CollapsiblePanelHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-center flex-1', className)}>
      {children}
    </div>
  )
}
