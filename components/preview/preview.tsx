'use client'

import { BarLoader } from 'react-spinners'
import { CompassIcon, Loader2, RefreshCwIcon } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSandboxStore } from '@/app/state'
import { urlToHttpOptions } from 'node:url'
interface Props {
  className?: string
  isMobile?: boolean
  disablePointerEvents?: boolean
}

export function Preview({ className, isMobile = false, disablePointerEvents = false }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const {creatingSandbox, sandboxId, previewRefreshTrigger, status, url, previewLoading} = useSandboxStore()
  const disabled = status === 'stopped';

  const refreshIframe = () => {
    if (iframeRef.current && url) {
      setIsLoading(true)
      setError(null)
      iframeRef.current.src = url
    }
  }

  // Listen for preview refresh triggers from global state
  useEffect(() => {
    if (previewRefreshTrigger > 0) {
      console.log('[PREVIEW] Received refresh trigger from global state')
      refreshIframe()
    }
  }, [previewRefreshTrigger])

  const loadNewUrl = () => {
    if (iframeRef.current && url) {
      setIsLoading(true)
      setError(null)
      iframeRef.current.src = url
    }
  }

  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError('Failed to load the page')
  }

  if (isMobile) {
    return (
      <div className={cn('flex flex-col h-full w-full border border-primary/18 rounded-sm', className)}>
        {/* Mobile Header - Compact */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-primary/18 bg-secondary/50">
          <div className="flex items-center space-x-1">
            <a href={url} target="_blank" className="p-0.5">
              <CompassIcon className="w-3 h-3" />
            </a>
            <button
              onClick={refreshIframe}
              className={cn('p-0.5', {
                'animate-spin': isLoading,
              })}
            >
              <RefreshCwIcon className="w-3 h-3" />
            </button>
          </div>

          {url && (
            <input
              type="text"
              className="font-mono text-xs h-5 border border-gray-200 px-2 bg-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent flex-1 mx-2 min-w-0"
              onClick={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                  loadNewUrl()
                }
              }}
              style={{
                fontSize: isMobile ? 12 : 14
              }}
              value={url}
            />
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {(url && !disabled) ? (
            <>
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full scale-75 origin-top-left"
                style={{
                  width: '133.33%',
                  height: '133.33%',
                  pointerEvents: disablePointerEvents ? 'none' : 'auto',
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Browser content"
              />
            </>
          ) : (
            (creatingSandbox || sandboxId) ?
              <div className='w-full h-full flex items-center justify-center gap-x-2'>
                <Loader2 className="h-5 w-5 animate-spin text-gray-400"/>
                <p className='text-gray-400'>Building your app...</p>
              </div> :
              <div className='w-full h-full flex items-center justify-center gap-x-2'>
                <p className='text-sm text-gray-400'>No preview available</p>
              </div>
          )}

          {/* Show loading state even when no URL is available yet */}
          {isLoading && !error && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center flex-col gap-2">
              <BarLoader color="#666" />
              <span className="text-gray-500 text-xs">{"Building your app..."}</span>
            </div>
          )}
        </div>
      </div>
    )
  }


  return (
    <Panel className={className}>
      <PanelHeader>
        <div className="absolute flex items-center space-x-1">
          <a href={url} target="_blank" className="px-1">
            <CompassIcon className="w-4" />
          </a>
          <button
            onClick={refreshIframe}
            className={cn('px-1', {
              'animate-spin': isLoading,
            })}
          >
            <RefreshCwIcon className="w-4" />
          </button>
        </div>

        <div className="m-auto h-6">
          {url && (
            <input
              type="text"
              className="font-mono text-xs h-6 border border-gray-200 px-4 bg-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[300px]"
              onClick={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                  loadNewUrl()
                }
              }}
              value={url}
            />
          )}
        </div>
      </PanelHeader>

      <div className="flex h-full relative">
        {(url && !disabled) ? (
          <>
            <ScrollArea className="w-full">
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full"
                style={{
                  pointerEvents: disablePointerEvents ? 'none' : 'auto',
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Browser content"
              />
            </ScrollArea>
          </>
        ) : (
            (creatingSandbox || sandboxId) ?
              <div className='w-full h-full flex items-center justify-center gap-x-2'>
                <Loader2 className="h-5 w-5 animate-spin text-gray-400"/>
                <p className='text-gray-400'>Building your app...</p>
              </div> :
              <div className='w-full h-full flex items-center justify-center gap-x-2'>
                <p className='text-sm text-gray-400'>No preview available</p>
              </div>
        )}

        {/* Show loading state even when no URL is available yet */}
        {isLoading && !error && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center flex-col gap-2">
            <BarLoader color="#666" />
            <span className="text-gray-500 text-xs">{"Building your app..."}</span>
          </div>
        )}
      </div>
    </Panel>
  )
}
