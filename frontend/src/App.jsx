import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Assuming backend runs on 8000
const API_BASE = 'http://localhost:8000/api';

function App() {
  const [queue, setQueue] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [logs, setLogs] = useState(["Initializing system..."]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  
  // Ledger active decision filter: 'ALL', 'BLOCK', 'APPROVE', 'ESCALATE'
  const [ledgerFilter, setLedgerFilter] = useState('ALL');

  const [explanation, setExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Bottom panel (drawer) resizable height states
  const [footerHeight, setFooterHeight] = useState(240); // 240px default
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 48 && newHeight < window.innerHeight * 0.8) {
        setFooterHeight(newHeight);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const fetchExplanation = async (id) => {
    if (!id) return;
    setLoadingExplanation(true);
    setExplanation(null);
    try {
      const res = await axios.get(`${API_BASE}/transactions/${id}/explain`);
      setExplanation(res.data.explanation);
    } catch (error) {
      setExplanation("Failed to load Gemini anomaly explanation.");
    } finally {
      setLoadingExplanation(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      fetchExplanation(selectedId);
    }
  }, [selectedId]);

  const fetchQueue = async () => {
    try {
      const res = await axios.get(`${API_BASE}/queue`);
      setQueue(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0].transaction_id);
      }
    } catch (error) {
      logAction('Error', 'Failed to fetch queue');
    }
  };

  const fetchLedger = async () => {
    try {
      const url = ledgerFilter === 'ALL' 
        ? `${API_BASE}/ledger` 
        : `${API_BASE}/ledger?decision=${ledgerFilter}`;
      const res = await axios.get(url);
      setLedger(res.data);
    } catch (error) {
      logAction('Error', 'Failed to fetch ledger');
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Refetch ledger when active filter changes
  useEffect(() => {
    fetchLedger();
  }, [ledgerFilter]);

  // General poll for changes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueue();
      fetchLedger();
    }, 10000);
    return () => clearInterval(interval);
  }, [ledgerFilter]);

  const logAction = (type, msg) => {
    setLogs((prev) => [...prev, `[${type}] ${msg}`]);
  };

  const handleTriage = async (action, id) => {
    if (!id) return;
    const tx = queue.find(t => t.transaction_id === id);
    if (!tx) return;

    try {
      await axios.post(`${API_BASE}/triage/${id}`, { decision: action });
      
      // Update local state for immediate feedback
      setQueue(prev => prev.filter(t => t.transaction_id !== id));
      
      // Select next item
      const newQueue = queue.filter(t => t.transaction_id !== id);
      if (newQueue.length > 0) {
        setSelectedId(newQueue[0].transaction_id);
      } else {
        setSelectedId(null);
      }
      
      logAction('TRIAGE_SIGNAL', `Applied ${action.toUpperCase()} to ${id}`);
      
      // Refresh ledger
      fetchLedger();
    } catch (err) {
      logAction('Error', `Failed to triage ${id}`);
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (!selectedId) return;
    const key = e.key.toLowerCase();
    if (key === 'a') handleTriage('block', selectedId);
    if (key === 's') handleTriage('approve', selectedId);
    if (key === 'd') handleTriage('escalate', selectedId);
  }, [selectedId, queue]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("Processing files and running ML pipelines...");
    logAction("SYSTEM", `Uploading dataset: ${file.name}`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/ingest`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUploadStatus(res.data.message);
      logAction("SUCCESS", res.data.message);
      
      // Reset selected index & refresh queues
      setSelectedId(null);
      await fetchQueue();
      await fetchLedger();
    } catch (error) {
      const errMsg = error.response?.data?.detail || "Upload failed. Verify server is active.";
      setUploadStatus(`Error: ${errMsg}`);
      logAction("ERROR", errMsg);
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadStatus(null);
      }, 8000);
    }
  };

  const exportAudit = () => {
    const csv = "Timestamp,TxID,Decision,Score,Amount\n" + ledger.map(h => `${h.timestamp},${h.transaction_id},${h.decision},${(h.risk_score / 10).toFixed(1)}%,${h.amount}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_ledger_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const exportFraudCSV = () => {
    // Filter out only blocked/fraudulent items from the ledger
    const fraudItems = ledger.filter(h => h.decision === 'BLOCK');
    if (fraudItems.length === 0) {
      alert("No blocked fraud transactions currently exist in the active ledger view.");
      return;
    }
    const csv = "Timestamp,TxID,Decision,RiskScore,Amount\n" + fraudItems.map(h => `${h.timestamp},${h.transaction_id},${h.decision},${(h.risk_score / 10).toFixed(1)}%,${h.amount}`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraud_blocked_transactions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const selectedTx = queue.find(t => t.transaction_id === selectedId);

  // We convert the backend score (rank average out of 1000) to percentage directly
  const getScorePercentage = (scoreVal) => {
    if (!scoreVal) return "0.0";
    return (scoreVal / 10).toFixed(1);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-on-surface">
      <header className="h-14 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-container-padding shrink-0 z-50">
        <div className="flex items-center gap-6">
          <h1 className="text-headline-sm font-headline-md text-primary tracking-tight">Fraud Hunter <span className="font-normal opacity-50 text-body-sm">v2.5.0</span></h1>
          <div className="relative flex items-center bg-surface-container-low border border-outline-variant rounded px-2 h-8 w-64">
            <span className="material-symbols-outlined text-[18px] opacity-40">search</span>
            <input className="bg-transparent border-none focus:outline-none text-body-sm w-full placeholder-on-surface-variant/50 ml-1" placeholder="Search TxID..." type="text"/>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {uploadStatus && (
            <div className="text-body-sm font-medium text-secondary animate-pulse mr-4 px-3 py-1 bg-secondary-container rounded border border-outline-variant">
              {uploadStatus}
            </div>
          )}
          <div className="flex items-center gap-2 text-on-surface-variant pr-4 border-r border-outline-variant">
            <div className="w-2 h-2 rounded-full bg-secondary"></div>
            <span className="text-label-caps uppercase tracking-widest text-[10px]">Operations Online</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-20 lg:w-64 border-r border-outline-variant bg-surface-container-lowest flex flex-col pt-6 shrink-0 justify-between">
          <div className="px-4 space-y-4">
            <div className="space-y-1">
              <a className="flex items-center gap-3 px-3 py-2 text-primary bg-surface-container-high font-medium rounded-lg" href="#">
                <span className="material-symbols-outlined">shield</span>
                <span className="hidden lg:block text-body-sm">Active Triage</span>
              </a>
            </div>

            {/* Importer Section */}
            <div className="pt-4 border-t border-outline-variant hidden lg:block">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-2">Import Dataset</span>
              <label className={`flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:border-secondary rounded-lg p-4 cursor-pointer transition-colors bg-surface-container-low ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="material-symbols-outlined text-secondary text-[28px] mb-1">upload_file</span>
                <span className="text-body-sm font-medium text-primary text-center">
                  {uploading ? 'Uploading...' : 'Choose transactions.csv'}
                </span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
          
          <div className="p-4 border-t border-outline-variant space-y-2">
            {/* Small visible upload icon on mobile/tablet sidebar */}
            <label className="lg:hidden flex items-center justify-center p-2 hover:bg-surface-container-low rounded-lg cursor-pointer text-on-surface-variant">
              <span className="material-symbols-outlined">upload_file</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            
            <button className="w-full py-2 bg-error text-on-error rounded text-label-caps font-bold text-[11px] uppercase tracking-wider hover:bg-red-700 transition-colors flex items-center justify-center gap-1" onClick={exportFraudCSV}>
              <span className="material-symbols-outlined text-[14px]">download</span> Export Fraud CSV
            </button>
          </div>
        </nav>

        <main className="flex-1 flex min-w-0 bg-surface">
          {/* Queue List */}
          <div className="w-80 lg:w-96 border-r border-outline-variant flex flex-col bg-surface-container-lowest shrink-0">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
              <span className="text-label-caps text-on-surface-variant">Review Queue</span>
              <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-[11px] font-bold">{queue.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto terminal-scroll">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant opacity-40 text-body-sm">
                  {uploading ? "Analyzing new database..." : "Queue Clear. Import transactions.csv to start!"}
                </div>
              ) : (
                queue.map(tx => {
                  const isActive = tx.transaction_id === selectedId;
                  const riskPercent = getScorePercentage(tx.anomaly_score);
                  const riskColor = parseFloat(riskPercent) > 80 ? 'text-error' : (parseFloat(riskPercent) > 50 ? 'text-on-tertiary-container' : 'text-secondary');
                  
                  return (
                    <div key={tx.transaction_id} onClick={() => setSelectedId(tx.transaction_id)} className={`p-4 border-b border-outline-variant cursor-pointer transition-all ${isActive ? 'active-row' : 'hover:bg-surface-container-low'}`}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-data-mono font-bold text-primary">{tx.transaction_id}</span>
                            <span className={`text-data-mono font-bold ${riskColor}`}>{riskPercent}%</span>
                        </div>
                        <div className="flex justify-between text-[12px] text-on-surface-variant">
                            <span>${tx.amount.toLocaleString()}</span>
                            <span className="opacity-60">{tx.merchant_country || 'Unknown'}</span>
                        </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail View (Using expanded spacing now that the sidebar is removed) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-bright">
            {!selectedTx ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant opacity-40 gap-2">
                <span className="material-symbols-outlined text-[48px]">verified_user</span>
                <span className="text-body-md font-medium">Select a flagged item from the queue to investigate</span>
              </div>
            ) : (
              <div className="p-8 max-w-5xl w-full mx-auto space-y-8 overflow-y-auto">
                <div className="flex justify-between items-end border-b border-outline-variant pb-6">
                    <div>
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Transaction Detail</div>
                        <h2 className="text-headline-md font-bold text-primary leading-none">{selectedTx.transaction_id}</h2>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Aggregated Risk</div>
                        <div className="text-headline-md font-bold text-primary">{getScorePercentage(selectedTx.anomaly_score)}<span className="text-body-md opacity-30 font-normal">%</span></div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8 bg-surface-container-low p-6 rounded-lg border border-outline-variant">
                    <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Amount</label>
                        <div className="text-body-lg font-bold text-primary">${selectedTx.amount.toLocaleString()}</div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Merchant Country / IP</label>
                        <div className="text-body-lg font-medium text-primary">
                          {selectedTx.merchant_country} <span className="opacity-40 text-body-sm font-normal">({selectedTx.ip_address || "No IP Address"})</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Current Queue Status</label>
                        <div className="inline-flex items-center px-2 py-0.5 rounded bg-primary-container border border-outline-variant text-[11px] font-medium text-on-primary-container uppercase">
                            {selectedTx.status}
                        </div>
                    </div>
                </div>

                {/* Gemini AI Copilot Explanation */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Gemini AI Copilot Anomaly Explanation</label>
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-lg">
                        {loadingExplanation ? (
                            <div className="text-body-sm font-medium text-primary animate-pulse flex items-center gap-2">
                                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                Analyzing anomalous features and generating plain-English explanation...
                            </div>
                        ) : explanation ? (
                            <p className="text-body-sm text-on-surface leading-relaxed">{explanation}</p>
                        ) : (
                            <span className="text-body-sm opacity-50">No AI explanation generated.</span>
                        )}
                    </div>
                </div>

                {/* Signals Block */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">High-Priority Detection Signals</label>
                    <div className="grid grid-cols-1 gap-2">
                        {selectedTx.signals.length === 0 ? <span className="text-body-sm opacity-50">No major signals extracted.</span> : null}
                        {selectedTx.signals.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-error-container border border-error/20 rounded">
                                <span className="material-symbols-outlined text-[18px] text-error">warning</span>
                                <span className="text-body-sm font-medium text-on-error-container">{s}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-outline-variant/60">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Card ID</label>
                    <div className="text-body-sm font-medium text-primary">{selectedTx.card_id}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Merchant Name</label>
                    <div className="text-body-sm font-medium text-primary">{selectedTx.merchant_name} ({selectedTx.merchant_category})</div>
                  </div>
                </div>

                <div className="pt-8 border-t border-outline-variant flex gap-3">
                    <button onClick={() => handleTriage('block', selectedTx.transaction_id)} className="triage-action-btn h-12 px-8 bg-error text-on-error rounded font-bold text-label-caps uppercase tracking-widest hover:bg-red-700 flex items-center gap-2">
                        Block [A]
                    </button>
                    <button onClick={() => handleTriage('approve', selectedTx.transaction_id)} className="triage-action-btn h-12 px-8 bg-secondary text-on-secondary rounded font-bold text-label-caps uppercase tracking-widest hover:opacity-90 flex items-center gap-2">
                        Approve [S]
                    </button>
                    <button onClick={() => handleTriage('escalate', selectedTx.transaction_id)} className="triage-action-btn h-12 px-8 bg-surface-container-high border border-outline-variant text-primary rounded font-bold text-label-caps uppercase tracking-widest hover:bg-surface-container-highest flex items-center gap-2">
                        Escalate [D]
                    </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom: Audit Ledger of Frauds & Actions */}
      <footer style={{ height: `${footerHeight}px` }} className="border-t border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-hidden relative select-none">
        {/* Drag Resize Handle */}
        <div 
          onMouseDown={startResizing} 
          className="h-1.5 w-full cursor-ns-resize bg-outline-variant/30 hover:bg-primary/50 transition-colors shrink-0 z-50 relative group flex items-center justify-center"
        >
          <div className="w-16 h-1 bg-outline rounded group-hover:bg-primary transition-colors absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="px-container-padding h-12 border-b border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-label-caps text-on-surface-variant font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></span>
              Audit History Log
            </span>
            
            {/* Collapse/Expand toggle button */}
            <button 
              onClick={() => setFooterHeight(prev => prev > 48 ? 48 : 320)}
              className="flex items-center justify-center p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors"
              title={footerHeight > 48 ? "Collapse Drawer" : "Expand Drawer"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {footerHeight > 48 ? "keyboard_arrow_down" : "keyboard_arrow_up"}
              </span>
            </button>
            
            {/* Filter Buttons */}
            <div className="flex bg-surface-container-high border border-outline-variant rounded p-0.5 ml-2">
              {['ALL', 'BLOCK', 'APPROVE', 'ESCALATE'].map(f => (
                <button key={f} onClick={() => setLedgerFilter(f)} className={`px-3 py-1 text-[11px] font-bold tracking-wide rounded-sm transition-colors ${ledgerFilter === f ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1"><kbd className="border border-outline-variant rounded px-1 bg-surface font-semibold">A</kbd> Block</span>
            <span className="flex items-center gap-1"><kbd className="border border-outline-variant rounded px-1 bg-surface font-semibold">S</kbd> Approve</span>
            <span className="flex items-center gap-1"><kbd className="border border-outline-variant rounded px-1 bg-surface font-semibold">D</kbd> Escalate</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto terminal-scroll">
          <table className="w-full text-left text-body-sm">
            <thead className="sticky top-0 bg-surface-container-low text-[11px] text-on-surface-variant font-bold uppercase tracking-wider border-b border-outline-variant z-10">
              <tr>
                <th className="px-6 py-2">Timestamp</th>
                <th className="px-6 py-2">Transaction ID</th>
                <th className="px-6 py-2">Decision / Action</th>
                <th className="px-6 py-2">Risk Score</th>
                <th className="px-6 py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="text-data-mono divide-y divide-outline-variant/30">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant opacity-50">
                    No actions logged for filter: {ledgerFilter}
                  </td>
                </tr>
              ) : (
                ledger.map((h, i) => (
                  <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-2 opacity-60 text-xs">
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-2 text-primary font-bold">{h.transaction_id}</td>
                      <td className="px-6 py-2">
                          <span className={`${h.decision === 'BLOCK' ? 'bg-error-container text-on-error-container border-error/20' : (h.decision === 'APPROVE' ? 'bg-secondary-container text-on-secondary-container border-secondary/20' : 'bg-surface-container-high text-primary border-outline-variant')} font-bold text-[10px] px-2 py-0.5 rounded border`}>
                              {h.decision === 'BLOCK' ? 'REJECTED (BLOCK)' : h.decision}
                          </span>
                      </td>
                      <td className="px-6 py-2 font-semibold">{getScorePercentage(h.risk_score)}%</td>
                      <td className="px-6 py-2 font-bold">${h.amount?.toLocaleString() || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </footer>
    </div>
  );
}

export default App;
