// Company (seller) — THE CUT MARKETING
export const COMPANY = {
  name: 'THE CUT MARKETING',
  reg: '202403098577 (IP0595704-M)',
  address: ['No 598, Lorong Kemuning 1, Taman Kemuning,', '09000 Kulim, Kedah, Malaysia.'],
  bankName: 'OCBC BANK (M) BHD',
  bankAcc: '7311299722',
  payTo: 'THE CUT MARKETING',
}

export const DEFAULT_TERMS = 'Net 30 days'
export const UOM_OPTIONS = ['UNIT', 'BTL', 'BOX', 'PKT', 'CTN', 'SET', 'PCS']

export type InvoiceItem = {
  line_no: number
  tax_code: string
  description: string
  product_code: string
  qty: number
  uom: string
  unit_price: number
  discount: number
  line_total: number
}

export type Invoice = {
  id?: string
  invoice_no: number
  invoice_date: string
  bill_to_name: string
  bill_to_address: string
  bill_to_tel: string
  bill_to_fax: string
  your_ref: string
  branch_name: string
  terms: string
  subtotal: number
  discount_total: number
  total: number
  amount_in_words: string
  items: InvoiceItem[]
}

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION']

function threeDigits(n: number): string {
  let s = ''
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + ' HUNDRED'
    n %= 100
    if (n) s += ' '
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)]
    n %= 10
    if (n) s += ' ' + ONES[n]
  } else if (n > 0) {
    s += ONES[n]
  }
  return s
}

function intToWords(n: number): string {
  if (n === 0) return 'ZERO'
  const parts: string[] = []
  let i = 0
  while (n > 0) {
    const chunk = n % 1000
    if (chunk) parts.unshift(threeDigits(chunk) + (SCALES[i] ? ' ' + SCALES[i] : ''))
    n = Math.floor(n / 1000)
    i++
  }
  return parts.join(' ')
}

// 3388.80 -> "RINGGIT MALAYSIA THREE THOUSAND THREE HUNDRED EIGHTY EIGHT AND CENTS EIGHTY ONLY"
export function amountInWords(amount: number): string {
  const rounded = Math.round((amount || 0) * 100)
  const ringgit = Math.floor(rounded / 100)
  const cents = rounded % 100
  let w = 'RINGGIT MALAYSIA ' + intToWords(ringgit)
  if (cents > 0) w += ' AND CENTS ' + intToWords(cents)
  return w + ' ONLY'
}

export function money(n: number): string {
  return (n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
