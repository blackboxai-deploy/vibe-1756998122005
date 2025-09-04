'use client'

import { useState, useEffect } from 'react'

export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState<number>(0)

  useEffect(() => {
    function updateViewportHeight() {
      // Get the actual viewport height
      const vh = window.innerHeight * 0.01
      
      // Set CSS custom property for fallback
      document.documentElement.style.setProperty('--vh', `${vh}px`)
      
      // Update state
      setViewportHeight(window.innerHeight)
    }

    // Initial calculation
    updateViewportHeight()

    // Listen for resize events (including mobile browser UI changes)
    window.addEventListener('resize', updateViewportHeight)
    window.addEventListener('orientationchange', updateViewportHeight)

    // Listen for visual viewport changes (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight)
    }

    return () => {
      window.removeEventListener('resize', updateViewportHeight)
      window.removeEventListener('orientationchange', updateViewportHeight)
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight)
      }
    }
  }, [])

  return viewportHeight
}
