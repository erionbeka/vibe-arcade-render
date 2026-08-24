const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const GAMES_DIR = path.join(UPLOADS_ROOT, 'games');
const TMP_DIR = path.join(UPLOADS_ROOT, 'tmp');
const SHOTS_DIR = path.join(UPLOADS_ROOT, 'screenshots');
for (const d of [GAMES_DIR, TMP_DIR, SHOTS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const MAX_GAME_BYTES = 60 * 1024 * 1024; // 60 MB
const MAX_SHOT_BYTES = 5 * 1024 * 1024;  // 5 MB

const SHOT_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: MAX_GAME_BYTES, files: 2 }
});

// ---------- helpers ----------

function parseTags(raw) {
  const seen = new Set();
  for (const part of String(raw || '').split(/[,\s]+/)) {
    let t = part.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!t) continue;
    t = t.slice(0, 24);
    seen.add(t);
    if (seen.size >= 8) break;
  }
  return [...seen];
}

/** Safely extract a zip, defending against zip-slip. Returns { baseDir } where
 *  baseDir is '' or 'folder/' such that index.html lives at games/<id>/<baseDir>index.html */
function extractGameZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const resolvedDest = fs.realpathSync(destDir);

  // Find index.html: prefer root, else inside exactly one top-level folder.
  let baseDir = '';
  const names = entries.filter(e => !e.isDirectory).map(e => e.entryName.replace(/\\/g, '/'));
  if (!names.includes('index.html')) {
    const candidates = new Set();
    for (const n of names) {
      const m = n.match(/^([^/]+\/)index\.html$/);
      if (m) candidates.add(m[1]);
    }
    if (candidates.size === 1) baseDir = [...candidates][0];
    else throw new Error('The zip must contain an index.html at its root (or inside a single top-level folder).');
  }

  for (const entry of entries) {
    const rel = entry.entryName.replace(/\\/g, '/');
    const target = path.resolve(destDir, rel);
    if (target !== resolvedDest && !target.startsWith(resolvedDest + path.sep)) {
      throw new Error('Illegal file path inside zip.');
    }
    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.getData());
    }
  }
  return { baseDir };
}

function gameRow(id, viewerId) {
  const rows = db.prepare(`
    SELECT g.*, u.username AS author,
      (SELECT COUNT(*) FROM likes l WHERE l.game_id = g.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.game_id = g.id) AS comment_count,
      (SELECT ROUND(AVG(stars), 2) FROM ratings r WHERE r.game_id = g.id) AS avg_rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.game_id = g.id) AS rating_count,
      ${viewerId ? '(SELECT COUNT(*) FROM likes l WHERE l.game_id = g.id AND l.user_id = ?)' : '0'} AS liked,
      ${viewerId ? '(SELECT stars FROM ratings r WHERE r.game_id = g.id AND r.user_id = ?)' : 'NULL'} AS my_rating
    FROM games g JOIN users u ON u.id = g.user_id WHERE g.id = ?
  `);
  return (viewerId ? rows.get(viewerId, viewerId, id) : rows.get(id));
}

function shapeGame(g) {
  if (!g) return null;
  const tags = db.prepare('SELECT tag FROM tags WHERE game_id = ? ORDER BY tag').all(g.id).map(r => r.tag);
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    type: g.type,
    has_source: !!g.has_source,
    author: g.author,
    author_id: g.user_id,
    screenshot: g.screenshot_path ? `/uploads/screenshots/${g.screenshot_path}` : null,
    views: g.views,
    downloads: g.downloads,
    likes: g.like_count,
    liked: !!g.liked,
    comments: g.comment_count,
    rating: g.avg_rating || 0,
    rating_count: g.rating_count,
    my_rating: g.my_rating || 0,
    tags,
    created_at: g.created_at
  };
}

// ---------- routes ----------

const uploadFields = [
  { name: 'file', maxCount: 1 },
  { name: 'screenshot', maxCount: 1 }
];
router.post('/', requireAuth, (req, res) => {
  upload.fields(uploadFields)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    try {
      createGame(req, res);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Upload failed.' });
    }
  });
});

function createGame(req, res) {
  const title = String(req.body.title || '').trim().slice(0, 100);
  const description = String(req.body.description || '').trim().slice(0, 5000);
  const type = req.body.type === 'download' ? 'download' : 'web';
  const tags = parseTags(req.body.tags);
  const gameFile = req.files?.file?.[0];
  const shotFile = req.files?.screenshot?.[0];

  if (!title) { cleanupTmp([gameFile, shotFile]); return res.status(400).json({ error: 'Title is required.' }); }
  if (!gameFile) { cleanupTmp([gameFile, shotFile]); return res.status(400).json({ error: 'Please attach a game file (.zip or .html).' }); }
  if (shotFile && !SHOT_MIMES.has(shotFile.mimetype)) {
    cleanupTmp([gameFile, shotFile]);
    return res.status(400).json({ error: 'Screenshot must be a PNG, JPG, WEBP or GIF image.' });
  }

  const ext = path.extname(gameFile.originalname).toLowerCase();
  if (!['.zip', '.html', '.htm'].includes(ext)) {
    cleanupTmp([gameFile, shotFile]);
    return res.status(400).json({ error: 'Game must be a .zip or single .html file.' });
  }
  if (ext !== '.zip') req.body.type = 'web'; // single html files are always playable

  let gameId;
  try {
    gameId = db.transaction(() => {
      const info = db.prepare(
        'INSERT INTO games (user_id, title, description, type) VALUES (?, ?, ?, ?)'
      ).run(req.session.userId, title, description, type);
      const gid = info.lastInsertRowid;
      const dir = path.join(GAMES_DIR, String(gid));
      fs.mkdirSync(dir, { recursive: true });

      let entryPath = '';
      let hasSource = 0;
      if (ext === '.zip') {
        // Keep the original zip so anyone can download the source
        fs.renameSync(gameFile.path, path.join(dir, 'source.zip'));
        hasSource = 1;
        if (type === 'web') {
          ({ baseDir: entryPath } = extractGameZip(path.join(dir, 'source.zip'), dir));
        }
      } else {
        fs.renameSync(gameFile.path, path.join(dir, 'index.html'));
      }

      let shotName = null;
      if (shotFile) {
        shotName = path.basename(shotFile.filename);
        fs.renameSync(shotFile.path, path.join(SHOTS_DIR, shotName));
      }
      db.prepare('UPDATE games SET entry_path = ?, has_source = ?, screenshot_path = ? WHERE id = ?')
        .run(entryPath, hasSource, shotName, gid);

      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (game_id, tag) VALUES (?, ?)');
      for (const t of tags) insertTag.run(gid, t);
      return gid;
    })();
  } catch (err) {
    cleanupTmp([gameFile, shotFile]);
    throw err;
  }

  res.json({ game: shapeGame(gameRow(gameId, req.session.userId)) });
}

function cleanupTmp(files) {
  for (const f of files || []) {
    if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
  }
}

// List / search
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const tag = String(req.query.tag || '').trim().toLowerCase();
  const sort = ['new', 'views', 'rating', 'likes'].includes(req.query.sort) ? req.query.sort : 'new';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 24;

  const where = [];
  const params = [];
  if (q) {
    where.push('(g.title LIKE ? OR g.description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    where.push('g.id IN (SELECT game_id FROM tags WHERE tag = ?)');
    params.push(tag);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = {
    new: 'g.created_at DESC, g.id DESC',
    views: 'g.views DESC, g.id DESC',
    likes: 'like_count DESC, g.id DESC',
    rating: 'avg_rating DESC, rating_count DESC, g.id DESC'
  }[sort];

  const viewerId = req.session.userId || null;
  const baseSelect = `
    SELECT g.*, u.username AS author,
      (SELECT COUNT(*) FROM likes l WHERE l.game_id = g.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.game_id = g.id) AS comment_count,
      (SELECT ROUND(AVG(stars), 2) FROM ratings r WHERE r.game_id = g.id) AS avg_rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.game_id = g.id) AS rating_count
    FROM games g JOIN users u ON u.id = g.user_id`;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM games g ${whereSql}`).get(...params).n;
  const rows = db.prepare(`${baseSelect} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...params, perPage, (page - 1) * perPage);

  res.json({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    games: rows.map(shapeGame)
  });
});

// Popular tags for filter chips
router.get('/tags/popular', (req, res) => {
  const rows = db.prepare(`
    SELECT tag, COUNT(*) AS n FROM tags
    GROUP BY tag ORDER BY n DESC, tag ASC LIMIT 20
  `).all();
  res.json({ tags: rows });
});

// Single game
router.get('/:id', (req, res) => {
  const viewerId = req.session.userId || null;
  const g = gameRow(Number(req.params.id), viewerId);
  if (!g) return res.status(404).json({ error: 'Game not found.' });
  res.json({ game: shapeGame(g) });
});

// Play URL + count a view
router.post('/:id/view', (req, res) => {
  const id = Number(req.params.id);
  const g = db.prepare('SELECT id, type FROM games WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Game not found.' });
  db.prepare('UPDATE games SET views = views + 1 WHERE id = ?').run(id);
  const row = db.prepare('SELECT entry_path FROM games WHERE id = ?').get(id);
  res.json({ play_url: `/uploads/games/${id}/${row.entry_path}index.html` });
});

// Source zip download link + count
router.post('/:id/download', (req, res) => {
  const id = Number(req.params.id);
  const g = db.prepare('SELECT id, has_source FROM games WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Game not found.' });
  if (!g.has_source) return res.status(400).json({ error: 'No downloadable source for this game.' });
  db.prepare('UPDATE games SET downloads = downloads + 1 WHERE id = ?').run(id);
  res.json({ url: `/uploads/games/${id}/source.zip` });
});

// Toggle like
router.post('/:id/like', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Game not found.' });
  }
  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND game_id = ?').get(req.session.userId, id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND game_id = ?').run(req.session.userId, id);
  } else {
    db.prepare('INSERT INTO likes (user_id, game_id) VALUES (?, ?)').run(req.session.userId, id);
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE game_id = ?').get(id).n;
  res.json({ liked: !existing, likes: count });
});

// Rate 1-5
router.put('/:id/rate', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const stars = Math.round(Number(req.body.stars));
  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Game not found.' });
  }
  if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'Stars must be 1-5.' });
  db.prepare(`
    INSERT INTO ratings (user_id, game_id, stars) VALUES (?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET stars = excluded.stars
  `).run(req.session.userId, id, stars);
  const agg = db.prepare('SELECT ROUND(AVG(stars),2) AS avg, COUNT(*) AS n FROM ratings WHERE game_id = ?').get(id);
  res.json({ rating: agg.avg || 0, rating_count: agg.n, my_rating: stars });
});

// Comments
router.get('/:id/comments', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id, u.username
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.game_id = ? ORDER BY c.created_at DESC, c.id DESC
  `).all(Number(req.params.id));
  res.json({ comments: rows });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const body = String(req.body.body || '').trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Game not found.' });
  }
  const info = db.prepare('INSERT INTO comments (user_id, game_id, body) VALUES (?, ?, ?)')
    .run(req.session.userId, id, body);
  const c = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.user_id, u.username
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(info.lastInsertRowid);
  res.json({ comment: c });
});

router.delete('/:id/comments/:commentId', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id = ? AND game_id = ?')
    .get(Number(req.params.commentId), Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Comment not found.' });
  if (c.user_id !== req.session.userId && !req.user.admin) {
    return res.status(403).json({ error: 'Not your comment.' });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

// Report a game (auth required)
router.post('/:id/report', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Game not found.' });
  }
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  const dup = db.prepare(
    "SELECT id FROM reports WHERE reporter_id = ? AND game_id = ? AND status = 'open'"
  ).get(req.session.userId, id);
  if (dup) return res.status(409).json({ error: 'You already reported this game.' });
  db.prepare('INSERT INTO reports (reporter_id, game_id, reason) VALUES (?, ?, ?)')
    .run(req.session.userId, id, reason);
  res.json({ ok: true });
});

// Delete own game (admins may delete any)
router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const g = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Game not found.' });
  if (g.user_id !== req.session.userId && !req.user.admin) {
    return res.status(403).json({ error: 'Not your game.' });
  }
  db.prepare('DELETE FROM games WHERE id = ?').run(id); // cascades
  fs.rmSync(path.join(GAMES_DIR, String(id)), { recursive: true, force: true });
  if (g.screenshot_path) {
    try { fs.unlinkSync(path.join(SHOTS_DIR, g.screenshot_path)); } catch { /* already gone */ }
  }
  res.json({ ok: true });
});

module.exports = router;
module.exports.extractGameZip = extractGameZip;
