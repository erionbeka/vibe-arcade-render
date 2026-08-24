// Shared helpers for all pages

async function api(path, opts = {}) {
  const init = {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    headers: {}
  };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, init);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function qs(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

let _me = undefined;
async function getMe() {
  if (_me === undefined) {
    try { _me = (await api('/auth/me')).user; }
    catch { _me = null; }
  }
  return _me;
}

function renderNav(user) {
  const el = document.getElementById('nav-auth');
  if (!el) return;
  if (user) {
    el.innerHTML = `
      ${user.admin ? '<a class="nav-link" href="/admin.html">Admin</a>' : ''}
      <a class="nav-link" href="/upload.html">Upload</a>
      <span class="nav-link" style="color:var(--text)">${escapeHtml(user.username)}</span>
      <button class="btn btn-sm btn-ghost" id="logout-btn">Log out</button>`;
    el.querySelector('#logout-btn').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      location.href = '/';
    });
  } else {
    el.innerHTML = `
      <a class="nav-link" href="/login.html">Log in</a>
      <a class="btn btn-sm btn-primary" href="/register.html">Sign up</a>`;
  }
}

function ensureFooter() {
  if (document.querySelector('footer')) return;
  const f = document.createElement('footer');
  f.innerHTML = `VIBE ARCADE — upload, play, rate, remix &nbsp;&middot;&nbsp;
    <a href="/terms.html">Terms</a> &nbsp;&middot;&nbsp; <a href="/privacy.html">Privacy</a>`;
  document.body.appendChild(f);
}

function timeAgo(sqlDate) {
  // SQLite datetime is UTC "YYYY-MM-DD HH:MM:SS"
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const s = (Date.now() - d.getTime()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

function starsDisplay(rating) {
  const full = Math.round(rating || 0);
  return `<span class="stat-star">${'\u2605'.repeat(full)}${'\u2606'.repeat(5 - full)}</span>`;
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

document.addEventListener('DOMContentLoaded', async () => {
  renderNav(await getMe());
  ensureFooter();
});
