// ── Config (env vars) ────────────────────────────────────────────────────────

export function getTikTokConfig() {
  return {
    appKey: process.env.TIKTOK_SHOP_APP_KEY || '',
    appSecret: process.env.TIKTOK_SHOP_APP_SECRET || '',
    redirectUri:
      process.env.TIKTOK_SHOP_REDIRECT_URI ||
      'https://dancoly-hub.vercel.app/api/tiktok/callback',
    authUrl:
      process.env.TIKTOK_SHOP_AUTH_URL ||
      'https://auth.tiktok-shops.com/oauth/authorize',
    tokenUrl:
      process.env.TIKTOK_SHOP_TOKEN_URL ||
      'https://auth.tiktok-shops.com/api/v2/token/get',
  }
}

export function missingTikTokConfig() {
  const config = getTikTokConfig()
  return [
    !config.appKey && 'TIKTOK_SHOP_APP_KEY',
    !config.appSecret && 'TIKTOK_SHOP_APP_SECRET',
  ].filter(Boolean) as string[]
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TikTokTokenData = {
  access_token: string
  access_token_expire_in: number
  refresh_token: string
  refresh_token_expire_in: number
  open_id: string
  seller_name: string
  seller_base_region: string
}

export type TikTokTokenResponse = {
  code: number
  message: string
  data: TikTokTokenData
}

export type TikTokOrderItem = {
  id: string
  product_id: string
  product_name: string
  sku_id: string
  sku_name: string
  image_url: string
  quantity: number
  sale_price: string
  original_price: string
  platform_discount: string
  seller_discount: string
  seller_sku: string
}

export type TikTokOrder = {
  id: string
  order_status: string
  payment_method_name: string
  currency: string
  total_amount: string
  sub_total: string
  shipping_fee: string
  seller_discount: string
  platform_discount: string
  create_time: number
  paid_time: number
  update_time: number
  buyer_uid: string
  buyer_message: string
  line_items: TikTokOrderItem[]
  recipient_address: {
    name: string
    phone_number: string
    full_address: string
    address_detail: string
    city: string
    district: string
    state: string
    postal_code: string
    region_code: string
  }
  tracking_number: string
  shipping_provider_name: string
}

// ── Signature ────────────────────────────────────────────────────────────────

/**
 * TikTok Shop API v2 signature (SHA-256).
 * base = {appSecret}{/path}{sortedKey1}{val1}{sortedKey2}{val2}...{appSecret}
 * sign = SHA256(base).hex().uppercase()
 * Params must exclude `sign` and `access_token`.
 * Uses Web Crypto API so it works in both Node.js and Edge Runtime.
 */
export async function generateSign(path: string, params: Record<string, string>): Promise<string> {
  const { sign: _s, access_token: _a, ...rest } = params
  const sorted = Object.keys(rest)
    .sort()
    .map(k => k + (rest[k] ?? ''))
    .join('')
  const { appSecret } = getTikTokConfig()
  const base = appSecret + path + sorted + appSecret
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

// ── Request helpers ──────────────────────────────────────────────────────────

const API_BASE = 'https://open-api.tiktok-shop.com'
const AUTH_BASE = 'https://auth.tiktok-shops.com'

type ApiParams = Record<string, string | number>

async function buildSignedUrl(
  path: string,
  extra: ApiParams = {},
  accessToken: string,
  shopId?: string,
): Promise<string> {
  const { appKey } = getTikTokConfig()
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  }
  if (shopId) params.shop_id = shopId
  const sign = await generateSign(path, params)
  const qs = new URLSearchParams({ ...params, sign, access_token: accessToken }).toString()
  return `${API_BASE}${path}?${qs}`
}

/** Signed fetch for all TikTok Shop Open API calls. */
export async function tiktokFetch<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string,
  shopId: string,
  params: ApiParams = {},
  body?: object,
): Promise<T> {
  const url = await buildSignedUrl(path, params, accessToken, shopId)
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tts-access-token': accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`TikTok API ${path} → HTTP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// ── OAuth helpers ────────────────────────────────────────────────────────────

/** Exchange authorization code for access + refresh tokens. */
export async function exchangeCodeForToken(authCode: string): Promise<TikTokTokenResponse> {
  const { appKey, appSecret, tokenUrl } = getTikTokConfig()
  // TikTok token API expects query-string params, not JSON body
  const url = new URL(tokenUrl)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('app_secret', appSecret)
  url.searchParams.set('auth_code', authCode)
  url.searchParams.set('grant_type', 'authorized_code')
  const res = await fetch(url.toString(), { cache: 'no-store' })
  return res.json()
}

/** Refresh a stale access token using the stored refresh token. */
export async function refreshAccessToken(storedRefreshToken: string): Promise<TikTokTokenResponse> {
  const { appKey, appSecret } = getTikTokConfig()
  const res = await fetch(`${AUTH_BASE}/api/v2/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_key: appKey,
      app_secret: appSecret,
      refresh_token: storedRefreshToken,
      grant_type: 'refresh_token',
    }),
  })
  return res.json()
}
