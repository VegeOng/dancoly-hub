'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthNav() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setEmail(data.user?.email ?? null)
    }

    loadUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setEmail(null)
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/" className="hover:underline">首页</Link>
      <Link href="/dashboard" className="hover:underline">客户管理</Link>
      <Link href="/orders" className="hover:underline">订单</Link>
      {email ? (
        <button onClick={logout} className="hover:underline">
          登出
        </button>
      ) : (
        <Link href="/login" className="hover:underline">登入</Link>
      )}
    </div>
  )
}
