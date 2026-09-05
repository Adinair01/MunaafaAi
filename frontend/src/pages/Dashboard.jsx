import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import MetricCard from '../components/MetricCard';

const CASE_TYPE_LABELS = {
  payment_failure: 'Payment Failure',
  checkout_abandonment: 'Checkout Abandonment',
  subscription_failure: 'Subscription Failure',
  invoice_overdue: 'Invoice Overdue',
};

const FAILURE_CLASS_META = {
  TIMING: { label: 'Timing', color: '#FBBF24' },
  TECHNICAL: { label: 'Technical', color: '#10B981' },
  FRICTION: { label: 'Friction', color: '#2DD4BF' },
  INTENT: { label: 'Intent', color: '#F87171' },
};

const EMPTY_FAILURE_CLASS = { count: 0, recovered: 0, amountRecovered: 0, amountAtRisk: 0 };

const TOOLTIP_STYLE = {
  background: 'rgba(7, 15, 11, 0.95)',
  border: '1px solid rgba(52, 211, 153, 0.25)',
  borderRadius: 10,
  color: '#E6F2EA',
  fontSize: 12,
  boxShadow: '0 12px 32px -12px rgba(0,0,0,0.8)',
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [byType, setByType] = useState([]);
  const [byFailureClass, setByFailureClass] = useState([]);
  const [recentAudit, setRecentAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, t, b, f, a] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/dashboard/timeline'),
        api.get('/dashboard/by-type'),
        api.get('/dashboard/by-failure-class'),
        api.get('/audit'),
      ]);
      setMetrics(m.data);
      setTimeline(t.data);
      setByType(b.data.map(d => ({ ...d, name: CASE_TYPE_LABELS[d._id] || d._id || 'Unknown' })));
      const classMap = Object.fromEntries(f.data.map(d => [d._id, d]));
      setByFailureClass(
        Object.entries(FAILURE_CLASS_META).map(([key, meta]) => ({
          name: key,
          value: (classMap[key] || EMPTY_FAILURE_CLASS).count || 0,
          count: (classMap[key] || EMPTY_FAILURE_CLASS).count || 0,
          recovered: (classMap[key] || EMPTY_FAILURE_CLASS).recovered || 0,
          amountRecovered: (classMap[key] || EMPTY_FAILURE_CLASS).amountRecovered || 0,
          ...meta,
        }))
      );
      setRecentAudit(a.data.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-fade-in">
        <div className="section-label">Overview</div>
        <div className="h-8 w-64 rounded-lg bg-emerald-500/10 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="section-label mb-1.5">Overview</div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Revenue Recovery Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Live position — every figure computed from the recovery engine</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live data
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-1">
        <MetricCard icon="₹" label="Total At Risk" value={metrics.totalAtRisk} format="currency" accent="danger" />
        <MetricCard icon="₹" label="Recovered" value={metrics.totalRecovered} format="currency" accent="success" />
        <MetricCard icon="%" label="Recovery Rate" value={metrics.recoveryRate} format="percent" accent="text-brand-500" />
        <MetricCard icon="◎" label="Active Cases" value={metrics.activeCases} accent="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-2">
        <div className="card">
          <div className="section-label mb-1">Activity</div>
          <h2 className="text-sm font-medium text-slate-300 mb-4">Recovery Activity (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeline}>
              <defs>
                <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,211,153,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#45685A" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#45685A" fontSize={11} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(52,211,153,0.25)' }} />
              <Line type="monotone" dataKey="recovered" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#34D399', strokeWidth: 0 }} name="Recovered (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-label mb-1">Breakdown</div>
          <h2 className="text-sm font-medium text-slate-300 mb-4">Cases by Type</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,211,153,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="#45685A" fontSize={10.5} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#45685A" fontSize={11} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(52,211,153,0.06)' }} />
              <Bar dataKey="count" fill="#10B981" radius={[7, 7, 0, 0]} name="Cases" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card stagger-3">
        <div className="section-label mb-1">Diagnosis</div>
        <h2 className="text-sm font-medium text-slate-300 mb-5">Cases by Failure Class</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={220} className="max-w-[240px]">
            <PieChart>
              <Pie
                data={byFailureClass}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={88}
                paddingAngle={3}
                stroke="transparent"
              >
                {byFailureClass.map(entry => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2.5 w-full sm:max-w-sm">
            {byFailureClass.map(entry => (
              <div key={entry.name} className="group flex items-center gap-3 text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-emerald-500/[0.05]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-glow-sm" style={{ background: entry.color }} />
                <span className="text-slate-300 w-24">{entry.label}</span>
                <span className="text-slate-500 text-xs">
                  {entry.count} case{entry.count === 1 ? '' : 's'} · {entry.recovered} recovered
                </span>
                <span className="ml-auto amount text-xs text-emerald-400">₹{Number(entry.amountRecovered).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {byFailureClass.every(e => e.count === 0) && (
              <p className="text-sm text-slate-500">No diagnosed cases yet — run a recovery sweep.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card stagger-4">
        <div className="section-label mb-1">Trail</div>
        <h2 className="text-sm font-medium text-slate-300 mb-4">Recent Activity</h2>
        <div className="flex flex-col gap-3">
          {recentAudit.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
          {recentAudit.map((entry, i) => (
            <div key={entry._id || i} className="flex items-center justify-between text-sm border-b border-emerald-900/30 last:border-0 pb-2.5 last:pb-0">
              <span className="flex items-center gap-2.5 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" />
                {entry.event?.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{entry.caseId}</span>
              <span className="text-slate-600 text-xs">{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
