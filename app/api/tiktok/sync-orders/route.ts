import { tiktokFetch, refreshAccessToken, type TikTokOrder } from '@/lib/tiktok'
import { supabase } from '@/lib/supabase'

// POST /api/tiktok/sync-orders
// Body (optional): { days?: number }  — how many past days to pull (default 30)
export async function POST(request: Request) {
  try {
    return await syncOrders(request)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('sync-orders fatal:', err)
    return Response.json({ error: msg }, { status: 500 })
  }
}

async function syncOrders(request: Request) {
  // ── 0. Options ────────────────────────────────────────────────────────
  let days = 30
  try {
    const body = await request.json()
    if (body?.days && typeof body.days === 'number') days = body.days
  } catch { /* no body */ }

  // ── 1. Load active connection ─────────────────────────────────────────
  const { data: conn, error: connErr } = await supabase
    .from('tiktok_connections')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (connErr || !conn) {
    return Response.json({ error: 'No active TikTok connection found' }, { status: 404 })
  }

  let { access_token, refresh_token } = conn as {
    id: string; shop_id: string; access_token: string; refresh_token: string
    token_expires_at: string; currency: string
  }

  // ── 2. Refresh token if expiring within 1 hour ────────────────────────
  const expiresAt = new Date(conn.token_expires_at).getTime()
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
      .eq('id', conn.id)
  }

  const shopId: string = conn.shop_id
  const now = Math.floor(Date.now() / 1000)
  const since = now - days * 86_400

  // ── 3. Search orders (paginated) ──────────────────────────────────────
  type OrderSearchResponse = {
    code: number; message: string
    data: { orders: Array<{ id: string }>; total_count: number; next_page_token?: string }
  }

  const allOrderIds: string[] = []
  let pageToken: string | undefined

  do {
    const body: Record<string, unknown> = {
      page_size: 50, sort_field: 'create_time', sort_order: 'DESC',
      create_time_ge: since, create_time_lt: now,
    }
    if (pageToken) body.page_token = pageToken

    const res = await tiktokFetch<OrderSearchResponse>('POST', '/order/202309/orders/search', access_token, shopId, {}, body)
    if (res.code !== 0) {
      return Response.json({ error: 'Order search failed', detail: res.message }, { status: 502 })
    }
    allOrderIds.push(...(res.data?.orders ?? []).map(o => o.id))
    pageToken = res.data?.next_page_token
  } while (pageToken)

  if (allOrderIds.length === 0) {
    await supabase.from('tiktok_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)
    return Response.json({ synced: 0, message: 'No orders in the requested window' })
  }

  // ── 4. Fetch order detail (50 per batch) ─────────────────────────────
  type OrderDetailResponse = { code: number; message: string; data: { orders: TikTokOrder[] } }

  const FIELDS = [
    'id','order_status','payment_method_name','currency',
    'total_amount','sub_total','shipping_fee','seller_discount','platform_discount',
    'create_time','paid_time','update_time',
    'buyer_uid','buyer_message','line_items','recipient_address',
    'tracking_number','shipping_provider_name',
  ].join(',')

  let upsertedOrders = 0, upsertedItems = 0

  for (let i = 0; i < allOrderIds.length; i += 50) {
    const batch = allOrderIds.slice(i, i + 50)
    const detailRes = await tiktokFetch<OrderDetailResponse>(
      'GET', '/order/202309/orders', access_token, shopId,
      { ids: batch.join(','), fields: FIELDS },
    )
    if (detailRes.code !== 0) { console.error('Detail fetch failed:', detailRes.message); continue }

    for (const o of detailRes.data?.orders ?? []) {
      const addr = o.recipient_address
      const shippingAddress = addr
        ? [addr.full_address, addr.city, addr.state, addr.postal_code, addr.region_code].filter(Boolean).join(', ')
        : null

      const { error: orderErr } = await supabase
        .from('tiktok_orders')
        .upsert({
          connection_id: conn.id,
          tiktok_order_id: o.id,
          total_amount: parseFloat(o.total_amount ?? '0'),
          subtotal: parseFloat(o.sub_total ?? '0'),
          shipping_fee: parseFloat(o.shipping_fee ?? '0'),
          seller_discount: parseFloat(o.seller_discount ?? '0'),
          platform_discount: parseFloat(o.platform_discount ?? '0'),
          currency: o.currency ?? 'MYR',
          order_status: o.order_status,
          payment_method: o.payment_method_name,
          shipping_provider: o.shipping_provider_name,
          tracking_number: o.tracking_number,
          recipient_name: addr?.name,
          recipient_phone: addr?.phone_number,
          shipping_address: shippingAddress,
          shipping_address_raw: addr ?? null,
          buyer_uid: o.buyer_uid,
          buyer_message: o.buyer_message,
          paid_at: o.paid_time ? new Date(o.paid_time * 1000).toISOString() : null,
          tiktok_created_at: o.create_time ? new Date(o.create_time * 1000).toISOString() : null,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tiktok_order_id' })

      if (orderErr) { console.error('Order upsert failed', o.id, orderErr); continue }
      upsertedOrders++

      // Delete and re-insert line items for clean sync
      await supabase.from('tiktok_order_items').delete().eq('tiktok_order_id', o.id)

      const items = (o.line_items ?? []).map(item => ({
        tiktok_order_id: o.id,
        sku_id: item.sku_id,
        product_id: item.product_id,
        product_name: item.product_name,
        sku_name: item.sku_name,
        image_url: item.image_url,
        quantity: item.quantity,
        unit_price: parseFloat(item.original_price ?? '0'),
        sale_price: parseFloat(item.sale_price ?? '0'),
        total_price: parseFloat(item.sale_price ?? '0') * item.quantity,
        seller_sku: item.seller_sku,
      }))

      if (items.length > 0) {
        const { error: itemErr } = await supabase.from('tiktok_order_items').insert(items)
        if (!itemErr) upsertedItems += items.length
      }
    }
  }

  await supabase.from('tiktok_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)

  return Response.json({ synced: upsertedOrders, items: upsertedItems, total_found: allOrderIds.length, days_window: days })
}
