import { FileText, Wallet } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/format'
import type { AccountStatement } from '../../types'

function MoneyCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'good' | 'warn' }) {
  const toneClass = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-gray-900 dark:text-white'
  return (
    <div className="card-3d p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{formatCurrency(value)}</p>
    </div>
  )
}

export function statementSummary(statement?: AccountStatement | null) {
  const alreadyGiven = statement?.cashGiven ?? 0
  const alreadyReceived = statement?.cashReceived ?? 0
  const remainingToGive = statement?.remainingToGive ?? 0
  const remainingToReceive = statement?.remainingToReceive ?? 0
  const productTotal = statement?.productTotal ?? 0
  const soldTotal = statement?.soldTotal ?? 0
  const label = remainingToGive > 0
    ? 'Remaining to give'
    : remainingToReceive > 0
      ? 'Remaining to receive'
      : alreadyGiven || alreadyReceived || productTotal || soldTotal
        ? 'Settled'
        : 'Total balance'
  return {
    alreadyGiven,
    alreadyReceived,
    remainingToGive,
    remainingToReceive,
    productTotal,
    soldTotal,
    label,
    net: remainingToGive || remainingToReceive || 0,
  }
}

export default function TotalBalancePanel({
  open,
  onClose,
  title,
  statement,
  onPrint,
  onGive,
  onReceive,
  giveLabel = 'Give on this ID',
  receiveLabel = 'Receive on this ID',
}: {
  open: boolean
  onClose: () => void
  title: string
  statement?: AccountStatement | null
  onPrint: (lang: 'en' | 'ur') => void
  onGive?: () => void
  onReceive?: () => void
  giveLabel?: string
  receiveLabel?: string
}) {
  const summary = statementSummary(statement)
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          This is the whole account: money already given or received on Arhat Register, plus product / sales history. The product bill stays product-only.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MoneyCard label="Already given" value={summary.alreadyGiven} tone={summary.alreadyGiven > 0 ? 'warn' : 'neutral'} />
          <MoneyCard label="Already received" value={summary.alreadyReceived} tone={summary.alreadyReceived > 0 ? 'good' : 'neutral'} />
          <MoneyCard label="Product in" value={summary.productTotal} tone="neutral" />
          {summary.soldTotal > 0 ? <MoneyCard label="Sold" value={summary.soldTotal} tone="neutral" /> : null}
          <MoneyCard
            label={summary.label}
            value={summary.net}
            tone={summary.net ? 'warn' : 'good'}
          />
        </div>
        {statement?.lines?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-2 py-2">Particular</th>
                  <th className="px-2 py-2 text-right">Added</th>
                  <th className="px-2 py-2 text-right">Deducted</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((row, index) => (
                  <tr key={`${row.kind}-${index}`} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-2 py-2">{row.particular}</td>
                    <td className="px-2 py-2 text-right">{row.addition ? formatCurrency(row.addition) : '—'}</td>
                    <td className="px-2 py-2 text-right">{row.deduction ? formatCurrency(row.deduction) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No register or product lines yet for this person.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {onGive ? (
            <Button variant="secondary" onClick={onGive}>
              <Wallet className="h-4 w-4" /> {giveLabel}
            </Button>
          ) : null}
          {onReceive ? (
            <Button variant="secondary" onClick={onReceive}>
              {receiveLabel}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={() => onPrint('ur')}>Total balance bill (UR)</Button>
          <Button onClick={() => onPrint('en')}>
            <FileText className="h-4 w-4" /> Generate total balance bill
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function TotalBalancePreview({
  statement,
  onOpen,
}: {
  statement?: AccountStatement | null
  onOpen: () => void
}) {
  const summary = statementSummary(statement)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-3d p-5 space-y-3 w-full text-left hover:ring-2 hover:ring-primary/30 transition"
    >
      <div>
        <p className="text-sm font-semibold">Total balance</p>
        <p className="text-sm text-slate-500 mt-1">
          Tap to see money already given or received, plus complete history. Generate the total-balance bill from there. Product bill stays product-only.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyCard label="Already given" value={summary.alreadyGiven} tone={summary.alreadyGiven > 0 ? 'warn' : 'neutral'} />
        <MoneyCard label="Already received" value={summary.alreadyReceived} tone={summary.alreadyReceived > 0 ? 'good' : 'neutral'} />
        <MoneyCard label="Remaining to give" value={summary.remainingToGive} tone={summary.remainingToGive > 0 ? 'warn' : 'good'} />
        <MoneyCard label="Remaining to receive" value={summary.remainingToReceive} tone={summary.remainingToReceive > 0 ? 'warn' : 'good'} />
      </div>
      <p className="text-sm font-semibold text-primary">
        {summary.label}: {formatCurrency(summary.net)}
      </p>
    </button>
  )
}
