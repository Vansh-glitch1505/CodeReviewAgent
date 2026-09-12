import React, { useState } from 'react';
import { Play, Sparkles, Folder, Settings2, AlertCircle, X, StopCircle } from 'lucide-react';
import Button from '../common/Button';

export default function RepoInputForm({
  repoPath,
  setRepoPath,
  backendUrl,
  setBackendUrl,
  onSubmit,
  onCancel,
  isLoading,
  backendStatus,
  error,
}) {
  const [showConfig, setShowConfig] = useState(false);

  const handleUseCurrent = () => {
    // Fill in default workspace path
    setRepoPath('c:\\Users\\ACER\\OneDrive\\agentic_ai\\CodeReviewAgent-LangGraph');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!repoPath.trim() || isLoading) return;
    onSubmit();
  };

  return (
    <div className="bg-[#11141a] border border-[#21262d] rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#21262d]/80">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Multi-Agent System</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            AI CODE REVIEW
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze your repository with specialized AI agents.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors self-start ${
            showConfig
              ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Server Config</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="pt-6 space-y-4">
        {/* Optional Server URL config */}
        {showConfig && (
          <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#2a313d] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-mono text-zinc-300 font-medium">
                Backend API URL
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">
                Default: http://localhost:8000
              </span>
            </div>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8000"
              disabled={isLoading}
              className="w-full bg-[#0a0c10] border border-[#2a313d] rounded-md px-3 py-2 text-zinc-200 text-xs font-mono focus:outline-none focus:border-indigo-500/60"
            />
          </div>
        )}

        {/* Repository Path Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              Repository Path
            </label>
            <button
              type="button"
              onClick={handleUseCurrent}
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              Use This Repo
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="C:\path\to\your\repository or /path/to/project"
              disabled={isLoading}
              className="w-full bg-[#0a0c10] border border-[#2a313d] rounded-lg px-4 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60"
            />
            {repoPath && !isLoading && (
              <button
                type="button"
                onClick={() => setRepoPath('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Error Display */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono">{error}</div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-zinc-500 font-mono">
            {backendStatus === 'disconnected' ? (
              <span className="text-rose-400">
                ⚠ FastAPI server at {backendUrl || 'localhost:8000'} is unreachable
              </span>
            ) : (
              <span>Ready for multi-agent ReAct review</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isLoading && onCancel && (
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={onCancel}
                icon={StopCircle}
              >
                Cancel Review
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={!repoPath.trim() || backendStatus === 'disconnected'}
              icon={Sparkles}
            >
              ✦ Run Code Review
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

