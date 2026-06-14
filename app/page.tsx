export default function Home() {
  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-amber-600 mb-2">Dancoly 销售助理</h1>
        <p className="text-gray-500">法国人参生发精华液 · 专属 CRM 系统</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <a href="/dashboard" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-4xl mb-3">👥</div>
          <h2 className="font-semibold text-lg mb-1">客户管理</h2>
          <p className="text-gray-400 text-sm">查看所有客户、新增客户、追踪回购客</p>
        </a>

        <a href="/orders" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="font-semibold text-lg mb-1">订单管理</h2>
          <p className="text-gray-400 text-sm">新增订单、生成确认卡、追踪付款状态</p>
        </a>

        <a href="/dashboard" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="font-semibold text-lg mb-1">销售统计</h2>
          <p className="text-gray-400 text-sm">总销售额、回购率、客户增长趋势</p>
        </a>

        <a href="/integrations" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
          <div className="text-4xl mb-3">🔗</div>
          <h2 className="font-semibold text-lg mb-1">平台连接</h2>
          <p className="text-gray-400 text-sm">连接 TikTok Shop、Shopee、Meta</p>
        </a>
      </div>
    </main>
  )
}
