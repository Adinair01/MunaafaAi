import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const fe = {};
    if (!email.trim()) fe.email = 'Please enter your email';
    else if (!EMAIL_RE.test(email)) fe.email = 'Enter a valid email address';
    if (!password) fe.password = 'Please enter your password';
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      const serverMsg = err.response?.data?.error;
      if (serverMsg) setError(serverMsg);
      else if (!err.response || err.response.status >= 500) setError('Cannot reach the server. Make sure the backend is running on port 5001.');
      else setError('Login failed — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = hasError => `input w-full px-3.5 py-2.5 text-sm ${hasError ? 'border-red-500/60' : ''}`;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex items-center gap-3 justify-center mb-9">
          <div className="w-11 h-11 rounded-2xl bg-brand-gradient flex items-center justify-center font-bold text-surface text-xl shadow-glow">
            M
          </div>
          <div className="text-left leading-tight">
            <div className="text-2xl font-bold tracking-tight text-slate-50">
              Munaafa<span className="text-gradient">AI</span>
            </div>
            <div className="text-[10px] font-medium text-emerald-500/80 uppercase tracking-[0.2em]">Revenue Recovery</div>
          </div>
        </div>

        <div className="card stagger-1">
          <h1 className="text-xl font-semibold text-slate-50 mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 mb-7">Sign in to your recovery console</p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: undefined })); }}
                className={inputClass(fieldErrors.email)}
                placeholder="you@company.com"
              />
              {fieldErrors.email && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined })); }}
                className={inputClass(fieldErrors.password)}
                placeholder="••••••••"
              />
              {fieldErrors.password && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.password}</p>}
            </div>

            {error && (
              <div className="animate-fade-in flex items-start gap-2.5 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-1 w-full py-3 text-sm"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-7 stagger-2">
          Don't have an account?{' '}
          <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
