import { prisma } from '@/server/db'

export type AiChatInput = {
  message?: string
  language?: string
  history?: Array<{ role: string; content: string }>
}

function response(reply: string, source: string) {
  return { reply, source }
}

const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const

async function resolveGeminiKey() {
  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const row = await prisma.businessSettings.findFirst({
    select: { geminiApiKey: true },
  })
  return row?.geminiApiKey?.trim() || null
}

async function shopSnapshot() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  try {
    const [settings, farmers, buyers, stock, pending, active, sales] = await Promise.all([
      prisma.businessSettings.findFirst({ select: { companyName: true } }),
      prisma.farmer.count({ where: { deleted: false } }),
      prisma.buyer.count({ where: { deleted: false } }),
      prisma.stock.aggregate({ _sum: { quantity: true } }),
      prisma.queueEntry.count({ where: { status: 'PENDING' } }),
      prisma.queueEntry.count({ where: { status: 'ACTIVE' } }),
      prisma.sale.aggregate({
        where: { deleted: false, saleDate: today },
        _sum: { totalAmount: true },
      }),
    ])
    const company = settings?.companyName?.trim() || 'Rehmani Trading Company'
    const kg = stock._sum.quantity?.toNumber() ?? 0
    const revenue = sales._sum.totalAmount?.toNumber() ?? 0
    return [
      `This assistant belongs to ${company}, a grain trading / arhat shop.`,
      `Live shop snapshot: farmers ${farmers}, buyers ${buyers}, stock ${kg} kg, queue pending ${pending}, queue active ${active}, today's sales PKR ${revenue}.`,
      'Commission on gross amount is 4%: Arhat 3%, supervisor 0.70%, labor 0.30%.',
    ].join(' ')
  } catch {
    return 'This assistant belongs to Rehmani Trading Company, a grain trading / arhat shop. Commission is 4% of gross amount.'
  }
}

function systemPrompt(input: AiChatInput, snapshot: string) {
  const urdu = input.language?.toLowerCase() === 'ur'
  return [
    'You are the professional AI assistant inside the Rehmani Trading Company Arhat Management System.',
    'Answer any genuine question the user asks: business, general knowledge, language, math, writing, current events, explanations, and advice.',
    'Do not refuse ordinary questions. Be clear, accurate, and concise. If you are unsure, say so briefly and still help as far as you can.',
    'When the question is about this shop, use the snapshot below as the source of truth and do not invent missing figures.',
    snapshot,
    urdu
      ? 'Reply in clear Urdu unless the user writes in English and clearly wants English.'
      : 'Reply in clear English unless the user writes in Urdu and clearly wants Urdu.',
  ].join('\n')
}

async function callGemini(key: string, model: string, input: AiChatInput, snapshot: string) {
  const history = (input.history ?? []).slice(-10).map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }))
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(input, snapshot) }] },
        contents: [
          ...history,
          { role: 'user', parts: [{ text: input.message }] },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(25_000),
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

async function generalAnswer(input: AiChatInput, snapshot: string) {
  const key = await resolveGeminiKey()
  if (!key) return { text: null as string | null, configured: false }
  try {
    for (const model of GEMINI_MODELS) {
      const text = await callGemini(key, model, input, snapshot)
      if (text?.trim()) return { text, configured: true }
    }
    return { text: null, configured: true }
  } catch {
    return { text: null, configured: true }
  }
}

function looksLikeExactShopFact(message: string) {
  return /^(how many|how much|what('?s| is) (our|the|my)|current|today'?s?)\b/i.test(message.trim())
    && /\b(farmer|buyers?|stock|inventory|queue|sales?|revenue|commission|آرھٹ|اسٹاک|کسان|خریدار|قطار|فروخت|کمیشن)\b/i.test(message)
}

async function shopFactReply(raw: string, urdu: boolean) {
  const message = raw.toLowerCase()
  if (/\b(commission|کمیشن|arhat %|munshi)\b/i.test(message) && /(%|percent|4|کیسے|کیا ہے)/i.test(message)) {
    return response(
      urdu
        ? 'کمیشن کل رقم کا 4% ہے: آرھٹ 3%، منشی/نگران 0.70%، ورکرز 0.30%۔'
        : 'Commission is 4% of gross amount: Arhat 3%, supervisor 0.70%, and labor 0.30%.',
      'commission',
    )
  }
  if (/\b(stock|inventory|اسٹاک)\b/i.test(message) && /\b(current|total|how much|kitna|کتنا|موجودہ)\b/i.test(message)) {
    const stock = await prisma.stock.aggregate({ _sum: { quantity: true } })
    const total = stock._sum.quantity?.toNumber() ?? 0
    return response(
      urdu ? `موجودہ کل کاروباری اسٹاک: ${total} کلو۔` : `Current total business stock is ${total} kg across all products.`,
      'stock',
    )
  }
  if (/\b(queue|قطار)\b/i.test(message) && /\b(status|pending|active|how many|کتنا|حالت)\b/i.test(message)) {
    const [pending, active] = await Promise.all([
      prisma.queueEntry.count({ where: { status: 'PENDING' } }),
      prisma.queueEntry.count({ where: { status: 'ACTIVE' } }),
    ])
    return response(
      urdu ? `قطار — زیر التواء: ${pending}، فعال: ${active}۔` : `Queue status — Pending: ${pending}, Active: ${active}.`,
      'queue_entries',
    )
  }
  if (/\b(farmers?|کسان)\b/i.test(message) && /\b(how many|count|registered|کتنا|کتنے)\b/i.test(message)) {
    const count = await prisma.farmer.count({ where: { deleted: false } })
    return response(
      urdu ? `سسٹم میں کسان: ${count}۔` : `You have ${count} farmers registered in the system.`,
      'farmers',
    )
  }
  if (/\b(buyers?|خریدار)\b/i.test(message) && /\b(how many|count|registered|کتنا|کتنے)\b/i.test(message)) {
    const count = await prisma.buyer.count({ where: { deleted: false } })
    return response(
      urdu ? `سسٹم میں خریدار: ${count}۔` : `You have ${count} buyers registered in the system.`,
      'buyers',
    )
  }
  if (/\b(sales?|revenue|فروخت|آمدنی)\b/i.test(message) && /\b(today|آج)\b/i.test(message)) {
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
  return null
}

export async function chat(input: AiChatInput) {
  const raw = input.message?.trim() ?? ''
  const urdu = input.language?.toLowerCase() === 'ur'
  if (!raw) {
    return response(
      urdu
        ? 'براہ کرم کوئی سوال لکھیں — کاروبار یا دنیا کے کسی بھی موضوع پر۔'
        : 'Please type a question — about your business or any topic.',
      'system',
    )
  }

  const snapshot = await shopSnapshot()
  const general = await generalAnswer(input, snapshot)
  if (general.text) return response(general.text, 'world_ai')

  if (looksLikeExactShopFact(raw) || !general.configured) {
    const shop = await shopFactReply(raw, urdu)
    if (shop) return shop
  }

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
      ? 'عام سوالات کے لیے Settings میں Gemini API کلید لگائیں، یا Vercel پر GEMINI_API_KEY سیٹ کریں۔ کاروباری اعداد و شمار کے بارے میں ابھی پوچھ سکتے ہیں۔'
      : 'Add a Gemini API key in Settings (or GEMINI_API_KEY on Vercel) for general questions. Shop-data questions still work now.',
    'system',
  )
}
