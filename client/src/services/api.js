// One place that talks to the Express API.
//  - credentials: 'include'  sends the HTTP-only sign-in cookie (the token is never readable by JavaScript)
//  - X-CSRF-Token             is added to every request that changes data
//  - a 401 on a normal request tells the app the session ended, so it can return to the sign-in page
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

let csrfToken = null;
export const setCsrfToken = (t) => { csrfToken = t || null; };

export class ApiError extends Error {
  constructor(status, error) {
    super((error && error.message) || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = (error && error.code) || 'ERROR';
    this.fields = (error && error.fields) || null;     // { fieldName: 'message' }
    this.existing = (error && error.existing) || null; // matching customers for duplicate warnings
    this.requestId = (error && error.requestId) || null;
    this.currentVersion = error && error.currentVersion;
  }
}

function buildUrl(path, params) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const s = qs.toString();
  return BASE + path + (s ? '?' + s : '');
}

async function send(method, path, { params, body, headers } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json', ...(headers || {}) } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (method !== 'GET' && csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;

  let res;
  try {
    res = await fetch(buildUrl(path, params), opts);
  } catch (e) {
    throw new ApiError(0, {
      code: 'NETWORK',
      message: 'Cannot reach the server. Check that the backend is running (npm run dev in the server folder) and that MySQL is started in XAMPP.',
    });
  }

  if (path.startsWith('/reports/') && params && params.format === 'csv' && res.ok) return res;

  let payload = null;
  try { payload = await res.json(); } catch (e) { /* not JSON */ }

  if (!res.ok || !payload || payload.success === false) {
    const err = new ApiError(res.status, payload && payload.error ? payload.error : { message: 'The server returned an unexpected response (status ' + res.status + ').' });
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      window.dispatchEvent(new CustomEvent('veltrix:session-expired'));
    }
    throw err;
  }
  return payload; // { success, data, meta }
}

export const api = {
  get: (path, params) => send('GET', path, { params }),
  post: (path, body, headers) => send('POST', path, { body: body || {}, headers }),
  put: (path, body) => send('PUT', path, { body: body || {} }),
  patch: (path, body) => send('PATCH', path, { body: body || {} }),
};

/** Download a report as CSV through the API (so the permission check and audit entry still apply). */
export async function downloadCsv(type, params) {
  const res = await send('GET', '/reports/' + type, { params: { ...params, format: 'csv' } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'veltrix-' + type + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
