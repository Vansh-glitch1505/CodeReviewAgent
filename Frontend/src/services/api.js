import { getApiBaseUrl } from './config';

/**
 * Health check to see if the FastAPI backend is running and reachable.
 */
export async function checkBackendHealth(customUrl = null) {
  const baseUrl = getApiBaseUrl(customUrl);
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    // FastAPI automatically serves /openapi.json
    const res = await fetch(`${baseUrl}/openapi.json`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latency = Math.round(performance.now() - start);
    return {
      connected: res.ok || res.status === 200,
      status: res.status,
      latency,
      url: baseUrl,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
      latency: null,
      url: baseUrl,
    };
  }
}

/**
 * Streams code review updates from POST /review/stream via SSE.
 *
 * @param {string} repoPath
 * @param {string|null} customUrl
 * @param {object} callbacks
 * @param {function} callbacks.onEvent - (event: string, payload: any) => void
 * @param {function} callbacks.onError - (error: string) => void
 * @param {function} callbacks.onDone - () => void
 * @param {AbortSignal} [callbacks.signal]
 */
export async function streamReview(repoPath, customUrl = null, callbacks = {}) {
  const { onEvent = () => {}, onError = () => {}, onDone = () => {}, signal } = callbacks;
  const baseUrl = getApiBaseUrl(customUrl);

  let response;
  try {
    response = await fetch(`${baseUrl}/review/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ repo_path: repoPath }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError(`Failed to connect to backend at ${baseUrl}: ${err.message}`);
    return;
  }

  if (!response.ok) {
    onError(`Backend returned HTTP ${response.status}: ${response.statusText}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep trailing incomplete line in buffer
      buffer = lines.pop() || '';

      for (let line of lines) {
        line = line.trim();
        if (line === '') {
          // Empty line indicates dispatch of event in standard SSE
          currentEvent = 'message';
          continue;
        }

        if (line.startsWith('event:')) {
          currentEvent = line.substring(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const rawData = line.substring(5).trim();
          if (!rawData) continue;

          let data;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            data = rawData;
          }

          if (currentEvent === 'error') {
            const msg = typeof data === 'object' && data.error ? data.error : String(data);
            onError(msg);
            return;
          }

          if (currentEvent === 'done') {
            onDone();
            return;
          }

          onEvent(currentEvent, data);
        }
      }
    }

    // If stream terminated without explicit done event
    onDone();
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError(`Streaming error: ${err.message}`);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Standard POST /review fallback
 */
export async function executeReviewDirect(repoPath, customUrl = null) {
  const baseUrl = getApiBaseUrl(customUrl);
  const response = await fetch(`${baseUrl}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

