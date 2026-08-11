import { AnimatePresence, motion } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import { useVoiceControl } from '../../context/VoiceControlContext'
import { softSpring } from '../../utils/motion'

export default function GlobalVoiceControl() {
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

  return (
    <div className={`fixed bottom-6 z-40 flex flex-col items-end gap-2 ${isUrdu ? 'right-6' : 'left-6'}`}>
      <AnimatePresence>
        {(listening || interim || lastHeard || lastResult) && (
          <motion.div
            key="voice-status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={`max-w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-white/15 bg-slate-900/90 text-slate-100 shadow-glass backdrop-blur-md px-4 py-3 ${isUrdu ? 'font-urdu text-right' : ''}`}
          >
            <div className="flex items-center gap-2 text-xs text-cyan-300 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{listening ? t('voiceListening') : t('voiceReady')}</span>
            </div>
            {listening && interim && (
              <p className="text-sm text-cyan-200/90 italic">{interim}</p>
            )}
            {!listening && lastHeard && (
              <p className="text-sm text-white/90">
                <span className="text-slate-400">{t('voiceYouSaid')} </span>
                {lastHeard}
              </p>
            )}
            {!listening && lastResult && (
              <p className="text-xs text-slate-300 mt-1 line-clamp-4">{lastResult}</p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">{t('voiceHint')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={() => setSpeakEnabled(!speakEnabled)}
          className={`w-11 h-11 rounded-full border border-white/15 flex items-center justify-center ${
            speakEnabled
              ? 'bg-slate-800/90 text-cyan-300'
              : 'bg-slate-800/70 text-slate-400'
          }`}
          title={speakEnabled ? t('aiVoiceOff') : t('aiVoiceOn')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
        >
          {speakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </motion.button>

        <motion.button
          type="button"
          onClick={toggleListening}
          disabled={!supported}
          className={`relative w-16 h-16 rounded-full text-white flex items-center justify-center shadow-lg disabled:opacity-50 ${
            listening
              ? 'bg-gradient-to-br from-rose-500 to-orange-500'
              : 'bg-gradient-to-br from-[#002D62] to-[#0B4F8A]'
          }`}
          title={listening ? t('voiceStop') : t('voiceStart')}
          aria-label={listening ? t('voiceStop') : t('voiceStart')}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={softSpring}
        >
          {listening && (
            <motion.span
              className="absolute inset-0 rounded-full bg-rose-400/40"
              animate={{ scale: [1, 1.4, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {listening ? <MicOff className="relative h-7 w-7" /> : <Mic className="relative h-7 w-7" />}
        </motion.button>
      </div>
    </div>
  )
}
