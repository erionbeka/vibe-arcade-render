const express = require('express');
const db = require('./db');
const { requireAdmin } = require('./auth');

const router = express.Router();
router.use(requireAdmin);

// Open reports, newest first
router.get('/reports', (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.reason, r.created_at, r.game_id,
           ru.username AS reporter,
           g.title AS game_title, gu.username AS game_author,
           (SELECT COUNT(*) FROM reports x WHERE x.game_id = r.game_id AND x.status = 'open') AS open_count
    FROM reports r
    JOIN users ru ON ru.id = r.reporter_id
    LEFT JOIN games g ON g.id = r.game_id
    LEFT JOIN users gu ON gu.id = g.user_id
    WHERE r.status = 'open'
    ORDER BY r.created_at DESC, r.id DESC
  `).all();
  res.json({ reports: rows });
});

// Resolve a report without action
router.delete('/reports/:id', (req, res) => {
  const r = db.prepare('SELECT id FROM reports WHERE id = ? AND status = ?').get(Number(req.params.id), 'open');
  if (!r) return res.status(404).json({ error: 'Report not found.' });
  db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(r.id);
  // resolving one report resolves all open reports for the same game
  const row = db.prepare('SELECT game_id FROM reports WHERE id = ?').get(r.id);
  if (row && row.game_id) {
    db.prepare("UPDATE reports SET status = 'resolved' WHERE game_id = ? AND status = 'open'").run(row.game_id);
  }
  res.json({ ok: true });
});

module.exports = router;
