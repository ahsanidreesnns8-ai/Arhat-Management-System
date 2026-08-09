import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { aiApi } from '../../services/api'
import { useLanguage } from '../../context/LanguageContext'
import { slideFromRight, softSpring, staggerContainer, staggerItem } from '../../utils/motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: string
}

export default function AiAssistantPanel() {
  const { t, isUrdu, lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const welcomed = useRef(false)

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
    // Refresh welcome copy when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const history = messages
        .filter((m) => m.content.trim())
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await aiApi.chat(userMsg, { language: lang, history })
      const payload = res.data?.data
      const reply = payload?.reply?.trim()
      if (!reply) throw new Error('empty reply')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: reply,
        source: payload.source,
      }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('aiError') }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="ai-fab"
            onClick={() => setOpen(true)}
            className={`fixed bottom-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center ${
              isUrdu ? 'left-6' : 'right-6'
            }`}
            title={t('aiTitle')}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={softSpring}
          >
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/40"
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <MessageCircle className="relative h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="ai-panel"
            className={`fixed bottom-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[32rem] card flex flex-col shadow-2xl overflow-hidden ${
              isUrdu ? 'left-6' : 'right-6'
            }`}
            variants={slideFromRight}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Bot className="h-4 w-4 text-primary" />
                </motion.div>
                <div>
                  <h3 className={`text-sm font-semibold text-gray-900 dark:text-white ${isUrdu ? 'font-urdu' : ''}`}>
                    {t('aiTitle')}
                  </h3>
                  <p className={`text-xs text-gray-500 ${isUrdu ? 'font-urdu' : ''}`}>{t('aiSubtitle')}</p>
                </div>
              </div>
              <motion.button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-4 w-4 text-gray-500" />
              </motion.button>
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
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  } ${isUrdu && msg.role === 'assistant' ? 'font-urdu' : ''}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content.replace(/\*\*(.+?)\*\*/g, '$1')}
                    </p>
                    {msg.source && msg.source !== 'system' && msg.source !== 'world_ai' && (
                      <p className="text-xs opacity-60 mt-1">Source: {msg.source}</p>
                    )}
                  </div>
                </motion.div>
              ))}
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

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
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
                  className="p-2.5 rounded-lg bg-primary text-white hover:bg-primary-700 disabled:opacity-50"
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
