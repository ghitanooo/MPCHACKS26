import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import JuryPanel from './JuryPanel'
import ClaudeExplanation from './ClaudeExplanation'
import GeoMap from './evidence/GeoMap'
import VelocityChart from './evidence/VelocityChart'
import SpendingChart from './evidence/SpendingChart'
import DeviceIPEvidence from './evidence/DeviceIPEvidence'
import ChannelEvidence from './evidence/ChannelEvidence'
import MerchantEvidence from './evidence/MerchantEvidence'
import SHAPChart from './evidence/SHAPChart'

const JURY_SEQUENCE = [
  { phase: 'entering',     delay: 0 },
  { phase: 'deliberating', delay: 1200 },
  { phase: 'voting',       delay: 1800 },
  { phase: 'complete',     delay: 2400 },
]

const DECISION_STYLES = {
  Approved: { bg: 'rgba(34,197,94,0.2)', border: '#22c55e40', color: '#22c55e', label: 'APPROVED' },
  Blocked:  { bg: 'rgba(239,68,68,0.2)',  border: '#ef444440', color: '#ef4444', label: 'BLOCKED' },
  Escalated:{ bg: 'rgba(245,158,11,0.2)', border: '#f59e0b40', color: '#f59e0b', label: 'ESCALATED' },
}

export default function ReplayOverlay() {
  const { replayCase: tx, stopReplay } = useStore()
  const [juryPhase, setJuryPhase] = useState('idle')
  const [showEvidence, setShowEvidence] = useState(false)
  const [showDecision, setShowDecision] = useState(false)

  useEffect(() => {
    if (!tx) return
    setJuryPhase('idle')
    setShowEvidence(false)
    setShowDecision(false)

    const timers = []
    JURY_SEQUENCE.forEach(({ phase, delay }) => {
      timers.push(setTimeout(() => setJuryPhase(phase), delay))
    })
    timers.push(setTimeout(() => setShowEvidence(true), 2800))
    timers.push(setTimeout(() => setShowDecision(true), 3800))

    return () => timers.forEach(clearTimeout)
  }, [tx?.transaction_id])

  if (!tx) return null

  const ev = tx.evidence_snapshot ?? {}
  const explanation = tx.explanation ?? null
  const decisionStyle = DECISION_STYLES[tx.status] ?? DECISION_STYLES.Escalated
  const score = Math.round(tx.anomaly_score ?? 0)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(8px)' }}
    >
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/30 uppercase tracking-widest mb-1">Replaying Investigation</div>
            <div className="text-lg font-bold text-white/80">{tx.transaction_id}</div>
          </div>
          <button
            onClick={stopReplay}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            ← Close Replay
          </button>
        </div>

        {/* Transaction info */}
        <div
          className="rounded-2xl p-4 grid grid-cols-2 gap-x-6 gap-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {[
            ['Amount', `$${tx.amount?.toFixed(2)} CAD`],
            ['Merchant', tx.merchant_name],
            ['Category', tx.merchant_category],
            ['Channel', tx.channel],
            ['Card', tx.card_id],
            ['Time', new Date(tx.timestamp).toLocaleString()],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-[10px] text-white/30 uppercase">{label}</div>
              <div className="text-sm text-white/80 truncate">{val}</div>
            </div>
          ))}
        </div>

        {/* Jury replay */}
        <JuryPanel tx={tx} phase={juryPhase} />

        {/* Evidence */}
        <AnimatePresence>
          {showEvidence && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
              {[
                ['Geographic', '🗺', <GeoMap geo={ev.geo} />],
                ['Velocity', '⚡', <VelocityChart velocity={ev.velocity} />],
                ['Spending', '💰', <SpendingChart spending={ev.spending} />],
                ['Device & IP', '🔌', <DeviceIPEvidence device_ip={ev.device_ip} />],
                ['Channel', '📡', <ChannelEvidence channel={ev.channel} tx={tx} />],
                ['Merchant', '🏪', <MerchantEvidence merchant={ev.merchant} tx={tx} />],
              ].map(([title, icon, child]) => (
                <div key={title} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{icon} {title}</div>
                  {child}
                </div>
              ))}
              <div className="col-span-2 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">📊 SHAP Feature Impact</div>
                <SHAPChart features={tx.shap_top_features} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Claude explanation */}
        {showEvidence && (
          <ClaudeExplanation explanation={explanation} loading={false} />
        )}

        {/* Final decision reveal */}
        <AnimatePresence>
          {showDecision && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center py-6"
            >
              <div
                className="inline-block px-8 py-4 rounded-2xl text-2xl font-black"
                style={{ background: decisionStyle.bg, border: `2px solid ${decisionStyle.border}`, color: decisionStyle.color }}
              >
                {decisionStyle.label}
              </div>
              {tx.decision_at && (
                <div className="text-xs text-white/30 mt-2">
                  Reviewed {new Date(tx.decision_at).toLocaleString()}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
