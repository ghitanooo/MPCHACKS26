import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'

const JURORS = [
  {
    id: 'iforest',
    emoji: '🌲',
    name: 'Isolation Forest',
    role: 'Forest Ranger',
    line: 'Unusual behavior detected.',
  },
  {
    id: 'ecod',
    emoji: '📊',
    name: 'ECOD',
    role: 'Data Scientist',
    line: 'Strong statistical deviation.',
  },
  {
    id: 'copod',
    emoji: '🔗',
    name: 'COPOD',
    role: 'Detective',
    line: 'Pattern inconsistent with history.',
  },
  {
    id: 'hbos',
    emoji: '📦',
    name: 'HBOS',
    role: 'Accountant',
    line: 'Distribution anomaly confirmed.',
  },
]

function JurorCard({ juror, score, vote, index, phase }) {
  const isFraud = vote === 1
  const showVote = phase === 'voting' || phase === 'complete'

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.3, duration: 0.5, type: 'spring', stiffness: 120 }}
      className="flex flex-col items-center gap-2 flex-1 min-w-0"
    >
      {/* Avatar */}
      <motion.div
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        animate={
          phase === 'deliberating'
            ? { rotate: [-2, 2, -2], transition: { repeat: Infinity, duration: 0.6 } }
            : phase === 'entering'
            ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } }
            : {}
        }
      >
        {juror.emoji}
        {phase === 'deliberating' && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </motion.div>

      {/* Name */}
      <div className="text-center">
        <div className="text-xs font-semibold text-white/80 leading-tight truncate w-full px-1">{juror.name}</div>
        <div className="text-[10px] text-white/40 truncate">{juror.role}</div>
      </div>

      {/* Deliberation line */}
      <AnimatePresence>
        {phase === 'deliberating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-white/50 text-center italic px-1 leading-tight"
          >
            "{juror.line}"
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vote reveal */}
      <AnimatePresence>
        {showVote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.2, type: 'spring', stiffness: 300 }}
            className="flex flex-col items-center gap-1"
          >
            <div
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                background: isFraud ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                color: isFraud ? '#ef4444' : '#22c55e',
                border: `1px solid ${isFraud ? '#ef4444' : '#22c55e'}40`,
              }}
            >
              {isFraud ? 'FRAUD' : 'NORMAL'}
            </div>
            <div className="text-[11px] font-mono text-white/60">
              {score != null ? `${Math.round(score)}/1000` : '—'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function JuryPanel({ tx, phase, onComplete }) {
  const modelVotes = tx?.model_votes ?? {}
  const modelScores = tx?.model_scores ?? {}
  const voteCount = Object.values(modelVotes).filter(v => v === 1).length

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4 text-center">
        Model Jury
      </div>

      <div className="flex gap-3">
        {JURORS.map((juror, i) => (
          <JurorCard
            key={juror.id}
            juror={juror}
            score={modelScores[juror.id]}
            vote={modelVotes[juror.id]}
            index={i}
            phase={phase}
          />
        ))}
      </div>

      {/* Verdict banner */}
      <AnimatePresence>
        {(phase === 'complete') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 rounded-xl px-4 py-3 text-center"
            style={{
              background: voteCount >= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
              border: `1px solid ${voteCount >= 3 ? '#ef444430' : '#6366f130'}`,
            }}
          >
            <span className="text-sm font-bold" style={{ color: voteCount >= 3 ? '#ef4444' : '#6366f1' }}>
              {voteCount} of 4 models suspect fraud
            </span>
            <span className="text-xs text-white/40 ml-2">
              · Score {Math.round(tx?.anomaly_score ?? 0)}/1000 · {tx?.fraud_confidence?.toUpperCase()} confidence
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
