import { config } from 'dotenv'
config({ path: '.env' })

/**
 * Production API smoke test — run: npx tsx scripts/api-smoke.ts
 */
import { requireShopPassword } from './smoke-credentials'

const BASE = process.env.SMOKE_BASE || 'https://arhat-management-system.vercel.app'
const OWNER_PASSWORD = requireShopPassword('owner')
const DEMO_PASSWORD = requireShopPassword('hasham')

type Result = { name: string; ok: boolean; status: number; detail: string }

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any; text: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}/api/${path.replace(/^\//, '')}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* html or plain */
  }
  return { status: res.status, json, text: text.slice(0, 200) }
}

async function login(username: string, password: string) {
  const r = await req('auth/login', {
    method: 'POST',
    body: { username, password },
  })
  if (!r.json?.success || !r.json?.data?.token) {
    throw new Error(`login failed for ${username}: ${r.status} ${r.text}`)
  }
  return r.json.data.token as string
}

async function check(
  name: string,
  path: string,
  opts: { method?: string; token?: string; body?: unknown; expect?: number | number[] } = {},
): Promise<Result> {
  const expect = opts.expect ?? 200
  const allowed = Array.isArray(expect) ? expect : [expect]
  try {
    const r = await req(path, opts)
    const ok =
      allowed.includes(r.status) &&
      (r.json == null || r.json.success !== false || allowed.some((s) => s >= 400))
    // For 2xx, require success:true when JSON envelope present
    const envelopeOk =
      r.status >= 400 || r.json == null || r.json.success === true || r.json.success === undefined
    return {
      name,
      ok: ok && envelopeOk && !r.text.includes('<!DOCTYPE'),
      status: r.status,
      detail:
        r.json?.message ||
        (typeof r.json?.data === 'object'
          ? `keys=${Object.keys(r.json.data || {}).slice(0, 6).join(',')}`
          : r.text.slice(0, 120)),
    }
  } catch (e) {
    return { name, ok: false, status: 0, detail: String(e) }
  }
}

async function main() {
  const results: Result[] = []

  results.push(await check('health', 'health'))
  results.push(await check('settings/public', 'settings/public'))

  let liveToken = ''
  try {
    liveToken = await login('owner', OWNER_PASSWORD)
    results.push({ name: 'login owner', ok: true, status: 200, detail: 'ok' })
  } catch (e) {
    results.push({ name: 'login owner', ok: false, status: 0, detail: String(e) })
  }
  let demoToken = ''
  try {
    const r = await req('auth/login', {
      method: 'POST',
      body: { username: 'hasham', password: DEMO_PASSWORD },
    })
    const data = r.json?.data || {}
    demoToken = data.token || ''
    results.push({
      name: 'login hasham demo',
      ok: Boolean(demoToken) && data.role === 'OWNER' && data.workspace === 'demo' && data.isDemo === true,
      status: r.status,
      detail: `role=${data.role} workspace=${data.workspace} isDemo=${data.isDemo}`,
    })
  } catch (e) {
    results.push({ name: 'login hasham demo', ok: false, status: 0, detail: String(e) })
  }

  try {
    await login('staff', 'Nankana#Desk5831Rtc')
    results.push({ name: 'login staff removed', ok: false, status: 200, detail: 'staff should be rejected' })
  } catch {
    results.push({ name: 'login staff removed', ok: true, status: 401, detail: 'rejected' })
  }

  if (demoToken) {
    try {
      const [a, b] = await Promise.all([
        login('hasham', DEMO_PASSWORD),
        login('hasham', DEMO_PASSWORD),
      ])
      const pulseA = await req('sync/pulse', { token: a })
      const pulseB = await req('sync/pulse', { token: b })
      results.push({
        name: 'parallel demo sessions',
        ok: pulseA.status === 200 && pulseB.status === 200 && a !== b,
        status: pulseA.status,
        detail: `tokensDistinct=${a !== b} pulseA=${pulseA.status} pulseB=${pulseB.status}`,
      })
    } catch (e) {
      results.push({ name: 'parallel demo sessions', ok: false, status: 0, detail: String(e) })
    }
    results.push(
      await check('demo owner commission', 'reports/commission', { token: demoToken }),
    )
    results.push(
      await check('demo owner panel users', 'users', { token: demoToken }),
    )
  }
  for (const [u, p] of [
    ['rehmani', 'rehmani123'],
    ['demo', 'demo123'],
    ['admin', 'admin'],
  ] as const) {
    try {
      await login(u, p)
      results.push({ name: `login blocked ${u}`, ok: false, status: 200, detail: 'should have been rejected' })
    } catch {
      results.push({ name: `login blocked ${u}`, ok: true, status: 401, detail: 'rejected' })
    }
  }

  const token = liveToken
  if (!token) {
    console.log(JSON.stringify(results, null, 2))
    process.exit(1)
  }

  const authed: Array<[string, string, number?]> = [
    ['sync/pulse', 'sync/pulse'],
    ['weather', 'weather'],
    ['dashboard/stats', 'dashboard/stats'],
    ['settings', 'settings'],
    ['settings/products', 'settings/products'],
    ['farmers', 'farmers'],
    ['buyers', 'buyers'],
    ['trucks', 'trucks'],
    ['dheris', 'dheris'],
    ['stock', 'stock'],
    ['queue', 'queue'],
    ['sales', 'sales'],
    ['payments', 'payments'],
    ['search?q=wheat', 'search?q=wheat'],
    ['reports/stock', 'reports/stock'],
    ['reports/sales', 'reports/sales'],
    ['reports/commission', 'reports/commission'],
    ['reports/profit', 'reports/profit'],
    ['queue/pending', 'queue/pending'],
    ['queue/active', 'queue/active'],
    ['stock/history', 'stock/history'],
  ]

  for (const [name, path] of authed) {
    results.push(await check(name, path, { token }))
  }

  // mutation smoke (owner live workspace)
  {
    const create = await req('farmers', {
      method: 'POST',
      token,
      body: { name: 'Smoke Test Farmer', phone: '03001110000', city: 'Lahore', code: `SMK-${Date.now()}` },
    })
    results.push({
      name: 'create farmer',
      ok: create.status >= 200 && create.status < 300 && create.json?.success === true,
      status: create.status,
      detail: create.json?.message || create.json?.data?.farmerId || create.text,
    })
    const id = create.json?.data?.id
    if (id) {
      const del = await req(`farmers/${id}`, { method: 'DELETE', token })
      results.push({
        name: 'delete farmer',
        ok: del.status >= 200 && del.status < 300,
        status: del.status,
        detail: del.json?.message || del.text,
      })
    }
  }

  // calculator
  results.push(
    await check('calculator', 'calculator/calculate', {
      method: 'POST',
      token,
      body: {
        numberOfBags: 10,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 3000,
        commissionPercentage: 4,
      },
    }),
  )

  if (liveToken && demoToken) {
    const stamp = `ISO-${Date.now()}`
    const create = await req('farmers', {
      method: 'POST',
      token: demoToken,
      body: { name: `Demo Isolation ${stamp}`, city: 'Lahore', code: stamp },
    })
    const demoId = create.json?.data?.id
    const liveList = await req('farmers', { token: liveToken })
    const rows = Array.isArray(liveList.json?.data) ? liveList.json.data : []
    const leaked = rows.some(
      (row: { name?: string; farmerId?: string; code?: string }) =>
        row.name === `Demo Isolation ${stamp}` || row.farmerId === stamp || row.code === stamp,
    )
    results.push({
      name: 'demo data hidden from live owner',
      ok: create.status >= 200 && create.status < 300 && !leaked,
      status: create.status,
      detail: leaked ? 'demo farmer leaked into live' : `created=${Boolean(demoId)} isolated=true`,
    })
    if (demoId) {
      await req(`farmers/${demoId}`, { method: 'DELETE', token: demoToken })
    }
  }

  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? 'OK ' : 'FAIL'} ${r.status} ${r.name} — ${r.detail}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
