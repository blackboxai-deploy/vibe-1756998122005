'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { IconSpinner, IconSpinnerNew } from '@/components/ui/icons'
import { getMessageFromCode, ResultCode } from '@/lib/utils'
import { signIn, getSession } from 'next-auth/react'
import { useSubscriptionCheck } from '@/lib/hooks/useSubscriptionCheck'

interface EmailVerificationProps {
  userEmail: string
  onBack: () => void
  onVerificationSuccess?: (session: any) => void
  backButtonText?: string
  title?: string
  description?: string
}

export default function EmailVerification({
  userEmail,
  onBack,
  onVerificationSuccess,
  backButtonText = "Back to signup",
  title = "Verify your email",
  description = "We've sent a verification code to your email address. Please enter it below."
}: EmailVerificationProps) {
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [verifyingEmail, setVerifyingEmail] = useState<boolean>(false)
  const [resendingCode, setResendingCode] = useState<boolean>(false)
  const [showVerifyingToken, setShowVerifyingToken] = useState<boolean>(false)
  const [verificationComplete, setVerificationComplete] = useState<boolean>(false)
  const { checkSubscription } = useSubscriptionCheck()

  function handlePricingRedirect() {
    if (!window.location.href?.includes('/builder')) {
      window.location.href = '/pricing'
    } else {
      window.location.href = '/pricing'
    }
  }

  const handleSubscriptionCheckAndRedirect = async (userEmail: string) => {
    if (!userEmail) {
      setShowVerifyingToken(false)
      handlePricingRedirect()
      return
    }

    try {
      const subscription_status_result = await checkSubscription(userEmail)
      const isPremium = subscription_status_result.status === 'PREMIUM'
      setShowVerifyingToken(false)

      if (!isPremium) {
        // Only redirect to pricing if not premium
        handlePricingRedirect()
      } else {
        // Redirect to home if premium
        window.location.href = '/'
      }
    } catch (error) {
      setShowVerifyingToken(false)
      handlePricingRedirect()
    }
  }

  const handleVerifyEmail = async () => {
    if (!verificationCode || !userEmail) return

    setVerifyingEmail(true)
    try {
      setShowVerifyingToken(true)

      // Call API directly instead of using server action
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          code: verificationCode
        }),
      })

      const data = await response.json()

      if (response.ok && data.autoLogin && data.autoLoginToken) {
        setVerificationComplete(true)
        // Perform client-side sign-in with the auto-login token
        try {
          const signInResult = await signIn('auto-login-token', {
            token: data.autoLoginToken,
            email: data.email,
            redirect: false,
            callbackUrl: window.location.origin
          })

          if (signInResult?.ok) {
            toast.success(getMessageFromCode(ResultCode.UserLoggedIn))
          } else {
            setShowVerifyingToken(false)
            setVerificationComplete(false)
            toast.error('Auto sign-in failed: ' + (signInResult?.error || 'Unknown error'))
            return
          }
        } catch (signInError) {
          if (signInError instanceof TypeError) {
            if (
              signInError.message === "URL constructor: /api/auth is not a valid URL."
            ) {
              // auth was successful
              toast.success(getMessageFromCode(ResultCode.UserLoggedIn))
            }
          } else {
            // auth actually failed for another reason
            setShowVerifyingToken(false)
            setVerificationComplete(false)
            toast.error('Auto sign-in failed: ' + 'Unknown error')
            console.error('Sign-in error:', signInError)
            return
          }
        }

        const session = await getSession() // ensure session is updated on ui also we can put the same logic here

        // Check subscription status and redirect after session is updated
        if (session?.user?.email) {
          if (onVerificationSuccess) {
            onVerificationSuccess(session)
          } else {
            await handleSubscriptionCheckAndRedirect(session.user.email)
          }
        }
      } else if (response.ok) {
        setVerificationComplete(true)
        toast.success('Email verified successfully')
        if (onVerificationSuccess) {
          const session = await getSession()
          onVerificationSuccess(session)
        }
      } else {
        setShowVerifyingToken(false)
        toast.error(data.error || 'Verification failed')
      }
    } catch (error) {
      setShowVerifyingToken(false)
      toast.error('Failed to verify email')
    } finally {
      setVerifyingEmail(false)
    }
  }

  const handleResendCode = async () => {
    if (!userEmail) return

    setResendingCode(true)
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail })
      })

      if (response.ok) {
        toast.success('Verification code sent!')
      } else {
        toast.error('Failed to resend code')
      }
    } catch (error) {
      toast.error('Failed to resend code')
    } finally {
      setResendingCode(false)
    }
  }

  // Show verifying token spinner after successful verification
  if (showVerifyingToken || verificationComplete) {
    return (
      <div className="flex flex-col items-center gap-4 space-y-3 w-full">
        <div className="w-full flex-1 rounded-lg px-6 pb-4 pt-8 md:w-96 bg-card">
          <div className="flex flex-col items-center justify-center py-8">
            <IconSpinnerNew className='my-2' />
            <h1 className="mb-3 text-xl font-semibold text-center">
              {verificationComplete ? 'Verification Complete' : 'Verifying Token'}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {verificationComplete
                ? 'Redirecting you now...'
                : 'Please wait while we verify your account...'
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 space-y-3 w-full">
      <div className="w-full flex-1 rounded-lg px-6 pb-4 pt-8 md:w-96 bg-card">
        <h1 className="mb-3 text-2xl font-bold text-center">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground text-center">
          {description}
        </p>

        <div className="w-full">
          <label
            className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
            htmlFor="verification-code"
          >
            Verification Code
          </label>
          <div className="relative">
            <input
              className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleVerifyEmail()
                }
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleVerifyEmail}
          disabled={verifyingEmail || !verificationCode}
          className="my-4 flex h-10 w-full flex-row items-center justify-center rounded-md bg-primary p-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {verifyingEmail ? <IconSpinner className="animate-spin" /> : 'Verify Email'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendingCode}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {resendingCode ? 'Sending...' : "Didn't receive the code? Resend"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setVerificationCode('')
          onBack()
        }}
        className="flex flex-row gap-1 text-sm text-muted-foreground"
      >
        {backButtonText}
      </button>
    </div>
  )
}
