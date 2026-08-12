import { missingTikTokConfig } from '@/lib/tiktok'

export default function IntegrationsPage() {
  const missing = missingTikTokConfig()
  const isReady = missing.length === 0

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">平台连接</h1>
        <p className="text-gray-500 mt-1">连接 TikTok Shop、Shopee、Meta 等平台来同步订单、业绩和投流数据。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg">TikTok Shop</h2>
              <p className="text-sm text-gray-500 mt-1">同步 TikTok Shop 订单、商品销售和店铺业绩。</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${isReady ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {isReady ? '可连接' : '待设置'}
            </span>
          </div>

          {isReady ? (
            <a
              href="/api/tiktok/connect"
              className="inline-block mt-5 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              连接 TikTok Shop
            </a>
          ) : (
            <div className="mt-5 bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-800">
              <p className="font-medium mb-1">Vercel 还需要加入这些环境变量：</p>
              <p>{missing.join(', ')}</p>
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-70">
          <h2 className="font-semibold text-lg">Shopee</h2>
          <p className="text-sm text-gray-500 mt-1">等待 Shopee Open Platform profile 审核通过后再连接。</p>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-70">
          <h2 className="font-semibold text-lg">Meta Ads</h2>
          <p className="text-sm text-gray-500 mt-1">之后可连接 Facebook / Instagram 广告花费、ROAS 和投流表现。</p>
        </section>
      </div>
    </main>
  )
}
