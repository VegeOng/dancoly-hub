import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <nav className="bg-amber-600 text-white px-6 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">💛 Dancoly CRM</h1>
          <div className="flex gap-4 text-sm">
            <a href="/" className="hover:underline">首页</a>
            <a href="/dashboard" className="hover:underline">客户管理</a>
            <a href="/orders" className="hover:underline">订单</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
