const form = document.getElementById('upload-form');
const errBox = document.getElementById('error');

function showError(msg) {
  errBox.textContent = msg;
  errBox.style.display = 'block';
}

// radio card styling
document.querySelectorAll('.radio-card input').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    radio.closest('.radio-card').classList.add('selected');
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.style.display = 'none';

  const me = await getMe();
  if (!me) { location.href = '/login.html?next=/upload.html'; return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const fd = new FormData(form);
    const res = await fetch('/api/games', { method: 'POST', body: fd, credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    toast('Game published!');
    setTimeout(() => { location.href = `/game.html?id=${data.game.id}`; }, 500);
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
    btn.textContent = 'Publish game';
  }
});
