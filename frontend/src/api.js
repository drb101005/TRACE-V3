const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const API_ORIGIN = API_BASE.startsWith('http') ? new URL(API_BASE).origin : '';

export function saveSession(token, user) {
  sessionStorage.setItem('trace-access-token', token);
  sessionStorage.setItem('trace-session', JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem('trace-access-token');
  sessionStorage.removeItem('trace-session');
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem('trace-access-token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const url = path === '/health' ? `${API_ORIGIN}/health` : `${API_BASE}${path}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (Array.isArray(detail)) {
      const messages = detail.map(issue => {
        const field = Array.isArray(issue.loc) ? issue.loc.filter(part => part !== 'body').join('.') : '';
        return [field, issue.msg].filter(Boolean).join(': ');
      }).filter(Boolean);
      if (messages.length) throw new Error(messages.join('; '));
    }
    throw new Error(`API request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response;
}

export const jsonBody = value => JSON.stringify(value);
