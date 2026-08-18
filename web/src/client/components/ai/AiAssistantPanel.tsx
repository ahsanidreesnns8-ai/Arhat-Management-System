import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X, Send, Bot, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi } from '../../services/api'
import { useLanguage } from '../../context/LanguageContext'
import { slideFromRight, softSpring, staggerContainer, staggerItem } from '../../utils/motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: string
}

type SpeechRecognitionType = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionType) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionType
    webkitSpeechRecognition?: new () => SpeechRecognitionType
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export default function AiAssistantPanel({
  open: openProp,
  onOpenChange,
  docked = false,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  docked?: boolean
} = {}) {
  const { t, isUrdu, lang } = useLanguage()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setInternalOpen(next)
  }
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [interim, setInterim] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const welcomed = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const speakRepliesRef = useRef(speakReplies)

  useEffect(() => { speakRepliesRef.current = speakReplies }, [speakReplies])

  useEffect(() => {
    if (!welcomed.current) {
      setMessages([{ role: 'assistant', content: t('aiWelcome') }])
      welcomed.current = true
      return
    }
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{ role: 'assistant', content: t('aiWelcome') }]
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, interim])

  const speak = useCallback((text: string) => {
    if (!speakRepliesRef.current || typeof window === 'undefined' || !window.speechSynthesis) return
    const clean = text.replace(/\*\*/g, '').replace(/[#`>_]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!clean) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(clean.slice(0, 1200))
    utter.lang = lang === 'ur' ? 'ur-PK' : 'en-US'
    utter.rate = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find((v) =>
      lang === 'ur'
        ? v.lang.toLowerCase().startsWith('ur')
        : v.lang.toLowerCase().startsWith('en'),
    )
    if (preferred) utter.voice = preferred
    window.speechSynthesis.speak(utter)
  }, [lang])

  const sendMessage = useCallback(async (userMsg: string) => {
    const text = userMsg.trim()
    if (!text || loading) return
    setInput('')
    setInterim('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const history = messages
        .filter((m) => m.content.trim())
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await aiApi.chat(text, { language: lang, history })
      const payload = res.data?.data
      const reply = payload?.reply?.trim()
      if (!reply) throw new Error('empty reply')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: reply,
        source: payload.source,
      }])
      speak(reply)
    } catch {
      const err = t('aiError')
      setMessages((prev) => [...prev, { role: 'assistant', content: err }])
      speak(err)
    } finally {
      setLoading(false)
    }
  }, [lang, loading, messages, speak, t])

  const handleSend = () => sendMessage(input)

  const stopListening = () => {
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }

  const toggleListen = () => {
    if (listening) {
      stopListening()
      return
    }
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      toast.error(isUrdu ? 'اس براؤزر میں آواز سپورٹ نہیں' : 'Voice is not supported in this browser (try Chrome)')
      return
    }
    window.speechSynthesis?.cancel()
    const recognition = new Ctor()
    recognition.lang = lang === 'ur' ? 'ur-PK' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      const results = event.results
      for (let i = 0; i < Object.keys(results).length; i++) {
        const row = results[i]
        if (!row) continue
        const piece = row[0]?.transcript || ''
        if (row.isFinal) finalText += piece
        else interimText += piece
      }
      if (interimText) setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        setInput(finalText.trim())
        void sendMessage(finalText.trim())
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
  }

  useEffect(() => () => {
    stopListening()
    window.speechSynthesis?.cancel()
  }, [])

  return (
    <>
      <AnimatePresence>
        {!open && !docked && (
          <motion.button
            key="ai-fab"
            onClick={() => setOpen(true)}
            className="ai-fab fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full text-white flex items-center justify-center"
            title={t('aiTitle')}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileTap={{ scale: 0.94 }}
            transition={softSpring}
          >
            <MessageCircle className="relative h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="ai-panel"
            className="fixed inset-x-3 bottom-[4.75rem] z-50 mx-auto w-auto max-w-md h-[min(68vh,30rem)] card-3d flex flex-col shadow-glass overflow-hidden"
            variants={slideFromRight}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/30 to-violet-500/30 border border-cyan-400/30 flex items-center justify-center"
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Bot className="h-4 w-4 text-cyan-300" />
                </motion.div>
                <div>
                  <h3 className={`text-sm font-semibold text-slate-900 dark:text-white ${isUrdu ? 'font-urdu' : ''}`}>
                    {t('aiTitle')}
                  </h3>
                  <p className={`text-xs text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>{t('aiSubtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  onClick={() => {
                    setSpeakReplies((v) => {
                      if (v) window.speechSynthesis?.cancel()
                      return !v
                    })
                  }}
                  className={`nav-icon-btn ${speakReplies ? 'text-cyan-400' : 'text-slate-400'}`}
                  title={speakReplies ? t('aiVoiceOff') : t('aiVoiceOn')}
                  whileTap={{ scale: 0.9 }}
                >
                  {speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </motion.button>
                <motion.button
                  onClick={() => { stopListening(); window.speechSynthesis?.cancel(); setOpen(false) }}
                  className="nav-icon-btn"
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="h-4 w-4 text-slate-400" />
                </motion.button>
              </div>
            </div>

            <motion.div
              className="flex-1 overflow-y-auto p-4 space-y-3"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={`${msg.role}-${i}`}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  variants={staggerItem}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)]'
                      : 'bg-slate-100/90 dark:bg-white/5 border border-white/10 text-slate-900 dark:text-slate-100'
                  } ${isUrdu && msg.role === 'assistant' ? 'font-urdu' : ''}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content.replace(/\*\*(.+?)\*\*/g, '$1')}
                    </p>
                  </div>
                </motion.div>
              ))}
              {listening && interim && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-primary/20 text-primary italic">
                    {interim}
                  </div>
                </div>
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-500 flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.12 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </motion.div>

            <div className="p-4 border-t border-white/10 space-y-2">
              {listening && (
                <p className={`text-xs text-cyan-400 text-center ${isUrdu ? 'font-urdu' : ''}`}>
                  {t('aiListening')}
                </p>
              )}
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={toggleListen}
                  disabled={loading}
                  className={`p-2.5 rounded-xl disabled:opacity-50 ${
                    listening
                      ? 'bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                      : 'bg-white/5 border border-white/10 text-cyan-300 hover:bg-cyan-500/10'
                  }`}
                  title={listening ? t('aiStopVoice') : t('aiStartVoice')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </motion.button>
                <input
                  className={`input-field flex-1 text-sm ${isUrdu ? 'font-urdu' : ''}`}
                  placeholder={t('aiPlaceholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <motion.button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="p-2.5 rounded-xl btn-primary disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
