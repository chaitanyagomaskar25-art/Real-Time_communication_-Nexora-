import React from 'react';

export const SkeletonBox = ({
  className = '',
  rounded = 'rounded-xl',
  height,
  width
}) => {
  return (
    <div
      className={`nx-skeleton-shimmer ${rounded} ${className}`}
      style={{
        height: height || undefined,
        width: width || undefined
      }}
    />
  );
};

export const SkeletonText = ({
  lines = 2,
  className = '',
  lastLineWidth = 'w-3/4'
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`h-2.5 rounded-full nx-skeleton-shimmer ${
            idx === lines - 1 && lines > 1 ? lastLineWidth : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

export const SkeletonAvatar = ({
  size = 'md',
  shape = 'rounded-2xl',
  className = ''
}) => {
  const sizeClass = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }[size] || 'w-10 h-10';

  return (
    <div className={`${sizeClass} ${shape} nx-skeleton-shimmer shrink-0 ${className}`} />
  );
};

export const ConversationSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-dark-800 bg-white/50 dark:bg-dark-900/40"
        >
          <SkeletonAvatar size="md" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <SkeletonBox className="h-3 w-28 rounded-md" />
              <SkeletonBox className="h-2.5 w-10 rounded-md" />
            </div>
            <SkeletonBox className="h-2.5 w-3/4 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ContactSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-3xl bg-white dark:bg-dark-900 border border-slate-200/80 dark:border-dark-750 space-y-4"
        >
          <div className="flex items-center gap-3.5">
            <SkeletonAvatar size="lg" shape="rounded-2xl" />
            <div className="space-y-2 flex-1">
              <SkeletonBox className="h-3.5 w-32 rounded-md" />
              <SkeletonBox className="h-2.5 w-20 rounded-md" />
            </div>
          </div>
          <SkeletonText lines={2} />
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-dark-800">
            <SkeletonBox className="h-8 flex-1 rounded-xl" />
            <SkeletonBox className="h-8 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const MessageSkeleton = () => {
  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
      {/* Left message skeleton */}
      <div className="flex items-start gap-3 max-w-md">
        <SkeletonAvatar size="sm" />
        <div className="space-y-1.5">
          <SkeletonBox className="h-14 w-64 rounded-2xl rounded-tl-sm" />
          <SkeletonBox className="h-2.5 w-16 rounded-md" />
        </div>
      </div>

      {/* Right message skeleton */}
      <div className="flex items-end justify-end gap-3 ml-auto max-w-md">
        <div className="space-y-1.5 text-right flex flex-col items-end">
          <SkeletonBox className="h-10 w-48 rounded-2xl rounded-tr-sm bg-brand-500/20" />
          <SkeletonBox className="h-2.5 w-12 rounded-md" />
        </div>
      </div>

      {/* Another left message skeleton */}
      <div className="flex items-start gap-3 max-w-md">
        <SkeletonAvatar size="sm" />
        <div className="space-y-1.5">
          <SkeletonBox className="h-20 w-80 rounded-2xl rounded-tl-sm" />
          <SkeletonBox className="h-2.5 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
};

export default {
  SkeletonBox,
  SkeletonText,
  SkeletonAvatar,
  ConversationSkeleton,
  ContactSkeleton,
  MessageSkeleton
};
