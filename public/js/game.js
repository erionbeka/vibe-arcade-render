const id = Number(qs('id'));
let game = null;
let me = await getMe();

function renderStarsWidget() {
  const el = document.getElementById('stars-widget');
  const my = game.my_rating || 0;
  el.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="star${i < my ? ' on' : ''}" data-star="${i + 1}">${i < my ? '\u2605' : '\u2606'}</span>`
  ).join('');
}

function renderRating() {
  document.getElementById('rating-num').textContent = game.rating ? Number(game.rating).toFixed(1) : '\u2013';
  document.getElementById('rating-count').textContent = `(${game.rating_count} rating${game.rating_count === 1 ? '' : 's'})`;
}

function renderActions() {
  const actions = document.getElementById('g-actions');
  const mine = me && me.id === game.author_id;
  let html = '';
  if (game.has_source) {
    html += `<button class="btn" id="dl-btn">\u2B07 Download source</button>`;
  }
  if (me && !mine) {
    html += `<button class="btn btn-ghost" id="report-btn">Report</button>`;
  }
  if (mine || (me && me.admin)) {
    html += `<button class="btn btn-danger" id="del-btn">Delete</button>`;
  }
  actions.innerHTML = html;

  const dl = document.getElementById('dl-btn');
  if (dl) dl.addEventListener('click', async () => {
    try {
      const { url } = await api(`/games/${id}/download`, { method: 'POST' });
      const a = document.createElement('a');
      a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
      game.downloads++;
    } catch (err) { toast(err.message); }
  });

  const rep = document.getElementById('report-btn');
  if (rep) rep.addEventListener('click', async () => {
    const reason = prompt(`Report "${game.title}" to the moderators.\nWhy are you reporting it?`);
    if (reason === null) return;
    try {
      await api(`/games/${id}/report`, { method: 'POST', body: { reason } });
      toast('Report sent. Thanks!');
    } catch (err) { toast(err.message); }
  });

  const del = document.getElementById('del-btn');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Delete this game permanently?')) return;
    try {
      await api(`/games/${id}`, { method: 'DELETE' });
      toast('Game deleted');
      setTimeout(() => location.href = '/', 600);
    } catch (err) { toast(err.message); }
  });
}

function renderMeta() {
  const tags = game.tags.map(t => `<span class="mini-tag">${escapeHtml(t)}</span>`).join(' ');
  document.getElementById('g-meta').innerHTML = `
    <li><b>Author:</b> ${escapeHtml(game.author)}</li>
    <li><b>Uploaded:</b> ${timeAgo(game.created_at)}</li>
    <li><b>Plays:</b> ${game.views}</li>
    <li><b>Likes:</b> ${game.likes}</li>
    <li><b>Type:</b> ${game.type === 'web' ? 'Playable in browser' : 'Downloadable build'}</li>
    ${tags ? `<li><b>Tags:</b> ${tags}</li>` : ''}`;
}

async function loadComments() {
  const { comments } = await api(`/games/${id}/comments`);
  const list = document.getElementById('comments-list');
  list.innerHTML = comments.length ? comments.map(c => `
    <div class="comment">
      <div class="comment-head">
        <span class="comment-author">${escapeHtml(c.username)}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
        ${me && (me.id === c.user_id || me.admin) ? `<button class="comment-del" data-id="${c.id}">delete</button>` : ''}
      </div>
      <div class="comment-body">${escapeHtml(c.body)}</div>
    </div>`).join('')
    : '<p class="muted">No comments yet. Start the conversation!</p>';

  list.querySelectorAll('.comment-del').forEach(btn =>
    btn.addEventListener('click', async () => {
      try {
        await api(`/games/${id}/comments/${btn.dataset.id}`, { method: 'DELETE' });
        loadComments();
        toast('Comment deleted');
      } catch (err) { toast(err.message); }
    })
  );
}

if (!id) { location.href = '/'; }

try {
  ({ game } = await api(`/games/${id}`));
} catch (err) {
  document.getElementById('g-title').textContent = 'Game not found';
  throw err;
}

document.title = `${game.title} — Vibe Arcade`;
document.getElementById('g-title').textContent = game.title;
document.getElementById('g-byline').innerHTML =
  `by <a href="#" onclick="return false">${escapeHtml(game.author)}</a> &middot; ${timeAgo(game.created_at)}`;
document.getElementById('g-desc').textContent = game.description || 'No description.';

// Count the play + get iframe URL
try {
  const { play_url } = await api(`/games/${id}/view`, { method: 'POST' });
  if (game.type === 'web') {
    document.getElementById('playframe').src = play_url;
  } else {
    document.getElementById('frame-area').innerHTML = `
      <div class="download-note">
        <h3 style="margin:0;color:var(--text)">This is a downloadable build</h3>
        <p style="margin:0">It runs outside the browser — grab the source and run it locally.</p>
        ${game.has_source ? `<button class="btn btn-primary" id="frame-dl">\u2B07 Download source</button>` : ''}
      </div>`;
    const fdl = document.getElementById('frame-dl');
    if (fdl) fdl.addEventListener('click', () => document.getElementById('dl-btn')?.click());
  }
} catch { /* view counting is best-effort */ }

renderActions();
renderMeta();
renderRating();
renderStarsWidget();
await loadComments();

const form = document.getElementById('comment-form');
const nudge = document.getElementById('login-nudge');
if (me) form.style.display = 'block';
else nudge.style.display = 'block';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bodyEl = document.getElementById('comment-body');
  const body = bodyEl.value.trim();
  if (!body) return;
  try {
    await api(`/games/${id}/comments`, { method: 'POST', body: { body } });
    bodyEl.value = '';
    await loadComments();
  } catch (err) { toast(err.message); }
});

document.getElementById('stars-widget').addEventListener('click', async (e) => {
  const star = e.target.closest('.star');
  if (!star) return;
  if (!me) { toast('Log in to rate games'); return; }
  try {
    const r = await api(`/games/${id}/rate`, { method: 'PUT', body: { stars: Number(star.dataset.star) } });
    game.rating = r.rating;
    game.rating_count = r.rating_count;
    game.my_rating = r.my_rating;
    renderRating();
    renderStarsWidget();
    toast(`You rated this ${r.my_rating} star${r.my_rating > 1 ? 's' : ''}`);
  } catch (err) { toast(err.message); }
});
