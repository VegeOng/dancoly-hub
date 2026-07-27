import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const today = new Date()
  const dateStr = `${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`
  
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .like('order_number', `F${dateStr}-%`)

  const seq = String((count || 0) + 1).padStart(2, '0')
  return NextResponse.json({ orderNumber: `F${dateStr}-${seq}` })
}
