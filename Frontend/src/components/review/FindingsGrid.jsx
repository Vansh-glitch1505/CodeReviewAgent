import React, { useState } from 'react';
import { Shield, Zap, Palette, Filter, CheckCircle2 } from 'lucide-react';
import FindingCard from './FindingCard';

export default function FindingsGrid({ findings = { security: [], performance: [], style: [] } }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const securityList = findings.security || [];
  const performanceList = findings.performance || [];
  const styleList = findings.style || [];
  const totalCount = securityList.length + performanceList.length + styleList.length;

  let displayedFindings = [];
  if (activeCategory === 'all') {
    displayedFindings = [...securityList, ...performanceList, ...styleList];
  } else if (activeCategory === 'security') {
    displayedFindings = securityList;
  } else if (activeCategory === 'performance') {
    displayedFindings = performanceList;
  } else if (activeCategory === 'style') {
    displayedFindings = styleList;
  }

  return (
    <div className="space-y-4">
      {/* Category Filter & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11141a] border border-[#21262d] rounded-xl p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <span>All Findings</span>
            <span className="px-1.5 py-0.2 rounded bg-black/30 text-[11px] font-mono">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('security')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === 'security'
                ? 'bg-rose-950/80 text-rose-200 border border-rose-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>Security</span>
            <span className="px-1.5 py-0.2 rounded bg-black/30 text-[11px] font-mono text-rose-400">
              {securityList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('performance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === 'performance'
                ? 'bg-amber-950/80 text-amber-200 border border-amber-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Performance</span>
            <span className="px-1.5 py-0.2 rounded bg-black/30 text-[11px] font-mono text-amber-400">
              {performanceList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('style')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === 'style'
                ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Style</span>
            <span className="px-1.5 py-0.2 rounded bg-black/30 text-[11px] font-mono text-emerald-400">
              {styleList.length}
            </span>
          </button>
        </div>

        <div className="text-xs font-mono text-zinc-500 self-end sm:self-center pr-2">
          Showing {displayedFindings.length} issue{displayedFindings.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Findings List */}
      {displayedFindings.length === 0 ? (
        <div className="p-12 text-center bg-[#11141a] border border-[#21262d] rounded-xl flex flex-col items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
          <h4 className="text-sm font-semibold text-zinc-200">
            No Confirmed Issues Found
          </h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            The specialist agents verified the codebase using tools and found zero confirmed issues for this category.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}

