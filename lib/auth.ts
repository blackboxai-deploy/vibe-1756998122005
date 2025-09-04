import { getServerSession } from 'next-auth/next'
import NextAuth, { type DefaultSession, type NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

import { EMAIL_VERIFY_ENABLED, getStringFromBuffer } from '@/lib/utils'
import { getUser } from '@/app/auth/login'
import { createUser } from '@/app/auth/signup'

// NextAuth module declaration
declare module 'next-auth' {
  interface Session {
    isNewUser?: boolean
    user: {
      /** The user's id. */
      id: string
    } & DefaultSession['user']
  }
}

interface RegistrationStatus {
  success: boolean;
  isNewUser: boolean;
}

async function registerUser(email: any, name: any): Promise<RegistrationStatus> {
  let registration: RegistrationStatus = { success: false, isNewUser: false };
  try {
    const result = await createUser(email, undefined, name, true);
    
    registration.success = result.type === 'success';
    registration.isNewUser = result.isNewUser || false;
    return registration;
  } catch (err) {
    console.log("Error creating user");
    console.error(err);
    return registration;
  }
}

// Function to check subscription status
async function checkSubscription(email: string) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/check-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })
    
    if (!response.ok) {
      console.error('Subscription check failed:', response.statusText)
      return { hasActiveSubscription: false }
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error checking subscription:', error)
    return { hasActiveSubscription: false }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6)
          })
          .safeParse(credentials)

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data
          const user = await getUser(email)

          if (!user) return null

          // Check if email is verified (skip for OAuth users)
          if (EMAIL_VERIFY_ENABLED && !user.throughProvider && !user.emailVerified) {
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          const encoder = new TextEncoder()
          const saltedPassword = encoder.encode(password + user.salt)
          const hashedPasswordBuffer = await crypto.subtle.digest(
            'SHA-256',
            saltedPassword
          )
          const hashedPassword = getStringFromBuffer(hashedPasswordBuffer)

          if (hashedPassword === user.password) {
            return user
          } else {
            return null
          }
        }

        return null
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        (session as any).isNewUser = token?.isNewUser || false;
        if (token.image) {
          session.user.image = token.image as string
        }
        // Add subscription info to session if available
        if (token.subscriptionData) {
          (session as any).subscriptionData = token.subscriptionData
        }
        // Add GitHub access token to session if available
        if (token.githubAccessToken) {
          (session as any).githubAccessToken = token.githubAccessToken as string
        }
      }
      return session
    },
    async jwt({ token, profile, user, trigger, session, account }) {
      let registration: RegistrationStatus = { success: false, isNewUser: false };
      
      // Handle session update triggers (like GitHub disconnect)
      if (trigger === 'update' && session?.disconnectGithub) {
        // Remove GitHub access token from the token
        delete token.githubAccessToken
        return token
      }
      
      // Handle OAuth providers (Google, GitHub)
      if (profile) {
        token.id = (profile as any).id || (profile as any).sub
        token.image = (profile as any).avatar_url || (profile as any).picture
        if (profile.email && (profile as any).given_name) {
          registration = await registerUser(profile.email, (profile as any).given_name)
        }
        token.isNewUser = registration.isNewUser || false;
        
        // Store subscription data for Google OAuth
        if (profile.email && account?.provider === 'google') {
          // TODO: Disable customerId check as even free users should be able to use the app
          // const subscriptionData = await checkSubscription(profile.email)
          // token.subscriptionData = subscriptionData
        }
      }

      // Handle credentials login (including auto-login-token)
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        // For auto-login tokens, user is already verified, so not a new user
        token.isNewUser = profile ? registration.isNewUser : false;
      }
      
      // Store GitHub access token
      if (account?.provider === 'github' && account.access_token) {
        token.githubAccessToken = account.access_token
      }
      
      return token
    }
  },
  pages: {
    signIn: '/login', // overrides the next-auth default signin page https://authjs.dev/guides/basics/pages
    error: "/auth/error"
  },
  session: {
    strategy: 'jwt',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
export const { signIn, signOut } = NextAuth(authOptions)
export const getAuthSession = () => getServerSession(authOptions)
