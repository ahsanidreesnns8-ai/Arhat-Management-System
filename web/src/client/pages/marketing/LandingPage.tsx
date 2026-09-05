import { Link } from 'react-router-dom'
import {
  Scale, BookOpen, Warehouse, FileText, ArrowRight,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { GHALLA_MANDI_EN, GHALLA_MANDI_UR } from '@/lib/branding'

const FEATURES = [
  {
    icon: Scale,
    tone: 'bg-sky-100 text-sky-700',
    en: 'Daily Trade',
    ur: 'روزانہ تجارت',
    dEn: 'Receive dheris, sell bags, and keep Extra KG stock in one desk.',
    dUr: 'ڈھیری آمد، بوری فروخت، اور اضافی کلو اسٹاک ایک جگہ۔',
  },
  {
    icon: BookOpen,
    tone: 'bg-emerald-100 text-emerald-700',
    en: 'Arhat Register',
    ur: 'آرھٹ رجسٹر',
    dEn: 'Give and receive by farmer or buyer ID — no missing accounts.',
    dUr: 'کسان یا خریدار کی آئی ڈی پر دینا اور لینا — کوئی کھاتہ نہ چھوٹے۔',
  },
  {
    icon: Warehouse,
    tone: 'bg-amber-100 text-amber-800',
    en: 'Stock & Extra KG',
    ur: 'اسٹاک اور اضافی کلو',
    dEn: 'Bags × bag weight is checked against Extra KG before you sell.',
    dUr: 'فروخت سے پہلے بوری × وزن کا مقابلہ اضافی کلو سے ہوتا ہے۔',
  },
  {
    icon: FileText,
    tone: 'bg-indigo-100 text-indigo-700',
    en: 'Bills & Khata',
    ur: 'بل اور کھاتہ',
    dEn: 'Print English and Urdu bills for farmers, buyers, and the register.',
    dUr: 'کسان، خریدار اور رجسٹر کے انگریزی و اردو بل پرنٹ کریں۔',
  },
]

const MODULES = [
  {
    to: '/features',
    tagEn: 'Desk',
    tagUr: 'ڈیسک',
    tag2En: 'Trade',
    tag2Ur: 'تجارت',
    en: 'Daily Trade',
    ur: 'روزانہ تجارت',
    byEn: 'Arhat Sale desk',
    byUr: 'آرھٹ سیل ڈیسک',
    whenEn: 'Receive · Sell · Stock',
    whenUr: 'آمد · فروخت · اسٹاک',
  },
  {
    to: '/features',
    tagEn: 'Accounts',
    tagUr: 'کھاتہ',
    tag2En: 'IDs',
    tag2Ur: 'آئی ڈیز',
    en: 'Farmers & Buyers',
    ur: 'کسان اور خریدار',
    byEn: 'Party books',
    byUr: 'پارٹی کھاتہ',
    whenEn: 'Name · Father · ID',
    whenUr: 'نام · والد · آئی ڈی',
  },
  {
    to: '/features',
    tagEn: 'Stock',
    tagUr: 'اسٹاک',
    tag2En: 'Bags',
    tag2Ur: 'بوریاں',
    en: 'Stock & Extra KG',
    ur: 'اسٹاک اور اضافی کلو',
    byEn: 'Warehouse lots',
    byUr: 'گودام لاٹس',
    whenEn: 'Weight-accurate',
    whenUr: 'وزن کے مطابق',
  },
  {
    to: '/about',
    tagEn: 'Print',
    tagUr: 'پرنٹ',
    tag2En: 'Ledger',
    tag2Ur: 'کھاتہ',
    en: 'Bills & Reports',
    ur: 'بل اور رپورٹس',
    byEn: 'Shop documents',
    byUr: 'دکان دستاویز',
    whenEn: 'EN · UR slips',
    whenUr: 'انگریزی · اردو',
  },
]

export default function LandingPage() {
  const { isUrdu } = useLanguage()
  const { companyName } = useBusiness()
  const company = companyName || 'Rehmani Trading Company'

  return (
    <div>
      <section className="relative overflow-hidden bg-white">
        <div className="mkt-container relative z-10 grid lg:grid-cols-2 gap-10 items-center py-14 lg:py-20">
          <div className={`max-w-xl ${isUrdu ? 'lg:order-2' : ''}`}>
            <p className={`text-[13px] font-semibold tracking-wide text-[#C5A059] uppercase mb-3 ${isUrdu ? 'font-urdu tracking-normal' : ''}`}>
              {isUrdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN}
            </p>
            <h1 className={`text-[2.15rem] sm:text-[2.75rem] font-extrabold leading-[1.15] text-[#0f172a] ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? (
                <>وصول کریں۔ تجارت کریں۔ <span className="text-[#002D62]">حساب چکا دیں۔</span></>
              ) : (
                <>Receive. Trade. <span className="text-[#002D62]">Settle.</span></>
              )}
            </h1>
            <p className={`mt-4 text-[15px] leading-relaxed text-slate-600 max-w-md ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? `${company} — کسان، خریدار، بوری اسٹاک، آرھٹ رجسٹر اور بل، ایک محفوظ دکان سسٹم میں۔`
                : `${company} keeps farmers, buyers, bag stock, Arhat Register, and bills in one secure shop desk.`}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-[#002D62] hover:bg-[#0a3a75]"
              >
                {isUrdu ? 'ایپ کھولیں' : 'Open App'}
                <ArrowRight className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center px-5 py-2.5 rounded-md text-sm font-semibold text-[#002D62] border border-[#002D62] hover:bg-[#002D62]/5"
              >
                {isUrdu ? 'طریقہ دیکھیں' : 'How it works'}
              </Link>
            </div>
          </div>
          <div className={`relative ${isUrdu ? 'lg:order-1' : ''}`}>
            <div className="relative overflow-hidden rounded-xl shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80">
              <img
                src="/ghalla-mandi.jpg"
                alt={isUrdu ? 'غلّہ منڈی — بوری اور اناج کا آرھٹ' : 'Ghalla Mandi grain yard with bags and heaps'}
                className="w-full h-[240px] sm:h-[300px] lg:h-[340px] object-cover object-center"
              />
              <div className={`absolute inset-y-0 w-2/5 ${isUrdu ? 'right-0 bg-gradient-to-l from-white to-transparent' : 'left-0 bg-gradient-to-r from-white to-transparent'}`} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f6f8] border-y border-slate-200/80">
        <div className="mkt-container py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((item) => (
            <div key={item.en} className="flex gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className={`font-semibold text-[#0f172a] text-[14px] ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? item.ur : item.en}
                </p>
                <p className={`mt-1 text-[12.5px] leading-relaxed text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? item.dUr : item.dEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mkt-container py-12">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className={`text-[1.45rem] font-extrabold text-[#0f172a] ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'سسٹم کے ماڈیولز' : 'Shop modules'}
            </h2>
            <Link to="/features" className={`text-[13px] font-semibold text-[#002D62] hover:underline ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'تمام فیچرز' : 'View all features'}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {MODULES.map((item) => (
              <article key={item.en} className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="relative h-36">
                  <img src="/ghalla-mandi.jpg" alt="" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 left-2 flex gap-1.5">
                    <span className="rounded-full bg-[#002D62] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {isUrdu ? item.tagUr : item.tagEn}
                    </span>
                    <span className="rounded-full bg-[#C5A059] px-2 py-0.5 text-[10px] font-semibold text-[#002D62]">
                      {isUrdu ? item.tag2Ur : item.tag2En}
                    </span>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <h3 className={`font-bold text-[#0f172a] ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.ur : item.en}
                  </h3>
                  <p className={`mt-1 text-[12px] text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.byUr : item.byEn}
                  </p>
                  <p className={`mt-2 text-[12px] text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.whenUr : item.whenEn}
                  </p>
                </div>
                <Link
                  to={item.to}
                  className="mx-4 mb-4 inline-flex justify-center rounded-md bg-[#002D62] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#0a3a75]"
                >
                  {isUrdu ? 'مزید دیکھیں' : 'Learn More'}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
