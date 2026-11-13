import React from 'react';

/**
 * NEXORA Custom Vector Empty-State Illustrations
 */
const EmptyIllustrations = {
  messages: () => (
    <svg
      className="w-36 h-36 mx-auto select-none"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="80" cy="80" r="70" className="fill-brand-50/50 dark:fill-brand-950/20" />
      <circle cx="80" cy="80" r="50" className="stroke-brand-200/50 dark:stroke-brand-800/30 stroke-dashed" strokeDasharray="4 4" />
      {/* Background card */}
      <rect x="36" y="42" width="76" height="42" rx="14" className="fill-white dark:fill-dark-800 shadow-md stroke-slate-200/80 dark:stroke-dark-700" strokeWidth="1.5" />
      <rect x="48" y="54" width="36" height="5" rx="2.5" className="fill-slate-200 dark:fill-dark-600" />
      <rect x="48" y="64" width="52" height="4" rx="2" className="fill-slate-100 dark:fill-dark-700" />
      {/* Foreground primary card with brand gradient */}
      <rect x="52" y="68" width="80" height="46" rx="16" fill="url(#nexoraGrad)" className="shadow-lg" />
      <rect x="66" y="80" width="44" height="5" rx="2.5" fill="white" fillOpacity="0.9" />
      <rect x="66" y="90" width="56" height="4" rx="2" fill="white" fillOpacity="0.6" />
      {/* Pulsing indicator */}
      <circle cx="120" cy="52" r="5" className="fill-emerald-500 shadow-sm" />
      <circle cx="120" cy="52" r="9" className="stroke-emerald-400/40 animate-pulse" strokeWidth="1.5" />
      <defs>
        <linearGradient id="nexoraGrad" x1="52" y1="68" x2="132" y2="114" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  ),

  search: () => (
    <svg
      className="w-36 h-36 mx-auto select-none"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="80" cy="80" r="64" className="fill-violet-50/50 dark:fill-violet-950/20" />
      <circle cx="80" cy="80" r="44" className="stroke-violet-200/60 dark:stroke-violet-800/40" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="74" cy="74" r="26" className="fill-white dark:fill-dark-850 stroke-brand-500 dark:stroke-brand-400" strokeWidth="3" />
      <path d="M94 94L114 114" className="stroke-brand-600 dark:stroke-brand-400" strokeWidth="4" strokeLinecap="round" />
      <circle cx="74" cy="74" r="14" className="fill-brand-50 dark:fill-brand-950/60" />
    </svg>
  ),

  contacts: () => (
    <svg
      className="w-36 h-36 mx-auto select-none"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="80" cy="80" r="66" className="fill-indigo-50/40 dark:fill-indigo-950/20" />
      {/* Network connector lines */}
      <path d="M52 64L80 50L108 64L80 110Z" className="stroke-brand-200 dark:stroke-brand-800/40" strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Center node */}
      <circle cx="80" cy="78" r="18" fill="url(#contactGrad)" className="shadow-md" />
      <circle cx="80" cy="74" r="6" fill="white" />
      <path d="M70 88C70 83 74 81 80 81C86 81 90 83 90 88" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Surrounding nodes */}
      <circle cx="52" cy="60" r="10" className="fill-white dark:fill-dark-800 stroke-slate-200 dark:stroke-dark-700" strokeWidth="1.5" />
      <circle cx="108" cy="60" r="10" className="fill-white dark:fill-dark-800 stroke-slate-200 dark:stroke-dark-700" strokeWidth="1.5" />
      <circle cx="80" cy="116" r="10" className="fill-white dark:fill-dark-800 stroke-slate-200 dark:stroke-dark-700" strokeWidth="1.5" />
      <defs>
        <linearGradient id="contactGrad" x1="62" y1="60" x2="98" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  )
};

const EmptyState = ({
  illustration = 'messages',
  title = 'No records found',
  description = 'Get started by creating your first entry.',
  action,
  className = ''
}) => {
  const IllustrationComp = EmptyIllustrations[illustration] || EmptyIllustrations.messages;

  return (
    <div className={`p-8 text-center max-w-sm mx-auto flex flex-col items-center justify-center animate-fade-in ${className}`}>
      <div className="mb-4 transform hover:scale-105 transition-transform duration-300">
        <IllustrationComp />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xs">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
