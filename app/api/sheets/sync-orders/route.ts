import { supabase } from '@/lib/supabase'

// POST /api/sheets/sync-orders
// Body: { sheetUrl: string }
// Reads a publicly-shared Google Sheet as CSV and upserts into tiktok_orders.
export async function POST(request: Request) {
  try {
    return await syncFromSheet(request)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

async function syncFromSheet(request: Request) {
  const { sheetUrl } = await request.json() as { sheetUrl: string }
  if (!sheetUrl) return Response.json({ error: 'sheetUrl is required' }, { status: 400 })

  // ── Extract Sheet ID from URL ─────────────────────────────────────────
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return Response.json({ error: 'Invalid Google Sheets URL' }, { status: 400 })
  const sheetId = match[1]

  // ── Fetch CSV from Google Sheets ──────────────────────────────────────
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  const csvRes = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) })
  if (!csvRes.ok) return Response.json({ error: `Cannot read sheet (HTTP ${csvRes.status}). Make sure it is shared as "Anyone with the link can view".` }, { status: 400 })

  const csvText = await csvRes.text()
  const rows = parseCSV(csvText)
  if (rows.length < 2) return Response.json({ synced: 0, message: 'Sheet has no data rows' })

  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map(h => h.toLowerCase().trim().replace(/[\s-]+/g, '_'))

  // ── Get active TikTok connection ──────────────────────────────────────
  const { data: conn } = await supabase
    .from('tiktok_connections')
    .select('id, currency')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Map each row to an order record ──────────────────────────────────
  const col = (...names: string[]) => {
    for (const n of names) {
      const normalized = n.toLowerCase().replace(/[\s-]+/g, '_')
      const idx = headers.indexOf(normalized)
      if (idx >= 0) return idx
    }
    return -1
  }

  const get = (row: string[], ...names: string[]) => {
    const idx = col(...names)
    return idx >= 0 ? row[idx]?.trim() || undefined : undefined
  }

  const orderRows = dataRows
    .map(row => {
      const orderId = get(row, 'order_id', 'id', 'order id', 'orderid')
      if (!orderId) return null

      const rawDate = get(row, 'created_at', 'create_time', 'created_time', 'order_date', 'date')
      const rawPaid = get(row, 'paid_at', 'paid_time', 'payment_time', 'payment_date')

      return {
        connection_id: conn?.id ?? null,
        tiktok_order_id: orderId,
        order_status: get(row, 'status', 'order_status', 'order status') ?? 'UNKNOWN',
        currency: get(row, 'currency') ?? conn?.currency ?? 'MYR',
        total_amount: parseNum(get(row, 'total_amount', 'total', 'amount', 'grand_total', 'grand total')),
        subtotal: parseNum(get(row, 'subtotal', 'sub_total', 'item_total', 'items_total')),
        shipping_fee: parseNum(get(row, 'shipping_fee', 'shipping', 'delivery_fee')),
        platform_discount: parseNum(get(row, 'platform_discount', 'platform discount')),
        seller_discount: parseNum(get(row, 'seller_discount', 'seller discount')),
        payment_method: get(row, 'payment_method', 'payment method', 'payment_type'),
        tracking_number: get(row, 'tracking_number', 'tracking number', 'tracking_no', 'awb'),
        shipping_provider: get(row, 'shipping_provider', 'logistics_provider', 'courier', 'carrier'),
        recipient_name: get(row, 'recipient_name', 'recipient', 'consignee', 'buyer_name', 'buyer name'),
        recipient_phone: get(row, 'recipient_phone', 'phone', 'mobile', 'contact'),
        shipping_address: get(row, 'shipping_address', 'address', 'delivery_address'),
        buyer_uid: get(row, 'buyer_uid', 'buyer_id', 'buyer id', 'user_id'),
        buyer_message: get(row, 'buyer_message', 'message', 'note', 'remark', 'remarks'),
        tiktok_created_at: rawDate ? parseDate(rawDate) : null,
        paid_at: rawPaid ? parseDate(rawPaid) : null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })
    .filter(Boolean)

  if (orderRows.length === 0) return Response.json({ synced: 0, message: 'No valid order rows found. Check that the sheet has an "order_id" column.' })

  // ── Upsert in batches of 100 ──────────────────────────────────────────
  let synced = 0
  for (let i = 0; i < orderRows.length; i += 100) {
    const batch = orderRows.slice(i, i + 100)
    const { error } = await supabase
      .from('tiktok_orders')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any[], { onConflict: 'tiktok_order_id' })
    if (!error) synced += batch.length
  }

  return Response.json({ synced, total_rows: dataRows.length })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(v: string | undefined): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
}

function parseDate(v: string): string | null {
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const fields: string[] = []
    let field = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(field); field = ''
      } else {
        field += ch
      }
    }
    fields.push(field)
    rows.push(fields)
  }
  return rows
}
