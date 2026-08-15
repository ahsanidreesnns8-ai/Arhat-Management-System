import { AnimatePresence, motion } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useVoiceControl } from '../../context/VoiceControlContext'
import AiAssistantPanel from '../ai/AiAssistantPanel'
import { softSpring } from '../../utils/motion'

/**
 * Bottom dock — Voice on the LEFT, AI on the RIGHT.
 * Clean, balanced, mobile-first placement.
 */
export default function MobileToolsDock() {
  const { t, isUrdu } = useLanguage()
  const {
    supported,
    listening,
    interim,
    lastHeard,
    lastResult,
    speakEnabled,
    setSpeakEnabled,
    toggleListening,
  } = useVoiceControl()
  const [aiOpen, setAiOpen] = useState(false)
  const [showStatus, setShowStatus] = useState(false)

  // Status bubble auto-hides after 3 seconds when not actively listening
  useEffect(() => {
    if (listening || interim) {
      setShowStatus(true)
      return
    }
    if (lastHeard || lastResult) {
      setShowStatus(true)
      const id = window.setTimeout(() => setShowStatus(false), 3000)
      return () => window.clearTimeout(id)
    }
    setShowStatus(false)
  }, [listening, interim, lastHeard, lastResult])

  return (
    <>
      <AnimatePresence>
        {showStatus && !aiOpen && (
          <motion.div
            key="voice-status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`fixed bottom-[5.1rem] left-3 right-3 z-40 mx-auto max-w-sm rounded-2xl border border-white/12 bg-slate-950/94 text-slate-100 shadow-lg backdrop-blur-md px-3.5 py-2.5 ${isUrdu ? 'font-urdu text-right' : ''}`}
          >
            <p className="text-[11px] font-semibold text-cyan-300 mb-0.5">
              {listening ? t('voiceListening') : t('voiceReady')}
            </p>
            {listening && interim && <p className="text-sm text-cyan-100/90 italic line-clamp-2">{interim}</p>}
            {!listening && lastHeard && (
              <p className="text-sm text-white/90 line-clamp-2">
                <span className="text-slate-400">{t('voiceYouSaid')} </span>
                {lastHeard}
              </p>
            )}
            {!listening && lastResult && (
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{lastResult}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-lg px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl px-2.5 py-2 shadow-[0_-10px_36px_rgba(0,0,0,0.4)]">
            {/* LEFT — Voice */}
            <div className="flex items-center gap-2 min-w-[42%]">
              <motion.button
                type="button"
                onClick={() => setSpeakEnabled(!speakEnabled)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  speakEnabled
                    ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-white/5 text-slate-400'
                }`}
                title={speakEnabled ? t('aiVoiceOff') : t('aiVoiceOn')}
                aria-label={speakEnabled ? t('aiVoiceOff') : t('aiVoiceOn')}
                whileTap={{ scale: 0.94 }}
              >
                {speakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </motion.button>

              <motion.button
                type="button"
                onClick={toggleListening}
                disabled={!supported}
                className={`relative w-12 h-12 rounded-xl text-white flex items-center justify-center flex-shrink-0 disabled:opacity-45 ${
                  listening
                    ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                    : 'bg-gradient-to-br from-[#002D62] to-[#0B4F8A]'
                }`}
                title={listening ? t('voiceStop') : t('voiceStart')}
                aria-label={listening ? t('voiceStop') : t('voiceStart')}
                whileTap={{ scale: 0.94 }}
                transition={softSpring}
              >
                {listening && (
                  <motion.span
                    className="absolute inset-0 rounded-xl bg-rose-400/35"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {listening ? <MicOff className="relative h-5 w-5" /> : <Mic className="relative h-5 w-5" />}
              </motion.button>

              <div className={`min-w-0 ${isUrdu ? 'font-urdu text-right' : ''}`}>
                <p className="text-[11px] font-semibold text-white/90 leading-tight">
                  {isUrdu ? 'آواز' : 'Voice'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {listening ? t('voiceListening') : (isUrdu ? 'کمانڈ بولیں' : 'Speak commands')}
                </p>
              </div>
            </div>

            <div className="w-px h-9 bg-white/10 flex-shrink-0" />

            {/* RIGHT — AI */}
            <div className="flex items-center gap-2 min-w-[42%] justify-end">
              <div className={`min-w-0 ${isUrdu ? 'font-urdu' : 'text-right'}`}>
                <p className="text-[11px] font-semibold text-white/90 leading-tight">
                  {t('aiTitle')}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {isUrdu ? 'مدد پوچھیں' : 'Ask for help'}
                </p>
              </div>

              <motion.button
                type="button"
                onClick={() => setAiOpen(true)}
                className="relative w-12 h-12 rounded-xl text-white flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-sky-500 to-violet-600"
                title={t('aiTitle')}
                aria-label={t('aiTitle')}
                whileTap={{ scale: 0.94 }}
              >
                <MessageCircle className="relative h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <AiAssistantPanel open={aiOpen} onOpenChange={setAiOpen} docked />
    </>
  )
}
