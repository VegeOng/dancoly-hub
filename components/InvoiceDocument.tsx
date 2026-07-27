'use client'
import { COMPANY, Invoice, money } from '@/lib/invoice'

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

export default function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const inv = invoice
  return (
    <div className="inv-sheet">
      <style>{INVOICE_CSS}</style>

      {/* Company header */}
      <div className="inv-head">
        <div className="inv-company">
          <h1>{COMPANY.name}</h1>
          <div className="inv-reg">{COMPANY.reg}</div>
          <div className="inv-addr">
            {COMPANY.address.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>
      <hr className="inv-divider" />

      {/* Title + number */}
      <div className="inv-title-row">
        <div className="inv-t">INVOICE</div>
        <div className="inv-no"><span className="inv-lab">No. :</span> <span className="inv-val">{inv.invoice_no}</span></div>
      </div>

      {/* Bill-to + meta */}
      <div className="inv-meta">
        <div className="inv-billto">
          <span className="inv-cap">Bill To</span>
          <div className="inv-name">{inv.bill_to_name || '—'}</div>
          {inv.bill_to_address && (
            <div className="inv-line">{inv.bill_to_address.split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>
          )}
          <div className="inv-tel">Tel : {inv.bill_to_tel || '—'}　　Fax : {inv.bill_to_fax || ''}</div>
        </div>
        <div className="inv-docmeta">
          <table>
            <tbody>
              <tr><td className="k">Your Ref</td><td className="c">:</td><td className="v">{inv.your_ref || '—'}</td></tr>
              <tr><td className="k">Branch Name</td><td className="c">:</td><td className="v">{inv.branch_name || '—'}</td></tr>
              <tr><td className="k">Terms</td><td className="c">:</td><td className="v">{inv.terms || '—'}</td></tr>
              <tr><td className="k">Date</td><td className="c">:</td><td className="v">{fmtDate(inv.invoice_date)}</td></tr>
              <tr><td className="k">Page</td><td className="c">:</td><td className="v">1 of 1</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items */}
      <table className="inv-items">
        <thead>
          <tr>
            <th style={{ width: 34 }}>Item</th>
            <th style={{ width: 60 }}>Tax<br />Code</th>
            <th>Description</th>
            <th className="num" style={{ width: 66 }}>Qty</th>
            <th className="center" style={{ width: 64 }}>UOM</th>
            <th className="num" style={{ width: 82 }}>U/Price<span className="u">RM</span></th>
            <th className="num" style={{ width: 56 }}>Disc.</th>
            <th className="num" style={{ width: 92 }}>Total<span className="u">RM</span></th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}>
              <td className="item">{it.line_no}.</td>
              <td className="tax">{it.tax_code}</td>
              <td className="desc">
                <div className="en">{it.description}</div>
                {it.product_code && <div className="code">{it.product_code}</div>}
              </td>
              <td className="num">{it.qty}</td>
              <td className="center">{it.uom}</td>
              <td className="num">{money(it.unit_price)}</td>
              <td className="num">{it.discount ? money(it.discount) : '—'}</td>
              <td className="num">{money(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="inv-foot">
        <div className="inv-words">
          <div className="inv-cap2">Amount in Words</div>
          <div className="inv-wval">{inv.amount_in_words}</div>
        </div>
        <div className="inv-totbox">
          <div className="inv-totrow"><span>Subtotal</span><span className="n">RM {money(inv.subtotal)}</span></div>
          <div className="inv-totrow"><span>Discount</span><span className="n">RM {money(inv.discount_total)}</span></div>
          <div className="inv-grand">
            <span className="inv-glab">TOTAL</span>
            <span className="inv-amt"><small>RM</small>{money(inv.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="inv-notes">
        <div className="inv-bank">
          <h4>Payment</h4>
          <p>All cheques should be crossed and made payable to<br /><b>{COMPANY.payTo}</b></p>
          <p>Bank : {COMPANY.bankName}<br />A/C No : {COMPANY.bankAcc} (MYR)</p>
        </div>
        <div>
          <h4>Terms &amp; Conditions</h4>
          <p>1. Goods sold are neither returnable nor refundable.</p>
          <p>2. Payment due within terms stated above.</p>
        </div>
      </div>

      <div className="inv-sig">Computer generated, no signature required</div>
    </div>
  )
}

const INVOICE_CSS = `
.inv-sheet {
  --ink:#1a1a1a; --ink-soft:#565248; --ink-mute:#8a8479; --rule:#2a2a2a;
  --hair:#d9d5cd; --brand:#b8860b; --brand-deep:#8c6608; --total-bg:#faf6ec; --paper:#fff;
  width:210mm; max-width:100%; min-height:297mm; margin:0 auto;
  background:var(--paper); color:var(--ink); padding:15mm 15mm 12mm;
  box-shadow:0 2px 4px rgba(40,34,20,.06),0 18px 50px rgba(40,34,20,.14);
  font-family:system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
}
.inv-sheet * { box-sizing:border-box; }
.inv-head { display:block; }
.inv-company { text-align:center; }
.inv-company h1 { font-family:Georgia,"Times New Roman",serif; margin:0; font-size:19px; font-weight:700; letter-spacing:.01em; }
.inv-reg { font-size:11.5px; font-weight:700; margin-top:2px; }
.inv-addr { font-size:11px; color:var(--ink-soft); line-height:1.5; margin-top:4px; }
.inv-divider { border:0; border-top:2px solid var(--rule); margin:12px 0 0; }
.inv-title-row { display:grid; grid-template-columns:1fr auto; align-items:end; margin:14px 0 10px; }
.inv-t { font-family:Georgia,"Times New Roman",serif; font-size:26px; font-weight:700; letter-spacing:.16em; text-align:center; }
.inv-no { text-align:right; font-size:13px; }
.inv-no .inv-lab { color:var(--ink-mute); }
.inv-no .inv-val { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-weight:700; font-size:15px; letter-spacing:.03em; }
.inv-meta { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:14px; }
.inv-billto { border:1px solid var(--rule); padding:10px 12px; min-height:96px; position:relative; }
.inv-billto .inv-cap { position:absolute; top:-8px; left:10px; background:var(--paper); padding:0 6px; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-mute); }
.inv-billto .inv-name { font-weight:700; font-size:13.5px; }
.inv-billto .inv-line { font-size:11.5px; color:var(--ink-soft); line-height:1.55; margin-top:3px; }
.inv-billto .inv-tel { font-size:11.5px; margin-top:8px; }
.inv-docmeta table { width:100%; border-collapse:collapse; font-size:12px; }
.inv-docmeta td { padding:3px 0; vertical-align:top; }
.inv-docmeta td.k { color:var(--ink-mute); width:96px; }
.inv-docmeta td.c { width:12px; color:var(--ink-mute); }
.inv-docmeta td.v { font-weight:600; }
table.inv-items { width:100%; border-collapse:collapse; }
table.inv-items thead th { font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:var(--ink-mute); font-weight:600; text-align:left; padding:7px 8px; border-top:1.5px solid var(--rule); border-bottom:1px solid var(--rule); white-space:nowrap; }
table.inv-items thead th .u { display:block; font-size:9px; letter-spacing:.04em; color:var(--ink-mute); font-weight:500; }
table.inv-items tbody td { padding:9px 8px; font-size:12px; vertical-align:top; border-bottom:1px solid var(--hair); }
table.inv-items .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
table.inv-items .center { text-align:center; }
table.inv-items td.desc .en { font-weight:600; }
table.inv-items td.desc .code { color:var(--ink-soft); font-size:11.5px; margin-top:1px; }
table.inv-items td.desc .pack { display:inline-block; margin-top:4px; font-size:10px; letter-spacing:.04em; color:var(--ink-mute); font-family:ui-monospace,Menlo,monospace; border:1px solid var(--hair); border-radius:3px; padding:1px 5px; }
table.inv-items td.item { color:var(--ink-mute); font-variant-numeric:tabular-nums; }
table.inv-items td.tax { color:var(--ink-mute); font-size:11px; }
.inv-foot { display:grid; grid-template-columns:1fr 260px; gap:18px; margin-top:14px; align-items:start; }
.inv-words { border:1px solid var(--rule); padding:9px 12px; min-height:54px; }
.inv-cap2 { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-mute); }
.inv-wval { font-size:11.5px; font-weight:600; margin-top:3px; line-height:1.5; }
.inv-totrow { display:flex; justify-content:space-between; align-items:baseline; font-size:12px; padding:4px 2px; color:var(--ink-soft); }
.inv-totrow .n { font-variant-numeric:tabular-nums; }
.inv-grand { display:flex; justify-content:space-between; align-items:baseline; margin-top:6px; padding:10px 12px; background:var(--total-bg); border:1.5px solid var(--brand); border-radius:4px; }
.inv-glab { font-weight:700; font-size:13px; letter-spacing:.05em; }
.inv-amt { font-weight:700; font-size:19px; font-variant-numeric:tabular-nums; color:var(--brand-deep); }
.inv-amt small { font-size:11px; font-weight:600; color:var(--ink-mute); margin-right:3px; }
.inv-notes { margin-top:20px; border-top:1px solid var(--hair); padding-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.inv-notes h4 { margin:0 0 5px; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-mute); font-weight:600; }
.inv-notes p { margin:0 0 4px; font-size:11px; color:var(--ink-soft); line-height:1.55; }
.inv-notes .inv-bank b { color:var(--ink); }
.inv-sig { text-align:center; margin-top:22px; font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--ink-soft); }
@media (max-width:720px) {
  .inv-meta,.inv-foot,.inv-notes { grid-template-columns:1fr; }
  .inv-sheet { padding:22px 16px; }
}
@media print {
  @page { size:A4; margin:12mm; }
  nav, .inv-noprint { display:none !important; }
  body { background:#fff !important; }
  .inv-sheet { box-shadow:none; margin:0; width:auto; min-height:0; padding:0; }
}
`
