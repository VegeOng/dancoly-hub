'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError('登入失败，请检查 Email 和密码。')
      return
    }

    router.replace(next)
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-amber-50/40 px-6 py-12">
      <div className="max-w-md mx-auto bg-white border border-amber-100 rounded-xl shadow-sm p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-amber-700">登入 Dancoly CRM</h1>
          <p className="text-sm text-gray-500 mt-2">请输入管理员账号进入客户和订单系统</p>
        </div>

        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-5 text-center">
          账号需要先在 Supabase Authentication 里创建。
        </p>
      </div>
    </main>
  )
}
