import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'
import { useBusiness } from '../../context/BusinessContext'

export default function ContactPage() {
  const { isUrdu } = useLanguage()
  const { companyName, settings } = useBusiness()
  const [form, setForm] = useState({ name: '', phone: '', message: '' })
  const phone = settings?.phone || '+92 300 0000000'
  const email = settings?.email || 'info@rehmani.trading'
  const address = settings?.address || (isUrdu ? 'غلّہ منڈی، ننکانہ صاحب، پنجاب' : 'Ghalla Mandi, Nankana Sahib, Punjab')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    toast.success(
      isUrdu
        ? 'شکریہ! ہم جلد رابطہ کریں گے — یا براہِ راست فون/واٹس ایپ کریں۔'
        : 'Thanks! We will reach out soon — or call/WhatsApp us directly.',
    )
    setForm({ name: '', phone: '', message: '' })
  }

  return (
    <div>
      <section className="mkt-page-hero">
        <div className="mkt-container py-14 text-center max-w-3xl mx-auto">
          <span className="mkt-badge-light">{isUrdu ? 'رابطہ' : 'Contact'}</span>
          <h1 className={`mkt-h1 mt-3 ${isUrdu ? 'font-urdu' : ''}`}>
            {isUrdu ? 'ڈیمو یا سپورٹ کے لیے رابطہ' : 'Request a demo or support'}
          </h1>
          <p className={`mt-3 text-slate-600 ${isUrdu ? 'font-urdu' : ''}`}>
            {companyName} — {isUrdu ? 'ہم منڈی کے اوقات میں دستیاب ہیں۔' : 'available during mandi hours.'}
          </p>
        </div>
      </section>

      <section className="mkt-section bg-white">
        <div className="mkt-container grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="mkt-card p-5 flex gap-3">
              <Phone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-slate-500">{isUrdu ? 'فون / واٹس ایپ' : 'Phone / WhatsApp'}</p>
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-semibold text-slate-900 hover:text-primary">
                  {phone}
                </a>
              </div>
            </div>
            <div className="mkt-card p-5 flex gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-slate-500">{isUrdu ? 'ای میل' : 'Email'}</p>
                <a href={`mailto:${email}`} className="font-semibold text-slate-900 hover:text-primary">{email}</a>
              </div>
            </div>
            <div className="mkt-card p-5 flex gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-slate-500">{isUrdu ? 'پتہ' : 'Address'}</p>
                <p className={`font-semibold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>{address}</p>
              </div>
            </div>
            <div className="mkt-card p-5 flex gap-3 bg-primary/5 border-primary/10">
              <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className={`font-semibold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                  {isUrdu ? 'پہلے سے اکاؤنٹ ہے؟' : 'Already have an account?'}
                </p>
                <Link to="/login" className="text-sm text-primary font-medium hover:underline">
                  {isUrdu ? 'ایپ میں لاگ اِن کریں' : 'Login to the app'}
                </Link>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="mkt-card p-6 space-y-4">
            <h2 className={`text-lg font-bold text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
              {isUrdu ? 'پیغام بھیجیں' : 'Send a message'}
            </h2>
            <div>
              <label className="text-sm font-medium text-slate-600">{isUrdu ? 'نام' : 'Name'}</label>
              <input
                className="input-field mt-1"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">{isUrdu ? 'فون' : 'Phone'}</label>
              <input
                className="input-field mt-1"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">{isUrdu ? 'پیغام' : 'Message'}</label>
              <textarea
                className="input-field mt-1 min-h-[120px]"
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <button type="submit" className="mkt-btn-primary w-full justify-center">
              {isUrdu ? 'ارسال کریں' : 'Submit'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
