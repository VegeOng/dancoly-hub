import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginShell() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-amber-50/40 px-6 py-12">
      <div className="max-w-md mx-auto bg-white border border-amber-100 rounded-xl shadow-sm p-6">
        <p className="text-center text-gray-400 py-12">载入登入页面中...</p>
      </div>
    </main>
  )
}
