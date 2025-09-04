'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'

import { cn } from '@/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'
import { IconSpinner, IconGoogle } from '@/components/ui/icons'
import { useSearchParams } from 'next/navigation'
// import { telemetry } from '@/lib/telemetry'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery';
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
type DeviceType = 'android' | 'ios' | 'unknown'

interface LoginButtonProps extends ButtonProps {
  showGithubIcon?: boolean
  text?: string
  showFromReferral?: any
  mobileClassName?: string
}


const getDeviceType = (): DeviceType => {
  if (typeof window === 'undefined') return 'unknown'
  const userAgent = window.navigator.userAgent.toLowerCase()
  if (/android/.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios'
  return 'unknown'
}

export function LoginButton({
  text = 'Sign In',
  showGithubIcon = true,
  className: customClassName,
  mobileClassName,
  ...props
}: LoginButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [shouldHideButton, setShouldHideButton] = React.useState(false)
  const [isChromeExt, setIsChromeExt] = React.useState(false)
  const [isVscode, setIsVscode] = React.useState(false)
  const [deviceType, setDeviceType] = React.useState<DeviceType>('unknown')
  const isMobile = useIsMobile()

  const searchParams = useSearchParams()
  const { invalidateSubscriptionCache } = useSubscriptionCheck()

  const cacheChatToLocalStorage = (roomId: any) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem("clicked_join_new_room", roomId);
    }
  }

  function verifyIfLoginFromRoomSharedLink() {
    if (typeof window !== 'undefined') {
      if (
        window.location.href.includes('next=')
        && window.location.href.includes('/chat/')
      ) {
        const roomId: any = window.location.href.split('/chat/')[1]
        cacheChatToLocalStorage(roomId)
      }
    }
  }

  let mobile: any = (searchParams && searchParams?.get('mobile')) || 'false';

  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    // Set isDesktop on client side only
    if (typeof window !== 'undefined') {
      setIsDesktop(window.matchMedia('(min-width: 768px)').matches);
    }
    if (typeof window !== 'undefined') {
      // Check if button should be hidden based on URL
      const shouldHide = window.location.href?.includes('mobile') || window.location.href?.includes('/chat/')
      setShouldHideButton(shouldHide)
      
      // Check for Chrome extension and VSCode
      setIsChromeExt(window.location.href.includes('frameurl='))
      setIsVscode(window.location.href.includes('vscode='))
      
      // Set device type
      setDeviceType(getDeviceType())
    }
  }, [])

  // Early return if button should be hidden
  if (shouldHideButton) {
    return (<></>)
  }

  return (
    <>
      {mobile !== 'true' && !isChromeExt && !isVscode &&
        <Button
          variant={'outline'}
          size={'sm'}
          onClick={() => {
            try {
              if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                let firstClickGmail = localStorage.getItem('firstClickGmail')
                if (!firstClickGmail) {
                  localStorage.setItem('firstClickGmail', 'true')
                } else {
                  localStorage.setItem('laterClickGmail', 'true')
                }
              }
            } catch (e) {
              console.log(e)
            }

            setIsLoading(true)

            verifyIfLoginFromRoomSharedLink()

            // next-auth signIn() function doesn't work yet at Edge Runtime due to usage of BroadcastChannel
            // signIn('google', { callbackUrl: `/api/auth/callback/google` })
            invalidateSubscriptionCache()
            signIn('google')

            // telemetry('Other Engagement', sessionId, {
            //   tag: "signup",
            //   position: "header"
            // })
          }}
          disabled={isLoading}
          className={cn(
            'text-ellipsis whitespace-nowrap overflow-hidden shadow-none',
            isMobile && mobileClassName ? mobileClassName : customClassName,
            // Ensure proper centering for mobile icon-only display
            isMobile && !text && 'justify-center items-center'
          )}
          {...props}
        >
          {isLoading ? (
            <IconSpinner className={`animate-spin ${isMobile && !text ? "mr-2" : "mr-1"}`} />
          ) : showGithubIcon ? (
            <IconGoogle className={isMobile && !text ? "mr-2" : "mr-1"} />
          ) : null}
          {text && <span className="">{text}</span>}
        </Button>
      }
    </>
  )
}
