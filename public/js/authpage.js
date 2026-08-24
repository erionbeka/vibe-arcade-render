async function handleAuthSubmit(e, endpoint, successMsg) {
  e.preventDefault();
  const errBox = document.getElementById('error');
  errBox.style.display = 'none';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    await api(endpoint, { method: 'POST', body: { username, password } });
    toast(successMsg);
    const next = new URLSearchParams(location.search).get('next');
    setTimeout(() => { location.href = next && next.startsWith('/') ? next : '/'; }, 500);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
}
