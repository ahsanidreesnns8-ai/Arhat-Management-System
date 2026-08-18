import { assertStrongPassword } from '../src/server/password-policy'

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
assertStrongPassword('Pass20260818!', 'u12345678')
expectThrow('owner123', 'owner')
expectThrow('staff123', 'staff')
expectThrow('password', 'ali')
expectThrow('short1Aa', 'ali')
expectThrow('abcdefghij', 'ali')
expectThrow('1234567890', 'ali')
expectThrow('aliShop9472', 'ali')
expectThrow('has space1A', 'ali')
console.log('password policy OK')
