import { NuqsAdapter } from 'nuqs/adapters/next/app'
// import { SandboxState } from '@/components/modals/sandbox-state'
import { Toaster } from '@/components/ui/sonner'
import { AuthSessionProvider } from '@/components/auth/session-provider'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import './intersection-safari.css'
import { LocalStorageProvider } from '@/components/utils/local-storage-provider'
import { ViewportInitializer } from '@/components/utils/viewport-initializer'

export const metadata: Metadata = {
  title: 'BLACKBOXAI Vibe Coding Agent',
  description: '',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          forcedTheme="light"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthSessionProvider>
            <LocalStorageProvider>
              <ViewportInitializer />
              <NuqsAdapter>{children}</NuqsAdapter>
              <Toaster />
              {/* <SandboxState /> */}
            </LocalStorageProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
