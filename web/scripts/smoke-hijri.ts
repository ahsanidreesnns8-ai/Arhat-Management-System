/**
 * Smoke: Hijri date auto-updates and a manual day correction sticks.
 * Demo workspace only. Usage: cd web && npx tsx scripts/smoke-hijri.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { addCalendarDays, computeHijriAdjustment, hijriInfo, hijriParts } from '../src/lib/hijri'
import { getSettings, updateSettings } from '../src/server/services/settings'
import { getWeather } from '../src/server/services/weather'
import { runWithWorkspace } from '../src/server/workspace'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  const tz = 'Asia/Karachi'
  const today = hijriInfo(0, tz)
  const minusOne = hijriInfo(-1, tz)
  const computed = computeHijriAdjustment(
    { day: minusOne.day, month: minusOne.month, year: minusOne.year },
    tz,
  )
  assert(computed === -1, `expected -1 day offset, got ${computed} (today ${today.formattedEn} vs ${minusOne.formattedEn})`)
  const roundTrip = hijriParts(addCalendarDays(new Date(), computed, tz), tz)
  assert(roundTrip.day === minusOne.day, 'shifted hijri day did not match target')

  await runWithWorkspace('demo', async () => {
    const before = await getSettings()
    const previous = before.hijriAdjustmentDays ?? 0
    try {
      const saved = await updateSettings({
        hijriCorrectDay: minusOne.day,
        hijriCorrectMonth: minusOne.month,
        hijriCorrectYear: minusOne.year,
      })
      assert(saved.hijriAdjustmentDays === -1, `settings did not store -1, got ${saved.hijriAdjustmentDays}`)
      const weather = await getWeather()
      assert(weather.hijri.day === minusOne.day, `weather hijri day ${weather.hijri.day} != ${minusOne.day}`)
      assert(weather.hijri.month === minusOne.month, 'weather hijri month mismatch')
      assert(weather.hijri.formattedEn.includes(String(minusOne.day)), 'weather formatted date missing corrected day')

      const auto = await updateSettings({ resetHijriAuto: true })
      assert(auto.hijriAdjustmentDays === 0, 'reset auto did not clear offset')
      console.log('hijri correction OK', {
        auto: today.formattedEn,
        corrected: minusOne.formattedEn,
        storedOffset: saved.hijriAdjustmentDays,
      })
    } finally {
      await prisma.businessSettings.updateMany({
        data: { hijriAdjustmentDays: previous },
      })
    }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('SMOKE PASS')
  })
  .catch(async (error) => {
    console.error('SMOKE FAIL', error)
    await prisma.$disconnect()
    process.exit(1)
  })
