'use client'

import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { LogOut, User, CreditCard } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect, Suspense } from 'react'
import { useIsMobile } from '@/hooks/useIsomorphicMediaQuery'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
import { LazyCreditsDialog } from '@/components/payment/lazy-credits-dialog'

export function UserMenu() {
  const isMobile = useIsMobile()
  const { data: session, status } = useSession()
  const [imageError, setImageError] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const { checkSubscription, subscriptionCache, invalidateSubscriptionCache } = useSubscriptionCheck()

  useEffect(() => {
    if (session?.user.email) {
      checkSubscription(session.user.email)
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="w-8 h-8 rounded-full bg-white animate-pulse" />
    )
  }

  if (!session?.user) {
    return null
  }

  const handleSignOut = () => {
    invalidateSubscriptionCache()
    signOut({ callbackUrl: '/' })
  }

  const UserAvatar = ({ size = 32 }: { size?: number }) => {
    const isMobile = useIsMobile()

    if (session?.user?.image && !imageError) {
      return (
        <Image
          className="rounded-full"
          src={session?.user?.image}
          alt={session?.user?.name || 'User avatar'}
          width={size}
          height={size}
          onError={() => setImageError(true)}
        />
      )
    }
    
    return <User className="h-6 w-6" />
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={`cursor-pointer bg-white relative h-7 w-7 rounded-full overflow-hidden`}>
          <UserAvatar />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] max-w-[280px] min-w-[240px]" 
        align="end"
        side="bottom"
        sideOffset={8}
        alignOffset={-8}
        avoidCollisions={true}
        collisionPadding={16}
      >
        <div className="flex items-center space-x-2 p-2">
          <UserAvatar />
          <div className="flex flex-col space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium leading-none truncate">
              {session.user.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {session.user.email}
            </p>
          </div>
        </div>
        <div className="pt-2">
          {subscriptionCache?.customerId && (
            <Button
              variant="ghost"
              className="w-full justify-start h-9"
              onClick={() => setShowCreditsDialog(true)}
              onFocus={(e) => {
                e.stopPropagation()
                e.target.blur()
              }}
            >
              <CreditCard className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">Credits</span>
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start h-9"
            onClick={handleSignOut}
            onFocus={(e) => {
              e.stopPropagation()
              e.target.blur()
            }}
          >
            <LogOut className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">Sign out</span>
          </Button>
        </div>
      </PopoverContent>
      
      <LazyCreditsDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
      />
    </Popover>
  )
}
