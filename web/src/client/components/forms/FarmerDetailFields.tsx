import Input from '../ui/Input'
import type { Farmer } from '../../types'

/** Saved farmer record shown after the user picks a name — bags/rate stay empty for them to fill. */
export default function FarmerDetailFields({ farmer }: { farmer: Farmer | null | undefined }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label="Farmer ID" value={farmer?.farmerId || ''} readOnly />
      <Input label="Name" value={farmer?.name || ''} readOnly />
      <Input label="Father name" value={farmer?.fatherName || ''} readOnly />
      <Input label="Phone" value={farmer?.phone || ''} readOnly />
      <Input label="CNIC" value={farmer?.cnic || ''} readOnly />
      <Input label="City" value={farmer?.city || ''} readOnly />
      <div className="sm:col-span-2">
        <Input label="Address" value={farmer?.address || ''} readOnly />
      </div>
    </div>
  )
}
