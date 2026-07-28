import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COMPANY, Invoice, money } from '@/lib/invoice'

const INK: [number, number, number] = [26, 26, 26]
const SOFT: [number, number, number] = [86, 82, 72]
const MUTE: [number, number, number] = [138, 132, 121]
const GOLD: [number, number, number] = [184, 134, 11]
const GOLD_DEEP: [number, number, number] = [140, 102, 8]
const GOLD_FILL: [number, number, number] = [250, 246, 236]
const HAIR: [number, number, number] = [217, 213, 205]

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

export function downloadInvoicePdf(inv: Invoice) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const L = 15
  const R = 195
  const CX = W / 2

  // ---- Company header (centered) ----
  doc.setFont('times', 'bold').setFontSize(15).setTextColor(...INK)
  doc.text(COMPANY.name, CX, 20, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(9)
  doc.text(COMPANY.reg, CX, 25, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text(COMPANY.address[0], CX, 29.5, { align: 'center' })
  doc.text(COMPANY.address[1], CX, 33.5, { align: 'center' })

  // rule
  doc.setDrawColor(...INK).setLineWidth(0.6).line(L, 38, R, 38)

  // ---- Title + number ----
  doc.setFont('times', 'bold').setFontSize(21).setTextColor(...INK)
  doc.text('INVOICE', CX, 48, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTE)
  doc.text('No. :', R - 34, 48)
  doc.setFont('courier', 'bold').setFontSize(13).setTextColor(...INK)
  doc.text(String(inv.invoice_no), R, 48, { align: 'right' })

  // ---- Bill To box + meta ----
  const boxY = 54
  const boxH = 30
  doc.setDrawColor(...INK).setLineWidth(0.3).rect(L, boxY, 90, boxH)
  doc.setFillColor(255, 255, 255).rect(L + 3, boxY - 2, 16, 4, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTE)
  doc.text('BILL TO', L + 4, boxY + 1)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK)
  doc.text(inv.bill_to_name || '-', L + 4, boxY + 7)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  let by = boxY + 12
  const addrLines = (inv.bill_to_address || '')
    .split('\n')
    .filter(Boolean)
    .flatMap(line => doc.splitTextToSize(line, 82) as string[])
    .slice(0, 3)
  addrLines.forEach(line => { doc.text(line, L + 4, by); by += 4 })
  doc.text(`Tel : ${inv.bill_to_tel || '-'}     Fax : ${inv.bill_to_fax || ''}`, L + 4, boxY + boxH - 3)

  // meta right
  const mx = 118
  const rows: [string, string][] = [
    ['Your Ref', inv.your_ref || '-'],
    ['Terms', inv.terms || '-'],
    ['Date', fmtDate(inv.invoice_date)],
    ['Page', '1 of 1'],
  ]
  let my = boxY + 3
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTE)
    doc.text(k, mx, my)
    doc.text(':', mx + 26, my)
    doc.setFont('helvetica', 'bold').setTextColor(...INK)
    doc.text(v, mx + 30, my)
    my += 5.5
  })

  // ---- Items table ----
  autoTable(doc, {
    startY: boxY + boxH + 6,
    margin: { left: L, right: 15 },
    tableWidth: R - L,
    head: [['Item', 'Description', 'Qty', 'UOM', 'U/Price\nRM', 'Disc.', 'Total\nRM']],
    body: inv.items.map(it => [
      `${it.line_no}.`,
      it.product_code ? `${it.description}\n${it.product_code}` : it.description,
      String(it.qty),
      it.uom,
      money(it.unit_price),
      it.discount ? money(it.discount) : '-',
      money(it.line_total),
    ]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: INK, lineColor: HAIR, lineWidth: { bottom: 0.1 } },
    headStyles: { fontSize: 8, fontStyle: 'bold', textColor: MUTE, lineColor: INK, lineWidth: { top: 0.4, bottom: 0.3 }, valign: 'bottom' },
    columnStyles: {
      0: { cellWidth: 10, textColor: MUTE },
      1: { cellWidth: 74 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
    },
  })

  // ---- Totals ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY as number
  let ty = finalY + 6

  // amount in words box (left)
  doc.setDrawColor(...INK).setLineWidth(0.3).rect(L, ty, 100, 18)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTE)
  doc.text('AMOUNT IN WORDS', L + 3, ty + 4)
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK)
  doc.text(doc.splitTextToSize(inv.amount_in_words || '', 94), L + 3, ty + 9)

  // right totals
  const rl = 125
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...SOFT)
  doc.text('Subtotal', rl, ty + 3)
  doc.text(`RM ${money(inv.subtotal)}`, R, ty + 3, { align: 'right' })
  doc.text('Discount', rl, ty + 9)
  doc.text(`RM ${money(inv.discount_total)}`, R, ty + 9, { align: 'right' })

  // TOTAL box
  const gy = ty + 13
  doc.setFillColor(...GOLD_FILL).setDrawColor(...GOLD).setLineWidth(0.5).rect(rl - 3, gy, R - rl + 3, 11, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK)
  doc.text('TOTAL', rl, gy + 7)
  doc.setFontSize(13).setTextColor(...GOLD_DEEP)
  doc.text(`RM ${money(inv.total)}`, R - 2, gy + 7.2, { align: 'right' })

  // ---- Notes ----
  let ny = ty + 30
  doc.setDrawColor(...HAIR).setLineWidth(0.2).line(L, ny - 4, R, ny - 4)
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...MUTE)
  doc.text('PAYMENT', L, ny)
  doc.text('TERMS & CONDITIONS', 112, ny)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...SOFT)
  doc.text('All cheques should be crossed and made payable to', L, ny + 5)
  doc.setFont('helvetica', 'bold').setTextColor(...INK)
  doc.text(COMPANY.payTo, L, ny + 9)
  doc.setFont('helvetica', 'normal').setTextColor(...SOFT)
  doc.text(`Bank : ${COMPANY.bankName}`, L, ny + 14)
  doc.text(`A/C No : ${COMPANY.bankAcc} (MYR)`, L, ny + 18)
  doc.text('1. Goods sold are neither returnable nor refundable.', 112, ny + 5)
  doc.text('2. Payment due within terms stated above.', 112, ny + 9)

  // sign-off
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...SOFT)
  doc.text('Computer generated, no signature required', CX, ny + 30, { align: 'center' })

  doc.save(`Invoice-${inv.invoice_no}.pdf`)
}
