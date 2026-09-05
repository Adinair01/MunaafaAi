import StatusBadge from './StatusBadge';

function complianceReason(flag) {
  if (!flag) return '';
  if (typeof flag === 'string') return flag;
  try {
    if (typeof flag === 'object') {
      return flag.reason || flag.flag || JSON.stringify(flag);
    }
    return String(flag);
  } catch {
    return String(flag);
  }
}

export default function RecoveryCaseCard({ recoveryCase, onExecute, executing }) {
  const c = recoveryCase;
  const canExecute = ['open', 'in_progress'].includes(c.status);
  const isEscalated = c.status === 'escalated';
  const flagReason = complianceReason(c.complianceFlag);

  return (
    <div
      className={`card flex flex-col gap-3 ${isEscalated ? 'border-danger' : ''}`}
      style={isEscalated ? { borderLeft: '4px solid #EF4444' } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-400">{c.caseId}</span>
        {isEscalated ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-danger/15 text-danger border-danger/40">
            ESCALATED — HUMAN REQUIRED
          </span>
        ) : (
          <StatusBadge value={c.status} />
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs text-slate-500">At Risk</div>
          <div className="amount text-lg text-slate-50">₹{Number(c.amountAtRisk || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Recovered</div>
          <div className="amount text-lg text-success">₹{Number(c.amountRecovered || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>

      {(c.aiFailureClass || typeof c.aiConfidence === 'number') && (
        <div className="flex flex-wrap items-center gap-2">
          {c.aiFailureClass && <StatusBadge value={c.aiFailureClass} />}
          {typeof c.aiConfidence === 'number' && (
            <span className="text-xs text-slate-500">confidence {c.aiConfidence}%</span>
          )}
        </div>
      )}

      {c.aiDiagnosis && (
        <p className="text-sm text-slate-300 line-clamp-2" title={c.aiDiagnosis}>
          {c.aiDiagnosis}
        </p>
      )}

      {isEscalated && flagReason && (
        <p className="text-xs text-danger border border-danger/30 bg-danger/10 rounded-lg px-2.5 py-2" title={flagReason}>
          <span className="font-semibold">Compliance reason:</span> {flagReason}
        </p>
      )}

      {c.economicReason && (
        <p className="text-xs text-slate-500" title={c.economicReason}>
          {c.economicReason}
        </p>
      )}

      {c.confidenceChange && c.confidenceChange !== '+0 (first assessment)' && (
        <p className="text-xs text-emerald-400">{c.confidenceChange}</p>
      )}

      {c.recommendedAction && (
        <div>
          <StatusBadge value={c.recommendedAction} />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 border-t border-emerald-900/40 pt-3">
        <span>Attempts: {c.attempts}/{c.maxAttempts}</span>
        {c.nextRetryAt && c.status !== 'recovered' && c.status !== 'closed_lost' && c.status !== 'escalated' && (
          <span>Next: {new Date(c.nextRetryAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {canExecute && (
        <button
          onClick={() => onExecute(c.caseId)}
          disabled={executing}
          className="btn-primary mt-1 w-full py-2.5 text-sm"
        >
          {executing ? 'Executing…' : '▶ Execute Action'}
        </button>
      )}
    </div>
  );
}
