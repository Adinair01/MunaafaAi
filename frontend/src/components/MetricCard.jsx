import { useEffect, useRef, useState } from 'react';

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const current = from + (target - from) * eased;
      setValue(current);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function formatValue(value, format) {
  if (format === 'currency') {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  if (format === 'percent') {
    return `${Number(value || 0).toFixed(1)}%`;
  }
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const ACCENT = {
  danger: { text: 'text-red-300', bg: 'bg-red-500/10', ring: 'border-red-500/30', glow: 'shadow-[0_0_18px_-6px_rgba(239,68,68,0.55)]' },
  success: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/30', glow: 'shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)]' },
  'text-brand-500': { text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'border-emerald-500/30', glow: 'shadow-[0_0_18px_-6px_rgba(16,185,129,0.6)]' },
  warning: { text: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'border-amber-500/30', glow: 'shadow-[0_0_18px_-6px_rgba(251,191,36,0.5)]' },
};

export default function MetricCard({ icon, label, value, format = 'number', trend, accent = 'text-brand-500' }) {
  const animated = useCountUp(Number(value || 0));
  const style = ACCENT[accent] || ACCENT['text-brand-500'];

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">{label}</span>
        {icon && (
          <span className={`w-9 h-9 rounded-xl border ${style.ring} ${style.bg} flex items-center justify-center text-base ${style.text} ${style.glow}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="amount text-3xl text-slate-50 tracking-tight">{formatValue(animated, format)}</div>
      {trend !== undefined && trend !== null && (
        <div className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className="inline-block">{trend >= 0 ? '▲' : '▼'}</span> {Math.abs(trend)}% <span className="text-slate-600 font-normal">vs baseline</span>
        </div>
      )}
    </div>
  );
}
