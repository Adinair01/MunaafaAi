import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const STYLES = {
  success: { box: 'border-emerald-500/40 bg-[#07130d]/95 text-emerald-200', icon: '✓', iconCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', glow: 'shadow-[0_0_30px_-8px_rgba(16,185,129,0.7)]' },
  error: { box: 'border-red-500/40 bg-[#150a0a]/95 text-red-200', icon: '✕', iconCls: 'bg-red-500/15 text-red-300 border-red-500/40', glow: 'shadow-[0_0_30px_-8px_rgba(239,68,68,0.6)]' },
  info: { box: 'border-emerald-500/30 bg-[#0a140f]/95 text-emerald-100', icon: '●', iconCls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', glow: 'shadow-[0_0_30px_-8px_rgba(16,185,129,0.5)]' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-50 w-80">
        {toasts.map(t => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              className={`toast-enter flex items-start gap-3 border rounded-xl px-4 py-3 text-sm backdrop-blur-xl shadow-card ${s.box} ${s.glow}`}
            >
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-bold ${s.iconCls}`}>
                {s.icon}
              </span>
              <span className="text-slate-100 leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="ml-auto text-slate-500 hover:text-slate-200 text-xs leading-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
