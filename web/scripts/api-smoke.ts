/**
 * Production API smoke test — run: npx tsx scripts/api-smoke.ts
 */
const BASE = process.env.SMOKE_BASE || 'https://arhat-management-system.vercel.app'

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
  let demoToken = ''
  try {
    liveToken = await login('rehmani', 'rehmani123')
    results.push({ name: 'login rehmani', ok: true, status: 200, detail: 'ok' })
  } catch (e) {
    results.push({ name: 'login rehmani', ok: false, status: 0, detail: String(e) })
  }
  try {
    demoToken = await login('demo', 'demo123')
    results.push({ name: 'login demo', ok: true, status: 200, detail: 'ok' })
  } catch (e) {
    results.push({ name: 'login demo', ok: false, status: 0, detail: String(e) })
  }

  const token = liveToken || demoToken
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
    ['reports/overview', 'reports/overview'],
    ['reports/farmers', 'reports/farmers'],
    ['reports/buyers', 'reports/buyers'],
    ['reports/stock', 'reports/stock'],
    ['reports/sales', 'reports/sales'],
    ['reports/commission', 'reports/commission'],
  ]

  for (const [name, path] of authed) {
    results.push(await check(name, path, { token }))
  }

  // demo workspace reads
  if (demoToken) {
    for (const path of ['sync/pulse', 'farmers', 'dashboard/stats', 'weather']) {
      results.push(await check(`demo:${path}`, path, { token: demoToken }))
    }
  }

  // mutation smoke on demo only
  if (demoToken) {
    const create = await req('farmers', {
      method: 'POST',
      token: demoToken,
      body: { name: 'Smoke Test Farmer', phone: '03001110000', city: 'Lahore' },
    })
    results.push({
      name: 'demo create farmer',
      ok: create.status >= 200 && create.status < 300 && create.json?.success === true,
      status: create.status,
      detail: create.json?.message || create.json?.data?.farmerId || create.text,
    })
    const id = create.json?.data?.id
    if (id) {
      const del = await req(`farmers/${id}`, { method: 'DELETE', token: demoToken })
      results.push({
        name: 'demo delete farmer',
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
