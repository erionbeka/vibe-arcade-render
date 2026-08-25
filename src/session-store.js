// SQLite-backed session store for express-session.
// Survives reboots, gets included in GitHub backups, no memory leak.
const { Store } = require('express-session');
const db = require('./db');

class SqliteSessionStore extends Store {
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb();
      if (row.expires <= Date.now()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb();
      }
      cb(null, JSON.parse(row.sess));
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb = () => {}) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
      const expires = Date.now() + maxAge;
      db.prepare(`
        INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
      `).run(sid, JSON.stringify(sess), expires);
      cb();
    } catch (err) { cb(err); }
  }

  destroy(sid, cb = () => {}) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb();
    } catch (err) { cb(err); }
  }

  touch(sid, sess, cb = () => {}) {
    this.set(sid, sess, cb);
  }
}

setInterval(() => {
  try { db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now()); } catch {}
}, 60 * 60 * 1000);

module.exports = new SqliteSessionStore();
