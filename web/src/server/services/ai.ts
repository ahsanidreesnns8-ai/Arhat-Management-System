import { prisma } from '@/server/db'

export type AiChatInput = {
  message?: string
  language?: string
  history?: Array<{ role: string; content: string }>
}

function response(reply: string, source: string) {
  return { reply, source }
}

function contains(message: string, ...values: string[]) {
  return values.some((value) => message.includes(value.toLowerCase()))
}

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'] as const

async function resolveGeminiKey() {
  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const row = await prisma.businessSettings.findFirst({
    select: { geminiApiKey: true },
  })
  return row?.geminiApiKey?.trim() || null
}

async function callGemini(key: string, model: string, input: AiChatInput) {
  const history = (input.history ?? []).slice(-8).map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }))
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...history,
          { role: 'user', parts: [{ text: input.message }] },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!result.ok) return null
  const body = (await result.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  return body.candidates?.[0]?.content?.parts?.[0]?.text ?? null
}

async function generalAnswer(input: AiChatInput) {
  const key = await resolveGeminiKey()
  if (!key) return { text: null as string | null, configured: false }
  try {
    for (const model of GEMINI_MODELS) {
      const text = await callGemini(key, model, input)
      if (text?.trim()) return { text, configured: true }
    }
    return { text: null, configured: true }
  } catch {
    return { text: null, configured: true }
  }
}

export async function chat(input: AiChatInput) {
  const raw = input.message?.trim() ?? ''
  const message = raw.toLowerCase()
  const urdu = input.language?.toLowerCase() === 'ur'
  if (!raw) {
    return response(
      urdu
        ? 'براہ کرم کوئی سوال لکھیں — کاروبار یا دنیا کے کسی بھی موضوع پر۔'
        : 'Please type a question — about your business or any topic in the world.',
      'system',
    )
  }
  if (/^(hi+|hello|hey|salam|assalam|aoa|سلام|ہائے|ہیلو)[!?.\s]*$/iu.test(raw)) {
    return response(
      urdu
        ? 'السلام علیکم! کاروباری ڈیٹا یا کسی عام موضوع کے بارے میں پوچھیں۔'
        : 'Hello! Ask about business data, stock, sales, queue, or any general topic.',
      'system',
    )
  }
  if (contains(message, 'commission', 'کمیشن', 'arhat', 'munshi')) {
    return response(
      urdu
        ? 'کمیشن کل رقم کا 4% ہے: آرھٹ 3%، منشی/نگران 0.70%، ورکرز 0.30%۔'
        : 'Commission is 4% of gross amount: Arhat 3%, supervisor 0.70%, and labor 0.30%.',
      'commission',
    )
  }
  if (contains(message, 'stock', 'inventory', 'اسٹاک')) {
    const stock = await prisma.stock.aggregate({ _sum: { quantity: true } })
    const total = stock._sum.quantity?.toNumber() ?? 0
    return response(
      urdu
        ? `موجودہ کل کاروباری اسٹاک: ${total} کلو۔`
        : `Current total business stock is ${total} kg across all products.`,
      'stock',
    )
  }
  if (contains(message, 'queue', 'قطار')) {
    const [pending, active] = await Promise.all([
      prisma.queueEntry.count({ where: { status: 'PENDING' } }),
      prisma.queueEntry.count({ where: { status: 'ACTIVE' } }),
    ])
    return response(
      urdu
        ? `قطار — زیر التواء: ${pending}، فعال: ${active}۔`
        : `Queue status — Pending: ${pending}, Active: ${active}.`,
      'queue_entries',
    )
  }
  if (contains(message, 'farmer', 'کسان')) {
    const count = await prisma.farmer.count({ where: { deleted: false } })
    return response(
      urdu
        ? `سسٹم میں کسان: ${count}۔`
        : `You have ${count} farmers registered in the system.`,
      'farmers',
    )
  }
  if (contains(message, 'buyer', 'خریدار')) {
    const count = await prisma.buyer.count({ where: { deleted: false } })
    return response(
      urdu
        ? `سسٹم میں خریدار: ${count}۔`
        : `You have ${count} buyers registered in the system.`,
      'buyers',
    )
  }
  if (contains(message, 'sales', 'revenue', 'فروخت', 'آمدنی')) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const total = await prisma.sale.aggregate({
      where: { deleted: false, saleDate: today },
      _sum: { totalAmount: true },
    })
    return response(
      urdu
        ? `آج کی کل فروخت: PKR ${total._sum.totalAmount?.toNumber() ?? 0}۔`
        : `Today's total sales revenue is PKR ${total._sum.totalAmount?.toNumber() ?? 0}.`,
      'sales',
    )
  }

  const general = await generalAnswer(input)
  if (general.text) return response(general.text, 'world_ai')
  if (general.configured) {
    return response(
      urdu
        ? 'Gemini اس وقت جواب نہیں دے سکا۔ کچھ لمحے بعد دوبارہ کوشش کریں۔'
        : 'Gemini is configured but could not answer just now. Please try again in a moment.',
      'system',
    )
  }
  return response(
    urdu
      ? 'عام سوالات کے لیے Settings میں Gemini API کلید لگائیں، یا Vercel پر GEMINI_API_KEY سیٹ کریں۔ کاروباری ڈیٹا کے بارے میں ابھی پوچھ سکتے ہیں۔'
      : 'Add a Gemini API key in Settings (or GEMINI_API_KEY on Vercel) for general questions. Business-data questions work now.',
    'system',
  )
}
