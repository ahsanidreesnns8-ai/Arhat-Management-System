import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Package, Warehouse,
  Calculator, Store, ListOrdered, Receipt, Wallet, BarChart3,
  ArrowRight, Shield,
} from 'lucide-react'
import RhmaniLogo from '../../components/brand/RhmaniLogo'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion'

const modules = [
  { icon: LayoutDashboard, en: 'Dashboard', ur: 'ڈیش بورڈ' },
  { icon: Users, en: 'Farmers', ur: 'کسان' },
  { icon: ShoppingBag, en: 'Buyers', ur: 'خریدار' },
  { icon: Truck, en: 'Trucks', ur: 'ٹرک' },
  { icon: Package, en: 'Dheris', ur: 'ڈھیری' },
  { icon: Warehouse, en: 'Stock', ur: 'اسٹاک' },
  { icon: Calculator, en: 'Calculator', ur: 'کیلکولیٹر' },
  { icon: Store, en: 'Arhat Sale', ur: 'آرھٹ سیل' },
  { icon: ListOrdered, en: 'Queue', ur: 'قطار' },
  { icon: Receipt, en: 'Sales', ur: 'سیلز' },
  { icon: Wallet, en: 'Payments', ur: 'ادائیگی' },
  { icon: BarChart3, en: 'Reports', ur: 'رپورٹس' },
]

export default function LandingPage() {
  const { isUrdu, lang, setLang } = useLanguage()
  const { companyName } = useBusiness()

  return (
    <div className="welcome-gate min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="welcome-gate-bg" />

      <motion.div
        className="relative z-10 flex-1 flex flex-col px-4 pt-6 pb-8 max-w-lg mx-auto w-full"
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <RhmaniLogo size="lg" variant="full" className="welcome-logo" />
          <p className={`mt-3 text-sm text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'گالا منڈی · ننکانہ صاحب' : 'Gala Mandi · Nankana Sahib'}
          </p>
          <h1 className={`mt-4 text-xl font-bold text-[#002D62] dark:text-white leading-snug ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'ڈیجیٹل آرھٹ اور کھاتہ سسٹم'
              : 'Digital Arhat & Khata System'}
          </h1>
          <p className={`mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-sm ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? `${companyName} — کسان، خریدار، ڈھیری، ادائیگی اور رپورٹس ایک محفوظ ایپ میں۔`
              : `${companyName} — farmers, buyers, dheris, payments and reports in one secure app.`}
          </p>
        </div>

        {/* Language */}
        <div className="mt-5 flex justify-center">
          <div className="inline-flex rounded-full border border-slate-200 dark:border-white/10 p-0.5 bg-white/80 dark:bg-white/5">
            {(['en', 'ur'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  lang === code
                    ? 'bg-[#002D62] text-white'
                    : 'text-slate-500'
                } ${code === 'ur' ? 'font-urdu' : ''}`}
              >
                {code === 'en' ? 'EN' : 'اردو'}
              </button>
            ))}
          </div>
        </div>

        {/* Modules grid — each module has its place */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className={`text-sm font-semibold text-slate-800 dark:text-slate-100 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'ماڈیولز' : 'Modules'}
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#C5A059]">
              <Shield className="h-3 w-3" />
              {isUrdu ? 'محفوظ لاگ اِن' : 'Secure login'}
            </span>
          </div>

          <motion.div
            className="grid grid-cols-3 gap-2.5"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {modules.map((m) => (
              <motion.div
                key={m.en}
                variants={staggerItem}
                className="welcome-module flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-[#002D62]/8 dark:bg-white/10 text-[#002D62] dark:text-[#E8C87A] flex items-center justify-center">
                  <m.icon className="h-4 w-4" />
                </div>
                <p className={`text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-tight ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? m.ur : m.en}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-8 space-y-3">
          <Link
            to="/login"
            className="mkt-btn-primary mkt-btn-lg w-full justify-center shadow-lg"
          >
            {isUrdu ? 'ایپ کھولیں' : 'Open App'}
            <ArrowRight className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} />
          </Link>
          <p className={`text-center text-[11px] text-slate-400 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'عملہ لاگ اِن درکار ہے' : 'Staff login required'}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
