import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, History, MessageCircle, PanelLeftClose, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useAiAssistant } from '../../context/AiAssistantContext'
import { aiApi } from '../../services/api'
import Button from '../ui/Button'

type ChatMessage = { role: 'user' | 'assistant'; text: string }
type ChatThread = {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: string
}

const STORAGE_KEY = 'rehmani_ai_chats'

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyThread(): ChatThread {
  return { id: newId(), title: '', messages: [], updatedAt: new Date().toISOString() }
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatThread[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 40)))
  } catch {
    // ignore quota
  }
}

function useDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return desktop
}

export default function AiAssistantPanel() {
  const { t, lang, isUrdu } = useLanguage()
  const { open, setOpen } = useAiAssistant()
  const desktop = useDesktop()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const stored = loadThreads()
    if (stored.length === 0) {
      const first = emptyThread()
      setThreads([first])
      setActiveId(first.id)
      return
    }
    setThreads(stored)
    setActiveId(stored[0].id)
  }, [])

  useEffect(() => {
    if (threads.length) saveThreads(threads)
  }, [threads])

  useEffect(() => {
    if (!open) return
    setHistoryOpen(desktop)
  }, [open, desktop])

  const active = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? threads[0] ?? null,
    [threads, activeId],
  )

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [active?.messages, busy, open])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  const startNewChat = () => {
    const next = emptyThread()
    setThreads((prev) => [next, ...prev])
    setActiveId(next.id)
    setError(null)
    if (!desktop) setHistoryOpen(false)
  }

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const remaining = prev.filter((thread) => thread.id !== id)
      if (remaining.length === 0) {
        const next = emptyThread()
        setActiveId(next.id)
        return [next]
      }
      if (activeId === id) setActiveId(remaining[0].id)
      return remaining
    })
  }

  const send = async () => {
    const question = input.trim()
    if (!question || busy || !active) return
    setInput('')
    setError(null)
    const history = active.messages.map((message) => ({
      role: message.role,
      content: message.text,
    }))
    const userMessage: ChatMessage = { role: 'user', text: question }
    const nextMessages = [...active.messages, userMessage]
    const title = active.title || question.slice(0, 42)
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === active.id
          ? { ...thread, title, messages: nextMessages, updatedAt: new Date().toISOString() }
          : thread,
      ),
    )
    setBusy(true)
    try {
      const res = await aiApi.chat(question, { language: lang, history })
      const reply = res.data?.data?.reply?.trim() || t('aiError')
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === active.id
            ? {
                ...thread,
                messages: [...nextMessages, { role: 'assistant', text: reply }],
                updatedAt: new Date().toISOString(),
              }
            : thread,
        ),
      )
    } catch {
      setError(t('aiError'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const historyPanel = (
    <div className="flex h-full w-[min(18rem,86vw)] shrink-0 flex-col bg-[#1F4D32] text-white md:w-56">
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E8C87A]">{t('aiHistory')}</p>
          <button
            type="button"
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 md:hidden"
            onClick={() => setHistoryOpen(false)}
            aria-label={t('aiCloseHistory')}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-3 py-2.5 text-sm font-semibold text-[#1F4D32]"
          onClick={startNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('aiNewChat')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`mb-1 flex items-start gap-1 rounded-xl px-2 py-2 ${
              thread.id === active?.id ? 'bg-white/15' : 'hover:bg-white/8'
            }`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setActiveId(thread.id)
                if (!desktop) setHistoryOpen(false)
              }}
            >
              <p className={`truncate text-xs font-semibold ${isUrdu ? 'font-urdu' : ''}`}>
                {thread.title || t('aiUntitled')}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">
                {new Date(thread.updatedAt).toLocaleString(lang === 'ur' ? 'ur-PK' : 'en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </button>
            <button
              type="button"
              className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-rose-200"
              onClick={() => deleteThread(thread.id)}
              aria-label={t('aiDeleteChat')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[#00152e]/55 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
        aria-label={t('close')}
      />
      <aside className="relative flex h-full w-full overflow-hidden bg-[#F7F4EC] shadow-[-28px_0_70px_rgba(31, 77, 50,0.35)] md:max-w-[56rem]">
        {/* Desktop history column */}
        {desktop && historyOpen ? historyPanel : null}

        {/* Phone history overlay */}
        {!desktop && historyOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/35"
              onClick={() => setHistoryOpen(false)}
              aria-label={t('aiCloseHistory')}
            />
            <div className="absolute inset-y-0 left-0 z-30 h-full shadow-2xl">
              {historyPanel}
            </div>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-[#1F4D32]/10 bg-white px-2 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1F4D32]/15 text-[#1F4D32]"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label={historyOpen ? t('aiCloseHistory') : t('aiOpenHistory')}
                title={t('aiHistory')}
              >
                <History className="h-5 w-5" />
              </button>
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1F4D32] text-[#E8C87A] sm:flex">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold text-[#1F4D32] ${isUrdu ? 'font-urdu' : ''}`}>{t('aiTitle')}</p>
                <p className={`hidden truncate text-[11px] text-slate-500 sm:block ${isUrdu ? 'font-urdu' : ''}`}>{t('aiHint')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={startNewChat} className="px-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('aiNewChat')}</span>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="px-2">
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">{t('close')}</span>
              </Button>
            </div>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
            {!active?.messages.length && (
              <div className="rounded-2xl border border-[#C5A059]/30 bg-white p-5">
                <Sparkles className="h-6 w-6 text-[#C5A059]" />
                <p className={`mt-3 text-base font-semibold text-[#1F4D32] ${isUrdu ? 'font-urdu' : ''}`}>
                  {t('aiWelcome')}
                </p>
                <p className={`mt-2 text-sm leading-6 text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>{t('aiHint')}</p>
              </div>
            )}
            {active?.messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-[#1F4D32] text-white'
                      : 'border border-[#1F4D32]/10 bg-white text-slate-800 shadow-sm'
                  } ${isUrdu ? 'font-urdu' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C5A059]">
                      <MessageCircle className="h-3 w-3" />
                      {t('aiTitle')}
                    </span>
                  )}
                  {message.text}
                </div>
              </div>
            ))}
            {busy && <p className={`text-xs text-slate-500 ${isUrdu ? 'font-urdu' : ''}`}>{t('aiThinking')}</p>}
            {error && <p className="text-xs text-rose-700">{error}</p>}
          </div>

          <form
            className="border-t border-[#1F4D32]/10 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <div className="flex items-end gap-2 rounded-2xl border border-[#1F4D32]/15 bg-[#F7F4EC] px-3 py-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder={t('aiPlaceholder')}
                className={`min-h-[2.5rem] flex-1 resize-none bg-transparent text-sm outline-none ${isUrdu ? 'font-urdu' : ''}`}
              />
              <Button type="submit" size="sm" disabled={busy || !input.trim()}>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t('aiSend')}</span>
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  )
}
