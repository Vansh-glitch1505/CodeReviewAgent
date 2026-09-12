import React from 'react';
import {
  Search,
  Shield,
  Zap,
  Palette,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Minus,
  Sparkles,
  ArrowDown,
} from 'lucide-react';

export default function GraphWorkflow({ agents = {} }) {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'running':
        return {
          badge: 'RUNNING',
          badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          dotClass: 'bg-sky-400 animate-ping',
          cardBorder: 'border-sky-500/50 shadow-sm shadow-sky-500/10',
          icon: <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />,
        };
      case 'completed':
        return {
          badge: 'COMPLETED',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dotClass: 'bg-emerald-400',
          cardBorder: 'border-emerald-500/30',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
      case 'skipped':
        return {
          badge: 'SKIPPED',
          badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
          dotClass: 'bg-zinc-600',
          cardBorder: 'border-zinc-800 opacity-60',
          icon: <Minus className="w-4 h-4 text-zinc-500" />,
        };
      case 'error':
        return {
          badge: 'FAILED',
          badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dotClass: 'bg-rose-500',
          cardBorder: 'border-rose-500/40',
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
        };
      case 'waiting':
      default:
        return {
          badge: 'WAITING',
          badgeClass: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/80',
          dotClass: 'bg-zinc-600',
          cardBorder: 'border-[#21262d]',
          icon: <span className="w-2 h-2 rounded-full bg-zinc-600" />,
        };
    }
  };

  const specialists = [
    {
      key: 'security',
      title: 'Security Agent',
      icon: Shield,
      color: 'text-rose-400',
      description: 'Injection, secrets, auth flaws & bandit linter',
      provider: 'Groq LLM',
    },
    {
      key: 'performance',
      title: 'Performance Agent',
      icon: Zap,
      color: 'text-amber-400',
      description: 'Bottlenecks, blocking code & perflint',
      provider: 'Gemini LLM',
    },
    {
      key: 'style',
      title: 'Style Agent',
      icon: Palette,
      color: 'text-emerald-400',
      description: 'Maintainability, PEP8, naming & structure',
      provider: 'Groq LLM',
    },
  ];

  const analyzerState = getStatusConfig(agents.analyzer?.status);
  const synthesizerState = getStatusConfig(agents.synthesizer?.status);

  return (
    <div className="bg-[#11141a] border border-[#21262d] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
            LangGraph Agent Workflow
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          Parallel ReAct Execution
        </span>
      </div>

      <div className="flex flex-col items-center max-w-4xl mx-auto">
        {/* Node 1: Initial Analyzer */}
        <div className="w-full max-w-md">
          <div
            className={`bg-[#161b22] border rounded-lg p-3 transition-all ${analyzerState.cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                    Initial Analyzer
                    <span className="text-[10px] font-mono text-zinc-500">
                      Gemini
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    High-level repo snapshot & triage verdict
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${analyzerState.badgeClass}`}
                >
                  {analyzerState.badge}
                </span>
                {analyzerState.icon}
              </div>
            </div>
            {agents.analyzer?.detail && (
              <div className="mt-2 pt-2 border-t border-[#21262d] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span className="truncate">{agents.analyzer.detail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Downward Connector Arrow */}
        <div className="h-6 flex items-center justify-center text-zinc-600 my-0.5">
          <ArrowDown className="w-4 h-4 text-zinc-600" />
        </div>

        {/* Node 2: 3 Parallel Specialist Agents */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
          {specialists.map((spec) => {
            const Icon = spec.icon;
            const currentAgent = agents[spec.key] || {};
            const stateCfg = getStatusConfig(currentAgent.status);
            const isRunning = currentAgent.status === 'running';

            return (
              <div
                key={spec.key}
                className={`bg-[#161b22] border rounded-lg p-3.5 flex flex-col justify-between transition-all ${stateCfg.cardBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${spec.color}`} />
                      <span className="text-xs font-semibold text-zinc-100">
                        {spec.title}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${stateCfg.badgeClass}`}
                    >
                      {stateCfg.badge}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 mb-2">
                    {spec.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#21262d] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{spec.provider}</span>
                  {currentAgent.iterations > 0 && (
                    <span
                      className={
                        isRunning ? 'text-sky-400 font-semibold' : 'text-zinc-400'
                      }
                    >
                      Iter {currentAgent.iterations}/4
                    </span>
                  )}
                  {currentAgent.detail && (
                    <span className="text-zinc-400 truncate max-w-[120px]" title={currentAgent.detail}>
                      {currentAgent.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Downward Connector Arrow */}
        <div className="h-6 flex items-center justify-center text-zinc-600 my-0.5">
          <ArrowDown className="w-4 h-4 text-zinc-600" />
        </div>

        {/* Node 3: Synthesizer Agent */}
        <div className="w-full max-w-md">
          <div
            className={`bg-[#161b22] border rounded-lg p-3 transition-all ${synthesizerState.cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                    Synthesizer Agent
                    <span className="text-[10px] font-mono text-zinc-500">
                      Groq
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Aggregates findings into structured markdown report
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${synthesizerState.badgeClass}`}
                >
                  {synthesizerState.badge}
                </span>
                {synthesizerState.icon}
              </div>
            </div>
            {agents.synthesizer?.detail && (
              <div className="mt-2 pt-2 border-t border-[#21262d] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span className="truncate">{agents.synthesizer.detail}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

