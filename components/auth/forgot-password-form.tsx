'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { IconSpinner } from '@/components/ui/icons'
import { ForgotPasswordPayload, ResetPasswordPayload, ApiResponse } from '@/app/types/auth'

export interface ForgotPasswordFormProps {
  onBack: () => void
}

export default function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSendVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email } as ForgotPasswordPayload),
      })

      const data: ApiResponse = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Verification code sent to your email')
        setVerificationSent(true)
      } else {
        toast.error(data.error || 'Failed to send verification code')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
          newPassword,
        } as ResetPasswordPayload),
      })

      const data: ApiResponse = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Password reset successfully')
        onBack() // Return to login
      } else {
        toast.error(data.error || 'Failed to reset password')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full flex-1 rounded-lg px-6 pb-4 pt-8 md:w-96 bg-card">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-sm text-muted-foreground"
        >
          Back to Login
        </Button>
      </div>

      {!verificationSent ? (
        <form onSubmit={handleSendVerification} className="space-y-4">
          <div>
          <label
            className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
            htmlFor="email"
          >
            Email
          </label>
          <input
            className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            autoFocus
          />
          </div>
          <Button
            type="submit"
            className="my-4 flex h-10 w-full items-center justify-center rounded-md bg-primary p-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? <IconSpinner className="animate-spin" /> : 'Send Verification Code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label
              className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
              htmlFor="verification-code"
            >
              Verification Code
            </label>
            <input
              className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter verification code"
              required
              autoFocus
            />
          </div>
          <div>
            <label
              className="mb-3 mt-5 block text-xs font-medium text-muted-foreground"
              htmlFor="new-password"
            >
              New Password
            </label>
            <input
              className="peer block w-full rounded-md border bg-input px-2 py-[9px] text-sm outline-none placeholder:text-muted-foreground border-border"
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>
          <Button
            type="submit"
            className="my-4 flex h-10 w-full items-center justify-center rounded-md bg-primary p-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? <IconSpinner className="animate-spin" /> : 'Reset Password'}
          </Button>
        </form>
      )}
    </div>
  )
}

// Explicitly export the component type
export type { ForgotPasswordForm }
