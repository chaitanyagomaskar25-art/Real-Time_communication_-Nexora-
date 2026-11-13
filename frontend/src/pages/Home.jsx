import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video,
  Shield,
  Zap,
  ArrowRight,
  Sparkles,
  MessageSquare,
  ScreenShare,
  Lock,
  Globe2,
  CheckCircle,
  Sun,
  Moon,
  Radio,
  Users,
  Activity,
  Layers,
  PhoneCall,
  Terminal,
  Check,
  ArrowUpRight,
  Play,
  Mic,
  MicOff,
  VideoOff,
  Share2,
  ShieldCheck,
  Cpu,
  Fingerprint,
  Code2,
  ChevronRight
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import NexoraLogo from '../components/common/NexoraLogo';
import Avatar from '../components/common/Avatar';
import StatusDot from '../components/common/StatusDot';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const [roomCode, setRoomCode] = useState('');
  const [isSimulatedMuted, setIsSimulatedMuted] = useState(false);
  const [isSimulatedVideoOff, setIsSimulatedVideoOff] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Core Requirement:
  // When user clicks on start call, if not authenticated -> redirect to login.
  // After login -> redirect to dashboard.
  // Do NOT request camera permission at start!
  const handleStartCall = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/dashboard' } } });
      return;
    }
    // If authenticated, navigate straight to dashboard
    navigate('/dashboard');
  };

  const handleExploreCapability = (e) => {
    if (e) e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/dashboard' } } });
      return;
    }
    navigate('/dashboard');
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/dashboard' } } });
      return;
    }
    navigate(`/room/${roomCode.trim()}`);
  };

  const bentoFeatures = [
    {
      icon: Zap,
      badge: 'Zero-Relay Routing',
      title: 'Decentralized P2P Mesh',
      description:
        'Direct browser-to-browser media streaming with sub-40ms peer latency without intermediate transcoding bottlenecks.',
      accent: 'from-brand-500/10 via-indigo-500/10 to-transparent',
      borderGlow: 'hover:border-brand-500/50'
    },
    {
      icon: Lock,
      badge: 'DTLS-SRTP 256-Bit',
      title: 'Cryptographic Privacy',
      description:
        'Hardware-level media channel encryption. Your audio and video streams are completely inaccessible to third-party relays.',
      accent: 'from-emerald-500/10 via-teal-500/10 to-transparent',
      borderGlow: 'hover:border-emerald-500/50'
    },
    {
      icon: ScreenShare,
      badge: 'Lossless 60 FPS',
      title: 'HD Code & Display Sharing',
      description:
        'Pixel-accurate window and multi-monitor streaming with high-bandwidth 48kHz Opus audio for crystal-clear software walkthroughs.',
      accent: 'from-violet-500/10 via-purple-500/10 to-transparent',
      borderGlow: 'hover:border-violet-500/50'
    },
    {
      icon: MessageSquare,
      badge: 'Spatial Messaging',
      title: 'Luminescent In-Chamber Chat',
      description:
        'Asymmetric chamfered dialogue ribbons, drag-and-drop file transfers, typing telemetry, and live reaction chips.',
      accent: 'from-cyan-500/10 via-blue-500/10 to-transparent',
      borderGlow: 'hover:border-cyan-500/50'
    },
    {
      icon: Layers,
      badge: 'Vector Canvas',
      title: 'Live Whiteboard & Notes',
      description:
        'Real-time multi-cursor collaboration, vector sketches, and collaborative markdown notes with instant export.',
      accent: 'from-purple-500/10 via-pink-500/10 to-transparent',
      borderGlow: 'hover:border-purple-500/50'
    },
    {
      icon: ShieldCheck,
      badge: 'Host Governance',
      title: 'Cryptographic Lockdowns',
      description:
        'Instant waiting room quarantine, cryptographic chamber locks, role escalations, and one-click ejection controls.',
      accent: 'from-amber-500/10 via-rose-500/10 to-transparent',
      borderGlow: 'hover:border-amber-500/50'
    }
  ];

  const metrics = [
    { value: '< 38ms', label: 'Direct Peer Latency', hint: 'Zero relay hops' },
    { value: '1080p 60fps', label: 'Lossless Visuals', hint: 'Hardware accelerated' },
    { value: '99.99%', label: 'Signaling Uptime', hint: 'Multi-region mesh' },
    { value: '0 Bytes', label: 'Cloud Storage', hint: 'Zero-telemetry policy' }
  ];

  const steps = [
    {
      num: '01',
      title: 'Initialize Chamber',
      desc: 'One click provisions a private cryptographic WebRTC chamber in your browser without requiring camera permissions prematurely.'
    },
    {
      num: '02',
      title: 'Broadcast Frequency',
      desc: 'Share your clean chamber link or room code with colleagues across laptops, desktops, and mobile devices.'
    },
    {
      num: '03',
      title: 'Collaborate Seamlessly',
      desc: 'Connect in real time with high-fidelity audio, lossless screen sharing, spatial chat, and interactive whiteboards.'
    }
  ];

  const testimonials = [
    {
      quote:
        'NEXORA is by far the most stylish and responsive communication workspace our engineering team has ever adopted. The zero-lag P2P audio makes remote work feel like sitting in the same room.',
      author: 'Marcus Vance',
      role: 'VP of Engineering',
      company: 'TechFlow Systems',
      avatar: 'MV'
    },
    {
      quote:
        'No bulky software to install, no camera access requested until you actually step into a meeting, and the dark violet interface looks like software from 2030.',
      author: 'Elena Rostova',
      role: 'Principal Architect',
      company: 'Veloce Labs',
      avatar: 'ER'
    },
    {
      quote:
        'Our engineering syncs are 10x faster now. The lossless screen sharing for code review is unmatched by legacy conference tools.',
      author: 'David Chen',
      role: 'Founding Partner',
      company: 'Studio Nova',
      avatar: 'DC'
    }
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-brand-500/20 selection:text-brand-900 dark:selection:bg-brand-500/30 dark:selection:text-brand-200">
      {/* =========================================================================
          1. FLOATING GLASS ISLAND NAVBAR
          ========================================================================= */}
      <div className="sticky top-4 z-50 px-4 sm:px-6 w-full max-w-6xl mx-auto">
        <nav className="rounded-full border border-slate-200/90 dark:border-white/10 bg-white/75 dark:bg-dark-900/75 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-brand-950/20 px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all">
          <Link to="/" className="flex items-center gap-2 group">
            <NexoraLogo size="sm" withText={true} />
          </Link>

          {/* Desktop Nav Anchor Links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Capabilities
            </a>
            <a href="#chamber-preview" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Live Chamber
            </a>
            <a href="#architecture" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Architecture
            </a>
            <a href="#workflow" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              Workflow
            </a>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              title={`Theme: ${resolvedTheme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}`}
              className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 transition cursor-pointer"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {isAuthenticated ? (
              <Button
                variant="gradient"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="rounded-full shadow-subtle cursor-pointer text-xs"
              >
                Dashboard
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="rounded-full text-xs font-semibold">
                    Sign In
                  </Button>
                </Link>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={handleStartCall}
                  className="rounded-full text-xs font-bold shadow-subtle cursor-pointer"
                >
                  Start Call
                </Button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* =========================================================================
          2. HERO SECTION — HIGH-END EDITORIAL & LUMINESCENT ATMOSPHERE
          ========================================================================= */}
      <section className="relative pt-12 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center flex-1">
        {/* Ambient Neon Atmosphere Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gradient-to-br from-brand-500/20 via-violet-600/15 to-transparent blur-[120px] pointer-events-none -z-10 rounded-full" />
        <div className="absolute top-1/2 -left-20 w-[350px] h-[350px] bg-gradient-to-tr from-indigo-500/15 to-transparent blur-[100px] pointer-events-none -z-10 rounded-full" />

        {/* Floating Capsule Badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-brand-50/90 text-brand-700 border border-brand-200/90 dark:bg-brand-950/70 dark:border-brand-800/80 dark:text-brand-300 text-xs font-bold uppercase tracking-wider mb-6 shadow-subtle"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 nx-presence-online" />
          <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Spatial Communication Platform</span>
          <span className="opacity-40">•</span>
          <span className="font-mono text-[10px] text-brand-600 dark:text-brand-400">v2.0 P2P</span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.06] font-heading"
        >
          Spatial real-time communication for{' '}
          <span className="nx-gradient-text">high-output teams.</span>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
        >
          High-performance WebRTC video conferencing, sub-40ms P2P audio chambers, and spatial messaging. No camera permissions required until you enter a meeting.
        </motion.p>

        {/* Interactive Dual-Mode CTA Center */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 max-w-xl mx-auto p-2 rounded-3xl bg-white/90 dark:bg-dark-900/90 border border-slate-200/90 dark:border-dark-750 shadow-elevated backdrop-blur-xl flex flex-col sm:flex-row items-center gap-2"
        >
          {/* Primary Action Button: Start Call */}
          <button
            onClick={handleStartCall}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 text-white font-bold text-sm shadow-glow hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shrink-0 group"
          >
            <Video className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" />
            <span>Start Call</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-dark-750 hidden sm:block mx-1" />

          {/* Join Code Input Field */}
          <form onSubmit={handleJoin} className="flex items-center gap-1.5 w-full flex-1">
            <input
              type="text"
              placeholder="Enter room code to join..."
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none flex-1 min-w-0"
            />
            <Button
              size="sm"
              variant="secondary"
              type="submit"
              disabled={!roomCode.trim()}
              className="rounded-xl shrink-0 cursor-pointer"
            >
              Join
            </Button>
          </form>
        </motion.div>

        {/* Frictionless Privacy Note */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> No initial camera prompt
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> DTLS-SRTP 256-bit cryptography
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> WebRTC peer-to-peer mesh
          </span>
        </div>

        {/* =========================================================================
            3. LIVE INTERACTIVE SIMULATED CHAMBER MOCKUP
            ========================================================================= */}
        <motion.div
          id="chamber-preview"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 sm:mt-20 relative rounded-3xl overflow-hidden border border-slate-200/90 dark:border-dark-750 bg-gradient-to-b from-white via-slate-50 to-lavender-50/30 dark:from-dark-900 dark:via-dark-900 dark:to-dark-950 p-4 sm:p-6 lg:p-8 shadow-elevated nx-bg-dots text-left"
        >
          {/* Chamber Header & Telemetry */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-dark-750 gap-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                chamber/nexora-frequency-01
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Mesh • 38ms • DTLS-SRTP 256-bit
              </span>
            </div>
          </div>

          {/* Interactive Chamber Grid: Video + Code + Spatial Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Tile 1: Active Speaker (4 Cols) */}
            <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-dark-900 to-black p-4 flex flex-col justify-between border border-brand-500/40 shadow-card min-h-[220px]">
              <div className="flex items-center justify-between text-xs text-white/80 z-10">
                <span className="px-2 py-0.5 rounded-md bg-brand-600 text-[10px] font-bold">
                  HOST
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <Activity className="w-3 h-3 animate-pulse" /> 1080p 60fps
                </span>
              </div>

              {/* Avatar with Orbital Aura */}
              <div className="self-center flex flex-col items-center my-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 text-white font-extrabold flex items-center justify-center text-xl shadow-glow nx-orbital-aura is-online">
                  AL
                </div>
                <span className="text-xs font-bold text-white mt-2.5">Alex Laurent</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Speaking on P2P Frequency
                </span>
              </div>

              {/* Animated Audio Equalizer Waveform */}
              <div className="flex items-center justify-between text-[11px] text-white/70 pt-2 border-t border-white/10">
                <div className="flex items-end gap-1 h-4">
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-2" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-4" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-3" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-5" />
                  <span className="w-1 bg-brand-400 rounded-full animate-pulse h-2" />
                </div>
                <span className="font-mono text-[10px] text-slate-300">48kHz Opus Audio</span>
              </div>
            </div>

            {/* Tile 2: Lossless Screen Sharing Display (4 Cols) */}
            <div className="lg:col-span-4 rounded-2xl bg-slate-900 border border-slate-700/60 p-4 flex flex-col justify-between shadow-card min-h-[220px]">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-400">
                  <Code2 className="w-3.5 h-3.5" />
                  Shared Code Stream
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800 font-mono">
                  webrtc-mesh.ts
                </span>
              </div>

              {/* Code Snippet Preview */}
              <div className="font-mono text-[11px] text-slate-300 py-3 space-y-1 overflow-hidden leading-relaxed">
                <div>
                  <span className="text-purple-400">const</span> chamber ={' '}
                  <span className="text-blue-400">await</span> nexora.
                  <span className="text-amber-300">instantiate</span>();
                </div>
                <div>
                  chamber.<span className="text-blue-400">enableMeshRouting</span>({'{'}
                </div>
                <div className="pl-4 text-emerald-400">encryption: 'DTLS-SRTP-256',</div>
                <div className="pl-4 text-emerald-400">audioCodec: 'Opus-48kHz',</div>
                <div className="pl-4 text-emerald-400">maxLatencyMs: 40</div>
                <div>{'}'});</div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800">
                <span>Presenter: Sarah Kim</span>
                <span className="text-emerald-400 font-bold">Lossless 60fps</span>
              </div>
            </div>

            {/* Tile 3: Spatial Chat Panel (4 Cols) */}
            <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 p-3.5 flex flex-col justify-between shadow-card min-h-[220px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-dark-750 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                  Chamber Chat
                </span>
                <span className="text-slate-400 font-normal">3 participants</span>
              </div>

              {/* Chamfered Ribbon Bubbles */}
              <div className="space-y-2 py-2">
                <div className="nx-bubble-incoming p-2.5 text-xs">
                  <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">
                    Sarah Kim
                  </span>
                  Signaling handshake completed. No server relays in between!
                </div>
                <div className="nx-bubble-outgoing p-2.5 text-xs">
                  Latency is locked at 38ms. Ready to ship the build.
                </div>
              </div>

              {/* Chat Input Capsule Mock */}
              <div className="pt-2 border-t border-slate-100 dark:border-dark-750 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Zero server recording
                </span>
                <span className="font-mono text-cyan-500">Read Receipts Live</span>
              </div>
            </div>
          </div>

          {/* Interactive Bottom Control Bar */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-dark-750 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsSimulatedMuted((m) => !m)}
              className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                isSimulatedMuted
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-slate-100 dark:bg-dark-800 border-slate-200 dark:border-dark-750 text-slate-700 dark:text-slate-200'
              }`}
            >
              {isSimulatedMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isSimulatedMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            <button
              onClick={() => setIsSimulatedVideoOff((v) => !v)}
              className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                isSimulatedVideoOff
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-slate-100 dark:bg-dark-800 border-slate-200 dark:border-dark-750 text-slate-700 dark:text-slate-200'
              }`}
            >
              {isSimulatedVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span>{isSimulatedVideoOff ? 'Camera Off' : 'Camera On'}</span>
            </button>

            <Button
              variant="gradient"
              size="sm"
              onClick={handleStartCall}
              className="rounded-2xl cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 mr-1.5" />
              Launch Live Chamber
            </Button>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          4. METRICS STRIP
          ========================================================================= */}
      <section className="py-12 px-4 sm:px-8 border-y border-slate-200/80 dark:border-dark-750 bg-white dark:bg-dark-900/60">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {metrics.map((s, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">
                {s.value}
              </div>
              <div className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                {s.label}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                {s.hint}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          5. BENTO GRID OF CORE ARCHITECTURAL PILLARS
          ========================================================================= */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="primary" size="md">Engineered for Performance</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight font-heading">
            Architected for instantaneous communication
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Eliminate bulky desktop clients and heavy relay servers. NEXORA leverages direct browser WebRTC standards for ultra-responsive collaboration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bentoFeatures.map((p, i) => (
            <div
              key={i}
              onClick={handleExploreCapability}
              className={`group p-6 sm:p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card hover:shadow-elevated transition-all duration-200 flex flex-col justify-between nx-card-interactive cursor-pointer ${p.borderGlow}`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-110 transition-transform">
                    <p.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300">
                    {p.badge}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                  {p.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <button
                type="button"
                onClick={handleExploreCapability}
                className="mt-6 pt-4 border-t border-slate-100 dark:border-dark-750 flex items-center text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:translate-x-1 transition-transform cursor-pointer w-full text-left"
              >
                <span>Explore capability</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          6. ARCHITECTURE PROTOCOL VISUALIZER (LEGACY VS. NEXORA)
          ========================================================================= */}
      <section id="architecture" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-200 dark:border-dark-750">
        <div className="text-center max-w-xl mx-auto mb-16">
          <Badge variant="default" size="md">Mesh Architecture</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 font-heading">
            Legacy Relay vs. NEXORA P2P
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Why direct browser-to-browser WebRTC is faster and inherently more private.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Legacy Card */}
          <div className="p-7 sm:p-8 rounded-3xl bg-slate-100/80 dark:bg-dark-900/40 border border-slate-200/90 dark:border-dark-750 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-dark-750">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                Legacy Cloud Video Platforms
              </span>
              <span className="text-xs font-mono text-slate-400">180ms+ Latency</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every participant sends audio and video to a centralized cloud server. The server decodes, transcodes, records, and relays data, introducing noticeable lag and exposure risks.
            </p>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 pt-2 font-mono">
              <li>❌ Intermediate media decoding & storage</li>
              <li>❌ Heavy central server bandwidth bills</li>
              <li>❌ Premature permission blocks on page load</li>
            </ul>
          </div>

          {/* NEXORA Card */}
          <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-brand-50/50 via-white to-violet-50/40 dark:from-brand-950/40 dark:via-dark-900 dark:to-dark-850 border border-brand-300 dark:border-brand-500/40 shadow-elevated space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-200/60 dark:border-dark-750">
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                NEXORA Cryptographic Mesh
              </span>
              <span className="text-xs font-mono text-emerald-500 font-bold">&lt; 38ms Latency</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Streams traverse directly between client browsers via encrypted WebRTC channels. Our signaling nodes merely orchestrate handshakes without ever decoding media.
            </p>
            <ul className="space-y-2 text-xs text-emerald-600 dark:text-emerald-400 pt-2 font-mono">
              <li>✔ Zero intermediary server media storage</li>
              <li>✔ Direct DTLS-SRTP 256-bit encryption</li>
              <li>✔ Camera access only requested upon room entry</li>
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. THREE-STEP WORKFLOW
          ========================================================================= */}
      <section id="workflow" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-200 dark:border-dark-750">
        <div className="text-center max-w-xl mx-auto mb-16">
          <Badge variant="default" size="md">Frictionless Workflow</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 font-heading">
            Live conferencing in three steps
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            No friction, no upfront hardware permissions, and instant access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, index) => (
            <div
              key={index}
              className="relative p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card nx-card-interactive"
            >
              <span className="text-4xl font-black text-brand-500/30 dark:text-brand-400/30 block mb-4 font-mono">
                {s.num}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                {s.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          8. TESTIMONIALS
          ========================================================================= */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-200 dark:border-dark-750">
        <div className="text-center max-w-xl mx-auto mb-16">
          <Badge variant="primary" size="md">Community Feedback</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 font-heading">
            Trusted by teams shipping fast
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <div
              key={index}
              className="p-7 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/90 dark:border-dark-750 shadow-card flex flex-col justify-between nx-card-interactive"
            >
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-dark-750">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {t.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.author}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          9. RADIANT CALL TO ACTION CAPSULE
          ========================================================================= */}
      <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto w-full my-6">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-14 bg-gradient-to-br from-indigo-900 via-brand-900 to-dark-900 text-white text-center shadow-elevated border border-brand-500/30">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-heading leading-tight">
              Ready to experience modern spatial communication?
            </h2>
            <p className="text-xs sm:text-base text-white/80 leading-relaxed">
              Launch a live chamber in under two seconds. Zero downloads, no upfront device permission blocks, and full end-to-end security.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-3.5">
              <button
                onClick={handleStartCall}
                className="px-8 py-4 rounded-2xl bg-white text-brand-900 font-bold text-sm shadow-xl hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Start Call Now</span>
              </button>
              <Link to="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-2xl border-white/30 text-white hover:bg-white/10 cursor-pointer"
                >
                  Create Workspace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          10. MINIMALIST ISLAND FOOTER
          ========================================================================= */}
      <footer className="mt-auto border-t border-slate-200 dark:border-dark-750 bg-white dark:bg-dark-900 py-12 px-4 sm:px-8 transition-colors">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="mb-3">
              <NexoraLogo size="sm" withText={true} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Spatial real-time communication platform engineered for high-performance product and software engineering teams.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3 font-heading">
              Product
            </h5>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/dashboard" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                  Communication Hub
                </Link>
              </li>
              <li>
                <Link to="/contacts" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                  Contact Directory
                </Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                  Conference History
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
                  Preferences & Security
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3 font-heading">
              Technology
            </h5>
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>Decentralized WebRTC Mesh</li>
              <li>Socket.IO Bidirectional Signaling</li>
              <li>React 18 & Vite Frontend</li>
              <li>DTLS 1.3 & SRTP Security</li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3 font-heading">
              Mesh Telemetry
            </h5>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200/80 dark:border-dark-750 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 nx-presence-online" />
                <span>All Gateways Live</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                P2P signaling and STUN nodes active with 99.99% uptime.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-100 dark:border-dark-750 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} NEXORA Platform. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-3 sm:mt-0">
            <span className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
              Privacy Policy
            </span>
            <span className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
              Terms of Service
            </span>
            <span className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
              Security Disclosures
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
