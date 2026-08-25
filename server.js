const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

// Restore saves from GitHub BEFORE opening the database, so a fresh container
// wakes up with all games/ratings/comments/uploads intact.
if (process.env.BACKUP_REPO && process.env.BACKUP_TOKEN) {
  try {
    require('./scripts/backup').restore();
  } catch (err) {
    console.error('[backup] restore error:', err.message);
  }
}

require('./src/db'); // initialize database

// On platforms with ephemeral disks (e.g. Render free tier), repopulate the
// demo arcade after every cold start. Safe to leave on: seeding is idempotent.
if (process.env.AUTO_SEED === '1') {
  const { execSync } = require('child_process');
  try {
    execSync(`node "${path.join(__dirname, 'scripts', 'seed.js')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('auto-seed failed:', err.message);
  }
}

const authRoutes = require('./src/auth');
const gameRoutes = require('./src/games');
const adminRoutes = require('./src/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind a reverse proxy (nginx/Caddy/Render), so req.ip is the real client IP
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// Persist a session secret so logins survive server restarts
const DATA_DIR = path.join(__dirname, 'data');
const SECRET_FILE = path.join(DATA_DIR, 'secret.txt');
let secret;
if (process.env.SESSION_SECRET) {
  secret = process.env.SESSION_SECRET;
} else if (fs.existsSync(SECRET_FILE)) {
  secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} else {
  secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret);
}

// Basic security headers for our own pages
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Brute-force / spam protection
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });

app.use(express.json({ limit: '256kb' }));
app.use(session({
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SECURE_COOKIES === '1', // set when serving over HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}));

app.use('/api', apiLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// Uploaded content is untrusted: never sniff types; games run in a sandboxed iframe
const uploadsStatic = express.static(path.join(__dirname, 'uploads'), {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
});
app.use('/uploads', uploadsStatic);

app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
// Rate-limit sensitive endpoints before mounting routes
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.post('/api/games', uploadLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'Something went wrong.' });
  }
  res.status(500).send('Server error');
});

const server = app.listen(PORT, () => {
  console.log(`Vibe Arcade running at http://localhost:${PORT}`);
});

// Periodic + on-exit snapshots so reboots never lose user content
if (process.env.BACKUP_REPO && process.env.BACKUP_TOKEN) {
  const backup = require('./scripts/backup');
  setInterval(() => {
    try { backup.snapshot('periodic'); } catch (e) { console.error('[backup]', e.message); }
  }, 15 * 60 * 1000);
  const goodbye = sig => {
    console.log(`\n${sig} received \u2014 saving arcade state...`);
    try { backup.snapshot('shutdown'); } catch (e) { /* best effort */ }
    process.exit(0);
  };
  process.on('SIGTERM', () => goodbye('SIGTERM'));
  process.on('SIGINT', () => goodbye('SIGINT'));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Run with another port:  set PORT=3001 && npm start`);
    process.exit(1);
  }
  throw err;
});
