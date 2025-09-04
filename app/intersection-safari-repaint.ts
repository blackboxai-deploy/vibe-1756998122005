import { useEffect, useRef, useCallback } from 'react';

/**
 * Intersection Observer Safari White Screen Prevention
 * 
 * This approach uses Intersection Observer to monitor chat elements and 
 * trigger gentle repaints when elements become visible, preventing Safari's
 * rendering engine from going into white screen mode.
 */

export function useIntersectionSafariRepaint() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeRepaints = useRef(new Set<HTMLElement>());
  const repaintCountRef = useRef(0);
  const isSafariRef = useRef(false);

  const performGentleRepaint = useCallback((element: HTMLElement) => {
    // Avoid spamming repaints on the same element
    if (activeRepaints.current.has(element)) {
      return;
    }

    activeRepaints.current.add(element);
    repaintCountRef.current += 1;

    // Gentle repaint technique - minimal GPU touch
    const originalOpacity = element.style.opacity || '1';
    element.style.opacity = '0.999999';
    
    console.log(`🎯 Intersection Repaint #${repaintCountRef.current}: Element ${element.tagName}${element.className ? '.' + element.className.split(' ')[0] : ''}`);
    
    requestAnimationFrame(() => {
      element.style.opacity = originalOpacity;
      
      // Remove from active set after repaint
      setTimeout(() => {
        activeRepaints.current.delete(element);
      }, 100);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Capture refs at effect start
    const currentActiveRepaints = activeRepaints.current;
    
    // Only activate for Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    isSafariRef.current = isSafari;
    
    if (!isSafari) {
      console.log('🔍 Intersection Safari Repaint: Not Safari, skipping');
      return;
    }

    console.log('🔍 Intersection Safari Repaint: Initializing for Safari');

    // Create intersection observer with optimized settings
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          
          // When element becomes visible or visibility changes significantly
          if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
            performGentleRepaint(element);
          }
          
          // Special handling for elements becoming fully visible
          if (entry.intersectionRatio > 0.9) {
            // Add a slight delay for fully visible elements
            setTimeout(() => performGentleRepaint(element), 50);
          }
        });
      },
      {
        root: null,
        rootMargin: '50px', // Start observing before element enters viewport
        threshold: [0, 0.1, 0.5, 0.9, 1.0] // Multiple thresholds for granular control
      }
    );

    // Function to observe chat-related elements
    const observeChatElements = () => {
      if (!observerRef.current) return;

      // Target selectors for chat elements that need monitoring
      const selectors = [
        '[data-chat-container]',
        '[data-chat-list]', 
        '[data-chat-message]',
        '[data-streaming]',
        '.chat-message',
        '.markdown-content',
        '[data-main-content]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (observerRef.current && el instanceof HTMLElement) {
            observerRef.current.observe(el);
          }
        });
      });
    };

    // Initial observation
    observeChatElements();

    // Re-observe when new chat messages are added
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldReobserve = false;
      
      mutations.forEach((mutation) => {
        // Check if new chat elements were added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.matches && (
              element.matches('[data-chat-message]') ||
              element.matches('.chat-message') ||
              element.matches('[data-streaming]') ||
              element.querySelector('[data-chat-message], .chat-message, [data-streaming]')
            )) {
              shouldReobserve = true;
            }
          }
        });
      });
      
      if (shouldReobserve) {
        // Debounce re-observation
        setTimeout(observeChatElements, 100);
      }
    });

    // Observe document for new chat message additions
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      mutationObserver.disconnect();
      
      // Clear active repaints safely using captured ref
      currentActiveRepaints.clear();
    };
  }, [performGentleRepaint]);

  return { 
    isActive: isSafariRef.current && observerRef.current !== null,
    repaintCount: repaintCountRef.current,
    activeElements: activeRepaints.current.size
  };
}

/**
 * Streaming-specific Safari repaint optimization
 * Applies more frequent repaints during active streaming
 */
export function useStreamingSafariRepaint(isStreaming: boolean) {
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari) return;

    if (isStreaming) {
      console.log('📡 Streaming Safari Repaint: Activating streaming mode');
      
      // During streaming, perform gentle repaints on streaming elements
      const performStreamingRepaint = () => {
        const streamingElements = document.querySelectorAll(
          '[data-streaming], [data-chat-message]:last-child, .chat-message:last-child'
        );
        
        streamingElements.forEach((el) => {
          const element = el as HTMLElement;
          if (element && element.getBoundingClientRect().height > 0) {
            // Very gentle repaint for streaming content
            element.style.transform = 'translateZ(0.1px)';
            requestAnimationFrame(() => {
              element.style.transform = 'translateZ(0)';
            });
          }
        });
      };

      // Gentle repaints every 200ms during streaming
      streamingIntervalRef.current = setInterval(performStreamingRepaint, 200);
      
    } else {
      console.log('✅ Streaming Safari Repaint: Deactivating streaming mode');
      
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    }

    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
      }
    };
  }, [isStreaming]);
}

/**
 * Emergency white screen detection and recovery
 * Uses intersection observer to detect if main content becomes invisible
 */
export function useWhiteScreenDetection() {
  const detectionObserverRef = useRef<IntersectionObserver | null>(null);
  const recoveryAttempts = useRef(0);
  const maxRecoveryAttempts = 3;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isSafari) return;

    console.log('🛡️ White Screen Detection: Initializing');

    // Create observer to monitor main content visibility
    detectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If main content becomes completely invisible
          if (!entry.isIntersecting && entry.intersectionRatio === 0) {
            const element = entry.target as HTMLElement;
            const rect = element.getBoundingClientRect();
            
            // Double-check if element actually has zero dimensions (white screen indicator)
            if (rect.width === 0 || rect.height === 0) {
              console.warn('🚨 White Screen Detection: Main content invisible, attempting recovery');
              
              if (recoveryAttempts.current < maxRecoveryAttempts) {
                recoveryAttempts.current++;
                
                // Gentle recovery approach
                setTimeout(() => {
                  // Force visibility
                  element.style.opacity = '0';
                  element.style.visibility = 'hidden';
                  
                  requestAnimationFrame(() => {
                    element.style.opacity = '1';
                    element.style.visibility = 'visible';
                    
                    // Reset counter if recovery seems successful
                    setTimeout(() => {
                      const newRect = element.getBoundingClientRect();
                      if (newRect.width > 0 && newRect.height > 0) {
                        recoveryAttempts.current = 0;
                        console.log('✅ White Screen Detection: Recovery successful');
                      }
                    }, 1000);
                  });
                }, 100);
              }
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0, 1]
      }
    );

    // Observe main content areas
    const mainContentSelectors = ['[data-main-content]', '#__next', 'main'];
    mainContentSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && detectionObserverRef.current) {
        detectionObserverRef.current.observe(element);
      }
    });

    return () => {
      if (detectionObserverRef.current) {
        detectionObserverRef.current.disconnect();
      }
    };
  }, []);
}
