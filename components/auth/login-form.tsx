'use client'

interface LoginFormProps {
  onForgotPassword: () => void;
}

import { useFormState, useFormStatus } from 'react-dom'
import { authenticate } from '@/app/auth/login'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { IconGoogle, IconSpinner } from '@/components/ui/icons'
import { getMessageFromCode, ResultCode, stripe_pro_url } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signIn, useSession } from 'next-auth/react'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
import EmailVerification from './email-verification'
import { handleRedirect } from '@/lib/utils/login'

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  // if (window.location.href?.includes('mobile')){
  //     return <></>
  // }

  const [isBlackboxApp, setIsBlackboxApp] = useState<boolean>(false)
  const router = useRouter()
  const [result, dispatch] = useFormState(authenticate, undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const { data: session } = useSession()
  const { invalidateSubscriptionCache } = useSubscriptionCheck()

  useEffect(() => {
    // Store redirect parameter in localStorage when component mounts
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    if (redirectPath) {
      try {
        localStorage.setItem('login_redirect_path', redirectPath);
      } catch (e) {
        console.error('Failed to store redirect path:', e);
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBlackboxApp(window.navigator.userAgent.includes('blackbox-app'))
    }
  }, [])

  useEffect(() => {
    try {
      if (result) {
        if (result.type === 'error') {
          if (result.resultCode === ResultCode.EmailNotVerified) {
            setShowVerification(true)
            toast.success('Please verify your email to continue')
          } else {
            toast.error(getMessageFromCode(result.resultCode))
          }
        } else {
          toast.success(getMessageFromCode(result.resultCode))

          // Check if there's a redirect parameter in the URL
          const urlParams = new URLSearchParams(window.location.search);
          const redirectPath = urlParams.get('redirect');

          // Check if there was a pending plan upgrade
          const pendingPlanUpgrade = localStorage.getItem('pending_plan_upgrade');
          if (pendingPlanUpgrade) {
            const planInfo = JSON.parse(pendingPlanUpgrade);
            localStorage.removeItem('pending_plan_upgrade'); // Clear the stored plan

            // Get source from URL parameters or default to 'pricing-popup'
            const urlParams = new URLSearchParams(window.location.search);
            const source = urlParams.get('source') || 'pricing-popup';

            let planParam = '';
            if (planInfo.text === 'Try Pro for Free') {
              planParam = '&plan=pro';
            } else if (planInfo.text === 'Try Business') {
              planParam = '&plan=ultra';
            } else if (planInfo.text === 'Continue with Ultimate') {
              planParam = '&plan=ultimate';
            }

            window.location.href = `${stripe_pro_url}&source=${source}&billing=${planInfo.billing}${planParam}&pathname=${window.location.pathname}`;
            return;
          }

          // Handle redirect after successful login
          handleRedirect(redirectPath);
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, [result, router, session])

  useEffect(() => {
    // Handle normal login-success redirect
    if (window.location.href?.includes('ref=login-success')) {
      // Check if this was a new user signup with Google
      const isNewUser = localStorage.getItem('newUserSignup');
      if (!isNewUser) {
        return
      }

      if (isNewUser === 'true') {
        // Clear the flag
        localStorage.removeItem('newUserSignup');
        // Redirect to pricing page
        window.location.href = '/pricing';
      } else {
        // Regular login flow - redirect to home
        window.location.href = window.location.origin;
      }
      return;
    }

    // Also check on initial page load for the flag
    const isNewUser = localStorage.getItem('newUserSignup');
    if (isNewUser === 'true' && window.location.pathname !== '/pricing') {
      // If session exists (user is already logged in)
      if (document.getElementById('loggedin-profile')) {
        localStorage.removeItem('newUserSignup');
        window.location.href = '/pricing';
      }
    }
  }, [])

  const handleVerificationSuccess = (session: any) => {
    // Handle successful verification - redirect based on login flow
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');

    // Handle redirect after successful email verification
    handleRedirect(redirectPath);
  }

  if (showVerification) {
    return (
      <EmailVerification
        userEmail={userEmail}
        onBack={() => {
          setShowVerification(false)
        }}
        onVerificationSuccess={handleVerificationSuccess}
        backButtonText="Back to login"
        title="Verify your email"
        description="Please verify your email address to continue logging in. We've sent a verification code to your email."
      />
    )
  }

  return (
    <form
      action={dispatch}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        setUserEmail(email);
        dispatch(formData);
      }}
      className="flex flex-col items-center gap-4 space-y-3"
    >
      <div className="w-full flex-1 rounded-lg px-6 pb-4 pt-8  md:w-96 bg-card">
        <h1 className="mb-6 text-2xl font-bold">Log into your account</h1>
        <Button
          variant={'outline'}
          type="button"
          onClick={() => {

            try {
              let firstClickGmail = localStorage.getItem('firstClickGmail')
              if (!firstClickGmail) {
                localStorage.setItem('firstClickGmail', 'true')
              } else {
                localStorage.setItem('laterClickGmail', 'true')
              }
            } catch (e) {
              console.log(e)
            }

            setIsLoading(true)
            invalidateSubscriptionCache()
            signIn('google')
          }}
          disabled={isLoading}
          className={'text-ellipsis h-10 whitespace-nowrap overflow-hidden shadow-none w-full'}
        >
          {isLoading ? (
            <IconSpinner className="mr-2 animate-spin" />
          ) : <IconGoogle className="mr-2" />}
          <span className="md:flex">Login with Google</span>
        </Button>
        <div className="text-center mb-2 mt-4 text-xs">OR</div>
        <div className="w-full">
          <div>
            <label
              className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label
                className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
                htmlFor="password"
              >
                Password
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onForgotPassword();
                }}
                className="mb-3 mt-5 text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
                id="password"
                type="password"
                name="password"
                placeholder="Enter password"
                required
                minLength={6}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </div>
          </div>
        </div>
        <LoginEmailButton />
      </div>

      {(window.location.href?.includes('/login') || window.location.href?.includes('/signup')) &&
        <Link
          href="/signup"
          className="flex flex-row gap-1 text-sm text-muted-foreground"
        >
          No account yet? <div className="font-semibold underline">Sign up</div>
        </Link>
      }
    </form>
  )
}

function LoginEmailButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="my-4 flex h-10 w-full flex-row items-center justify-center rounded-md bg-primary p-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      aria-disabled={pending}
    >
      {pending ? <IconSpinner /> : 'Log in'}
    </button>
  )
}
