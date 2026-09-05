const EVENT_COLORS = {
  CASE_CREATED: 'bg-emerald-400',
  ACTION_EXECUTED: 'bg-teal-300',
  STOPPING_RULE_TRIGGERED: 'bg-red-400',
};

export default function AuditTimeline({ entries }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-700/30 to-transparent" />
      <div className="flex flex-col gap-6">
        {entries.map((entry, i) => (
          <div key={entry._id || i} className="relative animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}>
            <span className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#050a07] ${EVENT_COLORS[entry.event] || 'bg-slate-500'} shadow-[0_0_12px_-2px_currentColor]`} />
            <div className="text-[11px] text-slate-600 mb-1 font-mono">
              {new Date(entry.timestamp).toLocaleString('en-IN')}
            </div>
            <div className="text-sm text-slate-100 font-semibold">{entry.event?.replace(/_/g, ' ')}</div>
            {entry.caseId && <div className="font-mono text-[11px] text-emerald-600 mt-0.5">{entry.caseId}</div>}
            {entry.outcome && <div className="text-sm text-slate-400 mt-1 leading-snug">{entry.outcome}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
