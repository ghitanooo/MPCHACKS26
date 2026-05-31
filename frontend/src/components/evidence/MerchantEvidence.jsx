export default function MerchantEvidence({ merchant, tx }) {
  if (!merchant) return null

  const count = merchant.unique_cards_1hr ?? 0
  const isBurst = count >= 5

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3"
      style={{
        background: isBurst ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isBurst ? '#ef444330' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <span className="text-2xl">🏪</span>
      <div>
        <div className="text-sm font-semibold text-white/80 truncate max-w-[180px]">
          {tx?.merchant_name ?? 'Merchant'}
        </div>
        <div className="text-xs" style={{ color: isBurst ? '#ef4444' : '#6b7280' }}>
          {count === 0
            ? 'No other cards in the last hour'
            : `${count} different card${count !== 1 ? 's' : ''} used here in the last hour`}
          {isBurst && <span className="ml-1 font-bold">— burst detected</span>}
        </div>
      </div>
    </div>
  )
}
