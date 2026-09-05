import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';

export default function Transactions() {
  const { push } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState(null);
  const [createdIds, setCreatedIds] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (type) params.type = type;
    if (search) params.search = search;
    const res = await api.get('/transactions', { params });
    setTransactions(res.data);
    setLoading(false);
  }, [status, type, search]);

  useEffect(() => { load(); }, [load]);

  async function createCase(id) {
    setCreatingId(id);
    try {
      const res = await api.post(`/recovery/create/${id}`);
      setCreatedIds(prev => ({ ...prev, [id]: res.data.caseId }));
      push(`Recovery case ${res.data.caseId} created`, 'success');
    } catch (err) {
      push(err.response?.data?.error || 'Failed to create recovery case', 'error');
    } finally {
      setCreatingId(null);
    }
  }

  function ageLabel(createdAt) {
    const hours = Math.floor((Date.now() - new Date(createdAt)) / 3600000);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  const selectCls = 'input px-3 py-2 text-sm w-auto appearance-none cursor-pointer';

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div>
        <div className="section-label mb-1.5">Ledger</div>
        <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Transactions</h1>
        <p className="text-sm text-slate-500 mt-1">All payment activity across your business</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
          <option value="overdue">Overdue</option>
          <option value="pending">Pending</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className={selectCls}>
          <option value="">All Types</option>
          <option value="payment">Payment</option>
          <option value="checkout">Checkout</option>
          <option value="subscription">Subscription</option>
          <option value="invoice">Invoice</option>
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transaction ID…"
          className="input px-3.5 py-2 text-sm flex-1 min-w-[200px]"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-slate-500 border-b border-emerald-900/40 bg-[#07130d]/60">
                <th className="px-5 py-3.5 font-semibold">ID</th>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-5 py-3.5 font-semibold">Amount</th>
                <th className="px-5 py-3.5 font-semibold">Type</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Method</th>
                <th className="px-5 py-3.5 font-semibold">Age</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">No transactions found.</td></tr>
              )}
              {transactions.map(tx => {
                const canRecover = ['failed', 'abandoned', 'overdue'].includes(tx.status);
                const caseId = createdIds[tx._id];
                return (
                  <tr key={tx._id} className="row-hover border-b border-emerald-900/20 last:border-0">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{tx.transactionId}</td>
                    <td className="px-5 py-3.5 text-slate-200">{tx.customer?.name || '—'}</td>
                    <td className="px-5 py-3.5 amount text-slate-100">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-slate-300 capitalize">{tx.type}</td>
                    <td className="px-5 py-3.5"><StatusBadge value={tx.status} /></td>
                    <td className="px-5 py-3.5 text-slate-400 uppercase text-xs">{tx.paymentMethod || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{ageLabel(tx.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {canRecover ? (
                        caseId ? (
                          <span className="text-xs text-emerald-400 font-mono">{caseId}</span>
                        ) : (
                          <button
                            onClick={() => createCase(tx._id)}
                            disabled={creatingId === tx._id}
                            className="btn-ghost text-xs px-3 py-1.5 font-medium"
                          >
                            {creatingId === tx._id ? 'Creating…' : '+ Create Case'}
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
