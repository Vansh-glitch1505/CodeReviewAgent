import { useState, useRef, useCallback } from 'react';
import { streamReview } from '../services/api';
import { parseFinding, parseInitialAnalysis } from '../utils/parser';

const INITIAL_AGENT_STATES = {
  analyzer: { status: 'idle', label: 'Initial Analyzer', iterations: 0, detail: '' },
  security: { status: 'idle', label: 'Security Agent', iterations: 0, detail: '' },
  performance: { status: 'idle', label: 'Performance Agent', iterations: 0, detail: '' },
  style: { status: 'idle', label: 'Style Agent', iterations: 0, detail: '' },
  synthesizer: { status: 'idle', label: 'Synthesizer Agent', iterations: 0, detail: '' },
};

export function useReviewStream() {
  const [reviewStatus, setReviewStatus] = useState('idle'); // 'idle' | 'running' | 'completed' | 'error'
  const [agents, setAgents] = useState(INITIAL_AGENT_STATES);
  const [traces, setTraces] = useState([]);
  const [initialAnalysis, setInitialAnalysis] = useState(null);
  const [findings, setFindings] = useState({ security: [], performance: [], style: [] });
  const [finalReport, setFinalReport] = useState('');
  const [error, setError] = useState(null);
  const [activeRepoPath, setActiveRepoPath] = useState('');

  const abortControllerRef = useRef(null);

  const addTrace = useCallback((trace) => {
    setTraces((prev) => [
      ...prev,
      {
        id: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        ...trace,
      },
    ]);
  }, []);

  const resetReview = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setReviewStatus('idle');
    setAgents(INITIAL_AGENT_STATES);
    setTraces([]);
    setInitialAnalysis(null);
    setFindings({ security: [], performance: [], style: [] });
    setFinalReport('');
    setError(null);
  }, []);

  const startReview = useCallback(async (repoPath, customUrl = null) => {
    if (!repoPath || !repoPath.trim()) {
      setError('Please provide a repository path.');
      return;
    }

    resetReview();
    setActiveRepoPath(repoPath.trim());
    setReviewStatus('running');
    setError(null);

    // Initial state: analyzer is running
    setAgents({
      analyzer: { status: 'running', label: 'Initial Analyzer', iterations: 0, detail: 'Scanning repository snapshot...' },
      security: { status: 'waiting', label: 'Security Agent', iterations: 0, detail: 'Waiting for analyzer' },
      performance: { status: 'waiting', label: 'Performance Agent', iterations: 0, detail: 'Waiting for analyzer' },
      style: { status: 'waiting', label: 'Style Agent', iterations: 0, detail: 'Waiting for analyzer' },
      synthesizer: { status: 'waiting', label: 'Synthesizer Agent', iterations: 0, detail: 'Waiting for specialists' },
    });

    addTrace({
      agent: 'system',
      type: 'status',
      title: 'Review started',
      detail: `Target repository: ${repoPath.trim()}`,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamReview(repoPath.trim(), customUrl, {
      signal: controller.signal,
      onEvent: (event, payload) => {
        if (!payload || typeof payload !== 'object') return;
        const { node, update } = payload;
        if (!node) return;

        // 1. ANALYZER NODE
        if (node === 'analyzer') {
          const rawAnalysis = update?.initial_analysis || '';
          const hasIssues = update?.has_issues ?? false;
          const parsed = parseInitialAnalysis(rawAnalysis);

          setInitialAnalysis({
            raw: rawAnalysis,
            verdict: hasIssues ? 'ISSUES' : 'CLEAN',
            cleanText: parsed.cleanText,
          });

          setAgents((prev) => ({
            ...prev,
            analyzer: {
              ...prev.analyzer,
              status: 'completed',
              detail: hasIssues ? 'Issues detected — dispatching specialists' : 'Clean repository',
            },
            security: {
              ...prev.security,
              status: hasIssues ? 'running' : 'skipped',
              detail: hasIssues ? 'Starting investigation...' : 'Skipped (code is clean)',
            },
            performance: {
              ...prev.performance,
              status: hasIssues ? 'running' : 'skipped',
              detail: hasIssues ? 'Starting investigation...' : 'Skipped (code is clean)',
            },
            style: {
              ...prev.style,
              status: hasIssues ? 'running' : 'skipped',
              detail: hasIssues ? 'Starting investigation...' : 'Skipped (code is clean)',
            },
          }));

          addTrace({
            agent: 'analyzer',
            type: 'node',
            title: 'Initial analysis completed',
            detail: `Verdict: ${hasIssues ? 'ISSUES DETECTED' : 'CLEAN'}`,
            data: parsed.cleanText,
          });
        }

        // 2. SPECIALIST AGENT RE-ACT NODES (security_agent, performance_agent, style_agent)
        else if (node.endsWith('_agent')) {
          const agentKey = node.replace('_agent', '');
          const messagesKey = `${agentKey}_messages`;
          const itersKey = `${agentKey}_iterations`;

          const rawMessages = update?.[messagesKey];
          const iters = update?.[itersKey] || 1;

          let toolCalls = [];
          let thought = '';

          if (Array.isArray(rawMessages)) {
            const lastMsg = rawMessages[rawMessages.length - 1];
            if (lastMsg && lastMsg.type === 'ai') {
              if (Array.isArray(lastMsg.tool_calls) && lastMsg.tool_calls.length > 0) {
                toolCalls = lastMsg.tool_calls;
              }
              if (lastMsg.content) {
                thought = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
              }
            }
          }

          setAgents((prev) => ({
            ...prev,
            [agentKey]: {
              ...prev[agentKey],
              status: 'running',
              iterations: iters,
              detail: toolCalls.length > 0
                ? `Calling ${toolCalls.map((t) => t.name).join(', ')}`
                : 'Evaluating findings...',
            },
          }));

          if (toolCalls.length > 0) {
            toolCalls.forEach((tc) => {
              addTrace({
                agent: agentKey,
                type: 'tool_call',
                title: `Invoked tool: ${tc.name}`,
                tool: tc.name,
                args: tc.args,
                iteration: iters,
              });
            });
          } else if (thought && thought.trim()) {
            addTrace({
              agent: agentKey,
              type: 'thought',
              title: 'Reasoning step',
              detail: thought.slice(0, 300) + (thought.length > 300 ? '...' : ''),
              iteration: iters,
            });
          }
        }

        // 3. SPECIALIST TOOL EXECUTION NODES (security_tool_node, etc.)
        else if (node.endsWith('_tool_node')) {
          const agentKey = node.replace('_tool_node', '');
          const messagesKey = `${agentKey}_messages`;
          const rawMessages = update?.[messagesKey];

          if (Array.isArray(rawMessages)) {
            rawMessages.forEach((msg) => {
              if (msg && msg.type === 'tool') {
                const preview = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                addTrace({
                  agent: agentKey,
                  type: 'tool_result',
                  title: 'Tool output received',
                  detail: preview.slice(0, 400) + (preview.length > 400 ? '... [truncated]' : ''),
                  fullContent: preview,
                });
              }
            });
          }
        }

        // 4. SPECIALIST CONCLUDE NODES (security_conclude, etc.)
        else if (node.endsWith('_conclude')) {
          const agentKey = node.replace('_conclude', '');
          const findingsKey = `${agentKey}_findings`;
          const rawFindings = update?.[findingsKey] || [];

          const parsedList = rawFindings
            .map((item, idx) => parseFinding(item, agentKey, idx))
            .filter(Boolean);

          setFindings((prev) => ({
            ...prev,
            [agentKey]: parsedList,
          }));

          setAgents((prev) => ({
            ...prev,
            [agentKey]: {
              ...prev[agentKey],
              status: 'completed',
              detail: `${parsedList.length} confirmed issue${parsedList.length === 1 ? '' : 's'}`,
            },
            synthesizer: {
              ...prev.synthesizer,
              status: 'running',
              detail: 'Synthesizing multi-agent findings...',
            },
          }));

          addTrace({
            agent: agentKey,
            type: 'conclude',
            title: `Concluded investigation`,
            detail: parsedList.length === 0
              ? 'No issues confirmed'
              : `Found ${parsedList.length} confirmed issue(s)`,
            count: parsedList.length,
          });
        }

        // 5. SYNTHESIZER NODE
        else if (node === 'synthesizer') {
          const report = update?.final_report || '';
          setFinalReport(report);

          setAgents((prev) => ({
            ...prev,
            synthesizer: {
              ...prev.synthesizer,
              status: 'completed',
              detail: 'Report synthesized',
            },
          }));

          addTrace({
            agent: 'synthesizer',
            type: 'node',
            title: 'Report synthesis complete',
            detail: 'Final review report successfully generated',
          });
        }

        // 6. FINISH_CLEAN NODE (if repository had zero issues)
        else if (node === 'finish_clean') {
          const report = update?.final_report || '';
          setFinalReport(report);

          setAgents((prev) => ({
            ...prev,
            synthesizer: {
              ...prev.synthesizer,
              status: 'completed',
              detail: 'Repository clean — no issues found',
            },
          }));

          addTrace({
            agent: 'system',
            type: 'status',
            title: 'Review concluded cleanly',
            detail: 'No actionable issues found in repository.',
          });
        }
      },

      onError: (errMessage) => {
        setError(errMessage);
        setReviewStatus('error');
        setAgents((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((k) => {
            if (updated[k].status === 'running' || updated[k].status === 'waiting') {
              updated[k] = { ...updated[k], status: 'error', detail: 'Aborted due to error' };
            }
          });
          return updated;
        });

        addTrace({
          agent: 'system',
          type: 'error',
          title: 'Execution error',
          detail: errMessage,
        });
      },

      onDone: () => {
        setReviewStatus('completed');
        addTrace({
          agent: 'system',
          type: 'status',
          title: 'Review stream finished',
          detail: 'All agents and synthesis have concluded.',
        });
      },
    });
  }, [addTrace, resetReview]);

  const cancelReview = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setReviewStatus('idle');
    addTrace({
      agent: 'system',
      type: 'status',
      title: 'Review cancelled by user',
    });
  }, [addTrace]);

  return {
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
  };
}

