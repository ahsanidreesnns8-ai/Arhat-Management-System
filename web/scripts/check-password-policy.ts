import { assertStrongPassword } from '../src/server/password-policy'
import { DEFAULT_SHOP_LOGINS } from '../src/server/shop-login-defaults'
import { RETIRED_SHOP_USERNAMES, SHARED_SHOP_USERNAMES } from '../src/server/allowed-logins'

function expectThrow(password: string, username?: string) {
  try {
    assertStrongPassword(password, username)
    throw new Error(`expected reject: ${password}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('expected reject')) {
      throw error
    }
  }
}

assertStrongPassword('Nankana#Shop9472Rtc', 'owner')
assertStrongPassword('Nankana#Desk5831Rtc', 'staff')
assertStrongPassword('hasham123', 'hasham')
assertStrongPassword('Pass20260818!', 'u12345678')
expectThrow('owner123', 'owner')
expectThrow('staff123', 'staff')
expectThrow('owner123', 'ali')
expectThrow('staff123', 'staffer')
expectThrow('hasham123', 'ali')
expectThrow('password', 'ali')
expectThrow('short1Aa', 'ali')
expectThrow('abcdefghij', 'ali')
expectThrow('1234567890', 'ali')
expectThrow('aliShop9472', 'ali')
expectThrow('has space1A', 'ali')

const demo = DEFAULT_SHOP_LOGINS.find((login) => login.username === 'hasham')
if (!demo || demo.workspace !== 'demo' || demo.role !== 'OWNER' || demo.password !== 'hasham123') {
  throw new Error('hasham demo owner login is missing')
}
const live = DEFAULT_SHOP_LOGINS.find((login) => login.username === 'owner')
if (!live || live.workspace !== 'live' || live.role !== 'OWNER') {
  throw new Error('owner live login is missing')
}
if (!(SHARED_SHOP_USERNAMES as readonly string[]).includes('hasham')) {
  throw new Error('hasham must be a shared shop login')
}
if ((SHARED_SHOP_USERNAMES as readonly string[]).includes('staff')) {
  throw new Error('staff must not be a shared shop login')
}
if (!(RETIRED_SHOP_USERNAMES as readonly string[]).includes('staff')) {
  throw new Error('staff must stay retired')
}

console.log('password policy OK')
