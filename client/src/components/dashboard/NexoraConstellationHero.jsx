import React from 'react';
import {
  Video,
  Plus,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Zap,
  Radio,
  Lock,
  Sparkles
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import NexoraLogo from '../common/NexoraLogo';

const NexoraConstellationHero = ({
  user,
  isConnected,
  onStartInstant,
  onOpenSchedule,
  onOpenNewChat,
  isInstantStarting
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-lavender-50/50 dark:from-dark-900 dark:via-dark-900 dark:to-dark-850 border border-slate-200/90 dark:border-dark-750 p-6 sm:p-8 lg:p-10 shadow-elevated nx-bg-dots">
      {/* Ambient Radial Luminance */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-brand-500/15 via-violet-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-[300px] h-[300px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left: Atmospheric Greeting & Actions */}
        <div className="max-w-xl text-center lg:text-left">
          {/* Signal Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50/90 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-900/60 text-[11px] font-bold text-brand-700 dark:text-brand-300 mb-3 shadow-subtle">
            <span className="w-2 h-2 rounded-full bg-emerald-500 nx-presence-online" />
            <span>{formattedDate}</span>
            <span className="opacity-40">•</span>
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-brand-500" />
              {isConnected ? 'Signaling Mesh Active' : 'Connecting Gateway'}
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading leading-tight">
            {getGreeting()},{' '}
            <span className="nx-gradient-text">
              {user?.name?.split(' ')[0] || 'Partner'}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed max-w-lg">
            Welcome to <span className="font-bold text-slate-900 dark:text-white">NEXORA</span>. A distinct spatial communication platform powered by encrypted WebRTC mesh signaling, high-fidelity real-time audio, and zero-telemetry collaboration.
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-6">
            <Button
              variant="gradient"
              size="md"
              onClick={onStartInstant}
              isLoading={isInstantStarting}
              className="shadow-glow cursor-pointer"
            >
              <Video className="w-4 h-4 mr-2" />
              Instant Chamber
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={onOpenNewChat}
              className="cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 mr-2 text-brand-600 dark:text-brand-400" />
              Direct Message
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={onOpenSchedule}
              className="cursor-pointer"
            >
              <Calendar className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Schedule
            </Button>
          </div>

          {/* Security & Reliability Footnote */}
          <div className="flex items-center justify-center lg:justify-start gap-4 mt-6 pt-4 border-t border-slate-200/60 dark:border-dark-750 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              End-to-End Signaling
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-500" />
              DTLS-SRTP 256-bit
            </span>
            <span>•</span>
            <span>Sub-50ms Latency</span>
          </div>
        </div>

        {/* Right: The NEXORA Constellation Orbit Graphic */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 flex items-center justify-center shrink-0">
          {/* Outer Orbital Ring (Rotating Clockwise) */}
          <div className="absolute inset-0 rounded-full border border-dashed border-brand-400/30 dark:border-brand-500/25 nx-constellation-spin" />

          {/* Counter Orbital Ring (Rotating Counter-Clockwise) */}
          <div className="absolute inset-6 rounded-full border border-dotted border-violet-400/40 dark:border-violet-500/30 nx-constellation-spin-reverse" />

          {/* Inner Harmonic Orbit */}
          <div className="absolute inset-14 rounded-full border border-slate-300/40 dark:border-slate-700/40" />

          {/* Orbit Node 1: Video */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/40 border border-white/20">
            <Video className="w-3.5 h-3.5" />
          </div>

          {/* Orbit Node 2: Message */}
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/40 border border-white/20">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>

          {/* Orbit Node 3: Calendar */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/40 border border-white/20">
            <Calendar className="w-3.5 h-3.5" />
          </div>

          {/* Orbit Node 4: Sparkles */}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/40 border border-white/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          {/* Center Brand Monogram Jewel */}
          <div className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-950 via-dark-900 to-black p-1 shadow-2xl border border-brand-400/40 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-brand-500/20 blur-md pointer-events-none" />
            <NexoraLogo size="lg" withText={false} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NexoraConstellationHero;
