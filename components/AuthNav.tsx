import Link from 'next/link'

export default function AuthNav() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/" className="hover:underline">首页</Link>
      <Link href="/dashboard" className="hover:underline">客户管理</Link>
      <Link href="/orders" className="hover:underline">订单</Link>
      <Link href="/integrations" className="hover:underline">平台连接</Link>
    </div>
  )
}
