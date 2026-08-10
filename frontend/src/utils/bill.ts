import toast from 'react-hot-toast'

/** Open HTML bill/receipt in a new tab; falls back if popup blocked. */
export function openHtmlBill(html: string, title = 'Bill') {
  const content = typeof html === 'string' ? html : String(html ?? '')
  if (!content.trim() || content.trim().startsWith('{')) {
    throw new Error('Invalid bill content')
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
