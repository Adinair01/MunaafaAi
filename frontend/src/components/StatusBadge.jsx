const COLORS = {
  // transaction status
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  failed: 'bg-red-500/15 text-red-300 border-red-500/40',
  abandoned: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  overdue: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  pending: 'bg-slate-500/15 text-slate-300 border-slate-500/40',

  // recovery case status
  open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  in_progress: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  recovered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  escalated: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  closed_lost: 'bg-red-500/15 text-red-300 border-red-500/40',

  // failure classes
  INTENT: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  TECHNICAL: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  TIMING: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  FRICTION: 'bg-slate-500/15 text-slate-300 border-slate-500/40',

  // action types
  RETRY_PAYMENT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  SWITCH_PAYMENT_METHOD: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  SEND_RECOVERY_EMAIL: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  SEND_SMS_REMINDER: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  APPLY_DISCOUNT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  ESCALATE_TO_AGENT: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  MANDATE_RETRY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  WRITE_OFF: 'bg-red-500/15 text-red-300 border-red-500/40',
};

const DEFAULT = 'bg-slate-500/15 text-slate-300 border-slate-500/40';

function label(value) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function StatusBadge({ value, className = '' }) {
  const colorClass = COLORS[value] || DEFAULT;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-sm shadow-[0_0_12px_-6px_currentColor] ${colorClass} ${className}`}>
      {label(value)}
    </span>
  );
}
