'use client'

import * as React from 'react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import LoginForm from './login-form'
import SignupForm from './signup-form'
import ForgotPasswordForm from './forgot-password-form'
import Link from 'next/link'

interface LoginDialogProps {
  showLoginDialog: boolean;
  setShowLoginDialog: (show: boolean) => void;
}

export default function LoginDialog({ showLoginDialog, setShowLoginDialog }: LoginDialogProps) {
  const [view, setView] = useState<'login' | 'signup' | 'forgot-password' | 'verify-email'>('signup')
  const [isSignupLoading, setIsSignupLoading] = useState(false)

  return (
    <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
      <DialogContent className="flex flex-col items-center max-h-[85vh] overflow-y-auto p-6">
        <div className="flex flex-col items-center justify-between w-full min-h-[500px]">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {view === 'login' && (
              <LoginForm onForgotPassword={() => setView('forgot-password')} />
            )}

            {view === 'signup' && (
              <SignupForm onLoadingStateChange={setIsSignupLoading} />
            )}

            {view === 'forgot-password' && (
              <ForgotPasswordForm onBack={() => setView('login')} />
            )}
          </div>

          <div className="mt-6 flex-shrink-0">
            {view === 'login' && (
              <Link
                href="/signup"
                className="flex flex-row gap-1 text-sm text-zinc-400"
                onClick={(e) => {
                  e.preventDefault();
                  setView('signup');
                }}
              >
                No account yet? <div className="font-semibold underline">Sign up</div>
              </Link>
            )}

            {view === 'signup' && !isSignupLoading && (
              <Link
                href="/login"
                className="flex flex-row gap-1 text-sm text-zinc-400"
                onClick={(e) => {
                  e.preventDefault();
                  setView('login');
                }}
              >
                Already have an account? <div className="font-semibold underline">Log in</div>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
