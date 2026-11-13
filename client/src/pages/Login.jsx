import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Laptop,
  Check,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
  Zap
} from 'lucide-react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import NexoraLogo from '../components/common/NexoraLogo';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/authService';
import { DEMO_USER, DEMO_CREDENTIALS_STORAGE_KEY } from '../utils/constants';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState({
    loading: false,
    error: '',
    success: '',
    resetToken: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const { login } = useAuth();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!identifier.trim() || !password) {
      setError('Please provide both your email/username and password');
      return;
    }

    setIsLoading(true);
    try {
      await login({ identifier: identifier.trim(), password });
      setSuccessMsg('Authentication verified. Redirecting to workspace...');
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 500);
    } catch (err) {
      setError(
        err.message || 'Invalid credentials. Please verify your username/email and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = () => {
    try {
      const saved = localStorage.getItem(DEMO_CREDENTIALS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.identifier || parsed.username) {
          setIdentifier(parsed.identifier || parsed.username);
          setPassword(parsed.password || DEMO_USER.password);
          setError('');
          return;
        }
      }
    } catch (e) {
      // fallback to default demo account
    }
    setIdentifier(DEMO_USER.username);
    setPassword(DEMO_USER.password);
    setError('');
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus({ loading: true, error: '', success: '', resetToken: '' });

    try {
      const res = await authService.forgotPassword(forgotEmail.trim());
      setForgotStatus({
        loading: false,
        error: '',
        success: 'Reset token generated successfully! You can now set your new password below.',
        resetToken: res.resetToken
      });
    } catch (err) {
      setForgotStatus({
        loading: false,
        error: err.message || 'Failed to process password reset request.',
        success: '',
        resetToken: ''
      });
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setForgotStatus((prev) => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }

    setIsResetting(true);
    try {
      await authService.resetPassword(forgotStatus.resetToken, newPassword);
      setForgotStatus((prev) => ({
        ...prev,
        success: 'Password reset successfully! Redirecting to workspace...'
      }));
      setTimeout(() => {
        setIsForgotModalOpen(false);
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setForgotStatus((prev) => ({
        ...prev,
        error: err.message || 'Failed to reset password.'
      }));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col justify-between p-4 sm:p-6 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 transition-colors nx-bg-dots selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-brand-500/30 dark:selection:text-brand-200">
      {/* Ambient Neon Atmosphere Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-br from-brand-500/20 via-violet-600/15 to-transparent blur-[130px] pointer-events-none -z-10 rounded-full" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-transparent blur-[110px] pointer-events-none -z-10 rounded-full" />

      {/* =========================================================================
          1. TOP NAVIGATION WITH PROMINENT "BACK TO HOME" BUTTON
          ========================================================================= */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 z-20">
        {/* Back to Home Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200/90 dark:border-dark-750 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-400/60 shadow-subtle transition-all duration-200 group"
          title="Return to NEXORA Homepage"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span>Back to Home</span>
        </Link>

        {/* Center Brand Logo (Clickable back to Home) */}
        <Link to="/" className="flex items-center gap-2 group">
          <NexoraLogo size="sm" withText={true} />
        </Link>

        {/* Theme Cycler Toggle */}
        <button
          onClick={toggleTheme}
          title={`Appearance: ${resolvedTheme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}`}
          className="p-2 rounded-full border border-slate-200/90 dark:border-dark-750 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition cursor-pointer shadow-subtle"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </header>

      {/* =========================================================================
          2. MAIN AUTHENTICATION CARD
          ========================================================================= */}
      <main className="flex-1 flex items-center justify-center py-8 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white/95 dark:bg-dark-900/95 border border-slate-200/90 dark:border-dark-750 rounded-3xl p-7 sm:p-9 shadow-elevated backdrop-blur-xl relative overflow-hidden"
        >
          {/* Subtle top edge violet shimmer */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-violet-500 to-indigo-600" />

          {/* Card Header & Brand Symbol */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center mb-3">
              <NexoraLogo size="md" withText={false} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
              Welcome back to <span className="nx-gradient-text">NEXORA</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Enter your credentials to access your real-time workspace
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5 animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              type="text"
              id="identifier"
              placeholder="e.g. alex_johnson or alex@example.com"
              icon={Mail}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-8 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-end text-xs pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail('');
                  setForgotStatus({ loading: false, error: '', success: '', resetToken: '' });
                  setIsForgotModalOpen(true);
                }}
                className="text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer transition"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full mt-2 shadow-glow cursor-pointer"
              isLoading={isLoading}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Workspace
            </Button>
          </form>

          {/* Quick Fill Demo Credentials */}
          <div className="mt-4">
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={fillDemoAccount}
              className="w-full text-xs font-semibold cursor-pointer border border-slate-200/60 dark:border-dark-750"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-brand-600 dark:text-brand-400" />
              Quick Fill Demo Credentials
            </Button>
          </div>

          {/* Security & Cryptography Assurance Pill */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-dark-750 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>WebRTC Direct Mesh • DTLS-SRTP Cryptography</span>
          </div>

          {/* Switch to Register */}
          <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Don't have an account yet?{' '}
            <Link
              to="/register"
              className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              Sign up for free
            </Link>
          </div>
        </motion.div>
      </main>

      {/* =========================================================================
          3. FORGOT PASSWORD MODAL
          ========================================================================= */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Password Recovery"
        subtitle="Reset your NEXORA account credentials"
      >
        {!forgotStatus.resetToken ? (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            {forgotStatus.error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotStatus.error}</span>
              </div>
            )}

            <Input
              label="Registered Email Address"
              type="email"
              placeholder="name@example.com"
              icon={Mail}
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-dark-750">
              <Button variant="ghost" type="button" onClick={() => setIsForgotModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="gradient" type="submit" isLoading={forgotStatus.loading}>
                Generate Reset Token
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{forgotStatus.success}</span>
            </div>

            <div className="p-3 bg-slate-100 dark:bg-dark-850 rounded-2xl text-xs font-mono text-slate-700 dark:text-slate-300 break-all border border-slate-200/60 dark:border-dark-750">
              Token: {forgotStatus.resetToken}
            </div>

            <Input
              label="Enter New Password"
              type="password"
              placeholder="Minimum 6 characters"
              icon={KeyRound}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-dark-750">
              <Button variant="gradient" type="submit" isLoading={isResetting}>
                Reset Password & Log In
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* =========================================================================
          4. FOOTER
          ========================================================================= */}
      <footer className="text-center text-xs text-slate-400 py-3 z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <span>&copy; {new Date().getFullYear()} NEXORA Communication Platform</span>
        <span className="hidden sm:inline">•</span>
        <Link to="/" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          <span>Home</span>
        </Link>
      </footer>
    </div>
  );
};

export default Login;
