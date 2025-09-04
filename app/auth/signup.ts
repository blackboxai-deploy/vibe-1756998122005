'use server'

import { signIn } from '@/lib/auth';
import { EMAIL_VERIFY_ENABLED, ResultCode, eventTypes, getStringFromBuffer } from '@/lib/utils'
import { z } from 'zod'
import { getUser } from './login';
import { AuthError } from '@auth/core/errors'
import { addTrialCreditsForEmail } from '@/lib/credits';
import kvUser from '@/lib/services/kvUser';
// import { validatePartnerKey } from '../lib/partnerstack'
// import { telemetry } from '@/lib/telemetry'

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const saltedPassword = encoder.encode(password + salt)
  const hashedPasswordBuffer = await crypto.subtle.digest('SHA-256', saltedPassword)
  return getStringFromBuffer(hashedPasswordBuffer)
}

interface Result {
  type: string
  resultCode: ResultCode
  isNewUser?: boolean
}

export async function createUser(
  email: string,
  password?: string,
  fullname?: string,
  throughProvider: boolean = false,
) {
  const existingUser = await getUser(email)

  if (existingUser) {
    // If user exists and logging in through OAuth provider, ensure emailVerified is true
    if (throughProvider && !existingUser.emailVerified) {
      console.log(`Updating emailVerified status for existing OAuth user: ${email}`)
      await kvUser.hmset(`user:${email}`, { emailVerified: true })
    }

    return {
      type: 'error',
      resultCode: ResultCode.UserAlreadyExists,
      isNewUser: false,
    }
  } else {
    // telemetry(eventTypes.signup, '', {})
    const user: any = {
      id: crypto.randomUUID(),
      email,
      timestamp: new Date(),
      throughProvider,
      emailVerified: throughProvider // OAuth users are automatically verified
    }

    if (fullname) {
      user.fullname = fullname
    }

    if (password && !throughProvider) {
      const salt = crypto.randomUUID()
      const hashedPassword = await hashPassword(password, salt)
      user.password = hashedPassword
      user.salt = salt
    }

    const cleanUser = Object.fromEntries(
      Object.entries(user).filter(([_, value]) => value != null)
    )

    await kvUser.hmset(`user:${email}`, cleanUser)

    await addTrialCreditsForEmail(email) // adding 1 dollar trial credit for litellm here

    return {
      type: 'success',
      resultCode: ResultCode.UserCreated,
      isNewUser: true
    }
  }
}

export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<Result> {
  try {
    const existingUser = await getUser(email)
    if (!existingUser) {
      return {
        type: 'error',
        resultCode: ResultCode.InvalidCredentials
      }
    }

    const salt = crypto.randomUUID()
    const hashedPassword = await hashPassword(newPassword, salt)

    await kvUser.hmset(`user:${email}`, {
      password: hashedPassword,
      salt: salt
    })

    return {
      type: 'success',
      resultCode: ResultCode.UserUpdated
    }
  } catch (error) {
    console.error('Error updating password:', error)
    return {
      type: 'error',
      resultCode: ResultCode.UnknownError
    }
  }
}

export async function signup(
  _prevState: Result | undefined,
  formData: FormData
): Promise<Result | undefined> {
  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log('Attempting signup with email:', email)

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
      console.log('Credentials validation successful')
      try {
        console.log('Attempting to create user in KV database')
        const result = await createUser(email, password)
        console.log('Create user result:', result)

        if (result.resultCode === ResultCode.UserCreated) {
          try {
            // await validatePartnerKey(email);

            if (EMAIL_VERIFY_ENABLED) {
              // Send verification email
              const verificationResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/send-verification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
              })

              if (!verificationResponse.ok) {
                console.error('Failed to send verification email')
              }
              // Return success but don't auto-login - user needs to verify email first
              return {
                type: 'success',
                resultCode: ResultCode.UserCreated
              }
            }
            else {
              const signInResult = await signIn('credentials', {
                email,
                password,
                redirect: false
              })

              if (!signInResult?.error) {
                return {
                  type: 'success',
                  resultCode: ResultCode.UserLoggedIn
                }
              }
            }

          } catch (error) {
            console.error('Error during post-signup process:', error)
          }
          // Still return success since user was created
          return {
            type: 'success',
            resultCode: ResultCode.UserCreated
          }
        }

        return result
      } catch (error) {
        console.error('Error during user creation:', error)
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
        } else {
          return {
            type: 'error',
            resultCode: ResultCode.UnknownError
          }
        }
      }
    } else {
      console.error('Invalid credentials format:', parsedCredentials.error)
      return {
        type: 'error',
        resultCode: ResultCode.InvalidCredentials
      }
    }
  } catch (error) {
    console.error('Top level error:', error)
    return {
      type: 'error',
      resultCode: ResultCode.UnknownError
    }
  }
}