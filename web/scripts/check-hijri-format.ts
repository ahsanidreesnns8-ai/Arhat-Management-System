import { formatHijri, urduDigits } from '../src/lib/hijri'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

assert(urduDigits(1448) === '۱۴۴۸', `1448 must stay ۱۴۴۸, got ${urduDigits(1448)}`)
assert(urduDigits(0) === '۰', 'zero mapping')
assert(urduDigits(1234567890) === '۱۲۳۴۵۶۷۸۹۰', 'full digit map')
assert(
  formatHijri({ day: 4, month: 3, year: 1448 }, 'ur').includes('۱۴۴۸'),
  'Urdu Hijri year must match English year',
)
assert(
  formatHijri({ day: 4, month: 3, year: 1448 }, 'en').includes('1448'),
  'English Hijri year',
)
console.log('hijri digits OK')
