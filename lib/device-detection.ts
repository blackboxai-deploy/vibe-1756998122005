import { headers } from 'next/headers'

export async function getDeviceType() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  
  // Mobile device detection patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
    /Tablet/i
  ]
  
  const isMobileDevice = mobilePatterns.some(pattern => pattern.test(userAgent))
  
  // Additional check for screen width if available in user agent
  const hasSmallScreen = /Mobile|Android.*Mobile|iPhone|iPod|BlackBerry|Windows Phone/i.test(userAgent)
  
  return {
    isMobile: isMobileDevice || hasSmallScreen,
    userAgent
  }
}

export type DeviceInfo = Awaited<ReturnType<typeof getDeviceType>>
