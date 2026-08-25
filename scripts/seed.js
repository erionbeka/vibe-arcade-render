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
  },
  {
    file: 'password-2000.html',
    title: 'PASSWORD CREATOR 2000',
    description: 'Create a password. Easy. Oh — a new requirement just appeared. And another. One of them is the word "sunday". Another bans the letter e.\n\nSatisfy every escalating rule to earn... an error: your password is TOO STRONG. Please weaken it.',
    tags: 'puzzle logic comedy'
  },
  {
    file: 'potato-futures.html',
    title: 'POTATO FUTURES EXCHANGE',
    description: 'Trade potatoes on a fully unregulated exchange driven by headlines like "PEAK CARB declared by magazine" and "gravy futures soar".\n\nNet worth displayed in fries. Insider trading is legal here because who would stop you.',
    tags: 'trading sim comedy finance'
  },
  {
    file: 'jar-speedrun.html',
    title: 'SPEEDRUN: OPEN A JAR',
    description: 'The final boss of kitchens. HOLD to build grip strength, then tap TWIST before your grip decays. Resistance varies; occasionally the lid was already loose and you question everything.\n\nPersonal bests tracked. The jar laughs in glass.',
    tags: 'skill speedrun kitchen'
  },
  {
    file: 'karaoke.html',
    title: 'KARAOKE SCORER',
    description: 'Read a lyric for 3 seconds, then perform it from memory into the text box. A drunk-but-honest audience scores your accuracy.\n\nThree songs per night. High scores mean nothing; the mic smells like quarters regardless.',
    tags: 'memory music comedy'
  },
  {
    file: 'thermostat-wars.html',
    title: 'THERMOSTAT WARS',
    description: 'One dial. You want it colder. Your roommate wants it warmer and adjusts it while you are not touching the slider.\n\nPassive-aggressive notes appear. Hidden space heaters discovered. Historians will doubt the harmony ending.',
    tags: 'strategy comedy roommates'
  },
  {
    file: 'microwave-etiquette.html',
    title: 'MICROWAVE ETIQUETTE TRAINER',
    description: 'Six break-room crises: overnight fish, exploded soup, the 9:59 timer, silent eye contact through glass. Choose your response; office karma keeps score.\n\nEndings range from BREAK ROOM MONARCH (top-shelf mug privileges) to banishment to the basement microwave.',
    tags: 'choices office comedy karma'
  },
  {
    file: 'grocery-run.html',
    title: 'GROCERY RUN: MEMORY EDITION',
    description: 'Memorize a 5-item list, then navigate the shelves from memory. Impulse buys are tracked and judged ("why").\n\nYou will forget the milk. It does not matter what the list said. You will forget the milk anyway. That is the game\'s one true prophecy.',
    tags: 'memory shopping comedy'
  },
  {
    file: 'crosswalk-button.html',
    title: 'CROSSWALK BUTTON',
    description: 'Press the button. Press it again. Pedestrians arrive and judge your technique in silence.\n\nThe light eventually changes, and a fun fact is revealed about the button\'s actual role in civic infrastructure.',
    tags: 'toy comedy city waiting'
  },
  {
    file: 'progress-bar.html',
    title: 'PROGRESS BAR SIMULATOR',
    description: 'Watch an update progress. Copying files nobody will ever read. Defragmenting vibes. It stalls at 98 or 99% while the ETA becomes "estimate unstable".\n\nCompletion chance per second: small but real. Restart required to not update.',
    tags: 'idle tech comedy slow'
  },
  { file:'cookie-hell.html', title:'COOKIE CONSENT HELL',
    description:'Reject the cookie banner. It multiplies. Partners double. A banner about banners appears.\n\nSix rejections deep you learn the truth: the cookies now accept YOU.',
    tags:'troll parody comedy cookies' },
  { file:'fly-swat.html', title:'FLY SWAT 3000',
    description:'Flies infest the arcade. Swat them with your cursor before they multiply — but each generation learns from its fallen ancestors.\n\nSplat marks remain as a memorial. Generation 5 flies have seen things.',
    tags:'reflex mouse swarm escalating'
  },
  {
    file: 'waiting-room.html',
    title: 'WAITING ROOM',
    description: 'Take a number. Sit. The fluorescent hum is free of charge.\n\nWatch numbers get called while bonding silently with strangers, reading a 2011 magazine quiz, and aging at the exact speed of bureaucracy.',
    tags: 'idle comedy waiting'
  },
  { file:'catch-not-that-one.html', title:'CATCH! ...NOT THAT ONE',
    description:'Your mouse is a basket. Falling food is dinner. Pineapple pizza, broccoli and wet socks are betrayal.\n\nCombo multiplier rewards loyalty; one sock resets everything. 60 seconds of pure catch-or-cry.',
    tags:'arcade mouse reflexes food' },
  { file:'air-hockey-wall.html', title:'AIR HOCKEY vs THE WALL OF REJECTION',
    description:'Physics puck. Taunting wall paddle. First to 7 wins a match the wall will claim it let you have.\n\nReal deflections, real angles, real emotional damage when the wall says "my grandmother hits harder".',
    tags:'hockey physics versus arcade' },
  { file:'gravity-flip.html', title:'GRAVITY FLIP CORRIDOR',
    description:'The floor gave up. Click/space to slam gravity into the ceiling and run upside down past pink spikes.\n\nSpeed ramps forever. Flip timing is everything. Best distance recorded for posterity.',
    tags:'runner gravity reflexes hard' },
  { file:'rocket-landing.html', title:'ROCKET LANDING INC.',
    description:'Full lunar-lander physics with limited fuel: rotate, thrust, and touch down SOFTLY on the pad.\n\nCrash outcomes include "that was not landing, that was geology." Chain landings to build your astronaut legacy.',
    tags:'physics skill space landing' },
  { file:'paper-toss.html', title:'PAPER TOSS PRO',
    description:'Slingshot crumpled paper across the office into the bin while the AC wind actively lies to you.\n\nStreaks build. Coworker Dave watches. Dave always watches.',
    tags:'physics throwing office' },
  { file:'cart-chaos.html', title:'CART CHAOS: DOWNHILL GROCERY',
    description:'A shopping cart with no brakes, three hearts, and a shopping list. Steer downhill through displays, wet floor signs and shoppers.\n\nCollect all three list items without becoming a statistic.',
    tags:'steering dodge arcade food' },
  { file:'bee-herder.html', title:'BEE HERDER',
    description:'Your cursor is a magic flower. Bees follow it. Lead them to the hive to make honey while wasps run a kidnapping operation.\n\nEvery level adds wasps. The bees believe in you. Do not become the villain of the meadow.',
    tags:'herding animals cute action' },
  { file:'conga-line.html', title:'CONGA LINE (OFFICE EDITION)',
    description:'Classic snake, but every segment is a coworker who joined your conga (Gerald, Deb, Auditor Dan...).\n\nThe beat gets faster with every recruit. Do not conga into yourself. HR is watching.',
    tags:'snake arcade music office' },
  { file:'lying-button.html', title:'THE LYING BUTTON',
    description:'A button worth +100 points that refuses to be clicked. It dodges. It teleports. It has never lost.\n\nPoints accumulate anyway, from clicks on literally anything else, which is the most honest scoring system we could invent.',
    tags:'troll comedy cursor' },
  { file:'fake-update-prank.html', title:'IMPORTANT UPDATE (PRANK)',
    description:'An update progress bar that stalls at 87% "Removing features you liked"... then a full-screen fake crash.\n\nComplete with :( face, STOP CODE: YOU_CLICKED_THE_THING, and a slow fake recovery just to twist the knife.',
    tags:'troll prank tech comedy' },
  { file:'sassy-slider.html', title:'THE SLIDER HAS OPINIONS',
    description:'Set the volume. The slider sets it back. Loud? No. Quiet? Also no. The middle zone must be earned through respect.\n\nAfter enough fights, coexistence becomes possible. Barely.',
    tags:'troll toy comedy'
  },
  { file:'do-nothing.html', title:'DO NOTHING',
    description:'The hardest game ever made: do absolutely nothing. Any mouse move, key press or scroll breaks your streak and triggers personalized scolding.\n\nRecords tracked. 30+ seconds earns statue-career advice.',
    tags:'troll patience minimal'
  },
  { file:'evolving-dot.html', title:'CLICK THE DOT',
    description:'Click a friendly dot. It shrinks. It teleports mid-click. By stage four it is legally classified as disrespect in pixel form.\n\n18 hits to conquer. The dot bows to no one (it bows once).',
    tags:'troll clicker reflexes'
  },
  { file:'reverse-maze.html', title:'REVERSE MAZE',
    description:'Navigate a maze to the green door. After your first move, the maze randomly INVERTS your controls whenever it feels like it.\n\nThe arrows unionized against you. Escape repeatedly; each win reshuffles the betrayal schedule.',
    tags:'maze troll puzzle inverted' },
  { file:'captcha-hell.html', title:'PROVE YOU ARE HUMAN',
    description:'CAPTCHA challenges from a darker timeline: "Select all squares containing EMOTIONAL DAMAGE", "Select squares that have ever lied to you".\n\nWrong answers earn personal remarks. Your humanity certificate expires in 4 minutes.',
    tags:'troll parody comedy captcha' },
  { file:'patience-door.html', title:'THE PATIENCE DOOR',
    description:'Hold a button for 60 straight seconds while it insults your commitment. Release early and everything evaporates with an audible sigh.\n\nWhat is behind the door? Philosophy. Mostly philosophy.',
    tags:'troll endurance comedy door'
  },
  { file:'too-many-cursors.html', title:'TOO MANY CURSORS',
    description:'Fake cursors multiply and wander your screen gaslighting you while you hunt the golden target.\n\nThree wrong clicks and you can no longer tell which parts of you are real.',
    tags:'troll mouse chaos confusion'
  },
  { file:'arguing-adventure.html', title:'THE ARGUING ADVENTURE',
    description:'A text adventure where the narrator openly resents you. Every choice gets roasted ("Bravely? You checked your phone twice on the way here").\n\nFeatures a raisin, a Cave Manager, and an ending about breath.',
    tags:'adventure narrative troll comedy' },
  { file:'boss-battler.html', title:'PERFORMANCE REVIEW: FINAL BOSS',
    description:'Dodge flying memos ("this will go in your permanent record") while pelting your boss with staplers until his review score hits zero.\n\nSurvive the PIP. Get promoted to legend. Catharsis rating: maximum.',
    tags:'action boss catharsis office' },
  { file:'smash-the-office.html', title:'SMASH THE OFFICE',
    description:'Click printers, copiers and motivational posters until they explode into debris. A company plant watches with concern. Stress relief: measurable.\n\nEvery item destroyed is a tiny vacation.',
    tags:'destruction catharsis office stress' },
  { file:'punch-alarm.html', title:'PUNCH THE ALARM CLOCK',
    description:'7:00 AM. BEEP BEEP. Punch the clock for snoozes and satisfaction — but lateness rises whether you punch or not.\n\nDestroy clocks faster than mornings destroy you. At 100% late, the pigeon arrives.',
    tags:'action morning rage comedy' },
  { file:'vending-machine.html', title:'VENDING MACHINE JUSTICE',
    description:'It took your $2. Now SHAKE, TILT and UPPERCUT a physically wobbling machine until the snack surrenders.\n\nThe machine hums smugly. You hum back louder.',
    tags:'action catharsis comedy physics'
  },
  { file:'fire-the-client.html', title:'FIRE THE CLIENT',
    description:'Six nightmare clients request things like "bigger but smaller" logos. Endure them and lose sanity, or hit FIRE and gain peace.\n\nEndings range from agency nirvana to answering to a plant named after a font.',
    tags:'choices catharsis work comedy' },
  { file:'inbox-rage.html', title:'INBOX ZERO (RAGE EDITION)',
    description:'Emails multiply endlessly: meeting bots, crypto cousins, "Per my last 14 emails". Click to shred each one into sweet nothing.\n\nTherapy bills saved counter included.',
    tags:'clicker catharsis email satisfying' },
  { file:'parking-revenge.html', title:'THE CLAW (PARKING REVENGE)',
    description:'Someone took your spot. Fortunately you operate a giant crane claw. Grab their car and deposit it in the Compensation Bay.\n\nMissed grabs produce poetry: "empty claws. empty dreams."',
    tags:'skill claw revenge physics' },
  { file:'block-the-ex.html', title:'BLOCK THE EX',
    description:'Their texts escalate from "saw a dog today, thought of u" to wearing your hoodie at the gym. Block again. And again. Ten times.\n\nFinal translation of all messages: "i respect your boundaries now." Freedom achieved.',
    tags:'clicker catharsis comedy texting'
  },
  { file:'escape-meeting.html', title:'ESCAPE THE MEETING',
    description:'It could have been an email. Choose your exit: fake phone call, dramatic wifi death, coughing toward the door. Get caught and suspicion skyrockets.\n\nEscape a full hour and the birds sing songs about you.',
    tags:'choices stealth office comedy'
  },
  { file:'taxes-chipper.html', title:'TAX DOCUMENTS: WOOD CHIPPER',
    description:'Feed W2s, 1099s and receipts?? into a spinning wood chipper by hand. Audit risk rises. Regrets do not.\n\nRefund status: lol.',
    tags:'catharsis destruction comedy taxes'
  },
  { file:'project-graves.html', title:'GROUP PROJECT GRAVEYARD',
    description:'Bury teammates who contributed nothing, each tombstone engraved with their actual excuse ("my dog read the email").\n\nEight burials complete the memorial nobody asked for but everyone needed.',
    tags:'comedy school catharsis graveyard'
  },
  { file:'diet-slap.html', title:'SLAP YOUR OWN HAND',
    description:'Your traitor hand crawls toward THE DONUT on its own. Slap it away before consumption occurs. Willpower meter included.\n\nLoss counter quotes your own "just one" back at you, per donut.',
    tags:'reflex comedy diet slap'
  },
  { file:'speed-clean.html', title:'MOM INCOMING: SPEED CLEAN',
    description:'Drag the pizza box, mystery cup and homework (F-) into the closet before mom crosses the driveway. She notices EVERYTHING.\n\nVictory text calls you good boy/girl regardless of age. Victory nonetheless.',
    tags:'drag timer childhood comedy'
  },
  { file:'reply-all.html', title:'REPLY-ALL APOCALYPSE',
    description:'You replied "lol nice" to all 842 employees. Mash RECALL as chaos spreads — Kevin replied-all asking to be removed, adding everyone again.\n\nCEO progress bar decides your fate.',
    tags:'timer panic office comedy'
  },
  { file:'cs-yeller.html', title:'CUSTOMER SERVICE YELLER',
    description:'Navigate a phone tree designed by someone who hates you. Hold the red button to YELL "AGENT!!!" — rage is the only currency they accept.\n\nGreg (a human) solves everything in 40 seconds once summoned.',
    tags:'comedy phone rage catharsis'
  },
  { file:'unsubscribe.html', title:'UNSUBSCRIBE FOREVER',
    description:'Try to leave one newsletter. Survive surveys, denial stages, lawyer letters and emotional blackmail ("it says it loves you").\n\nThe unsubscribe button shrinks each round. Freedom has terms and conditions.',
    tags:'troll ui comedy email'
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
    fs.mkdirSync(path.join(GAMES_DIR, String(existing.id)), { recursive: true });
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
