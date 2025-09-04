import NextAuth, { type DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    isNewUser?: boolean
    user: {
      /** The user's id. */
      id: string
    } & DefaultSession['user']
    subscriptionData?: {
      hasActiveSubscription: boolean
      isTrialSubscription?: boolean
      customerId?: string
      expiryTimestamp?: number
    }
    githubAccessToken?: string
  }

  interface JWT {
    id?: string
    isNewUser?: boolean
    subscriptionData?: {
      hasActiveSubscription: boolean
      isTrialSubscription?: boolean
      customerId?: string
      expiryTimestamp?: number
    }
    githubAccessToken?: string
  }
}
