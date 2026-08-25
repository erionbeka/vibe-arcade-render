// GitHub-backed persistence for Vibe Arcade.
//
//   node scripts/backup.js init  -> creates a PRIVATE backup repo + first snapshot
//   node scripts/backup.js snap  -> take a snapshot now
//   node scripts/backup.js env   -> print the two env vars to paste into Render
//
// How it works at runtime (wired in server.js):
//   - on boot: restore data/ + uploads/ from the last snapshot (if any)
//   - every 5 min + on SIGTERM/SIGINT: commit & push a fresh snapshot
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const UP = path.join(ROOT, 'uploads');
const WORK = path.join(ROOT, '.backup-work');

// read env LIVE so `init` can set them mid-process
const repo = () => process.env.BACKUP_REPO || '';
const tok = () => process.env.BACKUP_TOKEN || '';
const MAX_FILE = 80 * 1024 * 1024; // github hard-limits files at 100MB

function configured() { return !!(repo() && tok()); }

function authedUrl() {
  return repo().replace('https://', `https://x-access-token:${tok()}@`);
}

function sanitize(s) {
  return tok() ? String(s).split(tok()).join('<token>') : String(s);
}

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: WORK,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
}

function ensureWork() {
  fs.mkdirSync(WORK, { recursive: true });
  if (!fs.existsSync(path.join(WORK, '.git'))) {
    git(['init', '-b', 'backups']);
    git(['config', 'user.name', 'vibe-arcade-bot']);
    git(['config', 'user.email', 'bot@vibe-arcade.local']);
    git(['config', 'core.autocrlf', 'false']);
  }
  try { git(['remote', 'add', 'origin', authedUrl()]); }
  catch { git(['remote', 'set-url', 'origin', authedUrl()]); }
}

function cpSync(src, dst, depth = 0) {
  if (!fs.existsSync(src)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) cpSync(path.join(src, f), path.join(dst, f), depth + 1);
    return;
  }
  const name = path.basename(src);
  if (name.endsWith('-wal') || name.endsWith('-shm')) return;
  if (st.size > MAX_FILE) {
    console.warn(`[backup] skipping ${name} (${(st.size / 1048576).toFixed(1)}MB > 80MB cap)`);
    return;
  }
  fs.copyFileSync(src, dst);
}

function checkpoint() {
  try {
    const db = require(path.join(__dirname, '..', 'src', 'db'));
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) { /* db not open yet */ }
}

function restore() {
  if (!configured()) return;
  ensureWork();
  try {
    git(['fetch', '--depth', '1', 'origin', 'backups']);
  } catch {
    console.log('[backup] no previous snapshot found \u2014 starting a fresh arcade');
    return;
  }
  try {
    git(['checkout', '-f', 'backups']);
    git(['reset', '--hard', 'origin/backups']);
    cpSync(path.join(WORK, 'data'), DATA);
    cpSync(path.join(WORK, 'uploads'), UP);
    console.log('[backup] restored database + uploaded games from last snapshot');
  } catch (e) {
    console.error('[backup] restore failed:', sanitize(e.message).slice(0, 160));
  }
}

function snapshot(reason = '') {
  if (!configured()) return false;
  ensureWork();
  checkpoint();
  cpSync(DATA, path.join(WORK, 'data'));
  cpSync(UP, path.join(WORK, 'uploads'));
  try {
    git(['add', '-A']);
    const dirty = git(['status', '--porcelain']).trim();
    if (!dirty) return true;
    git(['commit', '-m', `snapshot ${new Date().toISOString()}${reason ? ' (' + reason + ')' : ''}`]);
    try {
      git(['push', 'origin', 'backups']);
      console.log('[backup] snapshot pushed to GitHub');
      return true;
    } catch (e) {
      git(['push', '--force', 'origin', 'backups']);
      console.log('[backup] snapshot force-pushed (history reset)');
      return true;
    }
  } catch (e) {
    console.error('[backup] snapshot failed:', sanitize(e.message).slice(0, 200));
    return false;
  }
}

// ---------- CLI ----------
if (require.main === module) {
  const cmd = process.argv[2] || '';

  if (cmd === 'init') {
    let owner = '';
    let ghExe = 'gh';
    const ghCandidates = [
      path.join(process.env.TEMP || '', 'opencode', 'gh'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'gh')
    ];
    for (const dir of ghCandidates) {
      try {
        const hit = execFileSync('powershell', ['-NoProfile', '-Command',
          `(Get-ChildItem '${dir}' -Recurse -Filter gh.exe | Select-Object -First 1).FullName`]).toString().trim();
        if (hit) { ghExe = hit; break; }
      } catch { /* keep looking */ }
    }
    try {
      owner = execFileSync(ghExe, ['api', 'user', '--jq', '.login']).toString().trim();
    } catch {
      console.error('gh CLI not found/logged in. Install it or create the repo manually.');
      process.exit(1);
    }
    try {
      execFileSync(ghExe, ['repo', 'create', 'vibe-arcade-backups', '--private'], { stdio: 'inherit' });
      console.log('created private repo ' + owner + '/vibe-arcade-backups');
    } catch { /* probably already exists */ }
    process.env.BACKUP_REPO = `https://github.com/${owner}/vibe-arcade-backups`;
    process.env.BACKUP_TOKEN = execFileSync(ghExe, ['auth', 'token']).toString().trim();
    ensureWork();
    snapshot('initial');
    console.log('\nDone! Now paste these two variables into Render -> your service -> Environment:\n');
    console.log(`BACKUP_REPO=${process.env.BACKUP_REPO}`);
    console.log(`BACKUP_TOKEN=${process.env.BACKUP_TOKEN}`);
    console.log('\n(keep the token private \u2014 it can read/write that backups repo)');
  } else if (cmd === 'snap') {
    snapshot('manual');
  } else if (cmd === 'env') {
    console.log(`BACKUP_REPO=${REPO || '(run: npm run backup:init)'}`);
    console.log(`BACKUP_TOKEN=(run: gh auth token, and paste its output here)`);
  } else {
    console.log('usage: node scripts/backup.js [init|snap|env]');
  }
}

module.exports = { restore, snapshot, configured };
