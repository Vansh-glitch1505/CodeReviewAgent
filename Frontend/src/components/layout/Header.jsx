import React from 'react';
import { RefreshCw, FolderGit2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function Header({
  backendStatus = 'connecting',
  backendLatency = null,
  backendUrl = '',
  onRefreshHealth,
  currentRepo = '',
}) {
  const getStatusBadge = () => {
    switch (backendStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold">Backend Connected</span>
            {backendLatency !== null && (
              <span className="text-emerald-500/70 text-[10px]">
                ({backendLatency}ms)
              </span>
            )}
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Connecting...</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="font-semibold">Backend Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="h-14 border-b border-[#21262d] bg-[#0d1017]/80 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
          CodeReview AI
          <span className="text-zinc-500 font-normal">/</span>
          <span className="text-xs text-zinc-400 font-normal">
            Multi-Agent Orchestrator
          </span>
        </h1>

        {currentRepo && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono max-w-xs truncate">
            <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{currentRepo}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {getStatusBadge()}
        {onRefreshHealth && (
          <button
            type="button"
            onClick={onRefreshHealth}
            title="Check backend status"
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}

