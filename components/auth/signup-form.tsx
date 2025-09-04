'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signup } from '@/app/auth/signup'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { IconGoogle, IconSpinnerNew } from '@/components/ui/icons'
import { getMessageFromCode, ResultCode, stripe_pro_url } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { signIn, useSession } from 'next-auth/react'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'
import EmailVerification from './email-verification'

function LoadingScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 w-full">
      <IconSpinnerNew className="mb-4" />
      <h2 className="text-xl font-semibold text-center mb-2">{title}</h2>
      <p className="text-sm text-zinc-500 text-center">{subtitle}</p>
    </div>
  )
}

interface SignupFormProps {
  onLoadingStateChange?: (isLoading: boolean) => void;
}

export default function SignupForm({ onLoadingStateChange }: SignupFormProps = {}) {

  // if (window.location.href?.includes('mobile')){
  //     return <></>
  // }

  const [isBlackboxApp, setIsBlackboxApp] = useState<boolean>(false)
  const [result, dispatch] = useFormState(signup, undefined)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isInMobileIframe, setIsInMobileIframe] = useState(false)
  const [showVerification, setShowVerification] = useState<boolean>(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState<boolean>(false)
  const [loadingTitle, setLoadingTitle] = useState<string>('')
  const [loadingSubtitle, setLoadingSubtitle] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [isReturningToSignup, setIsReturningToSignup] = useState<boolean>(false)
  const { data: session } = useSession()
  const { invalidateSubscriptionCache } = useSubscriptionCheck()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsBlackboxApp(window.navigator.userAgent.includes('blackbox-app'))
    }
  }, [])

  useEffect(() => {
    try {
      if (result && !showVerification && !isReturningToSignup) {
        if (result.type === 'error') {
          toast.error(getMessageFromCode(result.resultCode))
          setShowLoadingScreen(false)
        } else {
          toast.success(getMessageFromCode(result.resultCode))
          if (result.resultCode === ResultCode.UserCreated) {
            if (showLoadingScreen) {
              setTimeout(() => {
                setLoadingTitle('Generating Verification Code')
                setLoadingSubtitle('Please wait while we prepare your verification code...')
              }, 1000)
              setTimeout(() => {
                setShowLoadingScreen(false)
                setShowVerification(true)
              }, 3000)
            } else {
              setShowLoadingScreen(true)
              setLoadingTitle('Verifying Account')
              setLoadingSubtitle('Please wait while we verify your account...')
              setTimeout(() => {
                setLoadingTitle('Generating Verification Code')
                setLoadingSubtitle('Please wait while we prepare your verification code...')
              }, 1000)
              setTimeout(() => {
                setShowLoadingScreen(false)
                setShowVerification(true)
              }, 3000)
            }
          }
          else if (result.resultCode === ResultCode.UserLoggedIn) {
            if (result.resultCode === ResultCode.UserLoggedIn) {
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
              const isInBuilder = window.location.pathname.includes("builder")
              window.location.href = '/pricing' + (isInBuilder ? `?source=webide` : '')
            }
          }
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, [result, showVerification, showLoadingScreen, isReturningToSignup])

  useEffect(() => {
    onLoadingStateChange?.(showLoadingScreen)
  }, [showLoadingScreen, onLoadingStateChange])

  useEffect(() => {
    if (!window.location.href?.includes('ref=login-success')) {
      return
    }
    window.location.href = window.location.origin
  }, [])

  if (showLoadingScreen) {
    return <LoadingScreen title={loadingTitle} subtitle={loadingSubtitle} />
  }

  if (showVerification) {
    return (
      <EmailVerification
        userEmail={userEmail}
        onBack={() => {
          setShowVerification(false)
          setShowLoadingScreen(false)
          setIsReturningToSignup(true)
          const form = document.querySelector('form')
          if (form) {
            form.reset()
          }
        }}
        backButtonText="Back to signup"
        title="Verify your email"
        description="We've sent a verification code to your email address. Please enter it below."
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 space-y-3 w-full">
      <form
        action={dispatch}
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const email = formData.get('email') as string;
          setUserEmail(email);
          setShowLoadingScreen(true);
          setLoadingTitle('Verifying Account');
          setLoadingSubtitle('Please wait while we verify your account...');
          setIsReturningToSignup(false); // Reset the flag for new submissions
          dispatch(formData);
        }}
        className="flex flex-col items-center gap-4 space-y-3 w-full"
      >
        <div className="w-full flex-1 rounded-lg px-6 pb-4 pt-8 md:w-96 bg-card">
          <h1 className="mb-3 text-2xl font-bold text-center">Create your account</h1>

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
              // Set a flag in localStorage to indicate this is a new signup with Google
              localStorage.setItem('newUserSignup', 'true');
              setIsLoading(true)
              invalidateSubscriptionCache()
              signIn('google')
            }}
            disabled={isLoading}
            className={'text-ellipsis h-10 whitespace-nowrap overflow-hidden shadow-none w-full'}
          >
            {isLoading ? (
              <IconSpinnerNew />
            ) : <IconGoogle className="mr-2" />}
            <span className="md:flex">Signup with Google</span>
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
                />
              </div>
            </div>
            <div className="mt-4">
              <label
                className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
                htmlFor="password"
              >
                Password
              </label>
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
                      e.preventDefault()
                      e.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <LoginEmailButton />
        </div>
      </form>
    </div>
  )
}

function LoginEmailButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      className="my-4 flex h-10 w-full flex-row items-center justify-center rounded-md bg-primary p-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? <IconSpinnerNew /> : 'Create account'}
    </button>
  )
}
