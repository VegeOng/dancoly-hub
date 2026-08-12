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

  return Response.json(steps)
}
