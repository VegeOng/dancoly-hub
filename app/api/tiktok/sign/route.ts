import { supabase } from '@/lib/supabase'
import { getTikTokConfig, generateSign, refreshAccessToken } from '@/lib/tiktok'

const API_BASE = 'https://open-api.tiktok-shop.com'

// POST /api/tiktok/sign
// Called by Make.com to get a signed TikTok API URL.
// Make then calls TikTok directly from Make's servers (not blocked by TikTok).
export async function POST(request: Request) {
  try {
    const {
      tiktok_method = 'GET',
      tiktok_path,
      query_params = {},
      body_params = null,
    } = (await request.json()) as {
      tiktok_method?: string
      tiktok_path: string
      query_params?: Record<string, string | number>
      body_params?: Record<string, unknown> | null
    }

    if (!tiktok_path) {
      return Response.json({ error: 'tiktok_path is required' }, { status: 400 })
    }

    // Load active connection
    const { data: conn, error: connErr } = await supabase
      .from('tiktok_connections')
      .select('id, shop_id, access_token, refresh_token, token_expires_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (connErr || !conn) {
      return Response.json({ error: 'No active TikTok connection' }, { status: 404 })
    }

    let { access_token, refresh_token } = conn as { access_token: string; refresh_token: string }

    // Refresh token if expiring within 1 hour
    const expiresAt = new Date((conn as { token_expires_at: string }).token_expires_at).getTime()
    if (Date.now() > expiresAt - 3_600_000) {
      const refreshed = await refreshAccessToken(refresh_token)
      if (refreshed.code !== 0) {
        return Response.json({ error: 'Token refresh failed', detail: refreshed.message }, { status: 401 })
      }
      access_token = refreshed.data.access_token
      refresh_token = refreshed.data.refresh_token
      const newExpiry = new Date(Date.now() + refreshed.data.access_token_expire_in * 1000).toISOString()
      await supabase
        .from('tiktok_connections')
        .update({ access_token, refresh_token, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq('id', (conn as { id: string }).id)
    }

    const { appKey } = getTikTokConfig()
    const timestamp = Math.floor(Date.now() / 1000)

    const params: Record<string, string> = {
      app_key: appKey,
      shop_id: (conn as { shop_id: string }).shop_id,
      timestamp: String(timestamp),
      access_token,
      ...Object.fromEntries(Object.entries(query_params).map(([k, v]) => [k, String(v)])),
    }

    const sign = await generateSign(tiktok_path, params)
    const qs = new URLSearchParams({ ...params, sign }).toString()

    return Response.json({
      url: `${API_BASE}${tiktok_path}?${qs}`,
      method: tiktok_method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'x-tts-access-token': access_token,
      },
      body: body_params,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
