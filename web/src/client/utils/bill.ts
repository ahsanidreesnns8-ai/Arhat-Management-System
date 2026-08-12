import toast from 'react-hot-toast'

function isSpaShell(html: string) {
  return html.includes('id="root"') || html.includes('/@vite/client')
}

function isBillHtml(html: string) {
  const trimmed = html.trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  if (isSpaShell(trimmed)) return false
  // Real bills are full HTML documents from BillService
  return (
    trimmed.includes('<html') ||
    trimmed.includes('<!DOCTYPE') ||
    trimmed.includes('<table') ||
    trimmed.includes('Bill') ||
    trimmed.includes('بل')
  )
}

/** Open HTML bill/receipt in a new tab; falls back if popup blocked. */
export function openHtmlBill(html: string, title = 'Bill') {
  const content = typeof html === 'string' ? html : String(html ?? '')
  if (!isBillHtml(content)) {
    throw new Error(
      isSpaShell(content)
        ? 'API proxy unavailable — start the backend on port 8080'
        : 'Invalid bill content',
    )
  }

  const win = window.open('', '_blank')
  if (win) {
    win.document.open()
    win.document.write(content)
    win.document.close()
    try {
      win.document.title = title
    } catch {
      // ignore cross-window title errors
    }
    return
  }

  // Popup blocked — download as HTML file instead
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Popup blocked — bill downloaded as HTML file')
}

export function billErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message
  const axiosErr = err as { response?: { data?: unknown; status?: number }; message?: string }
  const data = axiosErr?.response?.data
  if (typeof data === 'string' && data.trim()) {
    try {
      const parsed = JSON.parse(data) as { message?: string }
      if (parsed?.message) return parsed.message
    } catch {
      if (!data.includes('<html') && data.length < 200) return data
    }
  }
  if (data && typeof data === 'object' && 'message' in data) {
    const msg = (data as { message?: string }).message
    if (msg) return msg
  }
  if (axiosErr?.message && !axiosErr.message.startsWith('Request failed')) return axiosErr.message
  return fallback
}
