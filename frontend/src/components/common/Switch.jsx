import React from 'react';

/**
 * NEXORA Accessible Switch Toggle Component
 */
const Switch = ({
  checked = false,
  onChange,
  disabled = false,
  id,
  label,
  description,
  className = '',
  size = 'md'
}) => {
  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {(label || description) && (
        <div className="flex-1 min-w-0 pr-2">
          {label && (
            <label
              htmlFor={id}
              onClick={handleToggle}
              className={`block text-xs font-semibold text-slate-900 dark:text-white cursor-pointer select-none ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        disabled={disabled}
        onClick={handleToggle}
        className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-900 ${
          isSmall ? 'h-5 w-9' : 'h-6 w-11'
        } ${
          disabled
            ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-dark-750'
            : checked
            ? 'bg-gradient-to-r from-brand-600 to-violet-600 shadow-sm shadow-brand-500/25'
            : 'bg-slate-200 dark:bg-dark-700 hover:bg-slate-300 dark:hover:bg-dark-650'
        }`}
      >
        <span
          className={`pointer-events-none inline-block transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            isSmall
              ? `h-3.5 w-3.5 mt-[3px] ${checked ? 'translate-x-4.5' : 'translate-x-1'}`
              : `h-4.5 w-4.5 mt-[3px] ${checked ? 'translate-x-5.5' : 'translate-x-1'}`
          }`}
        />
      </button>
    </div>
  );
};

export default Switch;
