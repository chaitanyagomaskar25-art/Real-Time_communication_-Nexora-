import React from 'react';
import { Video } from 'lucide-react';

const PageLoader = ({ message = 'Loading NEXORA...' }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in" role="status" aria-live="polite">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/30 animate-pulse">
          <Video className="w-6 h-6" />
        </div>
        <div className="absolute -inset-1.5 rounded-2xl border-2 border-brand-500/20 animate-ping pointer-events-none" />
      </div>
      <div className="w-7 h-7 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide font-sans">{message}</p>
    </div>
  );
};

export default PageLoader;
