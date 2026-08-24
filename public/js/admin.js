const me = await getMe();
if (!me || !me.admin) {
  document.getElementById('loading').innerHTML =
    'This area is for moderators only. <a href="/">Back to the arcade</a>';
} else {
  load();
}

async function load() {
  const panel = document.getElementById('reports-panel');
  let data;
  try {
    data = await api('/admin/reports');
  } catch (err) {
    panel.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (!data.reports.length) {
    panel.innerHTML = '<h3>ALL CLEAR</h3><p class="muted" style="margin:0">No open reports. The arcade is peaceful today.</p>';
    return;
  }

  // group by game so multiple reports on one game show once
  const byGame = new Map();
  for (const r of data.reports) {
    if (!byGame.has(r.game_id)) byGame.set(r.game_id, []);
    byGame.get(r.game_id).push(r);
  }

  panel.innerHTML = '<h3>' + data.reports.length + ' OPEN REPORT' + (data.reports.length === 1 ? '' : 'S') + '</h3>' +
    [...byGame.entries()].map(([gid, reports]) => {
      const first = reports[0];
      return `
      <div class="comment" style="border-bottom:2px solid var(--border)">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(first.game_title || '[deleted game]')}</span>
          ${first.game_author ? `<span class="muted">by ${escapeHtml(first.game_author)}</span>` : ''}
          <span class="comment-time">${reports.length} report${reports.length > 1 ? 's' : ''}</span>
          <span style="margin-left:auto;display:flex;gap:8px">
            ${first.game_title ? `<a class="btn btn-sm" href="/game.html?id=${gid}">Open</a>` : ''}
            ${first.game_title ? `<button class="btn btn-sm btn-danger" data-del-game="${gid}">Delete game</button>` : ''}
            <button class="btn btn-sm btn-ghost" data-dismiss="${gid}">Dismiss</button>
          </span>
        </div>
        ${reports.map(r => `
          <div class="comment-body muted">&ldquo;${escapeHtml(r.reason) || '(no reason given)'}&rdquo;
            &mdash; ${escapeHtml(r.reporter)}, ${timeAgo(r.created_at)}</div>`).join('')}
      </div>`;
    }).join('');

  panel.querySelectorAll('[data-del-game]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Permanently delete this game?')) return;
      try {
        await api(`/games/${btn.dataset.delGame}`, { method: 'DELETE' });
        toast('Game deleted');
        load();
      } catch (err) { toast(err.message); }
    })
  );

  panel.querySelectorAll('[data-dismiss]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try {
        // resolve every open report tied to this game
        const { reports } = await api('/admin/reports');
        const targets = reports.filter(r => r.game_id === Number(btn.dataset.dismiss));
        for (const t of targets) await api(`/admin/reports/${t.id}`, { method: 'DELETE' });
        toast('Reports dismissed');
        load();
      } catch (err) { toast(err.message); }
    })
  );
}
