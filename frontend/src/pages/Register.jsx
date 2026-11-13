import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  User,
  UserPlus,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AtSign,
  Check,
  ArrowLeft,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import NexoraLogo from '../components/common/NexoraLogo';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { DEMO_USER, DEMO_CREDENTIALS_STORAGE_KEY } from '../utils/constants';

const Register = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!fullName.trim()) {
      setError('Please provide your full name');
      return;
    }

    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_.-]+$/i.test(username.trim())) {
      setError('Username can only contain letters, numbers, underscores, dots, or hyphens');
      return;
    }

    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password
      });

      try {
        localStorage.setItem(
          DEMO_CREDENTIALS_STORAGE_KEY,
          JSON.stringify({
            fullName: fullName.trim(),
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            password,
            identifier: username.toLowerCase().trim()
          })
        );
      } catch (e) {
        // ignore
      }

      setSuccessMsg('Account created successfully! Preparing your workspace...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err) {
      setError(
        err.message || 'Registration failed. Please check your information and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setFullName(DEMO_USER.fullName);
    setUsername(DEMO_USER.username);
    setEmail(DEMO_USER.email);
    setPassword(DEMO_USER.password);
    setError('');
    try {
      localStorage.setItem(
        DEMO_CREDENTIALS_STORAGE_KEY,
        JSON.stringify({
          fullName: DEMO_USER.fullName,
          username: DEMO_USER.username,
          email: DEMO_USER.email,
          password: DEMO_USER.password,
          identifier: DEMO_USER.username
        })
      );
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col justify-between p-4 sm:p-6 bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 transition-colors nx-bg-dots selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-brand-500/30 dark:selection:text-brand-200">
      {/* Ambient Neon Atmosphere Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-br from-brand-500/20 via-violet-600/15 to-transparent blur-[130px] pointer-events-none -z-10 rounded-full" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-transparent blur-[110px] pointer-events-none -z-10 rounded-full" />

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
          2. MAIN REGISTRATION CARD
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
              Create your <span className="nx-gradient-text">NEXORA</span> account
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Start hosting encrypted HD meetings and team workspaces in seconds
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

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              id="fullName"
              placeholder="e.g. Alex Johnson"
              icon={User}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Username"
              type="text"
              id="username"
              placeholder="e.g. alex_johnson"
              icon={AtSign}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              helperText="Unique identifier for calls, direct chats & channels"
            />

            <Input
              label="Work Email"
              type="email"
              id="email"
              placeholder="alex@example.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="At least 6 characters"
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

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full mt-2 shadow-glow cursor-pointer"
              isLoading={isLoading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Free Workspace Account
            </Button>
          </form>

          {/* Quick Fill Demo Information */}
          <div className="mt-3">
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={fillDemoAccount}
              className="w-full text-xs font-semibold cursor-pointer border border-slate-200/60 dark:border-dark-750"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-brand-600 dark:text-brand-400" />
              Quick Fill Demo Information
            </Button>
          </div>

          {/* Terms notice */}
          <p className="text-[11px] text-slate-400 text-center mt-4 leading-relaxed">
            By signing up, you agree to NEXORA's Terms of Service and zero-telemetry Privacy Policy.
          </p>

          {/* Security & Cryptography Assurance Pill */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-dark-750 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Hardware Encrypted • Direct WebRTC P2P</span>
          </div>

          {/* Switch to Login */}
          <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              Sign in to workspace
            </Link>
          </div>
        </motion.div>
      </main>

      {/* =========================================================================
          3. FOOTER
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

export default Register;
