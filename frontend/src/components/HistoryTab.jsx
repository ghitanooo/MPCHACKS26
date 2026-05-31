import { useEffect } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'

const FILTERS = ['ALL', 'BLOCK', 'APPROVE', 'ESCALATE']

const DECISION_COLORS = {
  BLOCK:    { bg: 'rgba(239,68,68,0.15)',  border: '#ef444430', text: '#ef4444' },
  APPROVE:  { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e30', text: '#22c55e' },
  ESCALATE: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b30', text: '#f59e0b' },
}

function HistoryCard({ item, onClick }) {
  const decision = item.status?.toUpperCase().replace('ED', '').replace('OV', 'APPROV') ?? ''
  const decisionKey = item.status === 'Approved' ? 'APPROVE' : item.status === 'Blocked' ? 'BLOCK' : 'ESCALATE'
  const colors = DECISION_COLORS[decisionKey] ?? DECISION_COLORS.ESCALATE
  const score = Math.round(item.anomaly_score ?? 0)
  const scoreColor = score > 700 ? '#ef4444' : score > 400 ? '#f59e0b' : '#22c55e'

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left rounded-2xl p-4 transition-colors"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white/50">{item.transaction_id}</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {item.status}
          </span>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: scoreColor }}>
          {score}/1000
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="font-medium text-white/70 truncate mr-2">{item.merchant_name}</span>
        <span className="shrink-0">${item.amount?.toFixed(2)}</span>
      </div>

      {item.decision_at && (
        <div className="text-[10px] text-white/30 mt-1">
          {new Date(item.decision_at).toLocaleString()}
        </div>
      )}
    </motion.button>
  )
}

export default function HistoryTab() {
  const { history, historyFilter, setHistoryFilter, startReplay, setMode, loadHistory } = useStore()

  useEffect(() => {
    loadHistory(historyFilter)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <button
          onClick={() => setMode('queue')}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back to Queue
        </button>
        <span className="text-sm font-semibold text-white/80">Investigation History</span>
        <span className="text-xs text-white/30">{history.length} cases</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-6 py-3 shrink-0">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setHistoryFilter(f)}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: historyFilter === f ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              color: historyFilter === f ? '#818cf8' : '#6b7280',
              border: `1px solid ${historyFilter === f ? '#6366f140' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/30 text-sm">
            No reviewed cases yet.
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {history.map(item => (
              <HistoryCard
                key={item.transaction_id}
                item={item}
                onClick={() => startReplay(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
