import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import JuryPanel from './JuryPanel'
import ClaudeExplanation from './ClaudeExplanation'
import QueueCounter from './QueueCounter'
import SwipeCard from './SwipeCard'
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

function EvidenceSection({ tx }) {
  const ev = tx?.evidence_snapshot ?? {}
  return (
    <div className="grid grid-cols-2 gap-3">
      <EvidenceCard title="Geographic" icon="🗺">
        <GeoMap geo={ev.geo} />
      </EvidenceCard>
      <EvidenceCard title="Velocity" icon="⚡">
        <VelocityChart velocity={ev.velocity} />
      </EvidenceCard>
      <EvidenceCard title="Spending" icon="💰">
        <SpendingChart spending={ev.spending} />
      </EvidenceCard>
      <EvidenceCard title="Device & IP" icon="🔌">
        <DeviceIPEvidence device_ip={ev.device_ip} />
      </EvidenceCard>
      <EvidenceCard title="Channel" icon="📡">
        <ChannelEvidence channel={ev.channel} tx={tx} />
      </EvidenceCard>
      <EvidenceCard title="Merchant" icon="🏪">
        <MerchantEvidence merchant={ev.merchant} tx={tx} />
      </EvidenceCard>
      <div className="col-span-2">
        <EvidenceCard title="SHAP Feature Impact" icon="📊">
          <SHAPChart features={tx?.shap_top_features} />
        </EvidenceCard>
      </div>
    </div>
  )
}

function EvidenceCard({ title, icon, children }) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

function TransactionMeta({ tx }) {
  const score = Math.round(tx.anomaly_score ?? 0)
  const scoreColor = score > 700 ? '#ef4444' : score > 400 ? '#f59e0b' : '#22c55e'

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Score badge */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black font-mono"
          style={{ background: `${scoreColor}18`, border: `2px solid ${scoreColor}40`, color: scoreColor }}
        >
          {score > 999 ? '999+' : score}
        </div>
        <div className="text-[10px] text-white/40 mt-1">/ 1000</div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-1">
        <MetaRow label="Amount"   value={`$${tx.amount?.toFixed(2)} CAD`} highlight />
        <MetaRow label="Card"     value={tx.card_id} mono />
        <MetaRow label="Merchant" value={tx.merchant_name} />
        <MetaRow label="Category" value={tx.merchant_category} />
        <MetaRow label="Channel"  value={tx.channel} />
        <MetaRow label="Time"     value={new Date(tx.timestamp).toLocaleString()} />
        {tx.ip_address && <MetaRow label="IP" value={tx.ip_address} mono />}
        {tx.device_id  && <MetaRow label="Device" value={tx.device_id} mono />}
      </div>
    </div>
  )
}

function MetaRow({ label, value, highlight, mono }) {
  return (
    <div>
      <div className="text-[10px] text-white/30 uppercase tracking-wider">{label}</div>
      <div className={`text-sm truncate ${highlight ? 'font-bold text-white' : 'text-white/80'} ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function TriageHints() {
  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      <HintBtn label="Approve" key="approve" icon="←" color="#22c55e" hint="A / ←" />
      <HintBtn label="Escalate" key="escalate" icon="↑" color="#f59e0b" hint="W / ↑" />
      <HintBtn label="Block" key="block" icon="→" color="#ef4444" hint="D / →" />
    </div>
  )
}

function HintBtn({ label, icon, color, hint }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
        style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}
      >
        {icon}
      </div>
      <div className="text-[10px] text-white/60">{hint}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  )
}

export default function CaseView() {
  const { queue, activeCase, juryPhase, setJuryPhase, triage, explanation, loadingExpl, loadExplanation, setMode, loadQueue } = useStore()
  const [exitDirection, setExitDirection] = useState(null)
  const timersRef = useRef([])

  // Load queue on mount
  useEffect(() => {
    loadQueue()
  }, [])

  // Run jury sequence when new case loads
  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setExitDirection(null)

    if (!activeCase) return

    JURY_SEQUENCE.forEach(({ phase, delay }) => {
      const t = setTimeout(() => setJuryPhase(phase), delay)
      timersRef.current.push(t)
    })

    // Load explanation after jury completes
    const explTimer = setTimeout(() => {
      loadExplanation(activeCase.transaction_id)
    }, 3200)
    timersRef.current.push(explTimer)

    return () => timersRef.current.forEach(clearTimeout)
  }, [activeCase?.transaction_id])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (!activeCase || exitDirection) return
      if (e.key === 'a' || e.key === 'ArrowLeft')  handleTriage('APPROVE')
      if (e.key === 'd' || e.key === 'ArrowRight') handleTriage('BLOCK')
      if (e.key === 'w' || e.key === 'ArrowUp')    handleTriage('ESCALATE')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeCase, exitDirection])

  const handleTriage = (decision) => {
    const dirMap = { APPROVE: 'approve', BLOCK: 'block', ESCALATE: 'escalate' }
    setExitDirection(dirMap[decision])
    setTimeout(() => triage(decision), 400)
  }

  if (!activeCase) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-white/30">
        <div className="text-5xl">🎉</div>
        <div className="text-xl font-semibold text-white/60">Queue Empty</div>
        <div className="text-sm">All cases have been reviewed.</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode('queue')}
            className="text-sm font-semibold text-indigo-400"
          >
            Fraud Investigation
          </button>
        </div>
        <QueueCounter count={queue.length} />
        <button
          onClick={() => setMode('history')}
          className="text-xs px-3 py-1.5 rounded-lg text-white/50 hover:text-white/80 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          History
        </button>
      </div>

      {/* Case content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCase.transaction_id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 max-w-4xl mx-auto"
          >
            <TransactionMeta tx={activeCase} />
            <JuryPanel tx={activeCase} phase={juryPhase} />

            <AnimatePresence>
              {juryPhase === 'complete' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <EvidenceSection tx={activeCase} />
                  <ClaudeExplanation explanation={explanation} loading={loadingExpl} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Triage hints */}
      <div
        className="shrink-0 px-6 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <TriageHints />
      </div>
    </div>
  )
}
