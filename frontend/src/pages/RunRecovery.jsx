import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';

const FAILURE_CLASS_COLORS = {
  TIMING: 'text-amber-400',
  TECHNICAL: 'text-emerald-400',
  FRICTION: 'text-teal-300',
  INTENT: 'text-red-400',
};

const FAILURE_CLASS_LABELS = {
  TIMING: 'Timing',
  TECHNICAL: 'Technical',
  FRICTION: 'Friction',
  INTENT: 'Intent',
};

export default function RunRecovery() {
  const { push } = useToast();
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState([]);
  const [queue, setQueue] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (queue.length === 0) return;
    timerRef.current = setTimeout(() => {
      const [next, ...rest] = queue;
      setFeed(prev => [next, ...prev]);
      setQueue(rest);
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [queue]);

  // Once the sweep API has returned AND the queued feed items have streamed
  // out, surface the summary modal.
  useEffect(() => {
    if (summary && !running && queue.length === 0) {
      const t = setTimeout(() => setShowSummary(true), 400);
      return () => clearTimeout(t);
    }
  }, [summary, running, queue]);

  async function runSweep() {
    setRunning(true);
    setFeed([]);
    setQueue([]);
    setSummary(null);
    setShowSummary(false);
    try {
      const res = await api.post('/recovery/run-batch');
      setQueue(res.data.results || []);
      setSummary(res.data);
      push(`Sweep processed ${res.data.processed} transactions`, 'success');
    } catch (err) {
      push(err.response?.data?.error || 'Sweep failed', 'error');
    } finally {
      setRunning(false);
    }
  }

  const casesCreated = feed.filter(r => r.caseId).length;
  const errors = feed.filter(r => r.error).length;
  const avgConfidence = feed.length
    ? Math.round(feed.filter(r => r.confidence).reduce((s, r) => s + r.confidence, 0) / (feed.filter(r => r.confidence).length || 1))
    : 0;
  const recoveredInFeed = feed.filter(r => r.status === 'recovered').length;
  const isProcessing = running || queue.length > 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div>
        <div className="section-label mb-1.5">Sweep</div>
        <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Run Recovery</h1>
        <p className="text-sm text-slate-500 mt-1">Trigger a full AI recovery sweep across every open failed transaction</p>
      </div>

      <div className="relative card flex flex-col items-center gap-5 py-12 overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-px scanline opacity-60" />
        <button
          onClick={runSweep}
          disabled={isProcessing}
          className={`btn-primary text-base px-10 py-4 ${isProcessing ? '' : 'animate-pulse-ring'}`}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full border-2 border-[#04110a]/30 border-t-[#04110a] animate-spin" />
              Sweep Running…
            </span>
          ) : (
            '▶ Run Full AI Recovery Sweep'
          )}
        </button>
        {summary && (
          <p className="text-sm text-slate-500">Processed {summary.processed} transactions · {Math.round((summary.sweepDurationMs || 0) / 1000)}s</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-1">
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Cases Opened</div>
          <div className="amount text-3xl text-slate-50">{casesCreated}</div>
        </div>
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Recovered</div>
          <div className="amount text-3xl text-emerald-400">{recoveredInFeed}</div>
        </div>
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Errors</div>
          <div className="amount text-3xl text-red-400">{errors}</div>
        </div>
        <div className="card">
          <div className="text-[11px] uppercase tracking-[0.1em] text-slate-500">AI Confidence (avg)</div>
          <div className="amount text-3xl text-emerald-400">{avgConfidence}%</div>
        </div>
      </div>

      <div className="card stagger-2">
        <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Feed
        </h2>
        {feed.length === 0 && !isProcessing && (
          <p className="text-sm text-slate-500">Run a sweep to see live AI diagnosis feed.</p>
        )}
        <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
          {feed.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between border border-emerald-900/30 rounded-xl px-3.5 py-2.5 bg-[#07130d]/60 last:pb-2.5 gap-4 animate-fade-in"
              style={{ animationDelay: '0s' }}
            >
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="font-mono text-[11px] text-emerald-600">{item.transactionId}</span>
                {item.error ? (
                  <span className="text-sm text-red-300">{item.error}</span>
                ) : (
                  <>
                    <span className="text-sm text-slate-300 truncate">{item.diagnosis}</span>
                    <span className="text-[11px] text-slate-600 truncate">{item.economicReason}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.status === 'recovered' && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">RECOVERED</span>
                )}
                {item.failureClass && <StatusBadge value={item.failureClass} />}
                {item.action && <StatusBadge value={item.action} />}
                {item.caseId && <span className="font-mono text-[11px] text-slate-500">{item.caseId}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSummary && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 animate-fade-in">
          <div className="w-full max-w-lg card flex flex-col gap-5 max-h-[85vh] overflow-y-auto animate-fade-up">
            <div className="flex items-start justify-between">
              <div>
                <div className="section-label mb-1">Sweep Complete</div>
                <h2 className="text-lg font-semibold text-slate-50">Recovery sweep finished</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {summary.totalCases} cases on file · {Math.round((summary.sweepDurationMs || 0) / 1000)}s sweep
                </p>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-slate-500 hover:text-slate-200 text-xl leading-none transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex items-baseline justify-between border-b border-emerald-900/40 pb-4">
              <div className="text-xs uppercase tracking-[0.1em] text-slate-500">Total Recovered</div>
              <div className="amount text-4xl text-emerald-400">
                ₹{Number(summary.totalRecovered || 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {Object.entries(summary.byFailureClass || {}).map(([cls, stats]) => (
                <div key={cls} className="flex items-center justify-between text-sm py-1">
                  <span className={`font-medium ${FAILURE_CLASS_COLORS[cls] || 'text-slate-300'}`}>
                    {FAILURE_CLASS_LABELS[cls] || cls}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {stats.count} cases · {stats.recovered} recovered
                  </span>
                  <span className="amount text-xs text-emerald-400">₹{Number(stats.amountRecovered || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-500/[0.05] border border-emerald-900/40 rounded-xl py-3.5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Write-offs</div>
                <div className="amount text-2xl text-red-400 mt-1">{summary.economicWriteOffs || 0}</div>
              </div>
              <div className="bg-emerald-500/[0.05] border border-emerald-900/40 rounded-xl py-3.5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Stopping Rules</div>
                <div className="amount text-2xl text-amber-400 mt-1">{summary.stoppingRulesTriggered || 0}</div>
              </div>
              <div className="bg-emerald-500/[0.05] border border-emerald-900/40 rounded-xl py-3.5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Escalations</div>
                <div className="amount text-2xl text-orange-400 mt-1">{summary.complianceEscalations || 0}</div>
              </div>
            </div>

            <button
              onClick={() => setShowSummary(false)}
              className="btn-primary w-full py-3 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
