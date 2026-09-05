import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import RecoveryCaseCard from '../components/RecoveryCaseCard';
import { useToast } from '../context/ToastContext';

export default function RecoveryCases() {
  const { push } = useToast();
  const [cases, setCases] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    const res = await api.get('/recovery/cases', { params });
    setCases(res.data);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function execute(caseId) {
    setExecutingId(caseId);
    try {
      const res = await api.post(`/recovery/execute/${caseId}`);
      await load();
      if (res.data.status === 'recovered') {
        push(`${caseId} recovered ₹${Number(res.data.amountRecovered).toLocaleString('en-IN')}`, 'success');
      } else if (res.data.status === 'closed_lost') {
        push(`${caseId} closed — ${res.data.reason || 'stopping rule reached'}`, 'error');
      } else {
        push(`${caseId} action executed, retry scheduled`, 'info');
      }
    } catch (err) {
      push(err.response?.data?.error || 'Failed to execute action', 'error');
    } finally {
      setExecutingId(null);
    }
  }

  async function runBatch() {
    setBatchRunning(true);
    try {
      const res = await api.post('/recovery/run-batch');
      await load();
      push(`Batch sweep processed ${res.data.processed} transactions`, 'success');
    } catch (err) {
      push(err.response?.data?.error || 'Batch run failed', 'error');
    } finally {
      setBatchRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="section-label mb-1.5">Cases</div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Recovery Cases</h1>
          <p className="text-sm text-slate-500 mt-1">AI-diagnosed cases and recommended actions</p>
        </div>
        <button
          onClick={runBatch}
          disabled={batchRunning}
          className="btn-primary text-sm px-5 py-2.5"
        >
          {batchRunning ? 'Running Batch…' : '▶ Run Batch Recovery'}
        </button>
      </div>

      <div className="flex gap-3">
        <select value={status} onChange={e => setStatus(e.target.value)} className="input px-3.5 py-2 text-sm w-auto cursor-pointer">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="recovered">Recovered</option>
          <option value="escalated">Escalated</option>
          <option value="closed_lost">Closed Lost</option>
        </select>
      </div>

      {loading && <p className="text-slate-500">Loading cases…</p>}
      {!loading && cases.length === 0 && (
        <p className="text-slate-500">No recovery cases yet. Create one from Transactions or run a batch sweep.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map(c => (
          <RecoveryCaseCard
            key={c._id}
            recoveryCase={c}
            onExecute={execute}
            executing={executingId === c.caseId}
          />
        ))}
      </div>
    </div>
  );
}
