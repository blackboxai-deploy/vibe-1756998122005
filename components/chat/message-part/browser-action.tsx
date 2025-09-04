import type { DataPart } from '@/ai/messages/data-parts'
import { MousePointer, Globe, Image, Terminal, Keyboard, ArrowDown, ArrowUp, X, CheckCircle, AlertCircle, Target } from 'lucide-react'
import { MessageSpinner } from '../message-spinner'
import { ToolHeader } from '../tool-header'
import { ToolMessage } from '../tool-message'
import { cn } from '@/lib/utils'
import { useState, memo } from 'react'

export const BrowserAction = memo(function BrowserAction(props: {
  className?: string
  message: DataPart['browser-action']
}) {
  console.log(`[BROWSER_ACTION] Rendering with data:`, props.message)
  
  const { 
    action, 
    url, 
    coordinate, 
    text, 
    status, 
    result, 
    screenshot, 
    logs, 
    currentUrl, 
    currentMousePosition,
    executionSuccess,
    errorMessage
  } = props.message
  const [showLogs, setShowLogs] = useState(false)
  const [screenshotError, setScreenshotError] = useState(false)
  
  console.log(`[BROWSER_ACTION] Screenshot available:`, !!screenshot, screenshot?.substring(0, 50) + '...')
  console.log(`[BROWSER_ACTION] Status:`, status, 'Action:', action)
  
  const getActionIcon = () => {
    switch (action) {
      case 'launch':
        return <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      case 'click':
        return <MousePointer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      case 'type':
        return <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      case 'scroll_down':
        return <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      case 'scroll_up':
        return <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      case 'close':
        return <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      default:
        return <MousePointer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    }
  }

  const getActionDescription = () => {
    switch (action) {
      case 'launch':
        return url ? `Launch browser at ${url}` : 'Launch browser'
      case 'click':
        return coordinate ? `Click at coordinates ${coordinate}` : 'Click'
      case 'type':
        return text ? `Type "${text}"` : 'Type text'
      case 'scroll_down':
        return 'Scroll down'
      case 'scroll_up':
        return 'Scroll up'
      case 'close':
        return 'Close browser'
      default:
        return action
    }
  }

  const getStatusIcon = () => {
    if (status === 'loading') return null
    if (executionSuccess === false || errorMessage) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    if (executionSuccess === true) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    return null
  }

  // Parse coordinate string to get x, y values
  const parseCoordinate = (coord: string) => {
    const match = coord.match(/(\d+),\s*(\d+)/)
    if (match) {
      return { x: parseInt(match[1]), y: parseInt(match[2]) }
    }
    return null
  }

  // Parse coordinates directly - no scaling needed since browser viewport is 900x600
  // and screenshots are captured at the same resolution
  const clickCoords = coordinate ? parseCoordinate(coordinate) : null
  const mouseCoords = currentMousePosition ? parseCoordinate(currentMousePosition) : null

  return (
    <ToolMessage className={cn(props.className)}>
      <ToolHeader>
        {getActionIcon()}
        <p className="flex-1 text-xs sm:text-sm overflow-hidden">
          {status === 'loading' ? 'Executing' : 'Executed'} Browser Action: {getActionDescription()}
        </p>
        {getStatusIcon()}
      </ToolHeader>
      <div className="max-w-full overflow-x-hidden space-y-3 sm:space-y-4">
        {status === 'loading' && (
          <div className="space-y-3">
            <MessageSpinner />
            <div className="text-xs sm:text-sm text-muted-foreground">
              Executing browser action: {getActionDescription()}...
            </div>
          </div>
        )}
        
        {/* Action Details */}
        {status === 'done' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            {/* Action Info Card */}
            <div className="bg-white rounded-lg p-3 sm:p-4 space-y-2 border">
              <div className="font-medium flex items-center gap-2 text-sm sm:text-base">
                {getActionIcon()}
                Action Details
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <div><span className="font-medium">Action:</span> {action}</div>
                {url && (
                  <div className="break-all">
                    <span className="font-medium">URL:</span> 
                    <span className="ml-1">{url}</span>
                  </div>
                )}
                {coordinate && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Click Position:</span> 
                    <code className="bg-white px-1.5 py-0.5 rounded text-xs sm:text-sm border">{coordinate}</code>
                    <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 flex-shrink-0" />
                  </div>
                )}
                {text && (
                  <div className="break-all">
                    <span className="font-medium">Text Input:</span> 
                    <code className="bg-white px-1.5 py-0.5 rounded text-xs sm:text-sm ml-1 border">&ldquo;{text}&rdquo;</code>
                  </div>
                )}
                {executionSuccess !== undefined && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <span className={cn(
                      "text-xs sm:text-sm px-2 py-1 rounded-full",
                      executionSuccess 
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    )}>
                      {executionSuccess ? 'Success' : 'Failed'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Browser State Card */}
            {(currentUrl || currentMousePosition) && (
              <div className="bg-white rounded-lg p-3 sm:p-4 space-y-2 border">
                <div className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                  Browser State
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  {currentUrl && (
                    <div>
                      <span className="font-medium">Current URL:</span>
                      <div className="text-blue-600 dark:text-blue-400 break-all mt-1 text-xs sm:text-sm">{currentUrl}</div>
                    </div>
                  )}
                  {currentMousePosition && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Mouse Position:</span>
                      <code className="bg-white px-1.5 py-0.5 rounded text-xs sm:text-sm border">{currentMousePosition}</code>
                      {mouseCoords && (
                        <MousePointer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {status === 'done' && errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium text-sm sm:text-base">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Action Failed
            </div>
            <div className="text-red-700 dark:text-red-400 text-xs sm:text-sm mt-2 break-words">
              Failed to launch browser
            </div>
          </div>
        )}

        {/* Result */}
        {status === 'done' && result && !errorMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-medium text-sm sm:text-base mb-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Action Result
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <pre className="whitespace-pre-wrap font-sans break-words overflow-x-auto">{result}</pre>
            </div>
          </div>
        )}

        {/* Current URL Display (Always show when available) */}
        {status === 'done' && currentUrl && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-medium text-sm sm:text-base mb-2">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              Current Page
            </div>
            <div className="text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <span className="font-medium text-muted-foreground flex-shrink-0">URL:</span>
                <div className="break-all text-blue-600 dark:text-blue-400 font-mono text-xs sm:text-sm bg-white dark:bg-white px-2 py-1 rounded border flex-1">
                  {currentUrl}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browser Window Frame Section - Always show when not close action */}
        {action !== 'close' && (
          <div className="space-y-3 sm:space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
                <Image className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Browser Screenshot
                {clickCoords && action === 'click' && (
                  <span className="text-xs sm:text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded whitespace-nowrap">
                    Clicked at ({clickCoords.x}, {clickCoords.y})
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                900×600 viewport • {screenshot ? (screenshot.startsWith('data:') ? '✓ Valid' : '✗ Invalid') : '✗ Missing'} format
              </div>
            </div>
            
            {/* Inline Browser Window Container */}
            <div className="w-full">
              <div className="relative bg-white dark:bg-white border border-gray-200 dark:border-gray-300 rounded-lg sm:rounded-xl overflow-hidden shadow-lg">
                {/* Browser Frame Header */}
                <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 px-2 sm:px-3 py-1.5 sm:py-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Browser Controls */}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full"></div>
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-yellow-500 rounded-full"></div>
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full"></div>
                    </div>
                    {/* Address Bar */}
                    <div className="flex-1 bg-white dark:bg-white rounded px-2 sm:px-3 py-1 text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-600 border border-gray-200 dark:border-gray-300 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="text-green-600 dark:text-green-400 text-xs flex-shrink-0">🔒</div>
                        <span className="truncate text-blue-600 dark:text-blue-400 text-xs sm:text-sm">{currentUrl || url || 'about:blank'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Browser Content Area - Responsive Display */}
                <div className="relative bg-white dark:bg-white">
                  {status === 'loading' ? (
                    <div className="flex items-center justify-center text-muted-foreground bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 w-full">
                      <div className="text-center p-4 sm:p-6">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mb-2 sm:mb-3"></div>
                        <p className="text-xs sm:text-sm font-medium mb-1">
                          Executing browser action...
                        </p>
                        <p className="text-xs opacity-75">
                          {getActionDescription()}
                        </p>
                      </div>
                    </div>
                  ) : screenshot && !screenshotError ? (
                    <div className="relative bg-white w-full">
                      {/* Browser Screenshot - Responsive */}
                      <img 
                        src={screenshot} 
                        alt={`Browser screenshot after ${action} action`}
                        className="overflow-x-scroll w-full h-full cursor-pointer select-none block bg-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] touch-manipulation"
                        style={{ 
                          objectFit: 'contain',
                          width: '100%',
                          height: '100%'
                        }}
                        onLoad={() => {
                          console.log(`[BROWSER_ACTION] Screenshot loaded successfully`)
                          setScreenshotError(false)
                        }}
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                          console.error(`[BROWSER_ACTION] Screenshot failed to load:`, screenshot?.substring(0, 100) + '...')
                          setScreenshotError(true)
                        }}
                        onDragStart={(e: React.DragEvent<HTMLImageElement>) => e.preventDefault()}
                        onClick={() => {
                          // Full-screen modal for better viewing
                          const modal = document.createElement('div')
                          modal.className = 'fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-2 sm:p-4 cursor-pointer'
                          modal.onclick = () => modal.remove()
                          
                          const img = document.createElement('img')
                          img.src = screenshot || ''
                          img.className = 'max-w-full max-h-full object-contain rounded-lg shadow-2xl'
                          img.alt = 'Full Browser Screenshot'
                          
                          modal.appendChild(img)
                          document.body.appendChild(modal)
                          
                          // Close on Escape key
                          const handleEscape = (e: KeyboardEvent) => {
                            if (e.key === 'Escape') {
                              modal.remove()
                              document.removeEventListener('keydown', handleEscape)
                            }
                          }
                          document.addEventListener('keydown', handleEscape)
                        }}
                      />
                      
                      {/* Click Position Indicator - Responsive */}
                      {clickCoords && action === 'click' && (
                        <div 
                          className="absolute pointer-events-none z-20"
                          style={{
                            left: `${(clickCoords.x / 900) * 100}%`,
                            top: `${(clickCoords.y / 600) * 100}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <div className="relative">
                            {/* Animated ping effect - responsive sizing */}
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500/30 rounded-full animate-ping absolute -top-0.5 sm:-top-1 -left-0.5 sm:-left-1"></div>
                            {/* Main click indicator - responsive sizing */}
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg relative z-10">
                              <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                            </div>
                            {/* Coordinate label - responsive positioning and sizing */}
                            <div className="absolute top-6 sm:top-7 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-lg whitespace-nowrap font-medium z-10">
                              Click: ({clickCoords.x}, {clickCoords.y})
                            </div>
                            {/* Crosshair lines - responsive sizing */}
                            <div className="absolute top-1/2 left-1/2 w-12 sm:w-16 h-0.5 bg-red-400/60 transform -translate-x-1/2 -translate-y-1/2 z-0"></div>
                            <div className="absolute top-1/2 left-1/2 w-0.5 h-12 sm:h-16 bg-red-400/60 transform -translate-x-1/2 -translate-y-1/2 z-0"></div>
                          </div>
                        </div>
                      )}

                      {/* Mouse Position Indicator - Responsive */}
                      {mouseCoords && action !== 'click' && (
                        <div 
                          className="absolute pointer-events-none z-20"
                          style={{
                            left: `${(mouseCoords.x / 900) * 100}%`,
                            top: `${(mouseCoords.y / 600) * 100}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <div className="relative">
                            {/* Subtle pulse effect - responsive sizing */}
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500/20 rounded-full animate-pulse absolute -top-0.5 sm:-top-1 -left-0.5 sm:-left-1"></div>
                            {/* Mouse cursor icon - responsive sizing */}
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg relative z-10">
                              <MousePointer className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
                            </div>
                            {/* Position label - responsive positioning and sizing */}
                            <div className="absolute top-5 sm:top-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow-lg whitespace-nowrap font-medium z-10">
                              Mouse: ({mouseCoords.x}, {mouseCoords.y})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-muted-foreground bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 w-full h-[400px]">
                      <div className="text-center p-4 sm:p-6">
                        <Image className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
                        <p className="text-xs sm:text-sm font-medium mb-1">
                          {screenshotError ? 'Screenshot failed to load' : (screenshot ? 'Loading screenshot...' : 'Screenshot not available')}
                        </p>
                        <p className="text-xs opacity-75">
                          {screenshotError ? 'The image data may be corrupted or invalid' : (screenshot ? 'Please wait while the image loads' : 'No screenshot was captured for this action')}
                        </p>
                        {screenshot && !screenshotError && (
                          <div className="mt-2">
                            <div className="inline-block animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Screenshot Info Panel */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-2 sm:px-3 py-2 sm:py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-blue-700 dark:text-blue-300">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    📐 <strong>Viewport:</strong> 900×600 pixels (1:1 scale)
                  </span>
                  {clickCoords && action === 'click' && (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500 flex-shrink-0" />
                      <strong>Click at ({clickCoords.x}, {clickCoords.y})</strong>
                    </span>
                  )}
                  {mouseCoords && action !== 'click' && (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <MousePointer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 flex-shrink-0" />
                      <strong>Mouse at ({mouseCoords.x}, {mouseCoords.y})</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <span className="whitespace-nowrap">🖱️ <strong>Click to expand</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Console Logs Section */}
        {status === 'done' && logs && action !== 'close' && (
          <div className="space-y-2 sm:space-y-3">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 sm:p-0 -m-2 sm:m-0 rounded touch-manipulation"
            >
              <Terminal className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>{showLogs ? 'Hide Console Logs' : 'Show Console Logs'}</span>
              <span className="text-xs text-muted-foreground">
                ({logs.split('\n').filter(line => line.trim()).length} entries)
              </span>
            </button>
            {showLogs && (
              <div className="bg-white text-black p-3 sm:p-4 rounded-md font-mono text-xs sm:text-sm overflow-x-auto max-h-48 sm:max-h-64 overflow-y-auto border">
                <div className="flex items-center gap-2 text-gray-600 mb-2 pb-2 border-b border-gray-300">
                  <Terminal className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">Console Output</span>
                </div>
                <pre className="whitespace-pre-wrap break-words overflow-x-auto">{logs}</pre>
              </div>
            )}
          </div>
        )}

        {/* Action Summary */}
        {status === 'done' && (
          <div className="pt-2 sm:pt-3 border-t border-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="whitespace-nowrap">Action: {action.toUpperCase()}</span>
                {executionSuccess !== undefined && (
                  <span className={cn(
                    "flex items-center gap-1 whitespace-nowrap",
                    executionSuccess ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {executionSuccess ? <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />}
                    {executionSuccess ? "Success" : "Failed"}
                  </span>
                )}
              </div>
              {screenshot && (
                <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  📸 Screenshot captured
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolMessage>
  )
})
