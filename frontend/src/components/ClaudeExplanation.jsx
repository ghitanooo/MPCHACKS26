import { motion } from 'framer-motion'

const ACTION_COLORS = {
  BLOCK: { bg: 'rgba(239,68,68,0.12)', border: '#ef444430', text: '#ef4444' },
  ESCALATE: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b30', text: '#f59e0b' },
  APPROVE: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e30', text: '#22c55e' },
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded"
          style={{ background: 'rgba(255,255,255,0.06)', width: `${70 + (i % 3) * 10}%` }}
        />
      ))}
    </div>
  )
}

export default function ClaudeExplanation({ explanation, loading }) {
  const colors = ACTION_COLORS[explanation?.recommended_action] ?? ACTION_COLORS.ESCALATE

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">AI Analysis</span>
        <span className="text-[10px] text-white/30">· claude-sonnet-4-6</span>
      </div>

      {loading ? (
        <Skeleton lines={4} />
      ) : explanation ? (
        <>
          <p className="text-sm text-white/80 leading-relaxed">{explanation.summary}</p>

          {explanation.why_suspicious?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Why Suspicious</div>
              <ul className="space-y-1">
                {explanation.why_suspicious.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-white/70">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.recommended_action && (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
            >
              <span className="text-xs font-bold" style={{ color: colors.text }}>
                RECOMMEND: {explanation.recommended_action}
              </span>
              <span className="text-xs text-white/50 flex-1">{explanation.reason}</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-white/30 italic">Explanation will appear after jury completes.</p>
      )}
    </motion.div>
  )
}
