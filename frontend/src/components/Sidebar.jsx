import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/transactions', label: 'Transactions', icon: '≡' },
  { to: '/cases', label: 'Recovery Cases', icon: '◎' },
  { to: '/run', label: 'Run Recovery', icon: '▶' },
  { to: '/audit', label: 'Audit Log', icon: '☰' },
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function LogoMark({ size = 'md' }) {
  const dims = size === 'lg' ? 'w-10 h-10 text-lg' : 'w-9 h-9 text-base';
  return (
    <div className={`relative ${dims} rounded-xl bg-brand-gradient flex items-center justify-center font-bold text-surface shadow-glow shrink-0`}>
      <span className="relative z-10 tracking-tight">M</span>
      <span className="absolute inset-0 rounded-xl bg-brand-gradient opacity-60 blur-md -z-0" />
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-emerald-900/40 bg-[#050a07]/80 backdrop-blur-xl flex flex-col z-20">
      <div className="flex items-center gap-3 px-5 py-6">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-base font-bold text-slate-50 tracking-tight">
            Munaafa<span className="text-gradient">AI</span>
          </div>
          <div className="text-[10px] font-medium text-emerald-500/80 uppercase tracking-[0.18em]">Revenue Recovery</div>
        </div>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden ${
                isActive
                  ? 'text-emerald-200'
                  : 'text-slate-400 hover:text-emerald-100 hover:bg-emerald-500/[0.06]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 rounded-xl bg-emerald-500/[0.12] border border-emerald-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_-6px_rgba(16,185,129,0.5)]" />
                )}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-gradient transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                <span className={`relative text-base w-5 text-center ${isActive ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-300'} transition-colors`}>
                  {item.icon}
                </span>
                <span className="relative">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-emerald-900/40">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-brand-gradient text-surface flex items-center justify-center text-xs font-bold shrink-0 shadow-glow-sm">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-200 truncate">{user?.name || 'Operator'}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-500/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-glow-sm" />
              System live
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 w-full text-left px-2 py-2 rounded-xl text-sm text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
