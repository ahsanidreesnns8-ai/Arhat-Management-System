import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

const steps = [
  {
    enTitle: 'Secure staff login',
    urTitle: 'محفوظ عملہ لاگ اِن',
    en: 'Owner creates users with roles. Staff sign in with username and password. Theme & language preferences are saved.',
    ur: 'مالک رولز کے ساتھ یوزر بناتا ہے۔ عملہ یوزر نیم/پاس ورڈ سے داخل ہوتا ہے۔ تھیم اور زبان محفوظ رہتی ہے۔',
  },
  {
    enTitle: 'Register parties & assets',
    urTitle: 'پارٹیز اور اثاثے',
    en: 'Add farmers, buyers, trucks and products. Duplicate suggestions help avoid double entries.',
    ur: 'کسان، خریدار، ٹرک اور پروڈکٹس شامل کریں۔ ڈپلیکیٹ تجاویز دوہری اندراجات روکتی ہیں۔',
  },
  {
    enTitle: 'Receive lots (dheris)',
    urTitle: 'ڈھیری وصول کریں',
    en: 'Create dheris / farmer products with bags, weight and rate. Stock updates automatically.',
    ur: 'بوری، وزن اور ریٹ کے ساتھ ڈھیری بنائیں۔ اسٹاک خود بخود اپڈیٹ ہوتا ہے۔',
  },
  {
    enTitle: 'Run queue & arhat sale',
    urTitle: 'قطار اور آرھٹ سیل',
    en: 'Manage auction queue, sell to buyers, or post farmer payables. Commission of total is applied (3% + 0.70% + 0.30%).',
    ur: 'نیلامی قطار چلائیں، خریدار کو فروخت کریں یا کسان واجب الادا درج کریں۔ کل رقم پر کمیشن۔',
  },
  {
    enTitle: 'Collect & pay',
    urTitle: 'وصول اور ادا',
    en: 'Record buyer receipts and farmer payouts against dheris. Filter by date; update or settle balances.',
    ur: 'خریدار وصولی اور کسان ادائیگی ڈھیری سے منسلک کریں۔ تاریخ سے فلٹر؛ بیلنس اپڈیٹ/سیٹل۔',
  },
  {
    enTitle: 'Bills, reports & AI',
    urTitle: 'بل، رپورٹس اور اے آئی',
    en: 'Download bilingual bills, export reports, and ask the AI Assistant about balances or world questions.',
    ur: 'دو زبانی بل ڈاؤن لوڈ کریں، رپورٹس نکالیں، اے آئی اسسٹنٹ سے بیلنس یا دنیا کے سوال پوچھیں۔',
  },
]

export default function HowItWorksPage() {
  const { isUrdu } = useLanguage()

  return (
    <div>
      <section className="mkt-page-hero">
        <div className="mkt-container py-14 text-center max-w-3xl mx-auto">
          <span className="mkt-badge-light">{isUrdu ? 'ورک فلو' : 'Workflow'}</span>
          <h1 className={`mkt-h1 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'منڈی کا دن کیسے چلتا ہے' : 'How a mandi day runs'}
          </h1>
          <p className={`mt-3 text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'پکا کھاتہ جیسا سادہ فلو — اندراج سے سیٹلمنٹ تک۔'
              : 'A clear Pakka Khata–style flow from entry to settlement.'}
          </p>
        </div>
      </section>

      <section className="mkt-section bg-white">
        <div className="mkt-container max-w-3xl space-y-5">
          {steps.map((s, i) => (
            <div key={s.enTitle} className="mkt-card p-6 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className={`text-lg font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? s.urTitle : s.enTitle}
                </h3>
                <p className={`mt-1.5 text-sm text-slate-600 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? s.ur : s.en}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/login" className="mkt-btn-primary mkt-btn-lg inline-flex">
            {isUrdu ? 'ایپ شروع کریں' : 'Start in the App'}
          </Link>
        </div>
      </section>
    </div>
  )
}
