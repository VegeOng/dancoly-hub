'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AuthGuard from '@/components/AuthGuard'

type Customer = {
  id: string
  name: string
  phone: string
  email: string
  customer_type: string
  hair_concern: string
  notes: string
  created_at: string
}

export default function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    customer_type: 'new', hair_concern: '', notes: ''
  })
  const [stats, setStats] = useState({
    total: 0, returning: 0, revenue: 0
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])

    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
    const revenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
    const returning = (data || []).filter(c => c.customer_type === 'returning').length

    setStats({ total: (data || []).length, returning, revenue })
    setLoading(false)
  }

  async function addCustomer() {
    if (!form.name) return alert('请填写客户姓名')
    await supabase.from('customers').insert(form)
    setForm({ name: '', phone: '', email: '', customer_type: 'new', hair_concern: '', notes: '' })
    setShowForm(false)
    loadCustomers()
  }

  const filtered = customers.filter(c =>
    c.name?.includes(search) || c.phone?.includes(search)
  )

  return (
    <AuthGuard>
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">👥 客户管理</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '总客户数', value: `${stats.total} 人` },
          { label: '回购客', value: `${stats.returning} 人` },
          { label: '已收款', value: `RM ${stats.revenue.toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-sm text-amber-600">{s.label}</p>
            <p className="text-2xl font-bold text-amber-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56"
            placeholder="搜索姓名 / 手机号"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + 新增客户
          </button>
        </div>

        {showForm && (
          <div className="bg-amber-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="姓名 *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="手机号" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.customer_type} onChange={e => setForm({...form, customer_type: e.target.value})}>
              <option value="new">新客</option>
              <option value="returning">回购客</option>
            </select>
            <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" placeholder="掉发困扰描述" value={form.hair_concern} onChange={e => setForm({...form, hair_concern: e.target.value})} />
            <textarea className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" placeholder="备注" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            <div className="col-span-2 flex gap-2">
              <button onClick={addCustomer} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">保存</button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">取消</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">加载中...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b text-left">
                <th className="pb-2">姓名</th>
                <th className="pb-2">手机</th>
                <th className="pb-2">类型</th>
                <th className="pb-2">掉发困扰</th>
                <th className="pb-2">加入日期</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-gray-500">{c.phone}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.customer_type === 'returning' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                      {c.customer_type === 'returning' ? '回购客' : '新客'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 text-xs">{c.hair_concern}</td>
                  <td className="py-2 text-gray-400">{new Date(c.created_at).toLocaleDateString('zh-MY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
    </AuthGuard>
  )
}
