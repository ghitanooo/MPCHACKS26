import { create } from 'zustand'
import axios from 'axios'

const API = 'http://localhost:8000/api'

const useStore = create((set, get) => ({
  // Queue
  queue: [],
  queueLoaded: false,

  // Active investigation
  activeCase: null,
  juryPhase: 'idle',    // 'idle' | 'entering' | 'deliberating' | 'voting' | 'complete'
  explanation: null,
  loadingExpl: false,

  // History
  history: [],
  historyFilter: 'ALL',
  replayCase: null,

  // App mode
  mode: 'queue',        // 'queue' | 'history'

  // Upload
  uploading: false,
  uploadMsg: null,

  // ── Queue actions ──────────────────────────────────────────────────────────

  loadQueue: async () => {
    try {
      const { data } = await axios.get(`${API}/queue`)
      const queue = data
      set({
        queue,
        queueLoaded: true,
        activeCase: queue[0] ?? null,
        juryPhase: queue[0] ? 'entering' : 'idle',
        explanation: null,
      })
    } catch (e) {
      console.error('loadQueue:', e)
    }
  },

  triage: async (decision) => {
    const { activeCase, queue } = get()
    if (!activeCase) return

    const txId = activeCase.transaction_id
    const remaining = queue.filter(tx => tx.transaction_id !== txId)
    const next = remaining[0] ?? null

    // Optimistic update
    set({
      queue: remaining,
      activeCase: next,
      juryPhase: next ? 'entering' : 'idle',
      explanation: null,
    })

    try {
      await axios.post(`${API}/triage/${txId}`, { decision })
    } catch (e) {
      console.error('triage failed, reloading queue')
      get().loadQueue()
    }
  },

  // ── Jury phase machine ─────────────────────────────────────────────────────
  setJuryPhase: (phase) => set({ juryPhase: phase }),

  // ── Explanation ────────────────────────────────────────────────────────────
  loadExplanation: async (txId) => {
    set({ loadingExpl: true, explanation: null })
    try {
      const { data } = await axios.get(`${API}/transactions/${txId}/explain`)
      set({ explanation: data, loadingExpl: false })
    } catch (e) {
      console.error('loadExplanation:', e)
      set({ loadingExpl: false })
    }
  },

  // ── History ────────────────────────────────────────────────────────────────
  loadHistory: async (filter = 'ALL') => {
    try {
      const params = filter !== 'ALL' ? { decision: filter } : {}
      const { data } = await axios.get(`${API}/history`, { params })
      set({ history: data, historyFilter: filter })
    } catch (e) {
      console.error('loadHistory:', e)
    }
  },

  setHistoryFilter: (f) => {
    set({ historyFilter: f })
    get().loadHistory(f)
  },

  startReplay: (tx) => set({ replayCase: tx }),
  stopReplay: () => set({ replayCase: null }),

  // ── Mode switch ────────────────────────────────────────────────────────────
  setMode: (m) => {
    set({ mode: m })
    if (m === 'history') get().loadHistory(get().historyFilter)
  },

  // ── Upload ─────────────────────────────────────────────────────────────────
  uploadCSV: async (file) => {
    set({ uploading: true, uploadMsg: 'Processing...' })
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await axios.post(`${API}/ingest`, form)
      set({ uploading: false, uploadMsg: data.message })
      get().loadQueue()
    } catch (e) {
      set({ uploading: false, uploadMsg: 'Upload failed.' })
    }
  },
}))

export default useStore
