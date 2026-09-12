import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ChevronRight,
  ChevronDown,
  Shield,
  Zap,
  Palette,
  Bot,
  Wrench,
  FileCode,
  ArrowDownCircle,
  Pause,
  Play,
  CheckCircle2,
} from 'lucide-react';

export default function AgentTraceConsole({ traces = [], isRunning = false }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'security' | 'performance' | 'style' | 'analyzer'
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState({});
  const consoleBottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [traces, autoScroll]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredTraces = traces.filter((t) => {
    if (filter === 'all') return true;
    return t.agent === filter;
  });

  const getAgentBadge = (agent) => {
    switch (agent) {
      case 'security':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <Shield className="w-2.5 h-2.5 text-rose-400" />
            Security
          </span>
        );
      case 'performance':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            Performance
          </span>
        );
      case 'style':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <Palette className="w-2.5 h-2.5 text-emerald-400" />
            Style
          </span>
        );
      case 'analyzer':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Bot className="w-2.5 h-2.5 text-indigo-400" />
            Analyzer
          </span>
        );
      case 'synthesizer':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <CheckCircle2 className="w-2.5 h-2.5 text-purple-400" />
            Synthesizer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            System
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0e1117] border border-[#21262d] rounded-xl overflow-hidden flex flex-col h-[480px]">
      {/* Console Header Bar */}
      <div className="px-4 py-2.5 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-200 uppercase font-mono tracking-wider">
              Live Agent Trace
            </span>
          </div>

          {isRunning && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
              Streaming events...
            </span>
          )}
        </div>

        {/* Filter Tabs & Scroll Lock */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0a0c10] rounded-md p-0.5 border border-[#21262d]">
            {['all', 'security', 'performance', 'style'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded capitalize transition-colors ${
                  filter === tab
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
            className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors ${
              autoScroll
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Trace Log Body */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2.5 selection:bg-indigo-900/40">
        {filteredTraces.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
            <Terminal className="w-8 h-8 stroke-1 mb-2 text-zinc-600" />
            <p>Awaiting agent execution events...</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Tool calls and reasoning steps will stream here in real time.
            </p>
          </div>
        ) : (
          filteredTraces.map((trace) => {
            const isExpanded = !!expandedIds[trace.id];
            const hasDetails = Boolean(trace.args || trace.fullContent || trace.data);

            return (
              <div
                key={trace.id}
                className="group rounded border border-transparent hover:border-[#21262d] hover:bg-[#161b22]/40 transition-colors p-1.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-zinc-500 text-[10px] shrink-0 pt-0.5">
                    {trace.timestamp}
                  </span>

                  <div className="shrink-0">{getAgentBadge(trace.agent)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {trace.type === 'tool_call' ? (
                        <span className="text-sky-300 font-semibold flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-sky-400" />
                          → {trace.tool}
                        </span>
                      ) : trace.type === 'tool_result' ? (
                        <span className="text-zinc-400 flex items-center gap-1">
                          <FileCode className="w-3 h-3 text-zinc-500" />
                          ← Result
                        </span>
                      ) : trace.type === 'conclude' ? (
                        <span className="text-emerald-300 font-semibold flex items-center gap-1">
                          ✓ Concluded
                        </span>
                      ) : (
                        <span className="text-zinc-200">{trace.title}</span>
                      )}

                      {trace.iteration && (
                        <span className="text-[10px] text-zinc-500">
                          (iter {trace.iteration})
                        </span>
                      )}
                    </div>

                    {trace.detail && (
                      <p className="text-zinc-400 text-[11px] mt-0.5 break-words">
                        {trace.detail}
                      </p>
                    )}

                    {/* Expandable tool arguments or content */}
                    {hasDetails && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => toggleExpand(trace.id)}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <span>{isExpanded ? 'Hide payload' : 'View payload'}</span>
                        </button>

                        {isExpanded && (
                          <pre className="mt-1.5 p-2 rounded bg-[#0a0c10] border border-[#21262d] text-[11px] text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {trace.args && JSON.stringify(trace.args, null, 2)}
                            {trace.fullContent && trace.fullContent}
                            {trace.data && trace.data}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={consoleBottomRef} />
      </div>
    </div>
  );
}

