'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Connection = {
  shop_id: string
  shop_name: string
  seller_name: string
  last_synced_at: string | null
}

type SyncResult = { synced: number; items: number; total_found: number }

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected') === 'true'
  const connectError = searchParams.get('error')

  const [conn, setConn] = useState<Connection | null | undefined>(undefined)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadConn = useCallback(async () => {
    const { data } = await supabase
      .from('tiktok_connections')
      .select('shop_id, shop_name, seller_name, last_synced_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setConn(data)
  }, [])

  useEffect(() => { loadConn() }, [loadConn])

  async function syncOrders() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await fetch('/api/tiktok/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '同步失败')
      setSyncResult(data)
      loadConn()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '同步出错')
    } finally {
      setSyncing(false)
    }
  }

  const isLoading = conn === undefined
  const isConnected = !!conn

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">平台连接</h1>
        <p className="text-gray-500 mt-1">连接 TikTok Shop、Shopee、Meta 等平台来同步订单、业绩和投流数据。</p>
      </div>

      {justConnected && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-medium text-green-800">TikTok Shop 已成功连接！</p>
            <p className="text-sm text-green-600">点击「立即同步订单」拉取最新数据。</p>
          </div>
        </div>
      )}

      {connectError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-medium text-red-800">⚠️ 连接失败：{connectError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── TikTok Shop ── */}
        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-lg">TikTok Shop</h2>
              <p className="text-sm text-gray-500 mt-1">同步 TikTok Shop 订单、商品销售和店铺业绩。</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
              isLoading ? 'bg-gray-50 text-gray-400'
              : isConnected ? 'bg-green-50 text-green-700'
              : 'bg-yellow-50 text-yellow-700'
            }`}>
              {isLoading ? '...' : isConnected ? '✓ 已连接' : '可连接'}
            </span>
          </div>

          {isConnected ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">店铺</span>
                  <span className="font-medium">{conn.shop_name || conn.seller_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">上次同步</span>
                  <span className="text-gray-600">
                    {conn.last_synced_at
                      ? new Date(conn.last_synced_at).toLocaleString('zh-MY')
                      : '从未同步'}
                  </span>
                </div>
              </div>

              {syncResult && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                  ✅ 同步完成：共 {syncResult.total_found} 张，写入 {syncResult.synced} 张，{syncResult.items} 个商品行
                </div>
              )}
              {syncError && (
                <div className="bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">⚠️ {syncError}</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={syncOrders}
                  disabled={syncing}
                  className="flex-1 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {syncing ? '同步中…' : '立即同步订单'}
                </button>
                <a
                  href="/api/tiktok/connect"
                  className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-500"
                >
                  重新授权
                </a>
              </div>
            </div>
          ) : !isLoading ? (
            <a
              href="/api/tiktok/connect"
              className="inline-block bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              连接 TikTok Shop
            </a>
          ) : null}
        </section>

        {/* ── Shopee ── */}
        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-60">
          <h2 className="font-semibold text-lg">Shopee</h2>
          <p className="text-sm text-gray-500 mt-1">等待 Shopee Open Platform profile 审核通过后再连接。</p>
        </section>

        {/* ── Meta Ads ── */}
        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-60">
          <h2 className="font-semibold text-lg">Meta Ads</h2>
          <p className="text-sm text-gray-500 mt-1">之后可连接 Facebook / Instagram 广告花费、ROAS 和投流表现。</p>
        </section>

      </div>
    </main>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto p-6 text-gray-400">加载中…</div>}>
      <IntegrationsContent />
    </Suspense>
  )
}
