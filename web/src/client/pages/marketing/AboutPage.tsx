import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'

export default function AboutPage() {
  const { isUrdu } = useLanguage()
  const { companyName, settings } = useBusiness()

  return (
    <div>
      <section className="mkt-page-hero">
        <div className="mkt-container py-14 text-center max-w-3xl mx-auto">
          <span className="mkt-badge-light">{isUrdu ? 'ہمارے بارے میں' : 'About Us'}</span>
          <h1 className={`mkt-h1 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>{companyName}</h1>
          <p className={`mt-3 text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu
              ? 'گالا منڈی ننکانہ صاحب میں اناج تجارت اور آڑھت کے لیے جدید ڈیجیٹل پلیٹ فارم۔'
              : 'A modern digital platform for grain trading and arhat at Gala Mandi Nankana Sahib.'}
          </p>
        </div>
      </section>

      <section className="mkt-section bg-white">
        <div className="mkt-container max-w-3xl space-y-8">
          <div className="mkt-card p-6">
            <h2 className={`text-xl font-bold text-primary mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'مشن' : 'Mission'}
            </h2>
            <p className={`text-slate-600 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'کاغذی رجسٹروں کو محفوظ ڈیجیٹل کھاتہ سے بدلنا — تاکہ کسان، خریدار اور آڑھتی کا حساب صاف، تیز اور قابلِ اعتماد رہے۔'
                : 'Replace paper registers with a secure digital khata — so farmer, buyer and adhati accounts stay clear, fast and trustworthy.'}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h2 className={`text-xl font-bold text-primary mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'ویژن' : 'Vision'}
            </h2>
            <p className={`text-slate-600 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? 'پنجاب کی اناج منڈیوں کے لیے معیاری آرھٹ سافٹ ویئر بننا — دو زبانی، موبائل دوستانہ، اور اے آئی معاونت کے ساتھ۔'
                : 'Become the standard arhat software for Punjab grain markets — bilingual, mobile-friendly, and AI-assisted.'}
            </p>
          </div>
          <div className="mkt-card p-6">
            <h2 className={`text-xl font-bold text-primary mb-2 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'تفصیلات' : 'Business details'}
            </h2>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">{isUrdu ? 'کمپنی' : 'Company'}</dt>
                <dd className="font-semibold text-slate-900">{companyName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{isUrdu ? 'مقام' : 'Location'}</dt>
                <dd className="font-semibold text-slate-900">
                  {settings?.address || (isUrdu ? 'گالا منڈی، ننکانہ صاحب' : 'Gala Mandi, Nankana Sahib')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{isUrdu ? 'فون' : 'Phone'}</dt>
                <dd className="font-semibold text-slate-900">{settings?.phone || '+92 300 0000000'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{isUrdu ? 'ای میل' : 'Email'}</dt>
                <dd className="font-semibold text-slate-900">{settings?.email || 'info@rehmani.trading'}</dd>
              </div>
            </dl>
          </div>
          <div className="text-center">
            <Link to="/contact" className="mkt-btn-primary mkt-btn-lg inline-flex">
              {isUrdu ? 'ہم سے رابطہ کریں' : 'Contact us'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
