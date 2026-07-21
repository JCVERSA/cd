import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Eye, EyeOff, Lock, User as UserIcon, ArrowRight, Shield,
  CheckCircle2, AlertCircle, Loader2, Server
} from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

// Floating particle component
function Particle({ index: _index }: { index: number }) {
  void _index;
  const size = 2 + Math.random() * 3;
  const x = Math.random() * 100;
  const delay = Math.random() * 8;
  const duration = 12 + Math.random() * 16;
  const opacity = 0.08 + Math.random() * 0.15;

  return (
    <motion.div
      className="absolute rounded-full bg-brand-400"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-5%',
        opacity,
      }}
      animate={{
        y: [0, -(window.innerHeight * 1.2)],
        x: [0, (Math.random() - 0.5) * 120],
        opacity: [0, opacity, opacity, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Animated service status line for the side panel
function ServiceLine({ name, id, delay: d }: { name: string; id: number; delay: number }) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), d * 1000);
    const t2 = setTimeout(() => setChecked(true), d * 1000 + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [d]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={visible ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-2 font-mono text-xs"
    >
      <span className="text-surface-600">[PM2]</span>
      <span className="text-brand-400">[{name}]</span>
      <span className="text-surface-700">({id})</span>
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={checked ? { opacity: 1, scale: 1 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="text-emerald-400 text-sm"
      >
        ✓
      </motion.span>
    </motion.div>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [shake, setShake] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    if (view === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }
      if (username.length < 3) {
        setError('Username must be at least 3 characters.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }
    }

    setIsLoading(true);

    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = { username, password };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.ok) {
          setSuccess(true);
          setTimeout(() => {
            onLogin();
          }, 1200);
        } else {
          setError(data.error || 'An error occurred during authentication.');
          setShake(true);
          setTimeout(() => setShake(false), 600);
        }
      })
      .catch(() => {
        setError('Cannot reach authentication server.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [username, password, confirmPassword, view, onLogin]);

  return (
    <div className="min-h-screen bg-surface-950 flex relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-brand-600/6 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-500/3 rounded-full blur-[160px] pointer-events-none" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }, (_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* ======================= LEFT SIDE — BRANDING ======================= */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 xl:p-14 relative z-10">
        {/* Top logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-500/25">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">
              Mini<span className="text-brand-400">Cloud</span>
            </span>
            <p className="text-[10px] text-surface-500 -mt-0.5 font-medium tracking-wide">PRIVATE CLOUD PLATFORM</p>
          </div>
        </motion.div>

        {/* Center content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="space-y-8"
        >
          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Welcome to your
              <br />
              <span className="gradient-text">Private Cloud.</span>
            </h1>
            <p className="mt-4 text-base text-surface-400 leading-relaxed max-w-md">
              Seven robust microservices. One elegant platform. Complete sovereignty over your files, notes, pictures, passwords and bookmarks.
            </p>
          </div>

          {/* Terminal card */}
          <div className="glass-card rounded-2xl overflow-hidden glow-sm max-w-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/30 bg-surface-900/40">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <span className="text-[10px] text-surface-500 font-mono ml-1.5">pm2 status</span>
            </div>
            <div className="p-4 space-y-1">
              <ServiceLine name="mc-gateway" id={0} delay={0.8} />
              <ServiceLine name="mc-auth" id={1} delay={1.1} />
              <ServiceLine name="mc-files" id={2} delay={1.4} />
              <ServiceLine name="mc-notes" id={3} delay={1.7} />
              <ServiceLine name="mc-gallery" id={4} delay={2.0} />
              <ServiceLine name="mc-vault" id={5} delay={2.3} />
              <ServiceLine name="mc-bookmarks" id={6} delay={2.6} />
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-surface-500">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-medium">AES-GCM Chiffrement</span>
            </div>
            <div className="flex items-center gap-2 text-surface-500">
              <Server className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-medium">Self-Hosted</span>
            </div>
            <div className="flex items-center gap-2 text-surface-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium">99.9% Uptime</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-[11px] text-surface-600"
        >
          © {new Date().getFullYear()} MiniCloud. Your data. Your rules.
        </motion.p>
      </div>

      {/* ======================= RIGHT SIDE — FORM ======================= */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:hidden flex items-center justify-center gap-2.5 mb-10"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-500/25">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Mini<span className="text-brand-400">Cloud</span>
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            {view === 'login' || view === 'register' ? (
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
              >
                {/* Card */}
                <div className="glass-card rounded-3xl p-7 sm:p-9 glow-sm">
                  {/* Header */}
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">
                      {view === 'login' ? 'Sign in' : 'Create account'}
                    </h2>
                    <p className="mt-1.5 text-sm text-surface-400">
                      {view === 'login'
                        ? 'Access your private MiniCloud dashboard'
                        : 'Register a new account on this MiniCloud instance'
                      }
                    </p>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 overflow-hidden"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs font-medium">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success message */}
                  <AnimatePresence>
                    {success && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 overflow-hidden"
                      >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs font-medium">
                          {view === 'login'
                            ? 'Authentication successful. Redirecting...'
                            : 'Registration successful. Signing you in...'
                          }
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form */}
                  <motion.form
                    onSubmit={handleSubmit}
                    animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className="space-y-5"
                  >
                    {/* Username */}
                    <div>
                      <label htmlFor="username" className="block text-xs font-semibold text-surface-300 mb-2">
                        Username
                      </label>
                      <div className={`relative flex items-center rounded-xl border transition-all duration-300 ${
                        focusedField === 'username'
                          ? 'border-brand-500/50 bg-surface-800/40 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                          : 'border-surface-700/40 bg-surface-800/20 hover:border-surface-600/50'
                      }`}>
                        <span className="pl-3.5">
                          <UserIcon className={`w-[16px] h-[16px] transition-colors ${
                            focusedField === 'username' ? 'text-brand-400' : 'text-surface-500'
                          }`} />
                        </span>
                        <input
                          id="username"
                          type="text"
                          value={username}
                          onChange={e => { setUsername(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('username')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="admin"
                          autoComplete="username"
                          disabled={isLoading || success}
                          className="flex-1 bg-transparent text-sm text-white placeholder-surface-600 outline-none py-3 px-3 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="password" className="text-xs font-semibold text-surface-300">
                          Password
                        </label>
                        {view === 'login' && (
                          <button
                            type="button"
                            onClick={() => { setView('forgot'); setError(''); }}
                            className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className={`relative flex items-center rounded-xl border transition-all duration-300 ${
                        focusedField === 'password'
                          ? 'border-brand-500/50 bg-surface-800/40 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                          : 'border-surface-700/40 bg-surface-800/20 hover:border-surface-600/50'
                      }`}>
                        <span className="pl-3.5">
                          <Lock className={`w-[16px] h-[16px] transition-colors ${
                            focusedField === 'password' ? 'text-brand-400' : 'text-surface-500'
                          }`} />
                        </span>
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => { setPassword(e.target.value); setError(''); }}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          disabled={isLoading || success}
                          className="flex-1 bg-transparent text-sm text-white placeholder-surface-600 outline-none py-3 px-3 disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="pr-3.5 text-surface-500 hover:text-surface-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword
                            ? <EyeOff className="w-[16px] h-[16px]" />
                            : <Eye className="w-[16px] h-[16px]" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password (register mode) */}
                    {view === 'register' && (
                      <div>
                        <label htmlFor="confirmPassword" className="block text-xs font-semibold text-surface-300 mb-2">
                          Confirm Password
                        </label>
                        <div className={`relative flex items-center rounded-xl border transition-all duration-300 ${
                          focusedField === 'confirmPassword'
                            ? 'border-brand-500/50 bg-surface-800/40 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]'
                            : 'border-surface-700/40 bg-surface-800/20 hover:border-surface-600/50'
                        }`}>
                          <span className="pl-3.5">
                            <Lock className={`w-[16px] h-[16px] transition-colors ${
                              focusedField === 'confirmPassword' ? 'text-brand-400' : 'text-surface-500'
                            }`} />
                          </span>
                          <input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                            onFocus={() => setFocusedField('confirmPassword')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            disabled={isLoading || success}
                            className="flex-1 bg-transparent text-sm text-white placeholder-surface-600 outline-none py-3 px-3 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading || success}
                      className="group relative w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all duration-300 shadow-xl shadow-brand-600/25 hover:shadow-brand-500/35 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-brand-600/25"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Redirecting...</span>
                        </>
                      ) : (
                        <>
                          <span>{view === 'login' ? 'Sign in to Dashboard' : 'Register Account'}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                      {!isLoading && !success && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      )}
                    </button>
                  </motion.form>
                </div>

                {/* Footer text */}
                <p className="text-center mt-6 text-xs text-surface-400">
                  {view === 'login' ? (
                    <>
                      First time?{' '}
                      <button
                        onClick={() => { setView('register'); setError(''); }}
                        className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      >
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={() => { setView('login'); setError(''); }}
                        className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      >
                        Sign in instead
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            ) : (
              /* ======================= FORGOT PASSWORD ======================= */
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
              >
                <div className="glass-card rounded-3xl p-7 sm:p-9 glow-sm">
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-7 h-7 text-amber-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">Password recovery</h3>
                    <p className="text-xs text-surface-400 mb-6">
                      La récupération de mot de passe n'est pas encore configurée.
                    </p>
                    <button
                      onClick={() => { setView('login'); setError(''); }}
                      className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
                    >
                      ← Back to sign in
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile footer */}
          <p className="lg:hidden text-center mt-8 text-[11px] text-surface-700">
            © {new Date().getFullYear()} MiniCloud. Your data. Your rules.
          </p>
        </div>
      </div>
    </div>
  );
}
