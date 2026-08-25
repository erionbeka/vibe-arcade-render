let state = { q: '', tag: '', sort: 'new', page: 1 };

function cardHtml(g) {
  const thumb = g.screenshot
    ? `<img class="card-thumb" src="${escapeHtml(g.screenshot)}" alt="" loading="lazy">`
    : (() => {
        const L = (g.title.replace(/[^a-z]/i,'')[0] || '?').toUpperCase();
        return `<div class="card-thumb-placeholder"><span class="ph-letter">${escapeHtml(L)}</span></div>`;
      })();
  const tags = g.tags.map(t => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('');
  return `
  <div class="card">
    <a href="/game.html?id=${g.id}">${thumb}</a>
    <div class="card-body">
      <h3 class="card-title"><a href="/game.html?id=${g.id}">${escapeHtml(g.title)}</a></h3>
      <div class="card-byline">by ${escapeHtml(g.author)} &middot; ${timeAgo(g.created_at)}</div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      <div class="card-stats">
        ${starsDisplay(g.rating)} <span>${g.rating || '&ndash;'}</span>
        <span>&hearts; ${g.likes}</span>
        <span>&#9654; ${g.views}</span>
      </div>
    </div>
  </div>`;
}

async function loadGames() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  params.set('sort', state.sort);
  params.set('page', state.page);

  const grid = document.getElementById('games');
  grid.innerHTML = '<div class="empty-state"><h3>Loading...</h3></div>';

  try {
    const data = await api(`/games?${params}`);
    renderPager(data.page, data.pages, data.total);
    if (!data.games.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No games here yet</h3>
          <p>Be the first! <a href="/upload.html">Upload your game</a> and kick things off.</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.games.map(cardHtml).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderPager(page, pages, total) {
  let pager = document.getElementById('pager');
  if (!pager) {
    pager = document.createElement('div');
    pager.id = 'pager';
    pager.className = 'pager';
    document.getElementById('games').after(pager);
  }
  if (pages <= 1) {
    if (total > 0) pager.innerHTML = `<span class="muted">${total} game${total === 1 ? '' : 's'}</span>`;
    else pager.innerHTML = '';
    return;
  }
  pager.innerHTML = `
    <button class="btn btn-sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>&#9664; Prev</button>
    <span class="muted">Page ${page} / ${pages}</span>
    <button class="btn btn-sm" id="pg-next" ${page >= pages ? 'disabled' : ''}>Next &#9654;</button>`;
  const go = (p) => { state.page = p; loadGames(); window.scrollTo({ top: 0 }); };
  document.getElementById('pg-prev').addEventListener('click', () => go(page - 1));
  document.getElementById('pg-next').addEventListener('click', () => go(page + 1));
}

async function loadTags() {
  const { tags } = await api('/games/tags/popular');
  const el = document.getElementById('tags');
  el.innerHTML = tags.map(t =>
    `<button class="chip${state.tag === t.tag ? ' active' : ''}" data-tag="${escapeHtml(t.tag)}">${escapeHtml(t.tag)} (${t.n})</button>`
  ).join('');
}

document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(window.__searchTimer);
  window.__searchTimer = setTimeout(() => {
    state.q = e.target.value.trim(); state.page = 1; loadGames();
  }, 300);
});

document.getElementById('sort').addEventListener('change', (e) => {
  state.sort = e.target.value; state.page = 1; loadGames();
});

document.getElementById('tags').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.tag = state.tag === chip.dataset.tag ? '' : chip.dataset.tag;
  state.page = 1;
  loadTags();
  loadGames();
});

loadTags().catch(() => {});
loadGames();
