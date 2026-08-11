function visible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function elementLabel(el: HTMLElement): string {
  return normalize(
    [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('placeholder'),
      el.getAttribute('name'),
      el.getAttribute('id'),
      el.textContent,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  desc?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Insert or replace text in the currently focused field. */
export function dictateIntoActiveElement(text: string, mode: 'replace' | 'append' = 'replace'): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const next = mode === 'append' && el.value ? `${el.value} ${text}` : text
    setNativeValue(el, next)
    return true
  }
  if ((el as HTMLElement).isContentEditable) {
    ;(el as HTMLElement).textContent = mode === 'append'
      ? `${(el as HTMLElement).textContent || ''} ${text}`.trim()
      : text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  return false
}

/** Find an input/textarea by label / placeholder / name and fill it. */
export function fillFieldByLabel(field: string, value: string): boolean {
  const target = normalize(field)
  const nodes = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea, select'),
  ).filter((el) => visible(el) && !el.disabled && el.type !== 'hidden')

  let best: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null
  let bestScore = 0

  for (const el of nodes) {
    const labelText = (() => {
      const id = el.getAttribute('id')
      if (id) {
        const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        if (lab?.textContent) return lab.textContent
      }
      const parentLabel = el.closest('label')
      if (parentLabel?.textContent) return parentLabel.textContent
      const wrap = el.closest('div')
      const siblingLabel = wrap?.querySelector('label')
      return siblingLabel?.textContent || ''
    })()

    const hay = normalize(
      [labelText, el.getAttribute('placeholder'), el.getAttribute('name'), el.getAttribute('aria-label'), el.id]
        .filter(Boolean)
        .join(' '),
    )
    if (!hay) continue
    let score = 0
    if (hay === target) score = 100
    else if (hay.includes(target)) score = 80
    else if (target.includes(hay) && hay.length > 2) score = 60
    else if (hay.split(' ').some((w) => w === target)) score = 70
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }

  if (!best || bestScore < 60) return false

  if (best instanceof HTMLSelectElement) {
    const opt = Array.from(best.options).find((o) => normalize(o.textContent || '').includes(normalize(value)))
    if (opt) {
      best.value = opt.value
      best.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return false
  }

  best.focus()
  setNativeValue(best, value)
  return true
}

/** Click the best matching visible button/link by spoken label. */
export function clickElementByLabel(label: string): boolean {
  const target = normalize(label)
  if (!target) return false

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="submit"], input[type="button"]'),
  ).filter((el) => visible(el) && !(el as HTMLButtonElement).disabled)

  let best: HTMLElement | null = null
  let bestScore = 0

  for (const el of candidates) {
    const hay = elementLabel(el)
    if (!hay) continue
    let score = 0
    if (hay === target) score = 100
    else if (hay.includes(target)) score = 85
    else if (target.includes(hay) && hay.length > 2) score = 70
    else {
      const words = target.split(' ').filter((w) => w.length > 2)
      const hits = words.filter((w) => hay.includes(w)).length
      if (hits && hits === words.length) score = 75
      else if (hits) score = 40 + hits * 10
    }
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }

  if (!best || bestScore < 50) return false
  best.click()
  return true
}

/** Focus the first empty visible text field (useful after opening a form). */
export function focusFirstEmptyField(): boolean {
  const el = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea'),
  ).find((n) => visible(n) && !n.disabled && !n.readOnly && !n.value)
  if (!el) return false
  el.focus()
  return true
}
