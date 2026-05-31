import { AnimatePresence, motion } from 'framer-motion'

export default function QueueCounter({ count }) {
  const label = count === 0 ? 'Queue Empty' : count === 1 ? 'Final Case' : `${count} Cases Remaining`
  const color  = count === 0 ? '#6b7280' : count <= 5 ? '#f59e0b' : '#6366f1'

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-semibold font-mono"
          style={{ color }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
      {count > 0 && (
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: color }}
        />
      )}
    </div>
  )
}
