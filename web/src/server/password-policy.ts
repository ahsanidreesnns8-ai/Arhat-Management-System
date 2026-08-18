import { isCanonicalShopPassword } from '@/server/shop-login-defaults'

const BREACHED_PASSWORDS = new Set([
  'owner123',
  'staff123',
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'admin',
  'admin123',
  'letmein',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'login',
  'root',
  'rehmani',
  'rehmani123',
  'nankana',
  'nankana123',
  'arhat',
  'arhat123',
  'changeme',
  'secret',
  'secret123',
])

export const PASSWORD_HINT =
  'At least 10 characters, with letters and numbers. Do not reuse a leaked password.'

export function assertStrongPassword(password: string, username?: string) {
  const value = password.trim()
  if (isCanonicalShopPassword(username, value)) return
  if (value.length < 10) {
    throw new Error('Password must be at least 10 characters')
  }
  if (value.length > 72) {
    throw new Error('Password is too long')
  }
  if (/\s/.test(value)) {
    throw new Error('Password cannot contain spaces')
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new Error('Password must include letters and numbers')
  }
  const lower = value.toLowerCase()
  if (BREACHED_PASSWORDS.has(lower)) {
    throw new Error(
      'This password appears in known data breaches. Choose a unique password.',
    )
  }
  const user = (username || '').trim().toLowerCase()
  if (user && user.length >= 3 && (lower === user || lower.includes(user))) {
    throw new Error('Password must not contain the username')
  }
}
