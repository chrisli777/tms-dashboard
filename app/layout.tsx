import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import { SWRProvider } from '@/components/providers/swr-provider'
import { RoleProvider } from '@/components/providers/role-provider'
import { SESSION_COOKIE, getRoleForToken } from '@/lib/auth'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'WHI SCM',
  description: 'Supply Chain Management - Orders, Shipments, Forecasting & Replenishment',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const role = await getRoleForToken(cookieStore.get(SESSION_COOKIE)?.value)

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <RoleProvider role={role}>
          <SWRProvider>
            {children}
          </SWRProvider>
        </RoleProvider>
        <Analytics />
      </body>
    </html>
  )
}
