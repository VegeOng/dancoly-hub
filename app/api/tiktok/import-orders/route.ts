import { supabase } from '@/lib/supabase'
import { type TikTokOrder } from '@/lib/tiktok'

// POST /api/tiktok/import-orders
// Called by Make.com after it fetches full order data from TikTok API.
// Body: { orders: TikTokOrder[] }
export async function POST(request: Request) {
  try {
    return await importOrders(request)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

async function importOrders(request: Request) {
  const { orders } = (await request.json()) as { orders: TikTokOrder[] }
  if (!Array.isArray(orders) || orders.length === 0) {
    return Response.json({ synced: 0, items: 0 })
  }

  const { data: conn } = await supabase
    .from('tiktok_connections')
    .select('id, currency')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orderRows = orders.map(o => {
    const addr = o.recipient_address
    return {
      connection_id: (conn as { id: string } | null)?.id ?? null,
      tiktok_order_id: o.id,
      total_amount: parseFloat(o.total_amount ?? '0'),
      subtotal: parseFloat(o.sub_total ?? '0'),
      shipping_fee: parseFloat(o.shipping_fee ?? '0'),
      seller_discount: parseFloat(o.seller_discount ?? '0'),
      platform_discount: parseFloat(o.platform_discount ?? '0'),
      currency: o.currency ?? (conn as { currency: string } | null)?.currency ?? 'MYR',
      order_status: o.order_status,
      payment_method: o.payment_method_name,
      shipping_provider: o.shipping_provider_name,
      tracking_number: o.tracking_number,
      recipient_name: addr?.name,
      recipient_phone: addr?.phone_number,
      shipping_address: addr
        ? [addr.full_address, addr.city, addr.state, addr.postal_code, addr.region_code]
            .filter(Boolean)
            .join(', ')
        : null,
      shipping_address_raw: addr ?? null,
      buyer_uid: o.buyer_uid,
      buyer_message: o.buyer_message,
      paid_at: o.paid_time ? new Date(o.paid_time * 1000).toISOString() : null,
      tiktok_created_at: o.create_time ? new Date(o.create_time * 1000).toISOString() : null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  const { error: orderErr } = await supabase
    .from('tiktok_orders')
    .upsert(orderRows, { onConflict: 'tiktok_order_id' })

  if (orderErr) {
    return Response.json({ error: 'DB upsert failed', detail: orderErr.message }, { status: 500 })
  }

  const orderIds = orders.map(o => o.id)
  await supabase.from('tiktok_order_items').delete().in('tiktok_order_id', orderIds)

  const allItems = orders.flatMap(o =>
    (o.line_items ?? []).map(item => ({
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
  )

  let itemsInserted = 0
  if (allItems.length > 0) {
    const { error: itemErr } = await supabase.from('tiktok_order_items').insert(allItems)
    if (!itemErr) itemsInserted = allItems.length
  }

  if ((conn as { id: string } | null)?.id) {
    await supabase
      .from('tiktok_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', (conn as { id: string }).id)
  }

  return Response.json({ synced: orderRows.length, items: itemsInserted })
}
