import { useState, useEffect, useCallback } from 'react'
import { PublishedApp } from '@/lib/types'

interface UsePublishedAppsResult {
  apps: PublishedApp[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  totalApps: number
}

export function usePublishedApps(itemsPerPage: number = 9): UsePublishedAppsResult {
  const [apps, setApps] = useState<PublishedApp[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalApps, setTotalApps] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const fetchApps = useCallback(async (page: number, reset: boolean = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/gallery/apps?page=${page + 1}&limit=${itemsPerPage}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch published apps')
      }

      const result = await response.json()

      if (result.success) {
        const newApps = result.apps || []
        
        setApps(prev => reset ? newApps : [...prev, ...newApps])
        setTotalApps(result.pagination.total)
        setHasMore(result.pagination.hasMore)
        setCurrentPage(page)
      } else {
        throw new Error(result.error || 'Failed to fetch apps')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch published apps')
    } finally {
      setIsLoading(false)
    }
  }, [itemsPerPage])

  // Load initial data
  useEffect(() => {
    fetchApps(0, true)
  }, [fetchApps])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return
    fetchApps(currentPage + 1, false)
  }, [hasMore, isLoading, currentPage, fetchApps])

  return {
    apps,
    isLoading,
    error,
    hasMore,
    loadMore,
    totalApps,
  }
}
