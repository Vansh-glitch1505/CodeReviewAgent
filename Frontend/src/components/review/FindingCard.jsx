import React, { useState } from 'react';
import {
  Shield,
  Zap,
  Palette,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Copy,
  Check,
} from 'lucide-react';
import Badge from '../common/Badge';

export default function FindingCard({ finding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!finding) return null;

  const { category, severity, title, description, filePath, lineNumber, raw } = finding;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryMeta = () => {
    switch (category) {
      case 'security':
        return {
          icon: Shield,
          color: 'text-rose-400',
          border: 'border-rose-500/20 hover:border-rose-500/40',
          badgeVar: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        };
      case 'performance':
        return {
          icon: Zap,
          color: 'text-amber-400',
          border: 'border-amber-500/20 hover:border-amber-500/40',
          badgeVar: severity === 'high' ? 'high' : 'medium',
        };
      case 'style':
      default:
        return {
          icon: Palette,
          color: 'text-emerald-400',
          border: 'border-emerald-500/20 hover:border-emerald-500/40',
          badgeVar: 'low',
        };
    }
  };

  const meta = getCategoryMeta();
  const Icon = meta.icon;

  return (
    <div
      className={`bg-[#11141a] border rounded-lg overflow-hidden transition-all duration-150 ${meta.border}`}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 cursor-pointer hover:bg-[#161b22]/50 transition-colors flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant={meta.badgeVar} size="sm">
              <span className="capitalize">{severity}</span>
            </Badge>

            <span className="text-[11px] font-mono uppercase text-zinc-500 flex items-center gap-1">
              <Icon className={`w-3 h-3 ${meta.color}`} />
              {category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy finding"
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <div className="text-zinc-500">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-zinc-100 leading-snug">
          {title}
        </h4>

        {/* File and Line Location if detected */}
        {filePath && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-[#0a0c10] px-2.5 py-1 rounded border border-[#21262d] w-fit">
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-zinc-200">{filePath}</span>
            {lineNumber && <span className="text-indigo-400">:{lineNumber}</span>}
          </div>
        )}

        {/* Concise Description */}
        {description && description !== title && (
          <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#21262d] bg-[#0e1117] text-xs font-mono text-zinc-300 space-y-3">
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
              Confirmed Evidence
            </span>
            <div className="p-2.5 rounded bg-[#0a0c10] border border-[#21262d] whitespace-pre-wrap break-words text-zinc-300 text-[11px] leading-relaxed">
              {raw}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

