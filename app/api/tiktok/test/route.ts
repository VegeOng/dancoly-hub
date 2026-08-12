import { supabase } from '@/lib/supabase'
import { getTikTokConfig, exchangeCodeForToken } from '@/lib/tiktok'

// GET /api/tiktok/test — diagnostic only, delete after debugging
export async function GET() {
  const steps: Record<string, unknown> = {}

  // Step 1: env vars
  const cfg = getTikTokConfig()
  steps.env = {
    app_key_len: cfg.appKey.length,
    app_secret_len: cfg.appSecret.length,
    redirect_uri: cfg.redirectUri,
  }

  // Step 2: supabase connection
  try {
    const { data, error } = await supabase
      .from('tiktok_connections')
      .select('id, shop_id, shop_name, is_active, token_expires_at')
      .limit(5)
    steps.supabase = error ? { error: error.message } : { rows: data?.length, first: data?.[0] }
  } catch (e) {
    steps.supabase = { thrown: String(e) }
  }

  // Step 3: active connection exists?
  const { data: conn } = await supabase
    .from('tiktok_connections')
    .select('id, shop_id, shop_name, access_token, token_expires_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (conn) {
    steps.active_connection = {
      shop_id: conn.shop_id,
      shop_name: conn.shop_name,
      token_expires_at: conn.token_expires_at,
      token_expired: conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : 'unknown',
      access_token_prefix: conn.access_token?.slice(0, 8) + '...',
    }
  } else {
    steps.active_connection = null
  }

  // Step 4: can we reach TikTok's API host?
  try {
    const r = await fetch('https://open-api.tiktok-shop.com/', {
      signal: AbortSignal.timeout(5000),
    })
    steps.tiktok_host_reachable = { status: r.status }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    const cause = (err as NodeJS.ErrnoException).cause as Error | undefined
    steps.tiktok_host_reachable = {
      error: `${err.name}: ${err.message}`,
      cause: cause ? `${cause.name}: ${cause.message}` : undefined,
      code: (cause as NodeJS.ErrnoException)?.code,
    }
  }

  // Step 5: can we reach auth.tiktok-shops.com?
  try {
    const r = await fetch('https://auth.tiktok-shops.com/', {
      signal: AbortSignal.timeout(5000),
    })
    steps.auth_host_reachable = { status: r.status }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    steps.auth_host_reachable = { error: `${err.name}: ${err.message}` }
  }

  return Response.json(steps)
}
