import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import { useTheme } from './ThemeContext'
import { aiApi } from '../services/api'
import { parseVoiceCommand, voiceHelpText, type VoiceIntent } from '../voice/commandParser'
import {
  clickElementByLabel,
  dictateIntoActiveElement,
  fillFieldByLabel,
  focusFirstEmptyField,
} from '../voice/domActions'
import {
  getSpeechRecognitionCtor,
  parseRecognitionResult,
  speakText,
  speechSupported,
  stopSpeaking,
  type SpeechRecognitionLike,
} from '../voice/speech'

export type VoicePageHandlers = {
  openCreate?: () => void
  save?: () => void
  cancel?: () => void
  refresh?: () => void
  setSearch?: (query: string) => void
  recordPayment?: () => void
  /** Extra named actions, e.g. { preview: () => ... } */
  custom?: Record<string, () => void>
}

type VoiceControlValue = {
  supported: boolean
  listening: boolean
  interim: string
  lastHeard: string
  lastResult: string
  speakEnabled: boolean
  setSpeakEnabled: (v: boolean) => void
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  executeTranscript: (text: string) => Promise<void>
  registerPage: (handlers: VoicePageHandlers) => () => void
  speak: (text: string) => void
}

const VoiceControlContext = createContext<VoiceControlValue | null>(null)

export function VoiceControlProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { lang, setLang, isUrdu, t } = useLanguage()
  const { setTheme } = useTheme()

  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const [lastResult, setLastResult] = useState('')
  const [speakEnabled, setSpeakEnabled] = useState(true)

  const handlersRef = useRef<VoicePageHandlers>({})
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speakEnabledRef = useRef(speakEnabled)
  const pendingOpenCreateRef = useRef(false)

  useEffect(() => { speakEnabledRef.current = speakEnabled }, [speakEnabled])

  const speak = useCallback((text: string) => {
    if (!speakEnabledRef.current) return
    speakText(text, lang)
  }, [lang])

  const registerPage = useCallback((handlers: VoicePageHandlers) => {
    handlersRef.current = handlers
    if (pendingOpenCreateRef.current && handlers.openCreate) {
      pendingOpenCreateRef.current = false
      // Allow page mount/render to finish
      setTimeout(() => {
        handlers.openCreate?.()
        setTimeout(() => focusFirstEmptyField(), 250)
      }, 350)
    }
    return () => {
      handlersRef.current = {}
    }
  }, [])

  const runIntent = useCallback(async (intent: VoiceIntent, raw: string) => {
    const h = handlersRef.current

    switch (intent.type) {
      case 'help': {
        const msg = voiceHelpText(isUrdu)
        setLastResult(msg)
        speak(msg)
        toast(msg, { duration: 5000 })
        return
      }
      case 'back': {
        navigate(-1)
        setLastResult(isUrdu ? 'واپس جا رہے ہیں' : 'Going back')
        speak(isUrdu ? 'واپس' : 'Going back')
        return
      }
      case 'logout': {
        logout()
        setLastResult(isUrdu ? 'لاگ آؤٹ' : 'Logged out')
        return
      }
      case 'language': {
        setLang(intent.lang)
        const msg = intent.lang === 'ur' ? 'زبان اردو کر دی گئی' : 'Language set to English'
        setLastResult(msg)
        speak(msg)
        return
      }
      case 'theme': {
        setTheme(intent.mode)
        const msg = isUrdu ? `تھیم: ${intent.mode}` : `Theme: ${intent.mode}`
        setLastResult(msg)
        speak(msg)
        return
      }
      case 'navigate': {
        const wantsCreate = /\b(add|new|create|نیا|شامل|ایڈ)\b/i.test(raw)
        if (wantsCreate) pendingOpenCreateRef.current = true
        navigate(intent.path)
        const msg = isUrdu ? `${intent.label} کھول رہے ہیں` : `Opening ${intent.label}`
        setLastResult(msg)
        speak(msg)
        // If already on page, open create immediately
        if (wantsCreate && window.location.pathname.replace(/\/$/, '') === intent.path) {
          pendingOpenCreateRef.current = false
          h.openCreate?.()
          setTimeout(() => focusFirstEmptyField(), 250)
        }
        return
      }
      case 'page': {
        if (intent.action === 'openCreate') {
          if (h.openCreate) {
            h.openCreate()
            setTimeout(() => focusFirstEmptyField(), 250)
            setLastResult(isUrdu ? 'فارم کھلا' : 'Form opened')
            speak(isUrdu ? 'فارم کھلا، بول کر بھریں' : 'Form opened — speak to fill fields')
          } else {
            toast.error(isUrdu ? 'اس صفحے پر نیا فارم نہیں' : 'No add action on this page')
          }
          return
        }
        if (intent.action === 'save') {
          if (h.save) {
            h.save()
            setLastResult(isUrdu ? 'محفوظ کر رہے ہیں' : 'Saving')
            speak(isUrdu ? 'محفوظ' : 'Saving')
          } else if (!clickElementByLabel(isUrdu ? 'محفوظ' : 'save')
            && !clickElementByLabel('submit')
            && !clickElementByLabel('create')) {
            toast.error(isUrdu ? 'محفوظ بٹن نہیں ملا' : 'Save action not found')
          }
          return
        }
        if (intent.action === 'cancel') {
          if (h.cancel) h.cancel()
          else clickElementByLabel(isUrdu ? 'بند' : 'cancel') || clickElementByLabel('close')
          setLastResult(isUrdu ? 'بند' : 'Cancelled')
          return
        }
        if (intent.action === 'refresh') {
          if (h.refresh) h.refresh()
          else window.location.reload()
          setLastResult(isUrdu ? 'ریفریش' : 'Refreshing')
          return
        }
        if (intent.action === 'recordPayment') {
          if (h.recordPayment) h.recordPayment()
          else {
            pendingOpenCreateRef.current = true
            navigate('/payments')
          }
          setLastResult(isUrdu ? 'ادائیگی فارم' : 'Payment form')
          speak(isUrdu ? 'ادائیگی فارم' : 'Opening payment form')
          return
        }
        return
      }
      case 'search': {
        if (h.setSearch) {
          h.setSearch(intent.query)
        }
        window.dispatchEvent(new CustomEvent('rehmani:voice-search', { detail: { query: intent.query } }))
        setLastResult(isUrdu ? `تلاش: ${intent.query}` : `Search: ${intent.query}`)
        speak(isUrdu ? `تلاش ${intent.query}` : `Searching ${intent.query}`)
        return
      }
      case 'dictate': {
        if (dictateIntoActiveElement(intent.text)) {
          setLastResult(isUrdu ? 'لکھ دیا گیا' : 'Typed into field')
          speak(isUrdu ? 'لکھ دیا' : 'Done')
        } else {
          toast.error(isUrdu ? 'پہلے کسی خانے پر کلک کریں' : 'Tap a field first, then speak')
        }
        return
      }
      case 'fill': {
        if (fillFieldByLabel(intent.field, intent.value)) {
          setLastResult(isUrdu ? `${intent.field} بھر دیا` : `Filled ${intent.field}`)
          speak(isUrdu ? 'بھر دیا' : `Filled ${intent.field}`)
        } else if (dictateIntoActiveElement(intent.value)) {
          setLastResult(isUrdu ? 'فعال خانے میں لکھا' : 'Filled active field')
        } else {
          toast.error(isUrdu ? 'خانہ نہیں ملا' : `Could not find field: ${intent.field}`)
        }
        return
      }
      case 'click': {
        // Page custom actions first
        const key = intent.label.toLowerCase().replace(/\s+/g, '')
        const customHit = h.custom
          && Object.entries(h.custom).find(([name]) =>
            name.toLowerCase().replace(/\s+/g, '').includes(key)
            || key.includes(name.toLowerCase().replace(/\s+/g, '')),
          )
        if (customHit) {
          customHit[1]()
          setLastResult(isUrdu ? `کیا: ${intent.label}` : `Ran: ${intent.label}`)
          speak(isUrdu ? 'ہو گیا' : 'Done')
          return
        }
        if (clickElementByLabel(intent.label)) {
          setLastResult(isUrdu ? `کلک: ${intent.label}` : `Clicked ${intent.label}`)
          speak(isUrdu ? 'ہو گیا' : 'Done')
        } else {
          // Fall through to AI for unanswered commands
          try {
            const res = await aiApi.chat(raw, { language: lang })
            const reply = res.data?.data?.reply?.trim()
            if (reply) {
              setLastResult(reply)
              speak(reply)
              toast(reply, { duration: 4000 })
            } else {
              toast.error(isUrdu ? 'سمجھ نہیں آیا' : `Could not find: ${intent.label}`)
            }
          } catch {
            toast.error(isUrdu ? 'سمجھ نہیں آیا — مدد کہیں' : 'Not understood — say "help"')
          }
        }
        return
      }
      case 'ai': {
        try {
          const res = await aiApi.chat(intent.text, { language: lang })
          const reply = res.data?.data?.reply?.trim() || t('aiError')
          setLastResult(reply)
          speak(reply)
          toast(reply, { duration: 4500 })
        } catch {
          const err = t('aiError')
          setLastResult(err)
          speak(err)
        }
        return
      }
      default:
        return
    }
  }, [isUrdu, lang, logout, navigate, setLang, setTheme, speak, t])

  const executeTranscript = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setLastHeard(trimmed)
    setInterim('')
    const intent = parseVoiceCommand(trimmed)
    await runIntent(intent, trimmed)
  }, [runIntent])

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      toast.error(isUrdu ? 'اس براؤزر میں آواز سپورٹ نہیں (Chrome استعمال کریں)' : 'Voice not supported — try Chrome')
      return
    }
    stopSpeaking()
    try { recognitionRef.current?.abort?.() } catch { /* ignore */ }

    const recognition = new Ctor()
    recognition.lang = lang === 'ur' ? 'ur-PK' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      const { finalText, interimText } = parseRecognitionResult(event)
      if (interimText) setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        void executeTranscript(finalText.trim())
      }
    }
    recognition.onerror = (event) => {
      setListening(false)
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error(isUrdu ? 'آواز سننے میں مسئلہ' : `Voice error: ${event.error}`)
      }
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      toast.error(isUrdu ? 'مائیک شروع نہیں ہو سکا' : 'Could not start microphone')
    }
  }, [executeTranscript, isUrdu, lang])

  const toggleListening = useCallback(() => {
    if (listening) stopListening()
    else startListening()
  }, [listening, startListening, stopListening])

  useEffect(() => () => {
    stopListening()
    stopSpeaking()
  }, [stopListening])

  const value = useMemo<VoiceControlValue>(() => ({
    supported: speechSupported(),
    listening,
    interim,
    lastHeard,
    lastResult,
    speakEnabled,
    setSpeakEnabled,
    startListening,
    stopListening,
    toggleListening,
    executeTranscript,
    registerPage,
    speak,
  }), [
    listening, interim, lastHeard, lastResult, speakEnabled,
    startListening, stopListening, toggleListening, executeTranscript, registerPage, speak,
  ])

  return (
    <VoiceControlContext.Provider value={value}>
      {children}
    </VoiceControlContext.Provider>
  )
}

export function useVoiceControl() {
  const ctx = useContext(VoiceControlContext)
  if (!ctx) throw new Error('useVoiceControl must be used within VoiceControlProvider')
  return ctx
}

/** Register page-level voice handlers (auto-cleaned on unmount). */
export function useVoicePageActions(handlers: VoicePageHandlers) {
  const { registerPage } = useVoiceControl()
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => registerPage({
    openCreate: () => ref.current.openCreate?.(),
    save: () => ref.current.save?.(),
    cancel: () => ref.current.cancel?.(),
    refresh: () => ref.current.refresh?.(),
    setSearch: (q) => ref.current.setSearch?.(q),
    recordPayment: () => ref.current.recordPayment?.(),
    get custom() { return ref.current.custom },
  }), [registerPage])
}
