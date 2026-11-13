import React, { useState } from 'react';
import StatusDot from './StatusDot';

// Coordinated NEXORA brand avatar gradients
const GRADIENT_PALETTES = [
  'from-brand-600 to-violet-600',
  'from-violet-600 to-purple-600',
  'from-indigo-600 to-brand-600',
  'from-purple-600 to-pink-600',
  'from-brand-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-rose-600'
];

export const getDeterministicGradient = (str = '') => {
  if (!str) return GRADIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
};

export const getInitials = (name = '') => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Avatar = ({
  src,
  alt = 'Avatar',
  name = '',
  status, // 'available' | 'busy' | 'away' | 'offline' | 'focused'
  size = 'md',
  shape = 'rounded-2xl', // 'rounded-full' | 'rounded-2xl' | 'rounded-xl'
  className = '',
  showStatus = false,
  orbital = false
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-24 h-24 text-2xl font-bold'
  }[size] || 'w-10 h-10 text-xs';

  const dotSize = {
    xs: 'xs',
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl',
    '2xl': 'xl'
  }[size] || 'md';

  const gradientClass = getDeterministicGradient(name || alt);
  const initials = getInitials(name || alt);
  const isOnline = status === 'available' || status === 'online';

  return (
    <div
      className={`relative inline-block shrink-0 select-none ${
        orbital ? `p-0.5 rounded-2xl ring-1.5 ${isOnline ? 'ring-emerald-400/50 dark:ring-emerald-500/40' : 'ring-brand-400/30 dark:ring-brand-500/30'}` : ''
      } ${className}`}
    >
      <div
        className={`${sizeClasses} ${shape} bg-gradient-to-tr ${gradientClass} text-white font-extrabold flex items-center justify-center shadow-sm overflow-hidden`}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="tracking-tight">{initials}</span>
        )}
      </div>

      {showStatus && status && (
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status={status} size={dotSize} />
        </div>
      )}
    </div>
  );
};

export default Avatar;
