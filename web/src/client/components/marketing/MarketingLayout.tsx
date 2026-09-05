import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { MapPin, Phone, Mail } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'
import { CREATOR_CONTACT, CREATOR_PHONE, GHALLA_MANDI_EN, GHALLA_MANDI_UR } from '@/lib/branding'
import CopyrightLine from '../brand/CopyrightLine'
import RtcMark from '../brand/RtcMark'

const NAV = [
  { to: '/', en: 'Home', ur: 'ہوم', end: true },
  { to: '/features', en: 'Features', ur: 'فیچرز' },
  { to: '/how-it-works', en: 'How it works', ur: 'طریقہ' },
  { to: '/about', en: 'About Us', ur: 'تعارف' },
  { to: '/contact', en: 'Contact', ur: 'رابطہ' },
] as const

export default function MarketingLayout() {
  const { isUrdu, lang, setLang } = useLanguage()
  const { companyName, settings } = useBusiness()
  const { pathname } = useLocation()
  const company = companyName || 'Rehmani Trading Company'
  const phone = settings?.phone || CREATOR_PHONE
  const email = settings?.email || 'info@rehmani.trading'
  const address = settings?.address || (isUrdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN)

  return (
    <div className="mkt-shell min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80">
        <div className="mkt-container flex items-center justify-between h-[68px] gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <RtcMark className="w-9 h-9" />
            <span className={`text-[15px] font-bold text-[#002D62] leading-tight ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'آرھٹ سسٹم' : 'Arhat System'}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item}
                className={({ isActive }) =>
                  `text-[14px] font-medium transition-colors ${isUrdu ? 'font-urdu' : ''} ${
                    isActive || (item.to === '/' && pathname === '/')
                      ? 'text-[#002D62]'
                      : 'text-slate-600 hover:text-[#002D62]'
                  }`
                }
              >
                {isUrdu ? item.ur : item.en}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex rounded-md border border-slate-200 p-0.5">
              {(['en', 'ur'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold ${
                    lang === code ? 'bg-[#002D62] text-white' : 'text-slate-500'
                  } ${code === 'ur' ? 'font-urdu' : ''}`}
                >
                  {code === 'en' ? 'EN' : 'اردو'}
                </button>
              ))}
            </div>
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-[#002D62] border border-[#002D62] hover:bg-[#002D62]/5"
            >
              {isUrdu ? 'لاگ اِن' : 'Login'}
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-white bg-[#002D62] hover:bg-[#0a3a75]"
            >
              {isUrdu ? 'ایپ کھولیں' : 'Open App'}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#001a3d] text-slate-200">
        <div className="mkt-container py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-[13px]">
          <div>
            <p className={`font-semibold text-white mb-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'مقام' : 'Location'}
            </p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Ghalla+Mandi+Nankana+Sahib"
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-white/10 mb-3"
            >
              <img
                src="/ghalla-mandi.jpg"
                alt={isUrdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN}
                className="h-24 w-full object-cover opacity-90"
              />
            </a>
            <p className={`flex items-start gap-2 text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#C5A059]" />
              {address}
            </p>
          </div>

          <div>
            <p className={`font-semibold text-white mb-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'رابطہ' : 'Contact'}
            </p>
            <p className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-[#C5A059]" />
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-white">{phone}</a>
            </p>
            <p className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-[#C5A059]" />
              <a href={`mailto:${email}`} className="hover:text-white break-all">{email}</a>
            </p>
            <p className="text-slate-400 mt-3">{CREATOR_CONTACT}</p>
          </div>

          <div>
            <p className={`font-semibold text-white mb-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'تعارف' : 'About Us'}
            </p>
            <p className={`text-slate-300 leading-relaxed ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu
                ? `${company} — غلّہ منڈی ننکانہ صاحب میں کسان، خریدار، اسٹاک اور کھاتہ کا ڈیجیٹل آرھٹ سسٹم۔`
                : `${company} is the digital arhat desk for farmers, buyers, stock and khata at Ghalla Mandi Nankana Sahib.`}
            </p>
          </div>

          <div>
            <p className={`font-semibold text-white mb-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'وسائل' : 'Resources'}
            </p>
            <ul className="space-y-1.5">
              {NAV.filter((item) => item.to !== '/').map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={`hover:text-white ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? item.ur : item.en}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/login" className={`hover:text-white ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? 'لاگ اِن' : 'Login'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className={`font-semibold text-white mb-3 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'اعلانات' : 'Announcements'}
            </p>
            <ul className={`space-y-2 text-slate-300 ${isUrdu ? 'font-urdu' : ''}`}>
              <li>{isUrdu ? 'روزانہ تجارت پر بوری × وزن سے اسٹاک چیک۔' : 'Daily Trade now checks bags × bag weight against Extra KG.'}</li>
              <li>{isUrdu ? 'کسان اور خریدار کی ہر آئی ڈی آرھٹ رجسٹر پر دکھے گی۔' : 'Every farmer and buyer ID now appears on Arhat Register.'}</li>
              <li>{isUrdu ? 'بل کے نیچے پیشہ ورانہ کریڈٹ۔' : 'Professional creator credit prints on every bill.'}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mkt-container py-4">
            <CopyrightLine light className="text-[11px]" />
          </div>
        </div>
      </footer>
    </div>
  )
}
