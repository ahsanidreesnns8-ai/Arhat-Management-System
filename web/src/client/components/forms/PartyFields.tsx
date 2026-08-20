import Input from '../ui/Input'

export type PartyFormValues = {
  code: string
  name: string
  fatherName: string
  address: string
  city: string
  notes: string
}

export const emptyPartyForm = (): PartyFormValues => ({
  code: '',
  name: '',
  fatherName: '',
  address: '',
  city: '',
  notes: '',
})

export default function PartyFields({
  form,
  setForm,
  idLabel,
}: {
  form: PartyFormValues
  setForm: (next: PartyFormValues) => void
  idLabel: string
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={`${idLabel} *`}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="ID you assign — same as Arhat Register if they already have one"
        />
        <Input
          label="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Father name"
          value={form.fatherName}
          onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
        />
        <Input
          label="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Note"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
