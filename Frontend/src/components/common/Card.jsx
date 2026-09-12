import React from 'react';

export default function Card({
  children,
  className = '',
  title = null,
  subtitle = null,
  action = null,
  footer = null,
  noPadding = false,
}) {
  return (
    <div
      className={`bg-[#11141a] border border-[#21262d] rounded-lg overflow-hidden transition-colors ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d] bg-[#161b22]/50">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-[#21262d] bg-[#161b22]/30 text-xs text-zinc-400">
          {footer}
        </div>
      )}
    </div>
  );
}

