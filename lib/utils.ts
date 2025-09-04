import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const EMAIL_VERIFY_ENABLED = true;

export const stripe_pro_url:any = `/api/buy-credits?productId=prod_RI1k0eOeA1Xf5u&userId=123&productName=webide` // being used for main app

export const eventTypes:any = {
  'other': 'Other Engagement',
  'chat': 'Chat Request',
  'signup': 'Clicked on Signup'
}

export enum ResultCode {
  InvalidCredentials = 'INVALID_CREDENTIALS',
  InvalidSubmission = 'INVALID_SUBMISSION',
  UserAlreadyExists = 'USER_ALREADY_EXISTS',
  UnknownError = 'UNKNOWN_ERROR',
  UserCreated = 'USER_CREATED',
  UserLoggedIn = 'USER_LOGGED_IN',
  UserUpdated = 'USER_UPDATED',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  VerificationSent = 'VERIFICATION_SENT'
}

export const getMessageFromCode = (resultCode: string) => {
  switch (resultCode) {
    case ResultCode.InvalidCredentials:
      return 'Invalid credentials!'
    case ResultCode.InvalidSubmission:
      return 'Invalid submission, please try again!'
    case ResultCode.UserAlreadyExists:
      return 'User already exists, please log in!'
    case ResultCode.UserCreated:
      return 'Account created! Please check your email to verify your account.'
    case ResultCode.UnknownError:
      return 'Something went wrong, please try again!'
    case ResultCode.UserLoggedIn:
      return 'Logged in!'
    case ResultCode.UserUpdated:
      return 'User information updated successfully!'
    case ResultCode.EmailNotVerified:
      return 'Please verify your email address before logging in.'
    case ResultCode.VerificationSent:
      return 'Verification code sent to your email!'
  }
}

export const getStringFromBuffer = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
