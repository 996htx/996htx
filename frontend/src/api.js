const BASE = '/api';

function getToken() {
  return localStorage.getItem('tt_token');
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function request(method, path, body) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (name, email, password, role) => request('POST', '/auth/register', { name, email, password, role }),
  me: () => request('GET', '/auth/me'),
  employees: () => request('GET', '/auth/employees'),

  // Projects
  projects: () => request('GET', '/projects'),
  project: (id) => request('GET', `/projects/${id}`),
  createProject: (data) => request('POST', '/projects', data),
  updateProject: (id, data) => request('PUT', `/projects/${id}`, data),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),

  // Time Entries
  timeEntries: (params = {}) => request('GET', '/time-entries?' + new URLSearchParams(params)),
  activeEntry: () => request('GET', '/time-entries/active'),
  summary: (params = {}) => request('GET', '/time-entries/summary?' + new URLSearchParams(params)),
  clockIn: (data) => request('POST', '/time-entries/clock-in', data),
  clockOut: (data) => request('POST', '/time-entries/clock-out', data),
  deleteEntry: (id) => request('DELETE', `/time-entries/${id}`),

  // Photos
  photos: (params = {}) => request('GET', '/photos?' + new URLSearchParams(params)),
  deletePhoto: (id) => request('DELETE', `/photos/${id}`),

  uploadPhoto: async (formData) => {
    const res = await fetch(BASE + '/photos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
};

export function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
