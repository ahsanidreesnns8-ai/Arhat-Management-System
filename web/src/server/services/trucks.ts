import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { nextTruckCode } from '@/server/ids'

type TruckRow = Prisma.TruckGetPayload<{ include: { farmer: true } }>

export type TruckInput = {
  registrationNumber?: string
  driverName?: string | null
  driverPhone?: string | null
  farmerId?: number
  capacity?: number | string | null
  notes?: string | null
}

export function truckDto(truck: TruckRow) {
  return {
    id: Number(truck.id),
    truckId: truck.truckId,
    registrationNumber: truck.registrationNumber,
    driverName: truck.driverName,
    driverPhone: truck.driverPhone,
    farmerId: Number(truck.farmerId),
    farmerName: truck.farmer.name,
    farmerCode: truck.farmer.farmerId,
    capacity: truck.capacity?.toNumber() ?? null,
    notes: truck.notes,
    active: truck.active,
  }
}

export async function listTrucks() {
  const rows = await prisma.truck.findMany({
    where: { deleted: false },
    include: { farmer: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(truckDto)
}

export async function listTrucksByFarmer(farmerId: number | bigint) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: BigInt(farmerId), deleted: false },
  })
  if (!farmer) throw new Error('Farmer not found')
  const rows = await prisma.truck.findMany({
    where: { farmerId: BigInt(farmerId), deleted: false },
    include: { farmer: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(truckDto)
}

export async function getTruck(id: number | bigint) {
  const row = await prisma.truck.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: { farmer: true },
  })
  if (!row) throw new Error('Truck not found')
  return truckDto(row)
}

async function validate(input: TruckInput) {
  if (!input.registrationNumber?.trim()) {
    throw new Error('Registration number is required')
  }
  if (input.farmerId == null) throw new Error('Farmer is required')
  const farmer = await prisma.farmer.findFirst({
    where: { id: BigInt(input.farmerId), deleted: false },
  })
  if (!farmer) throw new Error('Farmer not found')
}

export async function createTruck(input: TruckInput) {
  await validate(input)
  const row = await prisma.truck.create({
    data: {
      truckId: await nextTruckCode(),
      registrationNumber: input.registrationNumber!.trim(),
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      farmerId: BigInt(input.farmerId!),
      capacity: input.capacity == null ? null : String(input.capacity),
      notes: input.notes,
    },
    include: { farmer: true },
  })
  return truckDto(row)
}

export async function updateTruck(id: number | bigint, input: TruckInput) {
  await getTruck(id)
  await validate(input)
  const row = await prisma.truck.update({
    where: { id: BigInt(id) },
    data: {
      registrationNumber: input.registrationNumber!.trim(),
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      farmerId: BigInt(input.farmerId!),
      capacity: input.capacity == null ? null : String(input.capacity),
      notes: input.notes,
    },
    include: { farmer: true },
  })
  return truckDto(row)
}

export async function deleteTruck(id: number | bigint) {
  await getTruck(id)
  await prisma.truck.update({
    where: { id: BigInt(id) },
    data: { deleted: true },
  })
}
