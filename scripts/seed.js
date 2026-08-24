const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require(path.join(__dirname, '..', 'node_modules', 'bcryptjs'));

process.chdir(path.join(__dirname, '..'));
const db = require(path.join(__dirname, '..', 'src', 'db'));

const GAMES_DIR = path.join(__dirname, '..', 'uploads', 'games');
fs.mkdirSync(GAMES_DIR, { recursive: true });

const BOT_USER = process.env.SEED_USER || 'vibe_bot';
let bot = db.prepare('SELECT * FROM users WHERE username = ?').get(BOT_USER);
if (!bot) {
  const pw = 'bot-' + crypto.randomBytes(4).toString('hex');
  const info = db.prepare('INSERT INTO users (username, password_hash, admin) VALUES (?, ?, 0)')
    .run(BOT_USER, bcrypt.hashSync(pw, 10));
  bot = { id: info.lastInsertRowid };
  console.log(`created uploader account "${BOT_USER}" (password: ${pw})`);
} else if (bot.admin) {
  // the demo bot should never hog the auto-admin slot
  db.prepare('UPDATE users SET admin = 0 WHERE id = ?').run(bot.id);
}

const promoteArg = process.argv[2] || '';
if (promoteArg.startsWith('admin:')) {
  const name = promoteArg.slice(6).trim();
  if (!name) { console.error('usage: npm run seed -- admin:<username>'); process.exit(1); }
  let u = db.prepare('SELECT * FROM users WHERE username = ?').get(name);
  if (u) {
    db.prepare('UPDATE users SET admin = 1 WHERE id = ?').run(u.id);
    console.log(`"${name}" is now an admin.`);
  } else {
    const pw = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO users (username, password_hash, admin) VALUES (?, ?, 1)')
      .run(name, bcrypt.hashSync(pw, 10));
    console.log(`created admin "${name}" (password: ${pw})`);
  }
}

const CATALOG = [
  {
    file: 'the-button.html',
    title: 'THE BUTTON',
    description: 'There is a button. You press it. Nothing happens.\n\nFeatures: 19 milestones, escalating existential commentary, and a screen shake you have to earn with 500 clicks. There is no prize. There was never a prize.',
    tags: 'clicker useless comedy'
  },
  {
    file: 'watch-grass-grow.html',
    title: 'WATCH GRASS GROW',
    description: 'The most honest idle game ever made. Grass grows at 0.0000000-ish% per second while a narrator reports on bird flybys and root activity (unconfirmed).\n\nIncludes FERTILIZE button that grows one (1) blade slightly. Finish line exists. Reaching it says more about you than about grass.',
    tags: 'idle plants comedy slow'
  },
  {
    file: 'flappy-sausage.html',
    title: 'FLAPPY SAUSAGE',
    description: 'You are a sausage with eyes. Flap through hot dog buns. That is the whole lore.\n\nGrill-stripe physics, taunts calibrated to your ego, and a death screen that respects nothing. Best score saved locally so your shame is permanent.',
    tags: 'flappy arcade hard food'
  },
  {
    file: 'support-potato.html',
    title: 'EMOTIONAL SUPPORT POTATO',
    description: 'A potato provides YOU emotional support. Pet it, feed it vibes, or insult it and watch the trust evaporate.\n\nMood meter, blinking eyes, and enlightenment at 100%. Warning: the potato remembers every insult. Potatoes always do.',
    tags: 'pet wholesome comedy potato'
  },
  {
    file: 'snail-racing.html',
    title: 'SNAIL RACING LEAGUE (OFFICIAL)',
    description: 'Bet fake coins on four snails: Shelly, Turbo (not fast), Sir Slimesworth, and Dave. Races take forever because they are snails.\n\nLive announcer commentary includes such classics as "DAVE IS DOING SOMETHING" and "photo finish pending (no photos available)".',
    tags: 'racing betting animals comedy'
  },
  {
    file: 'toaster-roulette.html',
    title: 'TOASTER ROULETTE',
    description: 'Pull the lever. Receive toast. Or charcoal. Or the toast leaves for orbit. The toaster knows things it will not share.\n\nCollect stats across six possible outcomes including the rare GOLDEN TOAST JACKPOT (+10 legendary bread points).',
    tags: 'casino bread comedy random'
  },
  {
    file: 'rps-cheating-robot.html',
    title: 'RPS vs CHEATING ROBOT',
    description: 'Rock Paper Scissors against a robot that openly cheats 82% of the time and gloats about it.\n\nWin three in a row to witness a genuine robot crisis. It has already decided your fate. Probably.',
    tags: 'casual robots comedy unfair'
  },
  {
    file: 'budget-airlines.html',
    title: 'BUDGET AIRLINES: PEANUT EDITION',
    description: 'Pilot the world\'s cheapest aircraft. Hold to throttle up, collect peanuts (worth 10 meters each), dodge birds and colleagues.\n\nFeatures a captain who announces things like "we saved on fuel by removing the fuel" and a crash screen with sincere corporate apologies.',
    tags: 'flying arcade food comedy'
  }
];

const insertGame = db.prepare(
  'INSERT INTO games (user_id, title, description, type) VALUES (?, ?, ?, ?)'
);
const insertTag = db.prepare('INSERT OR IGNORE INTO tags (game_id, tag) VALUES (?, ?)');

for (const g of CATALOG) {
  const exists = db.prepare('SELECT id FROM games WHERE title = ? AND user_id = ?').get(g.title, bot.id);
  if (exists) {
    console.log(`skip (already published): ${g.title}`);
    continue;
  }
  const srcPath = path.join(__dirname, '..', 'games-to-upload', g.file);
  if (!fs.existsSync(srcPath)) {
    console.error(`missing file: ${g.file}`);
    continue;
  }
  const gameId = db.transaction(() => {
    const info = insertGame.run(bot.id, g.title, g.description, 'web');
    const dir = path.join(GAMES_DIR, String(info.lastInsertRowid));
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcPath, path.join(dir, 'index.html'));
    db.prepare('UPDATE games SET entry_path = ? WHERE id = ?').run('', info.lastInsertRowid);
    for (const t of g.tags.split(/\s+/).filter(Boolean)) insertTag.run(info.lastInsertRowid, t);
    return info.lastInsertRowid;
  })();
  console.log(`published #${gameId}: ${g.title}`);
}
console.log('done.');
