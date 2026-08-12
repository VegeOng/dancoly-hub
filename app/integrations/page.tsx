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
type SheetSyncResult = { synced: number; total_rows: number }

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected') === 'true'
  const connectError = searchParams.get('error')

  const [conn, setConn] = useState<Connection | null | undefined>(undefined)

  // ── Google Sheets state ──────────────────────────────────────────────
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetSyncing, setSheetSyncing] = useState(false)
  const [sheetResult, setSheetResult] = useState<SheetSyncResult | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  // Persist sheet URL in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tiktok_sheet_url')
    if (saved) setSheetUrl(saved)
  }, [])

  async function syncFromSheet() {
    if (!sheetUrl.trim()) return
    localStorage.setItem('tiktok_sheet_url', sheetUrl.trim())
    setSheetSyncing(true)
    setSheetResult(null)
    setSheetError(null)
    try {
      const res = await fetch('/api/sheets/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `错误 ${res.status}`)
      setSheetResult(data)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : '同步失败')
    } finally {
      setSheetSyncing(false)
    }
  }
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
      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch { /* empty body — likely timeout */ }
      if (!res.ok) throw new Error((data.error as string) ?? `服务器错误 ${res.status}，请稍后重试`)
      setSyncResult(data as unknown as SyncResult)
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

        {/* ── Google Sheets Sync ── */}
        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm md:col-span-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-lg">📊 Google Sheet 同步订单</h2>
              <p className="text-sm text-gray-500 mt-1">
                用 Zapier / Make 把 TikTok 订单自动写入 Google Sheet，再点这里同步进系统。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Google Sheet 链接（需设置为「任何人可查看」）</label>
              <input
                type="url"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            {sheetResult && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                ✅ 同步完成：共 {sheetResult.total_rows} 行，写入 {sheetResult.synced} 笔订单
              </div>
            )}
            {sheetError && (
              <div className="bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">⚠️ {sheetError}</div>
            )}

            <button
              onClick={syncFromSheet}
              disabled={sheetSyncing || !sheetUrl.trim()}
              className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {sheetSyncing ? '同步中…' : '从 Google Sheet 同步'}
            </button>

            <details className="text-xs text-gray-400 cursor-pointer">
              <summary className="hover:text-gray-600">查看 Zapier / Make 列名模板</summary>
              <div className="mt-2 bg-gray-50 rounded-lg p-3 font-mono text-xs leading-6 break-all">
                order_id, status, created_at, paid_at, total_amount, subtotal,
                shipping_fee, platform_discount, seller_discount, currency,
                payment_method, tracking_number, shipping_provider,
                recipient_name, recipient_phone, shipping_address,
                buyer_uid, buyer_message
              </div>
              <p className="mt-1">在 Zapier / Make 中，把 TikTok 字段映射到以上列名，Sheet 第一行必须是列名。</p>
            </details>
          </div>
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
