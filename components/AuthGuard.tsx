'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!active) return

      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        return
      }

      setChecking(false)
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  if (checking) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-center text-gray-400 py-12">检查登入状态中...</p>
      </main>
    )
  }

  return children
}
