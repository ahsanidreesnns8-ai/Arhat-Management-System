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

export const CREATOR_NAME = 'Ahsan Idrees'
export const CREATOR_PHONE = '+923224398646'
export const CREATOR_LINE = `Created by AI · ${CREATOR_NAME}`
export const CREATOR_CONTACT = `Contact number: ${CREATOR_PHONE}`

export function copyrightText(
  company: string,
  urdu = false,
  year = new Date().getFullYear(),
) {
  const place = urdu ? GHALLA_MANDI_UR : GHALLA_MANDI_EN
  const rights = urdu ? 'جملہ حقوق محفوظ ہیں۔' : 'All rights reserved.'
  return `© ${year} ${company} · ${place} · ${rights}`
}

export function aiMarkHtml() {
  return `<span class="ai-mark" aria-label="AI">
    <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI">
      <circle cx="36" cy="36" r="33" fill="#002D62" stroke="#C5A059" stroke-width="3.5"/>
      <circle cx="36" cy="36" r="27" fill="none" stroke="#C5A059" stroke-width="0.8" opacity="0.55"/>
      <text x="36" y="44" text-anchor="middle" fill="#C5A059" font-size="20" font-family="Georgia, 'Times New Roman', serif" font-weight="700" letter-spacing="1">AI</text>
    </svg>
  </span>`
}

export function creatorCreditHtml() {
  return `<div class="creator-credit">
    <div class="creator-line">${aiMarkHtml()}<span>${CREATOR_LINE}</span></div>
    <div class="creator-phone">${CREATOR_CONTACT}</div>
  </div>`
}

export function resolveRtcLogo(_custom?: string | null) {
  return RTC_LOGO_PATH
}
