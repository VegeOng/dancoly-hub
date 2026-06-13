import type { Metadata } from 'next'
import AuthNav from '@/components/AuthNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dancoly CRM',
  description: 'Dancoly 销售助理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>
        <nav className="bg-amber-600 text-white px-6 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">💛 Dancoly CRM</h1>
          <AuthNav />
        </nav>
        {children}
      </body>
    </html>
  )
}
