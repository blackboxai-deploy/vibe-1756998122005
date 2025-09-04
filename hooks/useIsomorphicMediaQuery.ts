'use client'

import { useState, useEffect, useLayoutEffect } from 'react'

// Use useLayoutEffect on client, useEffect on server to avoid warnings
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * A custom hook that provides media query functionality without hydration mismatches.
 * This hook ensures that the initial render matches between server and client,
 * preventing the flash of incorrect content.
 */
export function useIsomorphicMediaQuery(query: string, defaultValue: boolean = false) {
  // Start with the default value to ensure SSR matches initial client render
  const [matches, setMatches] = useState(defaultValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Handle media query evaluation on client side only
  useIsomorphicLayoutEffect(() => {
    const mediaQuery = window.matchMedia(query)
    
    // Set initial value immediately
    setMatches(mediaQuery.matches)
    setIsHydrated(true)

    // Create event listener for changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add listener
    mediaQuery.addEventListener('change', handler)

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [query])

  return matches
}

/**
 * Convenience hook for mobile detection
 */
export function useIsMobile() {
  return useIsomorphicMediaQuery('(max-width: 1023px)', false)
}
