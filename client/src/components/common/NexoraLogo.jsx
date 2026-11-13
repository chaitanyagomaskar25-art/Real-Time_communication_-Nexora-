import React from 'react';

/**
 * NexoraLogo — Custom geometric monogram and brand crest.
 * Features an interlocking dimensional prism forming the signature 'N'
 * with violet, indigo and luminous lavender reflections.
 */
const NexoraLogo = ({
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  withText = false,
  className = '',
  textClassName = ''
}) => {
  const sizeMap = {
    xs: { box: 'w-6 h-6', icon: 16 },
    sm: { box: 'w-8 h-8', icon: 20 },
    md: { box: 'w-9 h-9', icon: 24 },
    lg: { box: 'w-11 h-11', icon: 28 },
    xl: { box: 'w-14 h-14', icon: 36 }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Dimensional Prism Monogram */}
      <div
        className={`relative ${currentSize.box} rounded-2xl bg-gradient-to-br from-indigo-900 via-dark-900 to-black p-0.5 shadow-md shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-all duration-300 flex items-center justify-center shrink-0 border border-brand-500/30 group-hover:border-brand-400/60`}
      >
        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/30 via-violet-500/20 to-transparent blur-xs pointer-events-none" />

        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5 relative z-10"
        >
          <defs>
            <linearGradient id="nxPrismLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="nxPrismBridge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="nxPrismRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <filter id="nxGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#818cf8" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Left Pillar */}
          <path
            d="M7 6.5C7 5.67157 7.67157 5 8.5 5H10.5C11.3284 5 12 5.67157 12 6.5V25.5C12 26.3284 11.3284 27 10.5 27H8.5C7.67157 27 7 26.3284 7 25.5V6.5Z"
            fill="url(#nxPrismLeft)"
          />

          {/* Dynamic Faceted Diagonal Bridge */}
          <path
            d="M10.5 5.5L21.5 24.5C21.9 25.2 22.8 25.5 23.5 25.1C24.2 24.7 24.5 23.8 24.1 23.1L13.1 7.1C12.7 6.4 11.8 6.1 11.1 6.5C10.7 6.7 10.5 7.1 10.5 7.5V5.5Z"
            fill="url(#nxPrismBridge)"
            filter="url(#nxGlow)"
          />

          {/* Right Pillar */}
          <path
            d="M20 6.5C20 5.67157 20.6716 5 21.5 5H23.5C24.3284 5 25 5.67157 25 6.5V25.5C25 26.3284 24.3284 27 23.5 27H21.5C20.6716 27 20 26.3284 20 25.5V6.5Z"
            fill="url(#nxPrismRight)"
          />

          {/* Orbital Spark Node */}
          <circle cx="22.5" cy="8.5" r="2" fill="#ffffff" filter="url(#nxGlow)" />
        </svg>
      </div>

      {/* Brand Typography (Optional) */}
      {withText && (
        <div className={`flex flex-col text-left leading-none ${textClassName}`}>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-wider text-base text-slate-900 dark:text-white font-heading">
              NEXORA
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          </div>
          <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            Communication Platform
          </span>
        </div>
      )}
    </div>
  );
};

export default NexoraLogo;
