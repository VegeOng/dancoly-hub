import { type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/tiktok/webhook
// TikTok Shop pushes order events here in real-time.
// Docs: https://partner.tiktokshop.com/docv2/page/650a3023defece02be8f7c81
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Parse the event payload
  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = event.type as number
  const shopId = event.shop_id as string
  const data = event.data as Record<string, unknown> | undefined

  // ── Find the connection for this shop ─────────────────────────────────
  const { data: conn } = await supabase
    .from('tiktok_connections')
    .select('id, currency')
    .eq('shop_id', shopId)
    .maybeSingle()

  // Even without a matched connection, acknowledge receipt to TikTok
  if (!conn || !data) {
    return Response.json({ code: 0, message: 'ok' })
  }

  // ── Order status change (type=1) and new order (type=2) ───────────────
  // Reference: TikTok order event types
  if (type === 1 || type === 2) {
    const orderId = (data.order_id ?? data.id) as string | undefined
    if (!orderId) return Response.json({ code: 0, message: 'ok' })

    const orderStatus = data.order_status as string | undefined
    const updateTime = data.update_time as number | undefined

    await supabase
      .from('tiktok_orders')
      .upsert(
        {
          connection_id: conn.id,
          tiktok_order_id: orderId,
          order_status: orderStatus,
          currency: (data.currency as string) ?? conn.currency ?? 'MYR',
          total_amount: parseFloat((data.payment_info as Record<string, string>)?.total_amount ?? '0'),
          updated_at: updateTime ? new Date(updateTime * 1000).toISOString() : new Date().toISOString(),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'tiktok_order_id', ignoreDuplicates: false },
      )
  }

  // Always respond 200 with code:0 so TikTok stops retrying
  return Response.json({ code: 0, message: 'ok' })
}

// GET /api/tiktok/webhook — TikTok endpoint verification
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  if (challenge) {
    return new Response(challenge, { headers: { 'content-type': 'text/plain' } })
  }
  return Response.json({ status: 'webhook endpoint active' })
}
