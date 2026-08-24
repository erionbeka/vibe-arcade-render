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

const CATALOG_HANDMADE = [
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
    description: 'Pull the lever. Receive toast. Or charcoal. Or toast leaves for orbit. The toaster knows things it will not share.\n\nCollect stats across six possible outcomes including the rare GOLDEN TOAST JACKPOT (+10 legendary bread points).',
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
  },
  {
    file: 'yelling-simulator.html',
    title: 'YELLING SIMULATOR',
    description: 'Hold the button. Yell (internally). The decibel meter rises, the screen shakes, and your neighbors leave increasingly formal complaints.\n\nYell too briefly and you produce a mere squeak, disappointing a goldfish somewhere. 8 complaint milestones including involvement of the city.',
    tags: 'comedy clicker noise'
  },
  {
    file: 'wack-strike.html',
    title: 'WACK-A-MOLE (LABOR DISPUTE)',
    description: 'The moles are on strike and hold tiny picket signs. Whacking strikers earns you -1 karma and a formal grievance; the occasional non-union scab mole is fair game.\n\n30-second shifts end with an ethical assessment of your career choices.',
    tags: 'whack-a-mole animals comedy labor'
  },
  {
    file: 'goldfish-memory.html',
    title: 'GOLDFISH MEMORY TEST',
    description: 'Memorize words for 2 seconds, then pick them from decoys like "REGRET" and "CAR ALARM".\n\nYour opponent is a goldfish that claims it never forgets. The goldfish always scores. Always. Verify this injustice yourself across 6 rounds.',
    tags: 'quiz animals comedy unfair'
  },
  {
    file: 'dial-up-1997.html',
    title: 'DIAL-UP SIMULATOR 1997',
    description: 'Connect to the internet the way nature intended: a 25-second ritual of modem throat-clearing, handshakes, and genuine synthesized screeching.\n\nReward: one (1) email from mom with a 47-minute attachment. Disconnecting makes mom never know.',
    tags: 'retro simulation comedy slow'
  },
  {
    file: 'fridge.html',
    title: 'FRIDGE SIMULATOR',
    description: 'Open the fridge. Close the fridge. Discover what the leftovers have become.\n\n12 mysteries to find, including opinion-having yogurt, unexplained additional ham, and a cat that declines to leave. Day counter included because time passes inside fridges too.',
    tags: 'simulation food mystery cozy'
  },
  {
    file: 'floor-is-not-lava.html',
    title: 'THE FLOOR IS LAVA (it is not)',
    description: 'The floor is lava. Except it is not. It is regular floor. But what if?\n\nWalk around a room while an unseen voice issues lava alerts it immediately walks back. Includes ACHIEVEMENT: STILLNESS for standing motionless for six seconds like a brave little rectangle.',
    tags: 'walking paranoia comedy'
  },
  {
    file: 'elevator.html',
    title: 'ELEVATOR SIMULATOR',
    description: 'Nine floors. Nine buttons. One elevator car with dramatic doors.\n\nEach floor has a full description (spoiler: they are all offices). Random passengers board silently and leave awkwardness behind. Floor 9 is stairs.',
    tags: 'simulation awkward comedy'
  },
  {
    file: 'conspiracy-board.html',
    title: 'CONSPIRACY BOARD',
    description: 'PIGEONS. THE MOON. TOAST. YOUR CAT. Connect the photos with red string and the board stamps EXACTLY after every link.\n\nAfter 8 connections the truth is revealed, and it is laundry. It is always laundry.',
    tags: 'puzzle comedy birds'
  },
  {
    file: 'mood-ring.html',
    title: 'MOOD RING',
    description: 'A high-precision mood analysis instrument. Consult the ring and receive readings like "soup", "legally tired", or "one bad day from raccoon".\n\nColor changes included. Accuracy not. Recent moods logged for your permanent emotional record.',
    tags: 'toy comedy mood'
  },
  {
    file: 'decision-coin.html',
    title: 'DECISION COIN',
    description: 'Outsource your life choices to a coin with eight possible outcomes, including "YES BUT ALSO NO", "ASK AGAIN AFTER A SNACK" and "THE ANSWER IS SOUP".\n\nYour question is accepted and completely ignored. The coin flips dramatically anyway.',
    tags: 'casual comedy decisions'
  },
  {
    file: 'ant-farm-tycoon.html',
    title: 'ANT FARM TYCOON',
    description: 'Build a colony. Gather leaves. Buy ants that wander around accomplishing nothing visible.\n\nFeatures a stats panel measuring Colony GDP (in vibes) and escape attempts. Rename your colony anything; the ants will not remember.',
    tags: 'idle tycoon ants comedy'
  },
  {
    file: 'air-guitar.html',
    title: 'AIR GUITAR CHAMPIONSHIPS',
    description: 'Strum ASDFLH for power chords, SPACE for windmills. A panel including "the russian judge" and "a guy named dennis" scores your 30-second set.\n\nThe guitar is imaginary. The glory is real. Crowd attendance: nobody.',
    tags: 'music rhythm comedy keyboard'
  },
  {
    file: 'stare-contest.html',
    title: 'STARE CONTEST vs GOAT',
    description: 'A goat stares at you. Do not click. Clicking is blinking, and blinking is losing.\n\nThe goat blinks strategically then claims victory regardless ("goat cheated"). Survive long enough and it falls asleep standing up. Records tracked.',
    tags: 'animals casual comedy goat'
  },
  {
    file: 'bubble-wrap.html',
    title: 'BUBBLE WRAP: ETERNAL',
    description: '84 bubbles of satisfying popping with rising-pitch sounds. But the LAST BUBBLE is sentient, and it has seen its siblings fall.\n\nChoose: SPARE THE BUBBLE (it follows you spiritually) or POP IT ANYWAY ("i forgive you," it whispers). Both endings haunt.',
    tags: 'clicker comedy wholesome'
  },
  {
    file: 'time-travel-kiosk.html',
    title: 'TIME TRAVEL KIOSK',
    description: 'Self-service time travel. Enter a year, endure the warping sound, receive a disappointing arrival report ("still no flying cars", "gravity: unchanged (lazy)").\n\nSpecial years unlock special disappointments. Paradox accumulation rises 12% per trip; above 60% a second you arrives to complain about the mess.',
    tags: 'sci-fi casual comedy paradox'
  },
  {
    file: 'ghost-roommate.html',
    title: 'GHOST ROOMMATE AGREEMENT',
    description: 'Negotiate six house rules with a ghost named Reginald (or Gary, or Chad (dead)). Agreeing means nothing; refusing changes nothing.\n\nFinal Coexistence Score: exactly 50%. The lease is signed in cold breath. This is now legally your problem.',
    tags: 'casual ghosts comedy negotiation'
  }
];

const insertGame = db.prepare(
  'INSERT INTO games (user_id, title, description, type) VALUES (?, ?, ?, ?)'
);
const insertTag = db.prepare('INSERT OR IGNORE INTO tags (game_id, tag) VALUES (?, ?)');

const GEN_CATALOG = path.join(__dirname, '..', 'games-to-upload', 'gen-catalog.json');
const GENERATED = fs.existsSync(GEN_CATALOG)
  ? JSON.parse(fs.readFileSync(GEN_CATALOG, 'utf8'))
  : [];
const CATALOG = [...CATALOG_HANDMADE, ...GENERATED];

for (const g of CATALOG) {
  const srcPath = path.join(__dirname, '..', 'games-to-upload', g.file);
  if (!fs.existsSync(srcPath)) {
    console.error(`missing file: ${g.file}`);
    continue;
  }
  const existing = db.prepare('SELECT id FROM games WHERE title = ? AND user_id = ?').get(g.title, bot.id);
  if (existing) {
    // refresh the playable copy so source fixes reach published games
    fs.copyFileSync(srcPath, path.join(GAMES_DIR, String(existing.id), 'index.html'));
    console.log(`refreshed: ${g.title} (#${existing.id})`);
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
