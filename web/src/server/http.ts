import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

export type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T | null
}

export function serialize<T>(value: T): T {
  return serializeValue(value) as T
}

function serializeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : value.toString()
  }
  if (value instanceof Prisma.Decimal) return value.toNumber()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value && typeof value === 'object') {
    if ('toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber()
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeValue(child)]),
    )
  }
  return value
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(serialize(data), { status, headers })
}

export function ok<T>(data: T, message?: string, status = 200) {
  const body: ApiEnvelope<T> = { success: true, data }
  if (message) body.message = message
  return json(body, status)
}

export function fail(message: string, status = 400, data: unknown = null) {
  return json({ success: false, message, data }, status)
}

export function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
