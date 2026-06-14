import { NextRequest, NextResponse } from 'next/server'
import { getTikTokConfig, missingTikTokConfig } from '@/lib/tiktok'

export async function GET(request: NextRequest) {
  const missing = missingTikTokConfig()

  if (missing.length) {
    return statusPage('TikTok Shop 尚未设置完成', [
      `Vercel 还缺少：${missing.join(', ')}`,
      '请先加入环境变量后重新部署。',
    ])
  }

  const url = request.nextUrl
  const code = url.searchParams.get('code') || url.searchParams.get('auth_code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('tiktok_oauth_state')?.value

  if (!code) {
    return statusPage('没有收到 TikTok 授权码', [
      '请回到 Dancoly CRM 的平台连接页面，重新点击连接 TikTok Shop。',
    ])
  }

  if (savedState && state && savedState !== state) {
    return statusPage('TikTok 授权验证失败', [
      '授权状态不一致。请重新连接一次 TikTok Shop。',
    ])
  }

  const config = getTikTokConfig()
  const tokenUrl = new URL(config.tokenUrl)
  tokenUrl.searchParams.set('app_key', config.appKey)
  tokenUrl.searchParams.set('app_secret', config.appSecret)
  tokenUrl.searchParams.set('auth_code', code)
  tokenUrl.searchParams.set('grant_type', 'authorized_code')

  const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' })
  const tokenData = await tokenResponse.json().catch(() => null)

  if (!tokenResponse.ok || !tokenData) {
    return statusPage('TikTok token 换取失败', [
      'TikTok 已经回到你的网站，但换 token 时失败。',
      '请检查 App Key、App Secret、Redirect URL 是否完全正确。',
    ])
  }

  return statusPage('TikTok Shop 已授权成功', [
    '网站已经成功收到 TikTok 的授权资料。',
    '下一步需要建立 Supabase 储存表，把 access token 安全保存起来，然后就可以同步订单和业绩。',
  ])
}

function statusPage(title: string, lines: string[]) {
  return new NextResponse(
    `<!doctype html>
    <html lang="zh">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; background: #fff7ed; color: #1f2937; margin: 0; padding: 48px 20px; }
          main { max-width: 560px; margin: 0 auto; background: white; border: 1px solid #fed7aa; border-radius: 12px; padding: 28px; box-shadow: 0 1px 8px rgba(0,0,0,.05); }
          h1 { color: #b45309; font-size: 24px; margin: 0 0 16px; }
          p { line-height: 1.6; color: #4b5563; }
          a { display: inline-block; margin-top: 18px; color: white; background: #f59e0b; padding: 10px 14px; border-radius: 8px; text-decoration: none; }
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          ${lines.map(line => `<p>${line}</p>`).join('')}
          <a href="/integrations">回到平台连接</a>
        </main>
      </body>
    </html>`,
    {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }
  )
}
