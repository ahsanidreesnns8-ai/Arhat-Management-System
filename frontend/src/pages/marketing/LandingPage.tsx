import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calculator, Package, Warehouse, Users, Wallet, FileText,
  MessageCircle, Shield, Smartphone, Cloud, CheckCircle2,
  ArrowRight, Bot, Truck, Receipt, BarChart3, Store,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion'

const quickFeatures = [
  { icon: Calculator, en: 'Arhat Auto-Calculation', ur: 'آڑھت خودکار' },
  { icon: Package, en: 'Dheri / Lot Tracking', ur: 'ڈھیری ٹریکنگ' },
  { icon: Warehouse, en: 'Stock & Bardana', ur: 'اسٹاک و باردانہ' },
  { icon: Wallet, en: 'Party Balances', ur: 'پارٹی بیلنس' },
  { icon: MessageCircle, en: 'Bilingual Bills', ur: 'دو زبانی بل' },
]

const mandiFeatures = [
  {
    icon: Calculator,
    enTitle: 'Arhat Auto-Calculation',
    urTitle: 'آڑھت خودکار کیلکولیشن',
    en: 'Set commission once — Arhat 3%, Munshi 0.70%, Workers 0.30% of total calculated on every sale.',
    ur: 'ایک بار کمیشن سیٹ کریں — ہر فروخت پر آڑھت، منشی اور مزدوری خودکار حساب۔',
  },
  {
    icon: Package,
    enTitle: 'Dheri & Lot Tracking',
    urTitle: 'ڈھیری اور لاٹ ٹریکنگ',
    en: 'Create lots from farmers, link trucks, track arrival to payment day by day.',
    ur: 'کسان سے ڈھیری بنائیں، ٹرک جوڑیں، آمد سے ادائیگی تک دن بہ دن ٹریک کریں۔',
  },
  {
    icon: Store,
    enTitle: 'Arhat Sale Settlement',
    urTitle: 'آرھٹ سیل سیٹلمنٹ',
    en: 'Sell to buyer or post farmer payable with calculator-style entry and instant balance update.',
    ur: 'خریدار کو فروخت یا کسان واجب الادا — کیلکولیٹر انداز میں اندراج اور فوری بیلنس۔',
  },
  {
    icon: Truck,
    enTitle: 'Truck & Queue',
    urTitle: 'ٹرک اور قطار',
    en: 'Register trucks, manage auction queue, and keep mandi floor operations organized.',
    ur: 'ٹرک رجسٹر کریں، نیلامی قطار چلائیں، منڈی کا کام منظم رکھیں۔',
  },
]

const powerFeatures = [
  { icon: Users, en: 'Farmer & Buyer Khata', ur: 'کسان و خریدار کھاتہ', descEn: 'Full ledgers, credit, and outstanding at a glance.', descUr: 'مکمل کھاتہ، کریڈٹ اور بقایا ایک نظر میں۔' },
  { icon: Receipt, en: 'Sales & Bills', ur: 'سیلز اور بل', descEn: 'EN/UR receipts with logo and Gala Mandi footer.', descUr: 'لوگو اور گالا منڈی فوٹر کے ساتھ دو زبانی رسیدیں۔' },
  { icon: Wallet, en: 'Payments & Cashbook', ur: 'ادائیگی اور کیش بک', descEn: 'Pay farmers, receive from buyers, filter by date.', descUr: 'کسان کو ادا، خریدار سے وصول، تاریخ سے فلٹر۔' },
  { icon: Warehouse, en: 'Stock Control', ur: 'اسٹاک کنٹرول', descEn: 'In/out movements and low-stock visibility.', descUr: 'آمد/روانگی اور کم اسٹاک کی صورتحال۔' },
  { icon: BarChart3, en: 'Mandi Reports', ur: 'منڈی رپورٹس', descEn: 'Commission, sales, balances — Excel/PDF ready.', descUr: 'کمیشن، فروخت، بیلنس — ایکسل/پی ڈی ایف۔' },
  { icon: Bot, en: 'AI Digital Munshi', ur: 'اے آئی ڈیجیٹل منشی', descEn: 'Ask in Urdu or English about stock, sales, balances.', descUr: 'اردو یا انگریزی میں اسٹاک، سیلز، بیلنس پوچھیں۔' },
  { icon: FileText, en: 'Complete Records Hub', ur: 'مکمل ریکارڈز', descEn: 'One place for every farmer, sale, and payment.', descUr: 'ہر کسان، فروخت اور ادائیگی ایک جگہ۔' },
  { icon: Shield, en: 'Owner Controls', ur: 'مالک کنٹرول', descEn: 'Users, audit logs, backups, and role security.', descUr: 'یوزرز، آڈٹ لاگ، بیک اپ اور رول سیکیورٹی۔' },
]

const audiences = [
  { en: 'Adhati (Commission Agent)', ur: 'آڑھتی', descEn: 'Arhat, dheri, farmer statements, buyer receivables.', descUr: 'آڑھت، ڈھیری، کسان گوشوارے، خریدار واجب الوصول۔' },
  { en: 'Beopari (Trader)', ur: 'بیوپاری', descEn: 'Buy-sell tracking, transport, multi-party balances.', descUr: 'خرید و فروخت، ٹرانسپورٹ، پارٹی بیلنس۔' },
  { en: 'Farmers', ur: 'کسان', descEn: 'Product entry, payable tracking, payment history.', descUr: 'پروڈکٹ اندراج، واجب الادا، ادائیگی ہسٹری۔' },
  { en: 'Buyers', ur: 'خریدار', descEn: 'Invoices, rates, receivables, settlement.', descUr: 'انوائس، ریٹ، واجب الوصول، سیٹلمنٹ۔' },
]

const steps = [
  { n: '1', enTitle: 'Login securely', urTitle: 'محفوظ لاگ اِن', en: 'Owner creates staff accounts. Sign in with username & password.', ur: 'مالک عملہ اکاؤنٹ بناتا ہے۔ یوزر نیم اور پاس ورڈ سے سائن اِن۔' },
  { n: '2', enTitle: 'Add parties & stock', urTitle: 'پارٹیز اور اسٹاک', en: 'Register farmers, buyers, trucks, products and opening stock.', ur: 'کسان، خریدار، ٹرک، پروڈکٹ اور اوپننگ اسٹاک درج کریں۔' },
  { n: '3', enTitle: 'Run the mandi day', urTitle: 'منڈی کا دن چلائیں', en: 'Queue, arhat sales, payments, bills and reports — all digital.', ur: 'قطار، آرھٹ سیل، ادائیگی، بل اور رپورٹس — سب ڈیجیٹل۔' },
]

export default function LandingPage() {
  const { isUrdu } = useLanguage()
  const { companyName } = useBusiness()

  return (
    <div>
      {/* Hero */}
      <section className="mkt-hero relative overflow-hidden">
        <div className="mkt-hero-glow" />
        <div className="mkt-container relative z-10 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <span className="mkt-badge">
              {isUrdu ? 'پاکستان کی منڈی سافٹ ویئر' : 'Mandi Software for Pakistan'}
            </span>
            <h1 className={`mt-4 text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'ڈیجیٹل کھاتہ اور آرھٹ سسٹم — گالا منڈی ننکانہ صاحب'
                : 'Digital Khata & Arhat System for Gala Mandi'}
            </h1>
            <p className={`mt-3 text-lg text-accent-500 font-semibold ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'آڑھتی · بیوپاری · کسان · خریدار' : 'Adhati · Beopari · Farmers · Buyers'}
            </p>
            <p className={`mt-4 text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? `${companyName} کے ساتھ سیلز، خریداری، ڈھیری، آڑھت، ادائیگی، اسٹاک، بل اور اے آئی منشی — ایک محفوظ سسٹم میں۔`
                : `${companyName} helps manage sales, purchases, dheris, arhat, payments, stock, bilingual bills and an AI munshi — in one secure system.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="mkt-btn-primary mkt-btn-lg">
                {isUrdu ? 'ایپ کھولیں' : 'Open App'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/features" className="mkt-btn-outline mkt-btn-lg">
                {isUrdu ? 'فیچرز دیکھیں' : 'Explore Features'}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent-500" />{isUrdu ? 'دو زبانی' : 'EN + Urdu'}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent-500" />{isUrdu ? 'آڑھت خودکار' : 'Auto arhat'}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent-500" />{isUrdu ? 'اے آئی منشی' : 'AI Munshi'}</span>
            </div>
          </motion.div>

          <motion.div
            className="mkt-hero-card"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.55 }}
          >
            <p className="text-xs uppercase tracking-widest text-accent-500 font-semibold mb-2">Live modules</p>
            <h3 className={`text-xl font-bold text-white mb-4 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'آپ کی منڈی کا ڈیجیٹل آفس' : 'Your mandi’s digital office'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: isUrdu ? 'ڈیش بورڈ' : 'Dashboard', v: 'KPIs' },
                { t: isUrdu ? 'آرھٹ سیل' : 'Arhat Sale', v: 'Settle' },
                { t: isUrdu ? 'کسان کھاتہ' : 'Farmer Khata', v: 'Pay' },
                { t: isUrdu ? 'رپورٹس' : 'Reports', v: 'PDF' },
              ].map((x) => (
                <div key={x.t} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-slate-400">{x.v}</p>
                  <p className={`text-sm font-semibold text-white mt-1 ${isUrdu ? 'font-urdu' : ''}`}>{x.t}</p>
                </div>
              ))}
            </div>
            <p className={`mt-4 text-sm text-slate-400 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'کاغذی رجسٹر کی جگہ محفوظ کلاؤڈ کھاتہ۔' : 'Replace paper registers with a secure digital khata.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick icons */}
      <section className="bg-white border-b border-slate-100">
        <div className="mkt-container py-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {quickFeatures.map((f) => (
            <div key={f.en} className="flex flex-col items-center text-center gap-2 p-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <f.icon className="h-5 w-5" />
              </div>
              <p className={`text-sm font-semibold text-slate-800 ${isUrdu ? 'font-urdu' : ''}`}>
                {isUrdu ? f.ur : f.en}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Purpose-built */}
      <section className="mkt-section bg-slate-50">
        <div className="mkt-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="mkt-badge-light">{isUrdu ? 'صرف منڈی کے لیے' : 'Built for the Mandi'}</span>
            <h2 className={`mkt-h2 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'مقصد کے مطابق منڈی سافٹ ویئر' : 'Purpose-Built Mandi Software'}
            </h2>
            <p className={`mt-3 text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'آڑھت، ڈھیری، ٹرک، قطار، ادائیگی — عام اکاؤنٹنگ ٹول نہیں، منڈی کا سسٹم۔'
                : 'Arhat, dheri, trucks, queue, payments — built for the mandi, not a generic accounting tool.'}
            </p>
          </div>
          <motion.div
            className="grid md:grid-cols-2 gap-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {mandiFeatures.map((f) => (
              <motion.div key={f.enTitle} variants={staggerItem} className="mkt-card p-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[#0A3A75] text-white flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className={`text-lg font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? f.urTitle : f.enTitle}
                </h3>
                <p className={`mt-2 text-sm text-slate-600 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? f.ur : f.en}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Powerful features */}
      <section className="mkt-section bg-white">
        <div className="mkt-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="mkt-badge-light">{isUrdu ? 'طاقتور فیچرز' : 'Powerful Features'}</span>
            <h2 className={`mkt-h2 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? '۱۲+ فیچرز ایک جگہ' : '12+ features — all in one place'}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {powerFeatures.map((f) => (
              <div key={f.en} className="mkt-card p-5 hover:-translate-y-1 transition-transform">
                <f.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className={`font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? f.ur : f.en}</h3>
                <p className={`mt-1.5 text-sm text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? f.descUr : f.descEn}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/features" className="mkt-btn-primary inline-flex">
              {isUrdu ? 'تمام فیچرز' : 'Explore All Features'}
            </Link>
          </div>
        </div>
      </section>

      {/* AI Munshi */}
      <section className="mkt-section mkt-ai-band">
        <div className="mkt-container grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="mkt-badge">{isUrdu ? 'ڈیجیٹل منشی · اے آئی' : 'Digital Munshi · AI'}</span>
            <h2 className={`mkt-h2 text-white mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'اپنے کھاتے سے بات کریں' : 'Talk to your Khata'}
            </h2>
            <p className={`mt-3 text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'پوچھیں: “آج کی فروخت کتنی؟” یا “فلاں کسان کا بقایا؟” — جواب آپ کے اپنے ڈیٹا سے۔'
                : 'Ask “Aaj ki sales?” or “Farmer balance?” — answers from your own ledger, by voice or text.'}
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              {[
                isUrdu ? 'اردو / انگریزی میں سوال' : 'Ask in Urdu or English',
                isUrdu ? 'صرف پڑھتا ہے — ڈیٹا تبدیل نہیں کرتا' : 'Read-only — never edits your data',
                isUrdu ? 'آواز سے بولیں، جواب سن کر سنیں' : 'Voice in, spoken replies out',
              ].map((t) => (
                <li key={t} className={`flex items-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}>
                  <CheckCircle2 className="h-4 w-4 text-accent-500 flex-shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mkt-chat-demo">
            <div className="mkt-chat-bubble user">{isUrdu ? 'رحیم کا کتنا باقی ہے؟' : 'Rahim ka kitna baqi hai?'}</div>
            <div className="mkt-chat-bubble bot">
              {isUrdu
                ? 'رحیم ٹریڈرز پر واجب الوصول Rs 184,500 ہے۔ آخری ادائیگی Rs 50,000۔'
                : 'Rahim Traders owes Rs 184,500 (receivable). Last payment Rs 50,000.'}
            </div>
            <div className="mkt-chat-bubble user">{isUrdu ? 'آج کی وصولی؟' : 'Aaj ki wasooli?'}</div>
            <div className="mkt-chat-bubble bot">
              {isUrdu
                ? 'آج کی وصولی Rs 320,000 — ۷ پارٹیوں سے۔'
                : "Today's collection Rs 320,000 from 7 parties."}
            </div>
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="mkt-section bg-slate-50">
        <div className="mkt-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="mkt-badge-light">{isUrdu ? 'کس کے لیے' : 'Who Is It For?'}</span>
            <h2 className={`mkt-h2 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'ہر منڈی کردار کے لیے' : 'Built for every mandi role'}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {audiences.map((a) => (
              <div key={a.en} className="mkt-card p-5">
                <h3 className={`font-bold text-primary ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? a.ur : a.en}</h3>
                <p className={`mt-2 text-sm text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? a.descUr : a.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mkt-section bg-white">
        <div className="mkt-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="mkt-badge-light">{isUrdu ? 'آسان آغاز' : 'Get Started'}</span>
            <h2 className={`mkt-h2 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? '۳ آسان قدموں میں' : 'Get started in 3 simple steps'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <div key={s.n} className="mkt-card p-6 relative">
                <span className="absolute -top-3 left-6 w-8 h-8 rounded-full bg-accent text-primary font-bold flex items-center justify-center text-sm shadow">
                  {s.n}
                </span>
                <h3 className={`mt-2 font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? s.urTitle : s.enTitle}
                </h3>
                <p className={`mt-2 text-sm text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? s.ur : s.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust + CTA */}
      <section className="mkt-section mkt-cta-band">
        <div className="mkt-container text-center max-w-3xl mx-auto">
          <h2 className={`text-3xl sm:text-4xl font-extrabold text-white ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'آج ہی اپنی منڈی ڈیجیٹل بنائیں' : 'Modernize your mandi business today'}
          </h2>
          <p className={`mt-3 text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'آڑھت، ڈھیری، کھاتہ، بل اور رپورٹس — ایک محفوظ پلیٹ فارم۔'
              : 'Arhat, dheri, khata, bills and reports — one secure platform for Gala Mandi.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-200">
            <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4 text-accent-500" />{isUrdu ? 'موبائل دوستانہ' : 'Mobile friendly'}</span>
            <span className="inline-flex items-center gap-2"><Cloud className="h-4 w-4 text-accent-500" />{isUrdu ? 'محفوظ بیک اپ' : 'Secure backup'}</span>
            <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-accent-500" />{isUrdu ? 'رول بیسڈ ایکسیس' : 'Role-based access'}</span>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="mkt-btn-primary mkt-btn-lg">{isUrdu ? 'لاگ اِن' : 'Login'}</Link>
            <Link to="/contact" className="mkt-btn-outline mkt-btn-lg">{isUrdu ? 'رابطہ / ڈیمو' : 'Contact / Demo'}</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
