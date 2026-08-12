export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort?: () => void
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionResultEventLike = {
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      [index: number]: { transcript: string }
    }
  }
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function speechSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor())
}

export function parseRecognitionResult(event: SpeechRecognitionResultEventLike): {
  finalText: string
  interimText: string
} {
  let finalText = ''
  let interimText = ''
  for (let i = 0; i < event.results.length; i++) {
    const row = event.results[i]
    if (!row) continue
    const piece = row[0]?.transcript || ''
    if (row.isFinal) finalText += piece
    else interimText += piece
  }
  return { finalText, interimText }
}

export function speakText(text: string, lang: 'en' | 'ur') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
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
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}
