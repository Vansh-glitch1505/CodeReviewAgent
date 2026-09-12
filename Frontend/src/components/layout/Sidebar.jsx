import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Shield,
  Zap,
  Palette,
  Bot,
  Activity,
  CheckCircle2,
  AlertCircle,
  Radio,
} from 'lucide-react';

export default function Sidebar({
  activeTab = 'dashboard',
  onSelectTab,
  onNewReview,
  agents = {},
  backendStatus = 'connecting',
}) {
  const agentItems = [
    {
      key: 'security',
      label: 'Security Agent',
      icon: Shield,
      color: 'text-rose-400',
      activeColor: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      state: agents.security?.status || 'idle',
      iters: agents.security?.iterations || 0,
    },
    {
      key: 'performance',
      label: 'Performance Agent',
      icon: Zap,
      color: 'text-amber-400',
      activeColor: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      state: agents.performance?.status || 'idle',
      iters: agents.performance?.iterations || 0,
    },
    {
      key: 'style',
      label: 'Style Agent',
      icon: Palette,
      color: 'text-emerald-400',
      activeColor: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      state: agents.style?.status || 'idle',
      iters: agents.style?.iterations || 0,
    },
  ];

  const renderAgentStatus = (status) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
        );
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'waiting':
        return <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />;
    }
  };

  return (
    <aside className="w-64 bg-[#0d1017] border-r border-[#21262d] flex flex-col justify-between shrink-0 select-none h-screen sticky top-0">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#21262d] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">
                CodeReview AI
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium">
              LangGraph Multi-Agent
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="p-3 space-y-1">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-400" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={onNewReview}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-zinc-400" />
            <span>New Review</span>
          </button>
        </div>

        {/* Agent Specialists Section */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 border-b border-[#21262d]/60">
            <span>Specialist Agents</span>
            <Activity className="w-3 h-3 text-zinc-500" />
          </div>

          <div className="mt-2 space-y-1">
            {agentItems.map((agent) => {
              const Icon = agent.icon;
              const isRunning = agent.state === 'running';
              return (
                <div
                  key={agent.key}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md border transition-all ${
                    isRunning
                      ? agent.activeColor
                      : 'bg-zinc-900/30 border-zinc-800/80 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${agent.color}`} />
                    <span className="truncate font-medium text-zinc-200">
                      {agent.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {agent.iters > 0 && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        iter {agent.iters}
                      </span>
                    )}
                    {renderAgentStatus(agent.state)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Connection Pill */}
      <div className="p-3 border-t border-[#21262d] bg-[#0a0c10]/40">
        <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1.5 rounded bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-3 h-3 ${
                backendStatus === 'connected'
                  ? 'text-emerald-400 animate-pulse'
                  : backendStatus === 'connecting'
                  ? 'text-amber-400 animate-spin'
                  : 'text-rose-400'
              }`}
            />
            <span className="text-zinc-400">Backend API</span>
          </div>
          <span
            className={`font-semibold capitalize ${
              backendStatus === 'connected'
                ? 'text-emerald-400'
                : backendStatus === 'connecting'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {backendStatus}
          </span>
        </div>
      </div>
    </aside>
  );
}

