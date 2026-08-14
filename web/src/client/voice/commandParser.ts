export type VoiceIntent =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'page'; action: 'openCreate' | 'save' | 'cancel' | 'refresh' | 'recordPayment' }
  | { type: 'search'; query: string }
  | { type: 'dictate'; text: string }
  | { type: 'click'; label: string }
  | { type: 'fill'; field: string; value: string }
  | { type: 'language'; lang: 'en' | 'ur' }
  | { type: 'theme'; mode: 'light' | 'dark' | 'system' }
  | { type: 'logout' }
  | { type: 'back' }
  | { type: 'help' }
  | { type: 'ai'; text: string }

const ROUTES: { path: string; label: string; keys: string[] }[] = [
  { path: '/dashboard', label: 'Dashboard', keys: ['dashboard', 'home', 'ڈیش بورڈ', 'ڈیشبورڈ', 'ہوم'] },
  { path: '/farmers', label: 'Farmers', keys: ['farmers', 'farmer', 'کسان', 'کسانوں'] },
  { path: '/buyers', label: 'Buyers', keys: ['buyers', 'buyer', 'خریدار', 'خریداروں'] },
  { path: '/trucks', label: 'Trucks', keys: ['trucks', 'truck', 'ٹرک', 'ٹرکس'] },
  { path: '/dheris', label: 'Dheris', keys: ['dheris', 'dheri', 'ڈھیری', 'ڈھیریاں', 'ڈھیریوں'] },
  { path: '/stock', label: 'Stock', keys: ['stock', 'inventory', 'اسٹاک'] },
  { path: '/calculator', label: 'Calculator', keys: ['calculator', 'price calculator', 'کیلکولیٹر', 'قیمت'] },
  { path: '/farmer-product', label: 'Farmer Product', keys: ['farmer product', 'کسان پروڈکٹ'] },
  { path: '/arhat-sale', label: 'Arhat Sale', keys: ['arhat sale', 'arhat', 'آرھٹ', 'آرہٹ'] },
  { path: '/daily-trade', label: 'Daily Trade', keys: ['daily trade', 'stock sell', 'extra kg'] },
  { path: '/queue', label: 'Queue', keys: ['queue', 'قطار'] },
  { path: '/sales', label: 'Sales', keys: ['sales', 'sale', 'فروخت', 'سیلز'] },
  { path: '/payments', label: 'Payments', keys: ['payments', 'payment', 'ادائیگی', 'ادائیگیاں'] },
  { path: '/records', label: 'Records', keys: ['records', 'record', 'ریکارڈ', 'ریکارڈز'] },
  { path: '/reports', label: 'Reports', keys: ['reports', 'report', 'رپورٹ', 'رپورٹس'] },
  { path: '/settings', label: 'Settings', keys: ['settings', 'setting', 'ترتیبات', 'سیٹنگ'] },
  { path: '/owner', label: 'Owner Panel', keys: ['owner', 'owner panel', 'مالک', 'یوزر'] },
]

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(norm(p)))
}

function extractAfter(text: string, starters: string[]): string | null {
  for (const s of starters) {
    const n = norm(s)
    const idx = text.indexOf(n)
    if (idx >= 0) {
      const rest = text.slice(idx + n.length).trim()
      if (rest) return rest
    }
  }
  return null
}

/** Parse free-form speech into a voice intent (EN + UR). */
export function parseVoiceCommand(raw: string): VoiceIntent {
  const text = norm(raw)
  if (!text) return { type: 'help' }

  if (includesAny(text, ['help', 'commands', 'what can i say', 'مدد', 'کمانڈ', 'کیا بولوں'])) {
    return { type: 'help' }
  }

  if (includesAny(text, ['go back', 'back', 'previous', 'واپس', 'پیچھے'])) {
    return { type: 'back' }
  }

  if (includesAny(text, ['log out', 'logout', 'sign out', 'لاگ آؤٹ', 'سائن آؤٹ'])) {
    return { type: 'logout' }
  }

  if (includesAny(text, ['switch to urdu', 'urdu', 'اردو'])) {
    return { type: 'language', lang: 'ur' }
  }
  if (includesAny(text, ['switch to english', 'english', 'انگریزی'])) {
    return { type: 'language', lang: 'en' }
  }

  if (includesAny(text, ['dark mode', 'dark theme', 'ڈارک'])) {
    return { type: 'theme', mode: 'dark' }
  }
  if (includesAny(text, ['light mode', 'light theme', 'لائٹ'])) {
    return { type: 'theme', mode: 'light' }
  }
  if (includesAny(text, ['system theme', 'system mode'])) {
    return { type: 'theme', mode: 'system' }
  }

  const dictate = extractAfter(text, ['type', 'dictate', 'write', 'لکھو', 'لکھیں', 'ٹائپ'])
  if (dictate) return { type: 'dictate', text: dictate }

  const search = extractAfter(text, [
    'search for', 'search', 'find', 'look for', 'تلاش', 'ڈھونڈو', 'تلاش کرو',
  ])
  if (search) return { type: 'search', query: search }

  const fillMatch = text.match(/^(?:fill|set|enter|بھرو|ڈالو)\s+(.+?)\s+(?:with|to|کو|=)\s+(.+)$/i)
    || text.match(/^(.+?)\s+(?:میں|کو)\s+(.+?)\s+(?:لکھو|ڈالو|بھرو)$/)
  if (fillMatch) {
    return { type: 'fill', field: fillMatch[1].trim(), value: fillMatch[2].trim() }
  }

  if (includesAny(text, [
    'add new', 'add', 'create', 'new', 'open form', 'نیا', 'شامل', 'بنائیں', 'بناؤ', 'ایڈ',
  ]) && !includesAny(text, ['add to queue'])) {
    // "add farmer" → navigate + openCreate handled by page after navigate if needed
    for (const route of ROUTES) {
      if (route.keys.some((k) => text.includes(norm(k)))) {
        return { type: 'navigate', path: route.path, label: route.label }
      }
    }
    return { type: 'page', action: 'openCreate' }
  }

  if (includesAny(text, ['save', 'submit', 'confirm', 'محفوظ', 'محفوظ کرو', 'سیو', 'جمع'])) {
    return { type: 'page', action: 'save' }
  }

  if (includesAny(text, ['cancel', 'close', 'dismiss', 'بند', 'منسوخ'])) {
    return { type: 'page', action: 'cancel' }
  }

  if (includesAny(text, ['refresh', 'reload', 'تازہ', 'ریفریش'])) {
    return { type: 'page', action: 'refresh' }
  }

  if (includesAny(text, ['record payment', 'new payment', 'add payment', 'ادائیگی ریکارڈ', 'نیا ادائیگی'])) {
    return { type: 'page', action: 'recordPayment' }
  }

  const click = extractAfter(text, ['click', 'press', 'tap', 'open', 'دباؤ', 'کلک', 'کھولو', 'کھولیں'])
  if (click) {
    // Prefer navigation if the click target is a known page
    for (const route of ROUTES) {
      if (route.keys.some((k) => click.includes(norm(k)) || norm(k).includes(click))) {
        return { type: 'navigate', path: route.path, label: route.label }
      }
    }
    return { type: 'click', label: click }
  }

  for (const prefix of ['go to', 'open', 'show', 'navigate to', 'جاؤ', 'جاو', 'کھولو', 'دکھاؤ', 'پر جاؤ']) {
    const rest = extractAfter(text, [prefix])
    if (rest) {
      for (const route of ROUTES) {
        if (route.keys.some((k) => rest.includes(norm(k)) || norm(k).includes(rest))) {
          return { type: 'navigate', path: route.path, label: route.label }
        }
      }
    }
  }

  for (const route of ROUTES) {
    if (route.keys.some((k) => text === norm(k) || text.startsWith(`${norm(k)} `))) {
      return { type: 'navigate', path: route.path, label: route.label }
    }
  }

  // Bare page name anywhere
  for (const route of ROUTES) {
    if (route.keys.some((k) => text.includes(norm(k)))) {
      // If also sounds like create, open create after nav — caller may openCreate when already on page
      if (includesAny(text, ['add', 'new', 'create', 'نیا', 'شامل'])) {
        return { type: 'navigate', path: route.path, label: route.label }
      }
      if (text.split(' ').length <= 3) {
        return { type: 'navigate', path: route.path, label: route.label }
      }
    }
  }

  // Questions / unknown → AI
  if (
    includesAny(text, ['what', 'how', 'why', 'when', 'who', 'tell me', 'explain', 'کیا', 'کیسے', 'بتاؤ', 'بتائیں'])
    || text.endsWith('?')
  ) {
    return { type: 'ai', text: raw.trim() }
  }

  // Default: try click by spoken words, else AI
  if (text.split(' ').length <= 4) {
    return { type: 'click', label: raw.trim() }
  }
  return { type: 'ai', text: raw.trim() }
}

export function voiceHelpText(isUrdu: boolean): string {
  if (isUrdu) {
    return 'آپ کہہ سکتے ہیں: ڈیش بورڈ، کسان کھولو، نیا شامل کرو، تلاش احمد، نام میں علی لکھو، محفوظ کرو، بند کرو، ادائیگیاں، رپورٹس، اردو، انگریزی، یا کوئی سوال پوچھیں۔'
  }
  return 'Try: go to farmers, add new, search Ahmed, type Ali, fill name with Ali, save, cancel, open payments, click Preview, Urdu, English, or ask a question.'
}
