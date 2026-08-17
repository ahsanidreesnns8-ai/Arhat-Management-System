import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, Scale, ListOrdered, Receipt, Wallet, BarChart3,
  ArrowRight, Shield,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion'
import RhmaniLogo from '../../components/brand/RhmaniLogo'
import { GHALLA_MANDI_EN, GHALLA_MANDI_UR } from '@/lib/branding'

/** Each module gets a fixed place in the 3×4 grid */
const modules = [
  { icon: LayoutDashboard, en: 'Dashboard', ur: 'ڈیش بورڈ' },
  { icon: Users, en: 'Farmers', ur: 'کسان' },
  { icon: ShoppingBag, en: 'Buyers', ur: 'خریدار' },
  { icon: Truck, en: 'Trucks', ur: 'ٹرک' },
  { icon: Package, en: 'Dheris', ur: 'ڈھیری' },
  { icon: Warehouse, en: 'Stock', ur: 'اسٹاک' },
  { icon: Calculator, en: 'Calculator', ur: 'کیلکولیٹر' },
  { icon: Scale, en: 'Daily Trade', ur: 'روزانہ تجارت' },
  { icon: ListOrdered, en: 'Queue', ur: 'قطار' },
  { icon: Receipt, en: 'Sales', ur: 'سیلز' },
  { icon: Wallet, en: 'Payments', ur: 'ادائیگی' },
  { icon: BarChart3, en: 'Reports', ur: 'رپورٹس' },
]

export default function LandingPage() {
  const { isUrdu, lang, setLang } = useLanguage()
  const { companyName } = useBusiness()

  return (
    <div className="welcome-gate min-h-screen flex flex-col">
      <div className="welcome-gate-bg" />

      <motion.div
        className="relative z-10 flex-1 flex flex-col px-4 pt-8 pb-7 max-w-md mx-auto w-full"
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        {/* Clean brand mark — no oversized crest image */}
        <div className="flex flex-col items-center text-center">
          <RhmaniLogo variant="full" size="lg" showText={false} />
          <h1
            className={`mt-3 text-lg font-bold tracking-[0.14em] text-[#002D62] ${
              isUrdu ? 'font-urdu tracking-normal' : ''
            }`}
          >
            {isUrdu ? 'رحمانی ٹریڈنگ' : 'REHMANI TRADING'}
          </h1>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C5A059] ${isUrdu ? 'font-urdu tracking-normal' : ''}`}>
            {isUrdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN}
          </p>
          <p
            className={`mt-3 text-[13px] text-slate-600 leading-snug max-w-xs ${
              isUrdu ? 'font-urdu' : ''
            }`}
          >
            {isUrdu
              ? 'ڈیجیٹل آرھٹ اور کھاتہ — کسان، خریدار، ادائیگی اور رپورٹس۔'
              : 'Digital arhat & khata — farmers, buyers, payments & reports.'}
          </p>
        </div>

        {/* Language */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex rounded-full border border-slate-200 p-0.5 bg-white/90">
            {(['en', 'ur'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-3.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  lang === code ? 'bg-[#002D62] text-white' : 'text-slate-500'
                } ${code === 'ur' ? 'font-urdu' : ''}`}
              >
                {code === 'en' ? 'EN' : 'اردو'}
              </button>
            ))}
          </div>
        </div>

        {/* Modules — assigned places */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <h2
              className={`text-[12px] font-semibold text-slate-700 ${
                isUrdu ? 'font-urdu' : ''
              }`}
            >
              {isUrdu ? 'ماڈیولز' : 'Modules'}
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#C5A059]">
              <Shield className="h-3 w-3" />
              {isUrdu ? 'محفوظ' : 'Secure'}
            </span>
          </div>

          <motion.div
            className="grid grid-cols-3 gap-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {modules.map((m) => (
              <motion.div
                key={m.en}
                variants={staggerItem}
                className="welcome-module flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-center min-h-[4.6rem]"
              >
                <div className="w-8 h-8 rounded-lg bg-[#002D62]/8 text-[#002D62] flex items-center justify-center">
                  <m.icon className="h-3.5 w-3.5" />
                </div>
                <p
                  className={`text-[10px] font-semibold text-slate-700 leading-tight ${
                    isUrdu ? 'font-urdu' : ''
                  }`}
                >
                  {isUrdu ? m.ur : m.en}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-6 space-y-2">
          <Link
            to="/login"
            className="mkt-btn-primary w-full justify-center py-3 text-sm shadow-md"
          >
            {isUrdu ? 'ایپ کھولیں' : 'Open App'}
            <ArrowRight className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} />
          </Link>
          <p
            className={`text-center text-[10px] text-slate-400 ${
              isUrdu ? 'font-urdu' : ''
            }`}
          >
            {companyName}
            {' · '}
            {isUrdu ? 'عملہ لاگ اِن درکار' : 'Staff login required'}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
