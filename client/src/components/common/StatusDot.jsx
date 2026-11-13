import React from 'react';

/**
 * NEXORA Status Dot with non-aggressive breathing halo for online presence
 */
const StatusDot = ({
  status = 'available',
  size = 'md',
  className = '',
  title
}) => {
  const isOnline = status === 'available' || status === 'online';
  const isBusy = status === 'busy' || status === 'in-meeting' || status === 'in-call';
  const isFocused = status === 'focused' || status === 'dnd';
  const isAway = status === 'away';

  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4'
  }[size] || 'w-3 h-3';

  const colorClasses = isOnline
    ? 'bg-emerald-500 nx-presence-online ring-2 ring-white dark:ring-dark-900 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    : isBusy
    ? 'bg-rose-500 ring-2 ring-white dark:ring-dark-900 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
    : isFocused
    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 ring-2 ring-white dark:ring-dark-900 shadow-[0_0_10px_rgba(139,92,246,0.5)]'
    : isAway
    ? 'bg-amber-500 ring-2 ring-white dark:ring-dark-900 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
    : 'bg-slate-400 dark:bg-slate-500 ring-2 ring-white dark:ring-dark-900';

  const defaultTitle = isOnline
    ? 'Active Online'
    : isBusy
    ? 'Busy / In a Meeting'
    : isFocused
    ? 'Focused Mode'
    : isAway
    ? 'Away'
    : 'Offline';

  return (
    <span
      className={`rounded-full shrink-0 transition-colors duration-200 ${sizeClasses} ${colorClasses} ${className}`}
      title={title || defaultTitle}
      aria-label={title || defaultTitle}
    />
  );
};

export default StatusDot;
