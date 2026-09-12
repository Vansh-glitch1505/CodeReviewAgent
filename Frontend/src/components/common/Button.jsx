import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm shadow-indigo-950/50 border border-indigo-500/30 focus-visible:ring-indigo-500',
  secondary:
    'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-zinc-600 focus-visible:ring-zinc-600',
  danger:
    'bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-700/50 focus-visible:ring-rose-500',
  ghost:
    'bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent',
};

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
  lg: 'px-4 py-2 text-sm md:text-base font-medium',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon = null,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4 text-current" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

