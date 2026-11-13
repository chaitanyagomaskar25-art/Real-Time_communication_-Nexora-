import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-dark-950 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.985] select-none';

  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-[0_1px_2px_rgba(79,70,229,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] border border-brand-700/60 focus:ring-brand-500/40',
    gradient: 'bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 hover:from-brand-500 hover:via-indigo-500 hover:to-violet-500 text-white shadow-sm shadow-brand-600/30 border border-brand-500/30 focus:ring-brand-500/40',
    secondary: 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 shadow-subtle hover:border-slate-300 dark:bg-dark-900 dark:hover:bg-dark-850 dark:text-slate-100 dark:border-dark-750 focus:ring-slate-400/30',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 border border-rose-700/50 focus:ring-rose-500/40',
    outline: 'border border-slate-200 dark:border-dark-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-dark-850 hover:text-slate-900 dark:hover:text-white focus:ring-slate-400/30',
    ghost: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-dark-850 focus:ring-slate-400/30',
    subtle: 'bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/70 dark:bg-brand-950/40 dark:hover:bg-brand-900/40 dark:text-brand-300 dark:border-brand-800/50'
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 gap-2 font-medium',
    lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5 font-semibold'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
