import { Link } from 'react-router-dom'
import {
  Calculator, Package, Users, Wallet, Warehouse, Receipt,
  BarChart3, Bot, Truck, ListOrdered, FileText, Shield, Settings, Store,
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

const groups = [
  {
    en: 'Mandi Operations',
    ur: 'منڈی آپریشنز',
    items: [
      { icon: Calculator, en: 'Price Calculator', ur: 'قیمت کیلکولیٹر', dEn: 'Mann/bag style pricing for quick settlements.', dUr: 'من/بوری انداز کی فوری قیمت۔' },
      { icon: Store, en: 'Arhat Sale', ur: 'آرھٹ سیل', dEn: 'Sell to buyer or farmer payable with commission shares.', dUr: 'خریدار فروخت یا کسان واجب الادا بمع کمیشن۔' },
      { icon: Package, en: 'Dheri Management', ur: 'ڈھیری مینجمنٹ', dEn: 'Lots with day-wise payment history.', dUr: 'ڈھیریاں بمع دن بہ دن ادائیگی۔' },
      { icon: ListOrdered, en: 'Auction Queue', ur: 'نیلامی قطار', dEn: 'Pending, active and completed queue boards.', dUr: 'زیر التوا، فعال اور مکمل قطار۔' },
      { icon: Truck, en: 'Truck Register', ur: 'ٹرک رجسٹر', dEn: 'Link trucks to farmers and lots.', dUr: 'ٹرک کسان اور ڈھیری سے جوڑیں۔' },
      { icon: Warehouse, en: 'Stock Ledger', ur: 'اسٹاک لیجر', dEn: 'Incoming, outgoing, adjustments, alerts.', dUr: 'آمد، روانگی، ایڈجسٹمنٹ، الرٹ۔' },
    ],
  },
  {
    en: 'Money & Parties',
    ur: 'رقم اور پارٹیز',
    items: [
      { icon: Users, en: 'Farmers & Buyers', ur: 'کسان و خریدار', dEn: 'Profiles, CNIC, phone, city, notes, duplicates check.', dUr: 'پروفائل، شناختی کارڈ، فون، شہر، نوٹس۔' },
      { icon: Wallet, en: 'Payments', ur: 'ادائیگیاں', dEn: 'Pay / receive, update, settle remaining balance.', dUr: 'ادا / وصول، اپڈیٹ، بقایا سیٹل۔' },
      { icon: Receipt, en: 'Sales Invoices', ur: 'سیلز انوائس', dEn: 'Mixed-source lines and printable bills.', dUr: 'مخلوط سورس لائنز اور قابلِ پرنٹ بل۔' },
      { icon: FileText, en: 'Bilingual Bills', ur: 'دو زبانی بل', dEn: 'EN/UR receipts with logo & Gala Mandi footer.', dUr: 'لوگو اور گالا منڈی فوٹر۔' },
    ],
  },
  {
    en: 'Intelligence & Control',
    ur: 'ذہانت اور کنٹرول',
    items: [
      { icon: Bot, en: 'AI Assistant', ur: 'اے آئی اسسٹنٹ', dEn: 'Business + world Q&A with optional voice.', dUr: 'کاروبار + دنیا کے سوال، آواز کے ساتھ۔' },
      { icon: BarChart3, en: 'Reports', ur: 'رپورٹس', dEn: 'Commission, sales, stock — preview & print EN/UR.', dUr: 'کمیشن، سیلز، اسٹاک — پریویو اور پرنٹ اردو/انگریزی۔' },
      { icon: Settings, en: 'Business Settings', ur: 'کاروباری ترتیبات', dEn: 'Logo, address, commission rates, branding.', dUr: 'لوگو، پتہ، کمیشن، برانڈنگ۔' },
      { icon: Shield, en: 'Owner Panel', ur: 'مالک پینل', dEn: 'Users, audit trail, backups.', dUr: 'یوزرز، آڈٹ، بیک اپ۔' },
    ],
  },
]

export default function FeaturesPage() {
  const { isUrdu } = useLanguage()

  return (
    <div>
      <section className="mkt-page-hero">
        <div className="mkt-container py-14 text-center max-w-3xl mx-auto">
          <span className="mkt-badge-light">{isUrdu ? 'فیچرز' : 'Features'}</span>
          <h1 className={`mkt-h1 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'منڈی کے لیے مکمل فیچر سیٹ' : 'Everything your mandi needs'}
          </h1>
          <p className={`mt-3 text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'پکا کھاتہ طرز کی ساخت — آڑھت، پارٹیز، اسٹاک، ادائیگی، رپورٹس اور اے آئی منشی۔'
              : 'Pakka Khata–style structure — arhat, parties, stock, payments, reports and AI munshi.'}
          </p>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.en} className="mkt-section bg-white even:bg-slate-50">
          <div className="mkt-container">
            <h2 className={`mkt-h2 mb-6 ${isUrdu ? 'font-urdu' : ''}`}>{isUrdu ? g.ur : g.en}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.items.map((item) => (
                <div key={item.en} className="mkt-card p-5">
                  <item.icon className="h-6 w-6 text-primary mb-3" />
                  <h3 className={`font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.ur : item.en}
                  </h3>
                  <p className={`mt-1.5 text-sm text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.dUr : item.dEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="mkt-section mkt-cta-band">
        <div className="mkt-container text-center">
          <h2 className={`text-2xl font-bold text-white ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'ابھی سسٹم استعمال کریں' : 'Ready to use the system?'}
          </h2>
          <Link to="/login" className="mkt-btn-primary mkt-btn-lg mt-6 inline-flex">
            {isUrdu ? 'لاگ اِن' : 'Login to App'}
          </Link>
        </div>
      </section>
    </div>
  )
}
