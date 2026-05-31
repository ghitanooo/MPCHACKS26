import { useRef } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'

// direction: null | 'approve' | 'block' | 'escalate'
export default function SwipeCard({ children, onTriage, exitDirection }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-12, 12])

  const approveOpacity = useTransform(x, [-150, -30], [1, 0])
  const blockOpacity   = useTransform(x, [30, 150], [0, 1])
  const escalateOpacity = useTransform(y, [-150, -30], [1, 0])

  const exitVariants = {
    approve:  { x: -window.innerWidth * 1.5, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } },
    block:    { x:  window.innerWidth * 1.5, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } },
    escalate: { y: -window.innerHeight * 1.5, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } },
  }

  const handleDragEnd = (_, info) => {
    const { offset } = info
    if (offset.y < -100) { onTriage('ESCALATE'); return }
    if (offset.x < -100) { onTriage('APPROVE'); return }
    if (offset.x >  100) { onTriage('BLOCK'); return }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: 1000 }}>
      {/* Direction hint overlays */}
      <motion.div
        style={{ opacity: approveOpacity }}
        className="absolute top-6 left-6 z-20 pointer-events-none"
      >
        <div className="px-4 py-2 rounded-xl text-lg font-black rotate-[-12deg]"
          style={{ background: 'rgba(34,197,94,0.25)', border: '2px solid #22c55e', color: '#22c55e' }}>
          ✓ APPROVE
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: blockOpacity }}
        className="absolute top-6 right-6 z-20 pointer-events-none"
      >
        <div className="px-4 py-2 rounded-xl text-lg font-black rotate-[12deg]"
          style={{ background: 'rgba(239,68,68,0.25)', border: '2px solid #ef4444', color: '#ef4444' }}>
          ✗ BLOCK
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: escalateOpacity }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
      >
        <div className="px-4 py-2 rounded-xl text-lg font-black"
          style={{ background: 'rgba(245,158,11,0.25)', border: '2px solid #f59e0b', color: '#f59e0b' }}>
          ↑ ESCALATE
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!exitDirection ? (
          <motion.div
            key="card"
            style={{ x, y, rotate }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.25}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 200 }}
            className="w-full cursor-grab active:cursor-grabbing"
            style={{ x, y, rotate, touchAction: 'none' }}
          >
            {children}
          </motion.div>
        ) : (
          <motion.div
            key="exiting"
            initial={{ opacity: 1, scale: 1 }}
            animate={exitVariants[exitDirection] ?? { opacity: 0 }}
            className="w-full pointer-events-none"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
