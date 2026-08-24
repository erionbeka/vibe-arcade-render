const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, username: u.username, admin: !!u.admin, created_at: u.created_at };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'You must be logged in.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'You must be logged in.' });
  req.user = user;
  next();
}
router.requireAuth = requireAuth;

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user.admin) return res.status(403).json({ error: 'Admins only.' });
    next();
  });
}
router.requireAdmin = requireAdmin;

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user ? publicUser(user) : null });
});

router.post('/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 characters (letters, numbers, underscore).' });
  }
  if (password.length < 6 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'That username is taken.' });
  const hash = bcrypt.hashSync(password, 10);
  const isFirstUser = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  const info = db.prepare('INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)')
    .run(username, hash, isFirstUser ? 1 : 0);
  req.session.userId = info.lastInsertRowid;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  // Optional env-based promotion: ADMIN_USERNAME=yourname
  if (process.env.ADMIN_USERNAME && user.username.toLowerCase() === process.env.ADMIN_USERNAME.toLowerCase() && !user.admin) {
    db.prepare('UPDATE users SET admin = 1 WHERE id = ?').run(user.id);
    user.admin = 1;
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
