import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorText(err) {
  const status = err.response?.status;
  const serverMsg = err.response?.data?.error;
  if (serverMsg) return serverMsg;
  if (!status || status >= 500) {
    return 'Cannot reach the server. Make sure the backend is running on port 5001.';
  }
  return 'Signup failed — please try again.';
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const fe = {};
    const trimmedName = name.trim();
    if (!trimmedName) fe.name = 'Please enter your full name';
    else if (trimmedName.length < 2 || trimmedName.length > 60) fe.name = 'Name must be 2-60 characters';
    if (!email) fe.email = 'Please enter your email';
    else if (!EMAIL_RE.test(email)) fe.email = 'Enter a valid email address';
    if (!password) fe.password = 'Please create a password';
    else if (password.length < 8) fe.password = 'Password must be at least 8 characters';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      // 409: account already exists — surface it with a clear next step.
      setError(errorText(err));
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
          <h1 className="text-xl font-semibold text-slate-50 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-7">Start recovering lost revenue with AI</p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="signup-name" className="block text-xs font-medium text-slate-400 mb-1.5">Full name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => { setName(e.target.value); if (fieldErrors.name) setFieldErrors(f => ({ ...f, name: undefined })); }}
                className={inputClass(fieldErrors.name)}
                placeholder="Your full name"
              />
              {fieldErrors.name && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined })); }}
                className={inputClass(fieldErrors.password)}
                placeholder="At least 8 characters"
              />
              {fieldErrors.password && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.password}</p>}
            </div>

            {error && (
              <div className="animate-fade-in flex items-start gap-2.5 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>
                  {error}
                  {error.toLowerCase().includes('already exists') && (
                    <>
                      {' '}
                      <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2">
                        Sign in instead →
                      </Link>
                    </>
                  )}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-1 w-full py-3 text-sm"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-7 stagger-2">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
