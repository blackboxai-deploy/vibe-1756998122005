'use client'

import { useEffect } from 'react'

export function ViewportInitializer() {
  useEffect(() => {
    function setViewportHeight() {
      // Calculate the actual viewport height
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    // Set initial viewport height
    setViewportHeight()

    // Update on resize and orientation change
    window.addEventListener('resize', setViewportHeight)
    window.addEventListener('orientationchange', setViewportHeight)

    // Handle visual viewport changes for modern browsers
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const vh = window.visualViewport!.height * 0.01
        document.documentElement.style.setProperty('--vh', `${vh}px`)
      }
      
      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange)
      
      return () => {
        window.removeEventListener('resize', setViewportHeight)
        window.removeEventListener('orientationchange', setViewportHeight)
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
        window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange)
      }
    }

    return () => {
      window.removeEventListener('resize', setViewportHeight)
      window.removeEventListener('orientationchange', setViewportHeight)
    }
  }, [])

  return null
}
