'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import InvoiceDocument from '@/components/InvoiceDocument'
import { downloadInvoicePdf } from '@/lib/invoicePdf'
import {
  amountInWords, money, DEFAULT_TERMS, UOM_OPTIONS,
  type Invoice, type InvoiceItem,
} from '@/lib/invoice'

type FormItem = {
  description: string
  product_code: string
  qty: string
  uom: string
  unit_price: string
  discount: string
}

const blankItem = (): FormItem => ({
  description: '', product_code: '',
  qty: '1', uom: 'UNIT', unit_price: '', discount: '',
})

type ListRow = {
  id: string
  invoice_no: number
  invoice_date: string
  bill_to_name: string
  total: number
}

const num = (s: string) => parseFloat(s) || 0
const lineTotal = (it: FormItem) => num(it.qty) * num(it.unit_price) - num(it.discount)

const blankForm = () => ({
  bill_to_name: '', bill_to_address: '', bill_to_tel: '', bill_to_fax: '',
  terms: DEFAULT_TERMS,
  invoice_date: new Date().toISOString().slice(0, 10),
})

export default function Orders() {
  const [view, setView] = useState<'list' | 'form' | 'invoice'>('list')
  const [rows, setRows] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState<Invoice | null>(null)

  // edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNo, setEditingNo] = useState<number | null>(null)

  const [form, setForm] = useState(blankForm())
  const [items, setItems] = useState<FormItem[]>([blankItem()])

  useEffect(() => { loadList() }, [])

  async function loadList() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_no, invoice_date, bill_to_name, total')
        .order('invoice_no', { ascending: false })
      if (error) throw error
      setRows(data || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '无法连接数据库')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.unit_price), 0)
  const discountTotal = items.reduce((s, it) => s + num(it.discount), 0)
  const total = subtotal - discountTotal

  function updateItem(i: number, field: keyof FormItem, value: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }
  const addItem = () => setItems(prev => [...prev, blankItem()])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  function resetForm() {
    setForm(blankForm())
    setItems([blankItem()])
    setEditingId(null)
    setEditingNo(null)
  }

  async function saveInvoice() {
    if (!form.bill_to_name.trim()) return alert('Please fill in Bill To name')
    const valid = items.filter(it => it.description.trim())
    if (valid.length === 0) return alert('Please add at least one item')

    setSaving(true)
    try {
      const words = amountInWords(total)
      const payload = {
        bill_to_name: form.bill_to_name.trim(),
        bill_to_address: form.bill_to_address.trim(),
        bill_to_tel: form.bill_to_tel.trim(),
        bill_to_fax: form.bill_to_fax.trim(),
        terms: form.terms.trim(),
        invoice_date: form.invoice_date,
        subtotal, discount_total: discountTotal, total,
        amount_in_words: words,
      }

      let invId: string
      let invNo: number

      if (editingId) {
        // UPDATE existing invoice
        const { error } = await supabase.from('invoices').update(payload).eq('id', editingId)
        if (error) throw error
        invId = editingId
        invNo = editingNo!
        // replace all items
        await supabase.from('invoice_items').delete().eq('invoice_id', editingId)
      } else {
        // INSERT new invoice
        const { data: inv, error } = await supabase.from('invoices').insert(payload).select().single()
        if (error) throw error
        invId = inv.id
        invNo = inv.invoice_no
      }

      const itemsPayload = valid.map((it, i) => ({
        invoice_id: invId, line_no: i + 1,
        description: it.description.trim(), product_code: it.product_code.trim(),
        qty: num(it.qty), uom: it.uom,
        unit_price: num(it.unit_price), discount: num(it.discount), line_total: lineTotal(it),
      }))
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload)
      if (itemsError) throw itemsError

      const built: Invoice = {
        id: invId,
        invoice_no: invNo,
        ...payload,
        items: itemsPayload.map(p => ({ ...p } as InvoiceItem)),
      }
      setCurrent(built)
      setView('invoice')
      resetForm()
      loadList()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存发票失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function openInvoice(id: string) {
    try {
      const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (error) throw error
      const { data: its, error: e2 } = await supabase
        .from('invoice_items').select('*').eq('invoice_id', id).order('line_no')
      if (e2) throw e2
      setCurrent({ ...inv, items: (its || []) as InvoiceItem[] })
      setView('invoice')
    } catch (err) {
      alert(err instanceof Error ? err.message : '无法打开发票')
    }
  }

  async function openEdit(id: string) {
    try {
      const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (error) throw error
      const { data: its, error: e2 } = await supabase
        .from('invoice_items').select('*').eq('invoice_id', id).order('line_no')
      if (e2) throw e2

      setForm({
        bill_to_name: inv.bill_to_name || '',
        bill_to_address: inv.bill_to_address || '',
        bill_to_tel: inv.bill_to_tel || '',
        bill_to_fax: inv.bill_to_fax || '',
        terms: inv.terms || DEFAULT_TERMS,
        invoice_date: inv.invoice_date || new Date().toISOString().slice(0, 10),
      })
      setItems(
        (its || []).length > 0
          ? (its || []).map(it => ({
              description: it.description || '',
              product_code: it.product_code || '',
              qty: String(it.qty ?? 1),
              uom: it.uom || 'UNIT',
              unit_price: String(it.unit_price ?? 0),
              discount: String(it.discount ?? 0),
            }))
          : [blankItem()]
      )
      setEditingId(id)
      setEditingNo(inv.invoice_no)
      setView('form')
    } catch (err) {
      alert(err instanceof Error ? err.message : '无法加载发票')
    }
  }

  // ---------- Invoice view ----------
  if (view === 'invoice' && current) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <div className="inv-noprint flex flex-wrap gap-3 mb-4">
          <button onClick={() => current && downloadInvoicePdf(current)} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
            ⬇ Download PDF
          </button>
          <button onClick={() => window.print()} className="border border-amber-600 text-amber-700 hover:bg-amber-50 px-5 py-2 rounded-lg text-sm font-medium">
            🖨 Print
          </button>
          <button
            onClick={() => current && openEdit(current.id!)}
            className="border border-gray-400 text-gray-700 hover:bg-gray-50 px-5 py-2 rounded-lg text-sm font-medium"
          >
            ✎ Edit
          </button>
          <button onClick={() => { setCurrent(null); setView('list') }} className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm">
            ← Back to list
          </button>
        </div>
        <InvoiceDocument invoice={current} />
      </main>
    )
  }

  // ---------- Form view ----------
  if (view === 'form') {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold">
            {editingId ? `Edit Invoice #${editingNo}` : 'New Invoice'}
          </h1>
          <button onClick={() => { resetForm(); setView('list') }} className="text-sm text-gray-500 hover:text-gray-800">✕ Cancel</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-6">
          {/* Bill To + meta */}
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <h3 className="font-semibold text-amber-800 mb-2 text-sm uppercase tracking-wide">Bill To</h3>
              <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full mb-2" placeholder="Customer name *" value={form.bill_to_name} onChange={e => setForm({ ...form, bill_to_name: e.target.value })} />
              <textarea className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full mb-2" rows={2} placeholder="Address" value={form.bill_to_address} onChange={e => setForm({ ...form, bill_to_address: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Tel" value={form.bill_to_tel} onChange={e => setForm({ ...form, bill_to_tel: e.target.value })} />
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Fax" value={form.bill_to_fax} onChange={e => setForm({ ...form, bill_to_fax: e.target.value })} />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 mb-2 text-sm uppercase tracking-wide">Invoice Details</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Date
                  <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full mt-1" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
                </label>
                <label className="text-xs text-gray-500 col-span-2">Terms
                  <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full mt-1" value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} />
                </label>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <h3 className="font-semibold text-amber-800 mb-2 text-sm uppercase tracking-wide">Items</h3>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/60">
                  <div className="flex gap-2 items-start">
                    <span className="text-xs text-gray-400 pt-2 w-4">{i + 1}.</span>
                    <div className="flex-1 grid gap-2">
                      <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Description *" value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="Product code" value={it.product_code} onChange={e => updateItem(i, 'product_code', e.target.value)} />
                        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" value={it.uom} onChange={e => updateItem(i, 'uom', e.target.value)}>
                          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                        <label className="text-xs text-gray-500">Qty
                          <input type="number" min="0" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full mt-0.5 bg-white" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} />
                        </label>
                        <label className="text-xs text-gray-500">Unit Price (RM)
                          <input type="number" min="0" step="0.01" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full mt-0.5 bg-white" placeholder="0.00" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                        </label>
                        <label className="text-xs text-gray-500">Disc. (RM)
                          <input type="number" min="0" step="0.01" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full mt-0.5 bg-white" placeholder="0.00" value={it.discount} onChange={e => updateItem(i, 'discount', e.target.value)} />
                        </label>
                        <div className="text-xs text-gray-500">Line Total
                          <div className="font-semibold text-amber-700 text-sm mt-1.5">RM {money(lineTotal(it))}</div>
                        </div>
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xl leading-none pt-1" title="Remove">×</button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="text-amber-600 hover:text-amber-800 text-sm font-medium">+ Add item</button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1 text-gray-500"><span>Subtotal</span><span>RM {money(subtotal)}</span></div>
              <div className="flex justify-between py-1 text-gray-500"><span>Discount</span><span>RM {money(discountTotal)}</span></div>
              <div className="flex justify-between py-2 mt-1 border-t border-gray-200 font-bold text-amber-800"><span>TOTAL</span><span>RM {money(total)}</span></div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={saveInvoice} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Invoice'}
            </button>
            <button onClick={() => { resetForm(); setView('list') }} className="border border-gray-300 px-4 py-2.5 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      </main>
    )
  }

  // ---------- List view ----------
  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🧾 Invoices</h1>
        <button onClick={() => { resetForm(); setView('form') }} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading…</p>
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium mb-1">⚠️ 无法加载发票</p>
            <p className="text-gray-400 text-xs mb-3">{loadError}</p>
            <button onClick={loadList} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm">重试</button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No invoices yet. Click "+ New Invoice" to create one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b text-left">
                <th className="pb-2 font-medium">No.</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Bill To</th>
                <th className="pb-2 font-medium text-right">Total (RM)</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2.5 font-mono font-semibold">{r.invoice_no}</td>
                  <td className="py-2.5 text-gray-500">{r.invoice_date?.split('-').reverse().join('/')}</td>
                  <td className="py-2.5 font-medium">{r.bill_to_name}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-amber-700">{money(r.total)}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => openInvoice(r.id)} className="text-amber-600 hover:text-amber-800 font-medium">View →</button>
                      <button onClick={() => openEdit(r.id)} className="text-gray-500 hover:text-gray-800 font-medium">✎ Edit</button>
                    </div>
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
