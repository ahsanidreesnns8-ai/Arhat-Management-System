import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../context/LanguageContext'
import {
  getSpeechRecognitionCtor,
  parseRecognitionResult,
  stopSpeaking,
  type SpeechRecognitionLike,
} from '../../voice/speech'

type Props = {
  onText: (text: string) => void
  className?: string
  title?: string
}

/** Small mic for dictating into a single field. */
export default function VoiceFieldMic({ onText, className = '', title }: Props) {
  const { isUrdu, lang, t } = useLanguage()
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const stop = () => {
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }

  useEffect(() => () => stop(), [])

  const toggle = () => {
    if (listening) {
      stop()
      return
    }
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      toast.error(isUrdu ? 'آواز سپورٹ نہیں' : 'Voice not supported in this browser')
      return
    }
    stopSpeaking()
    const recognition = new Ctor()
    recognition.lang = lang === 'ur' ? 'ur-PK' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const { finalText } = parseRecognitionResult(event)
      const text = finalText.trim()
      if (text) onText(text)
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
      toast.error(isUrdu ? 'مائیک شروع نہیں ہوا' : 'Could not start microphone')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${
        listening
          ? 'bg-rose-500 text-white'
          : 'text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-300'
      } ${className}`}
      title={title || (listening ? t('voiceStop') : t('voiceDictateField'))}
      aria-label={title || t('voiceDictateField')}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}
