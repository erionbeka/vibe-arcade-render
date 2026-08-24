const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'games-to-upload');

// deterministic RNG so regenerated games keep identical filenames/titles (seed idempotency)
let seed = 1337;
function rng() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = a => a[Math.floor(rng() * a.length)];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
}

function shell(title, css, bodyHtml, js) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>' + title + '</title>\n<style>\n' +
    css +
    '\n</style>\n</head>\n<body>\n' + bodyHtml + '\n<script>\n' + js + '\n</script>\n</body>\n</html>';
}

function baseCss(bg, acc) {
  return `
  html,body{margin:0;height:100%;background:${bg};color:#eef;font-family:Consolas,monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  h1{font-size:.95rem;margin:0;text-align:center;color:${acc}}
  button{padding:11px 20px;font-family:inherit;font-size:.98rem;border:3px solid ${acc};background:#151530;color:#dfe8ff;cursor:pointer}
  button:disabled{opacity:.45}
  #say{min-height:28px;text-align:center;padding:0 10px}
`;
}

const beep = `(function(){window.__beep=function(f,d,t){try{var a=new (window.AudioContext||window.webkitAudioContext)();var o=a.createOscillator(),g=a.createGain();o.type=t||'square';o.frequency.value=f;g.gain.value=.05;g.gain.exponentialRampToValueAtTime(.001,a.currentTime+(d||.08));o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+(d||.08));}catch(e){}};})();`;

// ================= DODGE =================
const dodgeThemes = [
  ['SANDWICH VS PIGEONS', '#f7c948', 'pigeons', '#9aa2ad', 'olives', '#7cb342', ['pigeons operate in flocks. and grudges.', 'you dropped lettuce. they noticed.', 'the sandwich has been marked.']],
  ['LOST SOCK VS DRYER LINT', '#bfe3ff', 'lint balls', '#8d8d8d', 'matching socks', '#ffd54f', ['the dryer hungers.', 'lint comes from nowhere. like taxes.', 'your match is out there somewhere.']],
  ['SNOWMAN VS SUNBEAMS', '#f5faff', 'sunbeams', '#ffb300', 'snowflakes', '#81d4fa', ['global warming is personal today.', 'stay frosty. literally.', 'carrot nose status: melting.']],
  ['MEATBALL VS FORKS', '#a15c38', 'forks', '#cfd8dc', 'parmesan', '#fff59d', ['dinner is hostile tonight.', 'the forks are punctual.', 'grated cheese: worth the risk.']],
  ['TOAST VS BUTTER KNIVES', '#e8b06a', 'butter knives', '#b0bec5', 'jam jars', '#e91e63', ['breakfast turned.', 'crumbs everywhere. casualties of war.', 'jam or die.']],
  ['BALLOON VS CACTI', '#ff80ab', 'cacti', '#66bb6a', 'helium puffs', '#b39ddb', ['do not touch the spiky boys.', 'you are full of dreams and air.', 'one prick and it is over.']],
  ['TURTLE VS SKATEBOARDS', '#8bc34a', 'skateboards', '#a1887f', 'lettuce', '#dce775', ['speed is a mindset. yours is slow.', 'the youths zoom past. disrespectful.', 'shell: rated for exactly this.']],
  ['CLOUD VS RAIN', '#eceff1', 'raindrops', '#4fc3f7', 'sunbeams', '#ffee58', ['ironic, is it not?', 'you are the weather now.', 'stay fluffy. avoid wet.']],
  ['WORM VS BIRDS', '#f48fb1', 'birds', '#5c6bc0', 'dirt snacks', '#8d6e63', ['early bird gets you specifically.', 'dig deep. live long.', 'the ground is your friend. usually.']],
  ['BANANA VS MONKEYS', '#ffe135', 'monkeys', '#8d5738', 'smoothies', '#ce93d8', ['they want what you are.', 'slippery times ahead.', 'potassium is power.']],
  ['ROBOT VS RUST', '#4dd0e1', 'rust flakes', '#bf360c', 'oil cans', '#455a64', ['oxidation is the enemy.', 'creaky joints detected.', 'oil can. oil can.']],
  ['GHOST VS VACUUMS', '#e1f5fe', 'vacuum cleaners', '#ef5350', 'ectoplasm', '#69f0ae', ['the appliance fears nothing.', 'spooky AND aerodynamic.', 'boo, but fast.']],
  ['ICE CUBE VS HAIRDRYERS', '#b3e5fc', 'hairdryers', '#f06292', 'mint leaves', '#b9f6ca', ['stay cool. it is literal.', 'the wind weapon is warm. so warm.', 'melting is rude anyway.']],
  ['CACTUS VS HUGS', '#81c784', 'hugs', '#ffb74d', 'water drops', '#4dd0e1', ['everyone wants affection. you cannot accept it.', 'personal space is life.', 'prickly outside, prickly inside too.']],
  ['PANCAKE VS SYRUP BOTTLES', '#ffcc80', 'syrup bottles', '#7e57c2', 'butter pads', '#fff176', ['breakfast is a battlefield.', 'stay flat. stay free.', 'soggy is a fate worse than eaten.']],
  ['UFO VS CONSPIRACY NUTS', '#cfd8dc', 'believers', '#8d6e63', 'cows', '#fafafa', ['take the cow. do not get studied.', 'they have tin foil and no fear.', 'abduct responsibly.']]
];

function makeDodge(t, i) {
  const [title, pc, hn, hc, kn, kc, deaths] = t;
  const js = `
const c=document.getElementById('c'),x=c.getContext('2d');
let px=280,score=0,got=0,t0=Date.now(),dead=false,haz=[],snacks=[];
addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();px=Math.max(16,Math.min(584,e.clientX-r.left));});
addEventListener('keydown',e=>{if(e.key==='ArrowLeft')px-=24;if(e.key==='ArrowRight')px+=24;});
setInterval(()=>{if(dead)return;
  if(Math.random()<.055)haz.push({x:Math.random()*560+20,y:-20,v:2.2+Math.random()*1.6+(Date.now()-t0)/22000,k:Math.random()<.5});
  if(Math.random()<.022)snacks.push({x:Math.random()*560+20,y:-16,v:2});
},40);
setInterval(()=>{
  if(dead)return;
  x.clearRect(0,0,600,380);
  x.fillStyle='${pc}';x.fillRect(px-18,320,36,26);
  x.font='bold 12px Consolas';x.textAlign='center';x.fillStyle='#fff';
  x.fillText('${title.split(' VS ')[0]}',px,362);
  for(let hi=haz.length-1;hi>=0;hi--){
    const h=haz[hi];h.y+=h.v;
    x.fillStyle='${hc}';
    if(h.k)x.fillRect(h.x-10,h.y-14,20,28);else{x.beginPath();x.arc(h.x,h.y,11,0,7);x.fill();}
    if(h.y<395&&Math.abs(h.x-px)<27&&Math.abs(h.y-333)<27)return die();
    if(h.y>400)haz.splice(hi,1);
  }
  for(let si=snacks.length-1;si>=0;si--){
    const s=snacks[si];s.y+=s.v;
    x.fillStyle='${kc}';x.beginPath();x.arc(s.x,s.y,8,0,7);x.fill();
    if(s.y<395&&Math.abs(s.x-px)<27&&Math.abs(s.y-330)<24){snacks.splice(si,1);got++;__beep(700,.07);}
    else if(s.y>400)snacks.splice(si,1);
  }
  score=Math.floor((Date.now()-t0)/100)*5+got*50;
  document.getElementById('hud').textContent='score '+score+' \\u00B7 ${kn}: '+got;
},16);
function die(){
  dead=true;
  document.getElementById('say').innerHTML='${deaths[pick(deaths.map((_, i2) => i2))]}'+'<br><br><button onclick="location.reload()">TRY AGAIN</button>';
}`;
  const html = shell(title, baseCss('#10101f', kc),
    `<h1>${title}</h1>
<canvas id="c" width="600" height="380" style="border:4px solid ${hc};background:#181830"></canvas>
<div id="hud">score 0</div>
<div id="say">arrows or mouse. grab ${kn}. avoid the ${hn}. you will fail eventually.</div>`,
    beep + js);
  return {
    file: `gen_dodge_${i}_${slug(title)}.html`, html, title,
    description: `${title.split(' VS ')[0]} has ONE job: exist. Everything else wants otherwise.\n\nMove with arrows/mouse, collect ${kn} (+50), dodge falling ${hn}, and receive a personalized obituary.`,
    tags: `dodge arcade ${kn.split(' ')[0]}`
  };
}

// ================= CLICKER =================
const clickerThemes = [
  ['ROCK CLICKER', 'rock', 'rocks', '#8d8d8d',
    ['the rock does not care.', 'geology is just slow clicking.', 'sedimentary, my dear clicker.'],
    [['loupe', 10, 'now you can see the rock better'], ['hammer', 40, 'this is how rocks are made'], ['geologist hat', 120, 'professionally unprofessional']]],
  ['CLOUD CLICKER', 'cloud', 'raindrops', '#b3e5fc',
    ['the cloud holds. for now.', 'condensation achieved.', 'silver linings sold separately.'],
    [['tiny umbrella', 8, 'for the tiny drizzle'], ['wind fan', 35, 'cloud cardio'], ['weather license', 99, 'now legally responsible for storms']]],
  ['DUCK CLICKER', 'duck', 'breadcrumbs', '#ffe082',
    ['the duck accepts your tribute.', 'quack economics.', 'bread: the original currency.'],
    [['pond permit', 9, 'legal quacking'], ['fancy peas', 30, 'ducks love peas. who knew'], ['statue of yourself', 110, 'the ducks will worship you']]],
  ['KETTLE CLICKER', 'kettle', 'steam wisps', '#e0e0e0',
    ['the kettle whispers.', 'almost boiling since 2021.', 'whistle when ready.'],
    [['thermometer', 7, 'precision lukewarm'], ['descaler', 33, 'ancient crust removed'], ['cozy sweater', 85, 'kettles get cold too']]],
  ['CACTUS CLICKER', 'cactus', 'spines', '#81c784',
    ['ow. but progress.', 'hug attempt failed.', 'desert approved.'],
    [['gloves', 11, 'handle with mild confidence'], ['sunhat', 42, 'shade is growth'], ['sombrero', 130, 'maximum photosynthesis']]],
  ['CHEESE WHEEL CLICKER', 'cheese wheel', 'wedges', '#ffca28',
    ['aged to perfection.', 'smells like ambition.', 'the holes add character.'],
    [['tiny knife', 12, 'sampling begins'], ['wax seal', 44, 'authenticity +5'], ['mouse intern', 140, 'he works for cheese']]],
  ['FAX MACHINE CLICKER', 'fax machine', 'documents', '#b0bec5',
    ['beep boop. business.', 'the 90s called. they sent a fax.', 'screeching intensifies.'],
    [['toner', 13, 'dark ink, darker deals'], ['extra phone cord', 46, 'for range'], ['second fax machine', 155, 'to fax the first one']]],
  ['LIGHTHOUSE CLICKER', 'lighthouse', 'light beams', '#fff176',
    ['warning ships since forever.', 'shine on, crazy prism.', 'seagulls respect you now.'],
    [['polished lens', 14, '+2 nautical vibes'], ['foghorn', 50, 'HOOOOONK'], ['assistant keeper', 170, 'his name is greg']]],
  ['MUSHROOM CLICKER', 'mushroom', 'spores', '#a5d6a7',
    ['fungi among us.', 'growing on success.', 'dark and damp, like your humor.'],
    [['compost', 10, 'premium nutrition'], ['rain dance', 47, 'effective and embarrassing'], ['mycology degree', 180, 'now officially fun guy']]],
  ['TRAFFIC CONE CLICKER', 'traffic cone', 'apologies', '#ff8a65',
    ['cone. coned. coning.', 'orange is a lifestyle.', 'safety third.'],
    [['reflective tape', 9, 'visible from space'], ['base weight', 38, 'unmovable'], ['road crew friends', 125, 'they nod at you now']]],
  ['WASHING MACHINE CLICKER', 'washing machine', 'lost socks', '#90caf9',
    ['round and round it goes.', 'where did the other sock go. nobody knows.', 'spin cycle enlightenment.'],
    [['delicate bag', 10, 'sock protection program'], ['extra rinse', 41, 'cleanliness plus'], ['dryer alliance', 150, 'the socks fear it']]],
  ["GRANDMA'S ARMCHAIR CLICKER", "grandma's armchair", 'stories', '#bcaaa4',
    ['sit. listen. click.', 'the springs know things.', 'comfort level: archival.'],
    [['afghan blanket', 8, 'handmade, indestructible'], ['tea service', 36, 'compulsory refills'], ['remote control rights', 120, 'ultimate authority']]]
];

function makeClicker(t, i) {
  let title = t[0], thing = t[1], unit = t[2], color = t[3], mileTexts, ups;
  if (t.length === 6) {
    mileTexts = t[4]; ups = t[5];
  } else {
    mileTexts = t[4][0]; ups = t[4][1];
  }
  const miles = [[5, mileTexts[0]], [15, mileTexts[1]], [30, mileTexts[2]]];
  const js = `
let n=0,passive=0;
const MILE=${JSON.stringify(miles)};
document.getElementById('big').addEventListener('click',()=>{
  n++;__beep(200+n*2,.06);
  const m=MILE.find(m=>m[0]===n);
  if(m)say(m[1]);
  upd();
});
document.querySelectorAll('.up').forEach(b=>b.addEventListener('click',()=>{
  const c=+b.dataset.cost;
  if(n<c)return;
  n-=c;passive+=.2;
  b.dataset.cost=Math.ceil(c*3);
  b.querySelector('.cs').textContent=b.dataset.cost;
  say(b.dataset.joke);
  upd();
}));
setInterval(()=>{if(passive){n+=passive;upd();}},1000);
function say(t){document.getElementById('say').textContent=t;}
function upd(){
  document.getElementById('count').textContent=Math.floor(n)+' ${unit}';
  document.querySelectorAll('.up').forEach(b=>b.disabled=n<+b.dataset.cost);
}
upd();`;
  const shop = ups.map(u => `<button class="up" data-cost="${u[1]}" data-joke="${u[2]}">${u[0]} (<span class="cs">${u[1]}</span>)</button>`).join('');
  const html = shell(title, baseCss('#12101c', color),
    `<h1>${title}</h1>
<button id="big" style="width:190px;height:190px;border-radius:50%;border:8px double ${color};background:#1c1830;font-size:2rem;color:${color};text-transform:uppercase">${thing}</button>
<div id="count" style="font-size:1.2rem">0 ${unit}</div>
<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${shop}</div>
<div id="say">click the ${thing}. that is the entire economy.</div>`,
    beep + js);
  return {
    file: `gen_clicker_${i}_${slug(title)}.html`, html, title,
    description: `A ${thing}. You click it. ${unit.charAt(0).toUpperCase() + unit.slice(1)} accumulate, the upgrade shop sells pure placebo (+0.2/sec of self-respect), and milestone messages judge you softly.\n\n"${mileTexts[2]}"`,
    tags: `clicker idle ${thing.split(' ')[0]}`
  };
}

// ================= RUNNER =================
const runnerThemes = [
  ['POTATO FLEEING THE MASHER', '#d4a373', 'masher heads', 'you were almost thanksgiving.'],
  ['SNAIL COMMUTE', '#a7f3d0', 'coffee spills', 'slow and steady still got splashed.'],
  ['BUSINESSMAN FLEEING MEETINGS', '#5c6bc0', 'calendar invites', 'this could have been an email (your death).'],
  ['ROOMBA VS THE STAIRS', '#e0e0e0', 'stair edges', 'cliff. it was a cliff all along.'],
  ['PENGUIN ESCAPING SUMMER', '#eceff1', 'heatwaves', 'tuxedo made of ice. bad combo.'],
  ['T-REX AVOIDING LEG DAY', '#ef9a9a', 'dumbbells', 'skipping legs caught up with you.'],
  ['WIZARD LATE FOR WIZARD SCHOOL', '#b39ddb', 'enchanted briefcases', 'detention (magical).'],
  ['MOP CHASING CLEANLINESS', '#cfd8dc', 'grime piles', 'the grime fights back.'],
  ['COW EN ROUTE TO MOON', '#fafafa', 'gravity anomalies', 'the moon was never real (it is).'],
  ['SKATEBOARD VS EVERY PEBBLE', '#ffab91', 'pebbles', 'the smallest enemy won.'],
  ['MAILMAN VS DOGS', '#ffe082', 'dogs', 'special delivery: regret.'],
  ['KNIGHT BURIED IN PAPERWORK', '#90caf9', 'scroll piles', 'death by bureaucracy.']
];

function makeRunner(t, i) {
  const [title, pc, on, death] = t;
  const taunts = ['nice hops. said nobody.', 'is that all the altitude you have?', 'my grandmother clears those. she is a rock.', 'jump timing: creative.', 'you call that a jump?'];
  const js = `
const c=document.getElementById('c'),x=c.getContext('2d');
let y=210,vy=0,jump=false,dist=0,obs=[],dead=false,tick=0,lastTaunt=0;
function press(e){if(e)e.preventDefault();if(dead){location.reload();return;}if(!jump){vy=-8.4;jump=true;__beep(500,.06);}}
addEventListener('keydown',e=>{if(e.code==='Space')press(e);});
c.addEventListener('pointerdown',press);
setInterval(()=>{
  tick++;if(dead)return;
  vy+=.5;y=Math.min(212,y+vy);if(y>=212){y=212;jump=false;}
  dist+=.22;
  if(tick%Math.max(38,70-Math.floor(dist/60))===0)obs.push({x:620,w:16+Math.random()*22,h:22+Math.random()*26});
  obs.forEach(o=>o.x-=3.2+dist/240);
  obs=obs.filter(o=>o.x>-50);
  for(const o of obs)if(86>o.x&&60<o.x+o.w&&y>232-o.h)return die();
  if(tick-lastTaunt>480){lastTaunt=tick;if(Math.random()<.6)say(TAUNTS[Math.floor(Math.random()*TAUNTS.length)]);}
},16);
function say(t){document.getElementById('say').textContent=t;}
function die(){
  dead=true;saysay('');
  const d=Math.floor(dist);
  document.getElementById('over').style.display='flex';
  document.getElementById('res').innerHTML='distance: '+d+'m<br><span class="mut">${death}</span><br><br><button onclick="location.reload()">RUN IT BACK</button>';
}
(function draw(){
  x.clearRect(0,0,600,260);
  x.fillStyle='#2b2b40';x.fillRect(0,236,600,24);
  x.fillStyle='${pc}';x.fillRect(60,y,26,26);
  x.fillStyle='#ef5350';
  for(const o of obs)x.fillRect(o.x,236-o.h,o.w,o.h);
  x.fillStyle='#fff';x.font='bold 15px Consolas';
  x.fillText(Math.floor(dist)+'m',14,24);
  requestAnimationFrame(draw);
})();`;
  const fixedJs = js.replace("saysay('');", "say('');");
  const html = shell(title, baseCss('#0f1220', pc) + `
  #over{display:none;position:absolute;inset:0;background:rgba(5,5,15,.88);align-items:center;justify-content:center;text-align:center}
  body{position:relative}`, 
   `<h1>${title}</h1>
<canvas id="c" width="600" height="260" style="border:4px solid ${pc};touch-action:none"></canvas>
<div id="say">space / tap to jump. the world is hostile.</div>
<div id="over"><div id="res"></div></div>`,
    `const TAUNTS=${JSON.stringify(taunts)};` + beep + fixedJs);
  return {
    file: `gen_runner_${i}_${slug(title)}.html`, html, title,
    description: `An endless runner with strong opinions. Jump over ${on}, endure unsolicited coaching from the commentary track.\n\nEnding: "${death}"`,
    tags: `runner jumping arcade`
  };
}

// ================= REACTION =================
const reactThemes = [
  ['RED LIGHT GREEN LIGHT', 'WAIT...', 'GO!', '#39ff88', 'you moved, doll.'],
  ['POPCORN WATCH', 'heating...', 'POP!', '#ffe600', 'that was just the microwave humming.'],
  ['CAT POUNCE TRAINING', 'tail twitches...', 'PUCE!', '#ff8a65', 'the cat saw you hesitate.'],
  ['MICROWAVE DING', 'spinning...', 'DING!', '#ffd54f', 'you opened it 0.4s early. shame.'],
  ['VOLCANO WATCH', 'rumbling...', 'ERUPTION!', '#ff7043', 'ash in your mouth. should have waited.'],
  ['TEACHER TURNING AROUND', 'writing on board...', 'TURNED!', '#4fc3f7', 'caught passing notes to yourself.'],
  ['THE SNEEZE', 'inhaling...', 'ACHOO!', '#b39ddb', 'false alarm. everyone stared anyway.'],
  ['SNAIL RACE START', 'on your marks...', 'CRAWL!', '#a7f3d0', 'you left before the gun. disgrace.'],
  ['COFFEE READY', 'brewing...', 'READY!', '#8d6e63', 'burnt tongue speedrun any%.'],
  ['DRAGON EYE', 'it stirs...', 'AWAKE!', '#ff5252', 'it heard your heart. it always does.']
];

function makeReact(t, i) {
  const [title, waitW, goW, gc, fail] = t;
  const js = `
let state='idle',goTime=0,best=null,total=0;
const b=document.getElementById('zone');
b.addEventListener('pointerdown',()=>{
  if(state==='idle')begin();
  else if(state==='wait')early();
  else hit();
});
function begin(){
  state='wait';b.style.background='#3a1c1c';b.textContent='${waitW}';
  document.getElementById('say').textContent='hold... hold...';
  setTimeout(()=>{
    if(state!=='wait')return;
    state='go';goTime=Date.now();
    b.style.background='${gc}';b.textContent='${goW}';
    __beep(900,.09);
  },1400+Math.random()*2600);
}
function early(){
  state='idle';b.style.background='#33121f';b.textContent='too soon.';
  document.getElementById('say').textContent='${fail}';
  setTimeout(begin,1600);
}
function hit(){
  const ms=Date.now()-goTime;total++;
  if(best===null||ms<best)best=ms;
  document.getElementById('bestEl').textContent='best this session: '+best+'ms';
  state='idle';b.style.background='#1c2333';
  if(total>=3){
    b.textContent='DONE.';
    b.textContent='DONE. verdict: '+rank(best);
    document.getElementById('say').textContent='best '+best+'ms across 3 rounds. '+rank(best);
    total=0;setTimeout(()=>{b.textContent='BEGIN NEW TRIALS';state='idle';},1600);
    return;
  }
  b.textContent='AGAIN ('+(3-total)+' left)';
  setTimeout(()=>{if(state==='idle')begin();},1200);
}
function rank(ms){return ms<250?'CERTIFIED QUICK.':ms<400?'respectable.':ms<700?'your ancestor was a sloth.':'did you leave?';}`;
  const html = shell(title, baseCss('#0c1020', gc),
    `<h1>${title}</h1>
<button id="zone" style="width:min(480px,88vw);height:200px;font-size:1.5rem;font-family:inherit;border:4px solid ${gc};color:#fff">BEGIN (3 rounds)</button>
<div id="bestEl">best this session: --</div>
<div id="say">click when you see "${goW.replace('!', '')}". early clicks are publicly mocked.</div>`,
    beep + js);
  return {
    file: `gen_react_${i}_${slug(title)}.html`, html, title,
    description: `Three-round reaction trial: wait for the signal, then click with everything you have. Early clickers receive personalized disappointment ("${fail}")`,
    tags: `reaction reflex quick`
  };
}

// ================= SIMULATOR =================
const simThemes = [
  ['DISHWASHING SIMULATOR', 'RUN CYCLE', 'the rack awaits.', 'first cycle: everything is clean except one fork.',
   [['a plastic lid has fused upside-down again', 'lid'], ['the wine glass holds 1ml of eternal suds', 'glass'], ['someone put a CAST IRON PAN in here. criminal.', 'pan'], ['the filter contains a civilization', 'filter'], ['steam escape. dramatic. unnecessary.', 'steam'], ['everything clean except the one you need', 'fork'], ['mystery tupperware returns to the void', 'tupperware'], ['cycle complete. the kitchen hums.', 'done']]],
  ['LAUNDRY DAY SIMULATOR', 'START LOAD', 'sort the piles. or do not. chaos either way.', 'whites and colors together. bold.',
   [['one sock entered the void', 'sock'], ['tissue exploded in a pocket', 'tissue'], ['the fitted sheet refuses the fold', 'sheet'], ['favorite shirt shrinks to cat size', 'shirt'], ['static cling: visible electrical arcs', 'static'], ['jeans take 4 hours to dry. why', 'jeans'], ['missing sock found in the OTHER shoe', 'shoe'], ['fold basket achieved (lasts 1 hour)', 'basket']]],
  ['OFFICE PRINTER 3000', 'SEND JOB', 'it knows fear. it spreads it.', 'paper loaded correctly. suspicious.',
   [['PC LOAD LETTER. nobody knows what it means', 'pcload'], ['jammed. the jam is load-bearing', 'jam'], ['printed 47 copies by itself', 'copies'], ['out of magenta (printing grayscale)', 'magenta'], ['someone printed their novel. all of it.', 'novel'], ['wifi printer disconnected from wifi', 'wifi'], ['stapler function: hostile', 'staple'], ['IT restarts it. peace restored. briefly.', 'it']]],
  ['WEATHER FORECASTER', 'PUBLISH FORECAST', 'predict the sky. apologize later.', 'sunny with a chance of being wrong.',
   [['predicted clear. hail happened', 'hail'], ['umbrella sales spiked thanks to you', 'sales'], ['the wind did something unlisted', 'wind'], ['70% chance of vibes', 'vibes'], ['cold front named after you (insultingly)', 'front'], ['radar shows a blob. explain the blob.', 'blob'], ['perfect forecast. nobody believed it.', 'perfect'], ['you jinxed the sunshine', 'jinx']]],
  ['BUS STOP PHILOSOPHER', 'CHECK SCHEDULE', 'the bus arrives eventually. philosophically.', 'timetable says 4 minutes. believe.',
   [['bus arrives as 3 people leave. tragic theater', 'bus'], ['someone stands too close to the edge', 'edge'], ['pigeon audits your snack', 'pigeon'], ['schedule updates to "soon"', 'soon'], ['two buses arrive together after 40 min', 'twin'], ['person asks if bus came. it did not', 'asker'], ['your bus is out of service visually', 'oops'], ['you walked. bus passed you smiling', 'walk']]],
  ['DMV QUEUE SURVIVOR', 'TAKE NUMBER', 'number 84. now serving: number 3.', 'the queue is a lifestyle.',
   [['number 3 goes to lunch mid-call', 'lunch'], ['wrong window. back of line rules apply', 'window'], ['forms available at window 12 (closed)', 'form'], ['pen attached by string. string fails', 'pen'], ['photo taken mid-sneeze forever', 'photo'], ['number close to yours called. cruel.', 'close'], ['counter clerk achieves flow state', 'flow'], ['finally served. forgot documents.', 'docs']]],
  ['HOUSEPLANT PARENT', 'WATER PLANT', 'fernald the fern depends on you.', 'watered. fernald forgives your absence.',
   [['dropped a leaf dramatically', 'leaf'], ['new sprout! pride unlimited', 'sprout'], ['yellow tip: google says over AND under watering', 'tip'], ['roots escaping the pot. ambitious.', 'roots'], ['dust wiped. photosynthesis improved 1%', 'dust'], ['moved closer to window. fernald sulks anyway', 'window'], ['gnats arrive. uninvited roommates', 'gnats'], ['fernald blooms once. never explains why', 'bloom']]],
  ['WIFI ROUTER TECHNICIAN', 'REBOOT ROUTER', 'have you tried turning it off and on.', 'lights blink cryptically.',
   [['2.4GHz works. 5GHz is shy', 'band'], ['one bar in the corner room forever', 'bar'], ['firmware updated. everything moved', 'firmware'], ['neighbor connects automatically?? ', 'neighbor'], ['router placed higher. signal worse. science.', 'height'], ['all lights green. internet still down', 'green'], ['turned off and on. fixed. hate that.', 'fix'], ['password sticky note lost to time', 'password']]],
  ['FAMILY GROUP CHAT SCROLLER', 'SCROLL CHAT', '47 unread. all caps. godspeed.', 'uncle shares minion meme #214',
   [['mom sends chain letter from 2009', 'chain'], ['aunt posts 24 photos of the same sunset', 'aunt'], ['someone replies "ok" to everything', 'ok'], ['cousin leaves chat. returns in 4 min', 'cousin'], ['recipe argument reaches day 3', 'recipe'], ['accidental voice message. 9 minutes.', 'voice'], ['grandpa discovers emojis', 'grandpa'], ['chat renamed "family love" again', 'rename']]],
  ['GARAGE SALE BARON', 'OPEN SALE', 'price everything at "make offer".', 'first customer arrives before the sign is up.',
   [['haggled down from $1 to free', 'free'], ['someone wants the box, not contents', 'box'], ['vintage junk rebranded "rustic"', 'rustic'], ['early bird flips your price tags over', 'bird'], ['the exercise bike finds no home', 'bike'], ['kid buys your childhood toy. emotional.', 'toy'], ['everything half price. still no buyers', 'half'], ['sold the display table. genius mistake.', 'table']]]
];

function makeSim(t, i) {
  const [title, action, empty, first, events] = t;
  const js = `
let opens=0;const seen=new Set();
const EVENTS=${JSON.stringify(events)};
document.getElementById('act').addEventListener('click',()=>{
  opens++;
  const inv=document.getElementById('inv');
  if(opens===1){inv.textContent='${first}';__beep(600,.07);}
  else if(seen.size<EVENTS.length&&Math.random()<.62){
    let e;do{e=EVENTS[Math.floor(Math.random()*EVENTS.length)];}while(seen.has(e[1]));
    seen.add(e[1]);inv.textContent=e[0];__beep(800,.06);
  }else inv.textContent='${empty}';
  document.getElementById('cnt').textContent='cycles: '+opens+' \\u00B7 discoveries: '+seen.size+'/${events.length}';
  if(seen.size===EVENTS.length)inv.textContent+=' \\u2014 YOU HAVE SEEN IT ALL.';
});`;
  const html = shell(title, baseCss('#111318', '#7fd1ff'),
    `<h1>${title}</h1>
<button id="act" style="font-size:1.1rem">${action}</button>
<div id="inv" style="min-height:56px;width:min(460px,90vw);text-align:center;color:#cfd8e3">${empty}</div>
<div id="cnt">cycles: 0 \u00B7 discoveries: 0/${events.length}</div>`,
    beep + js);
  return {
    file: `gen_sim_${i}_${slug(title)}.html`, html, title,
    description: `The most realistic simulator on the site. Press ${action.toLowerCase()} repeatedly; discover all ${events.length} true-to-life events hiding in the mundane.\n\nContains at least one emotionally accurate disaster.`,
    tags: `simulation idle mundane`
  };
}

// ================= PET =================
const petThemes = [
  ['GRUMPY STORM CLOUD', '\u26C8', 'pet the cloud', 'offer lightning', 'poke the cloud',
    ['a single drop falls. ominous.', 'the cloud darkens approvingly.', 'static shock. rude but fair.'],
    'the cloud rains exclusively on YOU. that is honor.',
    'permanent drizzle mode. the cloud cares, in its way.'],
  ['OFFICE FERN', '\u{1F33F}', 'water the fern', 'fertilize', 'shake the fern',
    ['frond wiggle detected.', 'the fern leans toward the window. it always leans.', 'soil moisture: philosophical.'],
    'fern achieves unmatched lushness. coworkers notice.',
    'fern droops pointedly in your direction.'],
  ['VENDING MACHINE', '\u{1F37A}', 'insert coin', 'kick the machine', 'press refund',
    ['a snack falls sideways. classic.', 'the spiral turns with great drama.', 'change rattles hopefully.'],
    'dispenses TWO snacks. a miracle. tell no one.',
    'eats coin. dispenses nothing. tradition upheld.'],
  ['OLD LAPTOP', '\u{1F4BB}', 'open the lid', 'plug in charger', 'install update',
    ['fan roars like a jet preparing.', 'battery: 4% forever.', 'updates configured: 37 of 3.'],
    'runs surprisingly fast. suspicious. what did you do.',
    'blue screen. it rests now.'],
  ['PARKING METER', '\u{1F576}', 'feed the meter', 'read the dial', 'jiggle the handle',
    ['15 minutes granted. mercy.', 'the dial ticks ominously.', 'expired flag rises majestically.'],
    'grace period granted. rare kindness from the meter gods.',
    'ticket appears instantly. brutal. efficient. brutal.'],
  ['GARDEN GNOME', '\u{1F9D9}', 'polish the gnome', 'relocate the gnome', 'question the gnome',
    ['hat gleams with dignity.', 'new post: guarding the tomatoes.', 'the beard holds ancient crumbs.'],
    'the gnome nods. you have been acknowledged.',
    'the gnome faces away. silent judgment.']
];

function makePet(t, i) {
  const [title, glyph, a1, a2, a3, pets, good, bad] = t;
  const feedLines = ['consumed greedily.', 'refueled with attitude.', 'accepts offering silently.'];
  const pokeLines = ['hey. watch it.', 'poked. seething.', 'how dare.'];
  const js = `
let mood=50;
const upd=()=>{const f=document.getElementById('fill');f.style.width=mood+'%';f.style.background=mood>=65?'#69f0ae':mood>=30?'#c792ea':'#ff5c5c';};
const say=t=>{document.getElementById('say').textContent=t;};
document.getElementById('b1').addEventListener('click',()=>{
  mood=Math.min(100,mood+7);upd();
  const p=${JSON.stringify(pets)}[Math.floor(Math.random()*${pets.length})];
  say(p);
  if(mood>=100)say(${JSON.stringify(good)});
});
document.getElementById('b2').addEventListener('click',()=>{
  mood=Math.min(100,mood+12);upd();
  say(${JSON.stringify(feedLines)}[Math.floor(Math.random()*3)]);
  if(mood>=100)say(${JSON.stringify(good)});
});
document.getElementById('b3').addEventListener('click',()=>{
  mood=Math.max(0,mood-20);upd();__beep(140,.1);
  say(${JSON.stringify(pokeLines)}[Math.floor(Math.random()*3)]);
  if(mood<=0)say(${JSON.stringify(bad)});
});
upd();`;
  const html = shell(title, baseCss('#131124', '#c792ea'),
    `<h1>${title}</h1>
<div style="font-size:5rem;height:96px;line-height:96px">${glyph}</div>
<div style="position:relative;width:min(300px,80vw);height:16px;border:3px solid #7a5cc7">
<div id="fill" style="height:100%;width:50%;background:#c792ea"></div></div>
<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button id="b1">${a1}</button><button id="b2">${a2}</button><button id="b3">${a3}</button></div>
<div id="say">it awaits your attention. reluctantly.</div>`,
    beep + js);
  return {
    file: `gen_pet_${i}_${slug(title)}.html`, html, title,
    description: `Care for a ${title.toLowerCase()} using three questionable caregiving techniques. Mood meter included; consequences emotional.\n\nBest outcome: "${good}"`,
    tags: `pet wholesome comedy`
  };
}

// ================= QUIZ =================
const quizThemes = [
  ['ARE YOU THE DRAMA?',
   [['Your friend cancels plans. You:', 'understand, life is hard', 'start a podcast about it', 'thank the universe'],
    ['Group chat quiet for 2 hours. You:', 'enjoy the silence', 'post a screenshot of the silence', 'assume they discuss you'],
    ['Someone got a haircut. You:', 'compliment sincerely', 'notice. file it away. wait.', 'ask if they lost a bet'],
    ['Pizza arrives wrong. You:', 'eat it, it is pizza', 'write a review novel', 'start a support group'],
    ['Your birthday approaches. You:', 'mention it once, casually', 'countdown in bio since June', 'hire a hype squad']],
   'CERTIFIED MAIN CHARACTER'],
  ['WHICH KITCHEN APPLIANCE ARE YOU?',
   [['Monday morning energy:', 'espresso scream', 'toaster optimism', 'dishwasher melancholy'],
    ['Ideal vacation:', 'countertop by the window', 'dark pantry retreat', 'plugged in, doing nothing'],
    ['Conflict handling:', 'vent steam loudly', 'defrost slowly', 'catch fire slightly'],
    ['People describe you as:', 'hot stuff', 'cool and running', 'full of hot air'],
    ['Retirement plan:', 'become vintage (valuable)', 'yard sale legend', 'haunt the landfill proudly']],
   'YOU ARE THE TOASTER OVEN (nobody expected it)'],
  ['WHAT DOES YOUR WALLET FEAR?',
   [['You approach a store. Your wallet:', 'hopes', 'prays', 'writes a will'],
    ['A SALE sign appears. You:', 'need nothing, buy everything', 'walk away stronger', 'buy the thing you already own'],
    ['Bank app notification:', 'ignore', 'open with one eye closed', 'it sent condolences'],
    ['Receipts are:', 'kept in a shoebox shrine', 'lost to the void', 'emotional damage receipts'],
    ['Budgeting means:', 'spreadsheet paradise', 'vibes-based accounting', 'what is budget']],
   'YOUR WALLET FEARS TUESDAYS SPECIFICALLY'],
  ['HISTORY EXAM (MADE UP)',
   [['The Treaty of Waffles (1789) established:', 'breakfast borders', 'napkin diplomacy', 'the right to soggy bottoms'],
    ['Napoleon was finally defeated by:', 'a very cold Sunday', 'an army of geese', 'paperwork'],
    ['The Renaissance began when:', 'someone found a good pencil', 'art got hungry', 'a duke said yes to fonts'],
    ['Great Wall defense strategy:', 'stairs, but many', 'very tall discouragement','moat (dry)'],
    ['Ancient scrolls were mostly:', 'recipes', 'complaints about neighbors', 'both']],
   'GRADE: F+ (THE PLUS IS PITY)'],
  ['SPACE LAW BAR EXAM',
   [['An astronaut litters in orbit. Jurisdiction:', 'the moon claims it', 'space trash, space case', 'whoever catches it first'],
    ['Two satellites collide. Fault:', 'the one going up', 'physics', 'both pay a star fine'],
    ['Aliens land requesting asylum:', 'offer them a form', 'intergalactic waters! free!', 'bill their planet'],
    ['Moon real estate deeds are:', 'legally adorable', 'enforceable by telescope', 'valid if notarized twice'],
    ['Define "outer space":', 'outside', 'above 100km, allegedly', 'where wifi dies']],
   'BAR PASSED. SPACE DISBARRED.']
];

function makeQuiz(t, i) {
  const [title, qs, finalTitle] = t;
  const roasts = ['interesting choice. wrong, but interesting.', 'bold. incorrect. bold.', 'the committee wrote that down. laughed.', 'science has notes.', 'your therapist will hear about this.'];
  const js = `
let q=0;
const QS=${JSON.stringify(qs)};
function render(){
  if(q>=QS.length){
    document.getElementById('quiz').innerHTML='<div style="text-align:center"><b style="color:#ffe600;font-size:1.15rem">'+FINAL+'</b><br><br><span style="color:#9281bd">accuracy: irrelevant.<br>confidence: measured and alarming.</span><br><br><button onclick="location.reload()">RETAKE (results identical)</button></div>';
    return;
  }
  document.getElementById('qq').textContent=(q+1)+'/'+QS.length+'. '+QS[q][0];
  const opts=document.getElementById('opts');
  opts.innerHTML='';
  QS[q].slice(1).forEach(a=>{
    const b=document.createElement('button');
    b.textContent=a;b.style.width='100%';
    b.addEventListener('click',()=>{
      document.getElementById('roast').textContent=ROASTS[q%ROASTS.length];
      q++;
      setTimeout(render,850);
      __beep(300,.05);
    });
    opts.appendChild(b);
  });
  document.getElementById('roast').textContent='';
}
render();`;
  const html = shell(title, baseCss('#171225', '#ff6ec7'),
    `<h1>${title}</h1>
<div id="quiz" style="width:min(460px,92vw)">
  <div id="qq" style="min-height:44px;font-size:1.08rem;text-align:center"></div>
  <div id="opts" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div>
  <div id="roast" style="min-height:24px;text-align:center;color:#9281bd;font-size:.9rem"></div>
</div>`,
    `const ROASTS=${JSON.stringify(roasts)};\nconst FINAL=${JSON.stringify(finalTitle)};\n` + beep + js);
  return {
    file: `gen_quiz_${i}_${slug(title)}.html`, html, title,
    description: `Five deeply official questions. Every answer is wrong; some are wronger. Gentle narration, merciless verdict.\n\nFinal verdict: "${finalTitle}"`,
    tags: `quiz personality comedy`
  };
}

// ================= BALANCE =================
const balThemes = [
  ['SOUP ON YOUR HEAD', 'while walking. why.', 'LEFT HAND', 'RIGHT HAND', ['gust of wind', 'you blinked', 'a bird looked at you', 'thought about soup']],
  ['SEESAW WITH AN ELEPHANT', 'the elephant is not helping.', 'LEAN BACK', 'LEAN FORWARD', ['elephant shifted', 'elephant exhaled', 'elephant had an idea', 'gravity took sides']],
  ['TIGHTROPE RACCOON', 'trash in one paw, destiny in the other.', 'DIP LEFT', 'DIP RIGHT', ['crowd gasped', 'wind from popcorn fan', 'supportive raccoon arrived', 'existential thought']],
  ['STACK OF PLATES', 'wedding china. no pressure.', 'STEADY LEFT', 'STEADY RIGHT', ['door slammed', 'tiny personal earthquake', 'dishwasher jealousy', 'a plate sighed']],
  ['PING-PONG PADDLE BALL', 'how long can you keep it going.', 'ANGLE UP', 'ANGLE DOWN', ['sweat drip', 'fan across the gym', 'opponent psychically taunted', 'ball considered options']]
];

function makeBal(t, i) {
  const [title, sub, l, r, gusts] = t;
  const js = `
let pos=0,vel=0,alive=true,t0=Date.now(),best=0;
const bar=document.getElementById('fill');
function loop(){
  if(!alive)return;
  vel+=(Math.random()-.5)*.95;
  vel*=.985;
  pos+=vel;
  if(pos>100||pos<-100)return die();
  bar.style.width=Math.abs(pos)+'%';
  bar.style.left=pos<0?(50+pos/2)+'%':'50%';
  bar.style.background=Math.abs(pos)>70?'#ff5c5c':'#39ff88';
  requestAnimationFrame(loop);
}
function push(d){if(alive)vel+=d;}
document.getElementById('l').addEventListener('pointerdown',()=>push(-1.7));
document.getElementById('r').addEventListener('pointerdown',()=>push(1.7));
addEventListener('keydown',e=>{if(e.key==='ArrowLeft')push(-1.7);if(e.key==='ArrowRight')push(1.7);});
setInterval(()=>{
  if(alive&&Math.random()<.45){
    const g=GUSTS[Math.floor(Math.random()*GUSTS.length)];
    document.getElementById('say').textContent=g+'!';
  }
},1800);
function die(){
  alive=false;
  const sec=((Date.now()-t0)/1000).toFixed(1);
  best=Math.max(best,+sec);
  document.getElementById('say').innerHTML='lasted '+sec+'s (record '+best+'s). it hit the floor.<br><br><button onclick="location.reload()">REBALANCE</button>';
  __beep(120,.25,'sawtooth');
}
document.getElementById('say').textContent='${sub}';
loop();`;
  const fullJs = `const GUSTS=${JSON.stringify(gusts)};\n` + beep + js;
  const html = shell(title, baseCss('#161019', '#39ff88'),
    `<h1>${title}</h1>
<div style="color:#9281bd">${sub}</div>
<div style="position:relative;width:min(440px,88vw);height:30px;border:3px solid #39446b;background:#0d1120">
  <div id="fill" style="position:absolute;top:0;height:100%;width:0%;left:50%;background:#39ff88"></div>
</div>
<div style="display:flex;gap:40px"><button id="l">\u2190 ${l}</button><button id="r">${r} \u2192</button></div>
<div id="say"></div>`,
    fullJs);
  return {
    file: `gen_bal_${i}_${slug(title)}.html`, html, title,
    description: `Keep the meter centered while reality interferes. Gusts include "${gusts[2]}" and "${gusts[3]}". Controls: ${l.toLowerCase()} / ${r.toLowerCase()} buttons or arrow keys.\n\nPhysics rating: emotionally accurate.`,
    tags: `balance skill reflex`
  };
}

// ---------------- build ----------------
const catalog = [];
dodgeThemes.forEach((t, i) => catalog.push(makeDodge(t, i)));
clickerThemes.forEach((t, i) => catalog.push(makeClicker(t, i)));
runnerThemes.forEach((t, i) => catalog.push(makeRunner(t, i)));
reactThemes.forEach((t, i) => catalog.push(makeReact(t, i)));
simThemes.forEach((t, i) => catalog.push(makeSim(t, i)));
petThemes.forEach((t, i) => catalog.push(makePet(t, i)));
quizThemes.forEach((t, i) => catalog.push(makeQuiz(t, i)));
balThemes.forEach((t, i) => catalog.push(makeBal(t, i)));

for (const g of catalog) {
  fs.writeFileSync(path.join(OUT, g.file), g.html);
}
fs.writeFileSync(
  path.join(OUT, 'gen-catalog.json'),
  JSON.stringify(catalog.map(({ html, ...meta }) => meta), null, 1)
);
console.log(`GAME-O-MATIC: wrote ${catalog.length} games (${catalog.filter(g => g.file.includes('dodge')).length} dodge / ${catalog.filter(g => g.file.includes('clicker')).length} clicker / ${catalog.filter(g => g.file.includes('runner')).length} runner / ${catalog.filter(g => g.file.includes('react')).length} reaction / ${catalog.filter(g => g.file.includes('sim')).length} simulator / ${catalog.filter(g => g.file.includes('pet')).length} pet / ${catalog.filter(g => g.file.includes('quiz')).length} quiz / ${catalog.filter(g => g.file.includes('bal_')).length} balance)`);
