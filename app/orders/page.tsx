'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PRODUCTS = [
  'PL05-1 Rosemary Shampoo 400ml',
  'PL02-1 Verbena Oily Shampoo 400ml',
  'PL34-2 Iris Shampoo 800ml',
  'PL05-3 Rosemary Shampoo 800ml',
  'PL05-4 Rosemary Conditioner 800ml',
  'PL26-1 Kids Shampoo',
  'TUM05 Shampoo 600ml',
  'TUM05 Conditioner 600ml',
  'G-03 Tonic',
  'GE-03 Essential',
  'Other (custom)',
]

const GIFTS = [
  '头皮按摩梳',
  'Sample Pack 3套',
  '掉发自救指南',
  'RM100 Voucher',
  '头皮 Consultation',
  'Sample Set',
  'Other',
]

type ProductLine = {
  product: string
  customProduct: string
  quantity: number
}

type Order = {
  id: string
  order_number: string
  order_code: string
  quantity: number
  total_amount: number
  discount: number
  gift: string
  payment_status: string
  notes: string
  payment_proof_url: string
  delivery_address: string
  created_at: string
  customers: { name: string; phone: string; customer_type: string }
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_source: 'new',
    order_code: '',
    total_amount: '',
    discount: '',
    notes: '',
    delivery_address: '',
    payment_status: 'pending',
  })
  const [productLines, setProductLines] = useState<ProductLine[]>([
    { product: PRODUCTS[0], customProduct: '', quantity: 1 }
  ])
  const [selectedGifts, setSelectedGifts] = useState<string[]>([])
  const [otherGift, setOtherGift] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name, phone, customer_type)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '无法连接数据库')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  function addProductLine() {
    setProductLines([...productLines, { product: PRODUCTS[0], customProduct: '', quantity: 1 }])
  }

  function removeProductLine(index: number) {
    setProductLines(productLines.filter((_, i) => i !== index))
  }

  function updateProductLine(index: number, field: keyof ProductLine, value: string | number) {
    const updated = [...productLines]
    updated[index] = { ...updated[index], [field]: value }
    setProductLines(updated)
  }

  function toggleGift(gift: string) {
    setSelectedGifts(prev =>
      prev.includes(gift) ? prev.filter(g => g !== gift) : [...prev, gift]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    const url = URL.createObjectURL(file)
    setPdfPreview(url)
  }

  function getAllGifts() {
    const gifts = selectedGifts.filter(g => g !== 'Other')
    if (selectedGifts.includes('Other') && otherGift) {
      gifts.push(otherGift)
    }
    return gifts.join(', ')
  }

  async function addOrder() {
    if (!form.customer_name) return alert('Please enter customer name')
    if (!form.order_code) return alert('Please enter order code')
    if (!form.total_amount) return alert('Please enter total amount')
    if (!pdfFile) return alert('Please upload payment proof')
    if (!form.delivery_address) return alert('Please enter delivery address')

    setUploading(true)

    try {
      const res = await fetch('/api/order-number')
      if (!res.ok) throw new Error('无法生成订单号,请重试')
      const { orderNumber } = await res.json()

      const fileName = `${orderNumber}-${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, pdfFile, { contentType: pdfFile.type })
      if (uploadError) throw new Error(`付款凭证上传失败:${uploadError.message}`)

      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)

      const pdfUrl = urlData?.publicUrl || ''

      const productSummary = productLines
        .map(p => `${p.product === 'Other (custom)' ? p.customProduct : p.product} x${p.quantity}`)
        .join(', ')

      let customer = null
      const { data: existing, error: lookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('name', form.customer_name)
        .maybeSingle()
      if (lookupError) throw new Error(`查询客户失败:${lookupError.message}`)

      if (existing) {
        customer = existing
        if (form.customer_source === 'returning') {
          await supabase.from('customers').update({ customer_type: 'returning' }).eq('id', existing.id)
        }
      } else {
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({ name: form.customer_name, customer_type: form.customer_source })
          .select()
          .single()
        if (custError) throw new Error(`新增客户失败:${custError.message}`)
        customer = newCustomer
      }

      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        order_number: orderNumber,
        order_code: form.order_code,
        customer_id: customer.id,
        quantity: productLines.reduce((sum, p) => sum + p.quantity, 0),
        unit_price: 0,
        total_amount: parseFloat(form.total_amount),
        discount: parseFloat(form.discount || '0'),
        gift: getAllGifts(),
        notes: `Products: ${productSummary}${form.notes ? ' | Notes: ' + form.notes : ''}`,
        payment_status: form.payment_status,
        payment_proof_url: pdfUrl,
        delivery_address: form.delivery_address,
      }).select('*, customers(name, phone, customer_type)').single()
      if (orderError) throw new Error(`保存订单失败:${orderError.message}`)

      setCompletedOrder(newOrder)
      setForm({ customer_name: '', customer_source: 'new', order_code: '', total_amount: '', discount: '', notes: '', delivery_address: '', payment_status: 'pending' })
      setProductLines([{ product: PRODUCTS[0], customProduct: '', quantity: 1 }])
      setSelectedGifts([])
      setOtherGift('')
      setPdfFile(null)
      setPdfPreview(null)
      setShowForm(false)
      loadOrders()
    } catch (err) {
      alert(err instanceof Error ? err.message : '开单失败,请检查网络后重试')
    } finally {
      setUploading(false)
    }
  }

  function generateMessage(order: Order) {
    const products = order.notes?.replace('Products: ', '').split(' | Notes:')[0] || '-'
    const notes = order.notes?.includes('| Notes:') ? order.notes.split('| Notes: ')[1] : '-'
    const final = (order.total_amount - (order.discount || 0)).toFixed(2)
    return `🛍️ NEW ORDER

Order Code: ${order.order_code || '-'}
Date: ${new Date(order.created_at).toLocaleDateString('en-MY')}

👤 Customer Info
Name: ${order.customers?.name}
Type: ${order.customers?.customer_type === 'returning' ? 'Repeat Customer' : 'New Customer'}

📦 Products
${products.split(', ').map((p: string) => `- ${p}`).join('\n')}

🎁 Gifts
${order.gift ? order.gift.split(', ').map((g: string) => `- ${g}`).join('\n') : '- None'}

💰 Payment
Total: RM ${order.total_amount}
Discount: RM ${order.discount || 0}
Final: RM ${final}

📍 Delivery Address
${order.delivery_address || '-'}

💳 Payment Proof
${order.payment_proof_url}

📝 Notes
${notes}`
  }

  function copyMessage(order: Order) {
    navigator.clipboard.writeText(generateMessage(order))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function sendWhatsApp(order: Order) {
    const msg = encodeURIComponent(generateMessage(order))
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ payment_status: status }).eq('id', id)
    loadOrders()
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    paid: 'bg-green-50 text-green-700',
    overdue: 'bg-red-50 text-red-700',
  }
  const statusLabel: Record<string, string> = {
    pending: 'Pending', paid: 'Paid', overdue: 'Overdue'
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📋 Orders</h1>

      {completedOrder && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800">✅ Order Created Successfully!</h3>
            <button onClick={() => setCompletedOrder(null)} className="text-green-400 hover:text-green-600 text-xl">×</button>
          </div>
          <pre className="bg-white rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap border border-green-100 mb-4">
            {generateMessage(completedOrder)}
          </pre>
          <div className="flex gap-3">
            <button onClick={() => copyMessage(completedOrder)} className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium">
              {copied ? '✅ Copied!' : '📋 Copy Message'}
            </button>
            <button onClick={() => sendWhatsApp(completedOrder)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              📲 Send to Dispatch (WhatsApp)
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between mb-4">
          <h2 className="font-medium">All Orders</h2>
          <button onClick={() => setShowForm(!showForm)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + New Order
          </button>
        </div>

        {showForm && (
          <div className="bg-amber-50 rounded-xl p-5 mb-6 space-y-5">

            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Customer Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Customer Name *" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} />
                <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.customer_source} onChange={e => setForm({...form, customer_source: e.target.value})}>
                  <option value="new">New Customer</option>
                  <option value="returning">Repeat Customer</option>
                </select>
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" placeholder="Order Code * (e.g. DC-001)" value={form.order_code} onChange={e => setForm({...form, order_code: e.target.value})} />
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Products</h3>
              <div className="space-y-2">
                {productLines.map((line, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={line.product} onChange={e => updateProductLine(index, 'product', e.target.value)}>
                      {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {line.product === 'Other (custom)' && (
                      <input className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Product name" value={line.customProduct} onChange={e => updateProductLine(index, 'customProduct', e.target.value)} />
                    )}
                    <input type="number" min="1" className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={line.quantity} onChange={e => updateProductLine(index, 'quantity', parseInt(e.target.value))} />
                    {productLines.length > 1 && (
                      <button onClick={() => removeProductLine(index)} className="text-red-400 hover:text-red-600 text-xl">×</button>
                    )}
                  </div>
                ))}
                <button onClick={addProductLine} className="text-amber-600 hover:text-amber-800 text-sm font-medium">+ Add Product</button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Amount</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Total Amount (RM) *</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Discount (RM)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Final Amount (RM)</label>
                  <div className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm font-semibold text-amber-700">
                    RM {form.total_amount && !isNaN(parseFloat(form.total_amount))
                      ? (parseFloat(form.total_amount) - parseFloat(form.discount || '0')).toFixed(2)
                      : '0.00'}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Payment Status</h3>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48" value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Gifts */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Gifts</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {GIFTS.map(gift => (
                  <div key={gift}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedGifts.includes(gift)} onChange={() => toggleGift(gift)} className="accent-amber-500" />
                      {gift}
                    </label>
                    {gift === 'Other' && selectedGifts.includes('Other') && (
                      <input
                        className="mt-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full"
                        placeholder="Specify gift..."
                        value={otherGift}
                        onChange={e => setOtherGift(e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Delivery Address *</h3>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Full delivery address..." value={form.delivery_address} onChange={e => setForm({...form, delivery_address: e.target.value})} />
            </div>

            {/* Payment Proof */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Payment Proof *</h3>
              <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-amber-300 rounded-xl px-6 py-4 text-sm text-amber-600 hover:bg-amber-100 w-full">
                {pdfFile ? `✅ ${pdfFile.name}` : '📎 Click to upload PDF or Image'}
              </button>
              {pdfPreview && pdfFile?.type === 'application/pdf' && (
                <iframe src={pdfPreview} className="w-full h-64 mt-3 rounded-lg border border-gray-200" />
              )}
              {pdfPreview && pdfFile?.type !== 'application/pdf' && (
                <img src={pdfPreview} alt="Payment proof" className="w-full max-h-64 object-contain mt-3 rounded-lg border border-gray-200" />
              )}
            </div>

            {/* Notes */}
            <div>
              <h3 className="font-semibold text-amber-800 mb-3">Notes</h3>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Additional notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={addOrder} disabled={uploading} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Submit Order'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium mb-1">⚠️ 无法加载订单</p>
            <p className="text-gray-400 text-xs mb-3">{loadError}</p>
            <button onClick={loadOrders} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm">
              重试
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b text-left">
                <th className="pb-2">Order Code</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Discount</th>
                <th className="pb-2">Final</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-mono text-xs text-gray-500">{o.order_code || o.order_number}</td>
                  <td className="py-2 font-medium">{o.customers?.name}</td>
                  <td className="py-2 text-gray-400 text-xs">RM {o.total_amount}</td>
                  <td className="py-2 text-gray-400 text-xs">RM {o.discount || 0}</td>
                  <td className="py-2 font-semibold text-amber-700">RM {(o.total_amount - (o.discount || 0)).toFixed(2)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[o.payment_status]}`}>
                      {statusLabel[o.payment_status]}
                    </span>
                  </td>
                  <td className="py-2 flex gap-2 items-center">
                    <select className="text-xs border border-gray-200 rounded px-1 py-0.5" value={o.payment_status} onChange={e => updateStatus(o.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    <button onClick={() => sendWhatsApp(o)} className="text-green-500 hover:text-green-700 text-lg" title="Send to Dispatch">📲</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
