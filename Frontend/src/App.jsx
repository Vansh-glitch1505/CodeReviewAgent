import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import RepoInputForm from './components/review/RepoInputForm';
import GraphWorkflow from './components/review/GraphWorkflow';
import AgentTraceConsole from './components/review/AgentTraceConsole';
import InitialAnalysis from './components/review/InitialAnalysis';
import FindingsGrid from './components/review/FindingsGrid';
import FinalReportView from './components/review/FinalReportView';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useReviewStream } from './hooks/useReviewStream';
import { DISPLAY_BACKEND_URL } from './services/config';
import { Shield, Zap, Palette, AlertOctagon, RotateCcw, CheckCircle2 } from 'lucide-react';
import Button from './components/common/Button';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [repoPath, setRepoPath] = useState('');
  const [backendUrl, setBackendUrl] = useState(DISPLAY_BACKEND_URL);

  const { status: backendStatus, latency: backendLatency, checkNow: refreshHealth } =
    useBackendHealth(backendUrl);

  const {
    reviewStatus,
    agents,
    traces,
    initialAnalysis,
    findings,
    finalReport,
    error,
    activeRepoPath,
    startReview,
    cancelReview,
    resetReview,
  } = useReviewStream();

  const handleStartReview = () => {
    startReview(repoPath, backendUrl);
  };

  const handleNewReview = () => {
    resetReview();
    setActiveTab('dashboard');
  };

  const isReviewRunning = reviewStatus === 'running';
  const hasReviewStarted = reviewStatus !== 'idle';
  const isReviewCompleted = reviewStatus === 'completed';

  const totalFindingsCount =
    (findings.security?.length || 0) +
    (findings.performance?.length || 0) +
    (findings.style?.length || 0);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e6edf3] flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewReview={handleNewReview}
        agents={agents}
        backendStatus={backendStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          backendStatus={backendStatus}
          backendLatency={backendLatency}
          backendUrl={backendUrl}
          onRefreshHealth={refreshHealth}
          currentRepo={activeRepoPath || repoPath}
        />

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Top Form Section: Repository Input & Review Trigger */}
          <RepoInputForm
            repoPath={repoPath}
            setRepoPath={setRepoPath}
            backendUrl={backendUrl}
            setBackendUrl={setBackendUrl}
            onSubmit={handleStartReview}
            onCancel={cancelReview}
            isLoading={isReviewRunning}
            backendStatus={backendStatus}
            error={error}
          />

          {/* Execution Error Banner if any */}
          {error && reviewStatus === 'error' && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-200">
                    Review Failed
                  </h4>
                  <p className="text-xs text-rose-300 font-mono mt-0.5">
                    {error}
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={handleStartReview}
                icon={RotateCcw}
              >
                Retry Review
              </Button>
            </div>
          )}

          {/* Workflow Pipeline & Live Agents (Always visible once review begins) */}
          {hasReviewStarted && (
            <div className="space-y-6">
              {/* LangGraph Agent Orchestration Pipeline */}
              <GraphWorkflow agents={agents} />

              {/* Initial Analysis Card */}
              {initialAnalysis && (
                <InitialAnalysis analysis={initialAnalysis} />
              )}

              {/* Live Trace Console */}
              <AgentTraceConsole traces={traces} isRunning={isReviewRunning} />
            </div>
          )}

          {/* Review Results Section (Displays findings as they conclude and when completed) */}
          {hasReviewStarted && (totalFindingsCount > 0 || isReviewCompleted) && (
            <div className="space-y-6 pt-4 border-t border-[#21262d]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Review Findings
                    </h3>
                    {isReviewCompleted && (
                      <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Verified findings reported by specialized ReAct agents
                  </p>
                </div>

                {/* Metrics Badges */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    {findings.security?.length || 0} Security
                  </span>
                  <span className="px-2.5 py-1 rounded bg-amber-950/50 border border-amber-800/60 text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {findings.performance?.length || 0} Performance
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-400" />
                    {findings.style?.length || 0} Style
                  </span>
                </div>
              </div>

              {/* Findings Tabs & List */}
              <FindingsGrid findings={findings} />
            </div>
          )}

          {/* Final Synthesized Report Section */}
          {finalReport && (
            <div className="pt-4 border-t border-[#21262d]">
              <FinalReportView report={finalReport} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

