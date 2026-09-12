import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import Badge from '../common/Badge';

export default function InitialAnalysis({ analysis }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!analysis) return null;

  const isIssues = analysis.verdict === 'ISSUES';

  return (
    <div className="bg-[#11141a] border border-[#21262d] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 bg-[#161b22]/70 hover:bg-[#161b22] border-b border-[#21262d] flex items-center justify-between transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Initial Repository Analysis
            </h3>
            <p className="text-xs text-zinc-400">
              High-level repository scan by Initial Analyzer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isIssues ? (
            <Badge variant="amber" dot>
              VERDICT: ISSUES DETECTED
            </Badge>
          ) : (
            <Badge variant="green" dot>
              VERDICT: CLEAN
            </Badge>
          )}

          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 text-sm text-zinc-300 leading-relaxed font-sans bg-[#0d1017]/40">
          <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap font-sans text-xs text-zinc-300">
            {analysis.cleanText || analysis.raw}
          </div>
        </div>
      )}
    </div>
  );
}

