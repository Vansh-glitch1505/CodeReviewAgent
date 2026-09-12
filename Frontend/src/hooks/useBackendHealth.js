import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from '../services/api';

export function useBackendHealth(customUrl = null) {
  const [health, setHealth] = useState({
    status: 'connecting', // 'connected' | 'connecting' | 'disconnected'
    latency: null,
    error: null,
    url: '',
  });

  const check = useCallback(async () => {
    setHealth((prev) => ({ ...prev, status: 'connecting' }));
    const res = await checkBackendHealth(customUrl);
    setHealth({
      status: res.connected ? 'connected' : 'disconnected',
      latency: res.latency,
      error: res.error || null,
      url: res.url,
    });
  }, [customUrl]);

  useEffect(() => {
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [check]);

  return { ...health, checkNow: check };
}

