export const RTC_LOGO_PATH = '/rtc-logo.svg'
export const GHALLA_MANDI_EN = 'Ghalla Mandi Nankana Sahib'
export const GHALLA_MANDI_UR = 'غلّہ منڈی ننکانہ صاحب'

export function rtcMarkHtml() {
  return `<div class="rtc-mark" aria-label="RTC">
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RTC">
      <circle cx="36" cy="36" r="33" fill="#002D62" stroke="#C5A059" stroke-width="3.5"/>
      <circle cx="36" cy="36" r="27" fill="none" stroke="#C5A059" stroke-width="0.8" opacity="0.55"/>
      <text x="36" y="43" text-anchor="middle" fill="#C5A059" font-size="16" font-family="Georgia, 'Times New Roman', serif" font-weight="700" letter-spacing="1">RTC</text>
    </svg>
  </div>`
}

export function copyrightText(
  company: string,
  urdu = false,
  year = new Date().getFullYear(),
) {
  const place = urdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN
  const rights = urdu ? 'جملہ حقوق محفوظ ہیں۔' : 'All rights reserved.'
  return `© ${year} ${company} · ${place} · ${rights}`
}

export function resolveRtcLogo(_custom?: string | null) {
  return RTC_LOGO_PATH
}
