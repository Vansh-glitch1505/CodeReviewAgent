import React from 'react';

const VARIANTS = {
  default: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  cyan: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  red: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  critical: 'bg-rose-950/60 text-rose-300 border-rose-700/60 font-semibold',
  high: 'bg-orange-950/60 text-orange-300 border-orange-700/60',
  medium: 'bg-amber-950/60 text-amber-300 border-amber-700/60',
  low: 'bg-blue-950/60 text-blue-300 border-blue-700/60',
};

const SIZES = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
  dotColor = null,
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.default;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono border rounded-md font-medium tracking-wide ${variantClass} ${sizeClass} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            dotColor || 'bg-current'
          }`}
        />
      )}
      {children}
    </span>
  );
}

