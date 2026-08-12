import { type NextRequest } from 'next/server'
import { exchangeCodeForToken, tiktokFetch, missingTikTokConfig } from '@/lib/tiktok'
import { supabase } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dancoly-hub.vercel.app'

// GET /api/tiktok/callback?code=xxx&state=xxx
export async function GET(request: NextRequest) {
  try {
    return await handleCallback(request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('TikTok callback fatal:', err)
    return htmlPage('TikTok 连接出现错误', [`错误详情：${msg}`, '请截图后联系技术支持。'])
  }
}

async function handleCallback(request: NextRequest) {
  // ── 0. Env check ───────────────────────────────────────────────────────
  const missing = missingTikTokConfig()
  if (missing.length) {
    return htmlPage('TikTok Shop 尚未设置完成', [
      `Vercel 还缺少：${missing.join(', ')}`,
      '请先加入环境变量后重新部署。',
    ])
  }

  const url = request.nextUrl
  const code = url.searchParams.get('code') ?? url.searchParams.get('auth_code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('tiktok_oauth_state')?.value

  if (!code) {
    return htmlPage('没有收到 TikTok 授权码', [
      '请回到 Dancoly CRM 的平台连接页面，重新点击连接 TikTok Shop。',
    ])
  }

  if (savedState && state && savedState !== state) {
    return htmlPage('TikTok 授权验证失败', [
      '授权状态不一致。请重新连接一次 TikTok Shop。',
    ])
  }

  // ── 1. Exchange code for tokens ────────────────────────────────────────
  const tokenRes = await exchangeCodeForToken(code)
  if (tokenRes.code !== 0) {
    return htmlPage('TikTok token 换取失败', [
      `错误：${tokenRes.message}`,
      '请检查 App Key、App Secret、Redirect URL 是否正确。',
    ])
  }

  const {
    access_token,
    refresh_token,
    access_token_expire_in,
    open_id,
    seller_name,
    seller_base_region,
  } = tokenRes.data

  const tokenExpiresAt = new Date(Date.now() + access_token_expire_in * 1000).toISOString()

  // ── 2. Get authorized shop info ────────────────────────────────────────
  let shopId = open_id
  let shopName = seller_name
  let shopCode = ''

  type ShopListResponse = {
    code: number
    data: { shops: Array<{ id: string; name: string; code: string }> }
  }

  try {
    const shopList = await tiktokFetch<ShopListResponse>(
      'GET',
      '/api/shop/get_authorized_shop',
      access_token,
      '', // shop_id not required for this endpoint
    )
    const first = shopList?.data?.shops?.[0]
    if (first) { shopId = first.id; shopName = first.name; shopCode = first.code }
  } catch (err) {
    console.warn('Could not fetch shop list, using open_id as fallback:', err)
  }

  // ── 3. Upsert into tiktok_connections ─────────────────────────────────
  const { error: dbError } = await supabase
    .from('tiktok_connections')
    .upsert(
      {
        shop_id: shopId,
        shop_name: shopName,
        shop_code: shopCode,
        seller_name,
        country_code: seller_base_region ?? 'MY',
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' },
    )

  if (dbError) {
    console.error('DB upsert failed:', dbError)
    return htmlPage('数据储存失败', [
      '授权成功，但保存到数据库时出错。',
      `错误：${dbError.message}`,
      '请检查 Supabase tiktok_connections 表是否已创建。',
    ])
  }

  // ── 4. Redirect back to integrations with success flag ─────────────────
  return Response.redirect(`${APP_URL}/integrations?connected=true`)
}

function htmlPage(title: string, lines: string[]) {
  return new Response(
    `<!doctype html>
    <html lang="zh">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{font-family:Arial,Helvetica,sans-serif;background:#fff7ed;color:#1f2937;margin:0;padding:48px 20px}
          main{max-width:560px;margin:0 auto;background:#fff;border:1px solid #fed7aa;border-radius:12px;padding:28px;box-shadow:0 1px 8px rgba(0,0,0,.05)}
          h1{color:#b45309;font-size:24px;margin:0 0 16px}
          p{line-height:1.6;color:#4b5563}
          a{display:inline-block;margin-top:18px;color:#fff;background:#f59e0b;padding:10px 14px;border-radius:8px;text-decoration:none}
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          ${lines.map(l => `<p>${l}</p>`).join('')}
          <a href="/integrations">回到平台连接</a>
        </main>
      </body>
    </html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}
