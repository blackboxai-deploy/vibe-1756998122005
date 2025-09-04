'use server'

import { signIn } from '@/lib/auth'
import { User } from '@/lib/types'
import { AuthError } from '@auth/core/errors'
import { z } from 'zod'
import kvUser from '@/lib/services/kvUser'
import { EMAIL_VERIFY_ENABLED, ResultCode } from '@/lib/utils'

export async function getUser(email: string) {
  const user = await kvUser.hgetall<User>(`user:${email}`)
  return user
}

interface Result {
  type: string
  resultCode: ResultCode
}

export async function authenticate(
  _prevState: Result | undefined,
  formData: FormData
): Promise<Result | undefined> {
  try {
    const email = formData.get('email')
    const password = formData.get('password')

    const parsedCredentials = z
      .object({
        email: z.string().email(),
        password: z.string().min(6)
      })
      .safeParse({
        email,
        password
      })

    if (parsedCredentials.success) {
      // Check if user exists and if email is verified
      const user = await getUser(email as string)
      if (EMAIL_VERIFY_ENABLED && user && !user.emailVerified && !user.throughProvider) {
        // Send verification email if not verified
        try {
          const verificationResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/send-verification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          })
          
          if (verificationResponse.ok) {
            console.log('Verification email sent for login attempt')
          }
        } catch (error) {
          console.error('Failed to send verification email:', error)
        }

        return {
          type: 'error',
          resultCode: ResultCode.EmailNotVerified
        }
      }

      await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      return {
        type: 'success',
        resultCode: ResultCode.UserLoggedIn
      }
    } else {
      return {
        type: 'error',
        resultCode: ResultCode.InvalidCredentials
      }
    }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return {
            type: 'error',
            resultCode: ResultCode.InvalidCredentials
          }
        default:
          return {
            type: 'error',
            resultCode: ResultCode.UnknownError
          }
      }
    } else if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') {
      return {
        type: 'error',
        resultCode: ResultCode.EmailNotVerified
      }
    }
    
    return {
      type: 'error',
      resultCode: ResultCode.UnknownError
    }
  }
}
