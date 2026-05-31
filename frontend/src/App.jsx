import { useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import CaseView from './components/CaseView'
import HistoryTab from './components/HistoryTab'
import ReplayOverlay from './components/ReplayOverlay'

export default function App() {
  const mode = useStore(s => s.mode)
  const replayCase = useStore(s => s.replayCase)
  const uploading = useStore(s => s.uploading)
  const uploadMsg = useStore(s => s.uploadMsg)
  const uploadCSV = useStore(s => s.uploadCSV)
  const fileRef = useRef(null)

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Upload bar (shown when no queue data loaded yet or always accessible) */}
      {uploadMsg && (
        <div
          className="text-center text-xs py-1.5 px-4 shrink-0"
          style={{ background: 'rgba(99,102,241,0.12)', borderBottom: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
        >
          {uploadMsg}
          <button
            onClick={() => fileRef.current?.click()}
            className="ml-3 underline hover:text-indigo-300"
          >
            Upload new CSV
          </button>
        </div>
      )}

      {/* First-run upload prompt */}
      {!uploadMsg && (
        <div
          className="text-center text-xs py-1.5 px-4 shrink-0 cursor-pointer hover:bg-white/5 transition-colors"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#4b5563' }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Processing CSV...' : '↑ Upload transactions.csv to begin'}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) uploadCSV(f)
          e.target.value = ''
        }}
      />

      {/* Main area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {mode === 'queue' ? (
            <div key="queue" className="absolute inset-0">
              <CaseView />
            </div>
          ) : (
            <div key="history" className="absolute inset-0">
              <HistoryTab />
            </div>
          )}
        </AnimatePresence>

        {/* Replay overlay */}
        <AnimatePresence>
          {replayCase && <ReplayOverlay key="replay" />}
        </AnimatePresence>
      </div>
    </div>
  )
}
