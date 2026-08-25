let state = { q: '', tag: '', sort: 'new', page: 1 };

// Stupid-word forge: grows a fake word from the game's own initial,
// cross-bred with shared letter pools so every card invents new language.
const PH_A = ['BL','SN','GR','FL','KR','WO','ZO','MU','PL','DR','SK','THW','QU','BR','GL'];
const PH_B = ['NK','RP','MB','ZZ','G','MP','LK','BSH','NG','TT','FF','RG'];
const PH_C = ['A','O','E','OO','U','Y',''];
const PH_CAPS = ['A REAL WORD','IN THE DICTIONARY*','*NOT IN THE DICTIONARY','PRONOUNCE IT. WE DARE YOU','OFFICIALLY A WORD NOW','SAY IT OUT LOUD'];
function phHash(s){let h=0;for(const ch of s)h=((h*31)+ch.charCodeAt(0))>>>0;return h;}
function phWord(title){
  let h=phHash(title);
  const next=n=>{h=(h*1664525+1013904223)>>>0;return h%n;};
  const initial=(title.replace(/[^a-z]/i,'')[0]||'X').toUpperCase();
  let w=next(10)<4?initial:'';
  w+=PH_A[next(PH_A.length)];
  w+=PH_C[next(PH_C.length)];
  w+=PH_B[next(PH_B.length)];
  if(next(3)===0)w+=PH_C[next(PH_C.length)];
  return w.toUpperCase().slice(0,9);
}
function phCaption(title){
  return PH_CAPS[phHash(title+'cap')%PH_CAPS.length];
}
function cardHtml(g) {
  const thumb = g.screenshot
    ? `<img class="card-thumb" src="${escapeHtml(g.screenshot)}" alt="" loading="lazy">`
    : (() => {
        const word = phWord(g.title);
        const size = word.length > 6 ? '.9rem' : word.length > 4 ? '1.15rem' : '1.5rem';
        return `<div class="card-thumb-placeholder"><span class="ph-letter" style="font-size:${size}">${escapeHtml(word)}</span><span class="ph-cap">${escapeHtml(phCaption(g.title))}</span></div>`;
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
