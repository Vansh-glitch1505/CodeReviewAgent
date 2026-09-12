/**
 * Configuration for Backend API endpoint
 */
export const DEFAULT_BACKEND_URL = '/api';
export const DISPLAY_BACKEND_URL = 'http://localhost:8000';

export function getApiBaseUrl(customUrl = null) {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    const trimmed = customUrl.trim().replace(/\/+$/, '');
    // If user entered http://localhost:8000, we can use /api proxy for seamless CORS reliability
    if (trimmed === 'http://localhost:8000' || trimmed === 'http://127.0.0.1:8000') {
      return '/api';
    }
    return trimmed;
  }
  return DEFAULT_BACKEND_URL;
}
