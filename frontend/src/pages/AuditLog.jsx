import { useEffect, useState } from 'react';
import api from '../api/client';
import AuditTimeline from '../components/AuditTimeline';

const COMPLIANCE_EVENTS = ['STOPPING_RULE_TRIGGERED'];

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await api.get('/audit');
      setLogs(res.data);
      setLoading(false);
    }
    load();
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get('/audit/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'munaafaai-audit.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  }

  const complianceCount = logs.filter(l => COMPLIANCE_EVENTS.includes(l.event)).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="section-label mb-1.5">Compliance</div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Full chronological trail of every AI action</p>
        </div>
        <div className="flex items-center gap-3">
          {complianceCount > 0 && (
            <span className="text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
              {complianceCount} compliance-relevant events
            </span>
          )}
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="btn-ghost text-xs font-medium px-4 py-2"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="card stagger-1">
        {loading && <p className="text-sm text-slate-500 animate-pulse">Loading…</p>}
        {!loading && logs.length === 0 && <p className="text-sm text-slate-500">No audit events yet.</p>}
        {!loading && logs.length > 0 && <AuditTimeline entries={logs} />}
      </div>
    </div>
  );
}
