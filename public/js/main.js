let state = { q: '', tag: '', sort: 'new', page: 1 };

// Real 4-letter words forged from each game's own title letters.
// If a title can't spell one, letters are borrowed from the whole arcade.
const WORDS=['able','acid','aged','also','army','away','baby','back','ball','band','bank','base','bath','bear','beat','beer','bell','belt','best','bike','bird','bite','blue','blow','boat','body','bold','bone','book','boom','boot','born','both','burn','busy','cake','call','calm','camp','card','care','cart','case','cash','cast','cave','chat','chip','city','clip','club','coal','code','coin','cold','cook','cool','core','corn','cost','crew','crop','cure','dark','dart','dawn','dead','deal','dear','debt','deep','deer','dent','dial','dice','diet','dirt','dish','disk','done','door','dose','down','drag','draw','drop','drug','dual','duck','dull','dune','dusk','dust','duty','each','earn','ease','east','easy','echo','edge','envy','epic','even','ever','evil','exit','face','fact','fade','fail','fair','fall','fame','farm','fast','fate','fear','feed','feel','fell','felt','file','fill','film','find','fine','fire','firm','fish','fish','five','flag','flat','flee','flip','flow','fold','folk','food','fool','foot','ford','fork','form','four','free','frog','fuel','full','gain','game','gate','gear','gift','girl','give','glad','glow','goal','goat','gold','golf','gone','good','grab','gray','grew','grim','grin','grid','grow','hair','half','hall','halt','hand','hang','hard','harm','hate','haul','head','heal','heap','hear','heat','held','hell','helm','help','herb','here','hero','hide','high','hill','hint','hire','hold','hole','home','hood','hook','hope','horn','hour','huge','hunt','hurt','icon','idea','idle','inch','into','iron','item','jade','jail','jazz','join','joke','jolt','jump','jury','just','keen','keep','kick','kind','king','kiss','kite','knee','knew','knit','knob','knot','know','lace','lack','lady','laid','lake','lamb','lamp','land','lane','last','late','lava','lawn','lazy','lead','leaf','leak','lean','leap','left','lend','lens','less','lift','like','lime','line','link','lion','list','live','load','loaf','loan','lock','loft','logo','lone','long','look','loop','lord','lose','loss','lost','loud','love','luck','lung','made','mail','main','make','male','mall','many','mark','mask','mass','mate','maze','meal','mean','meat','meet','melt','memo','mend','menu','mere','mess','mild','mile','milk','mill','mind','mine','mint','miss','mist','mode','mold','mole','moon','more','moss','most','moth','move','much','mule','must','myth','nail','name','navy','near','neat','neck','need','nest','news','next','nice','nine','none','noon','nose','note','noun','oath','obey','once','only','onto','open','oral','oval','oven','over','pace','pack','page','paid','pain','pair','pale','palm','park','part','pass','past','path','peak','pear','peel','peer','pier','pile','pill','pine','pink','pipe','plan','play','plot','plug','plum','plus','poem','pole','poll','pond','pony','pool','poor','pork','port','pose','post','pour','prey','pull','pump','pure','push','quit','quiz','race','rack','raft','rage','raid','rail','rain','rank','rate','read','reef','rely','rent','rest','rice','rich','ride','ring','riot','rise','risk','road','roar','rock','role','roll','roof','room','root','rope','rose','ruby','rude','ruin','rule','rush','rust','safe','sage','said','sail','sale','salt','same','sand','save','scan','seal','seat','seed','seek','self','sell','send','sent','shed','ship','shoe','shop','shot','show','shut','sick','side','sigh','sign','silk','sing','sink','site','size','skin','skip','slam','slap','slid','slim','slip','slot','slow','snap','snow','soap','soak','soar','sock','soda','soft','soil','sold','sole','some','song','soon','sore','sort','soul','soup','spin','spot','star','stay','stem','step','stew','stop','such','suit','sung','sunk','sure','surf','swap','swim','tail','take','tale','talk','tall','tank','tape','task','taxi','team','tear','tech','tell','tend','tent','term','test','text','than','that','thaw','them','then','thin','this','thus','tick','tide','tidy','tile','tilt','time','tiny','tire','toad','toll','tomb','tone','tool','tore','tour','town','trap','tray','tree','trim','trip','true','tube','tuna','tune','turn','twin','type','ugly','undo','unit','upon','urge','used','vain','vase','vast','veil','verb','very','vibe','view','vine','visa','void','vote','wage','wait','wake','walk','wall','wand','want','ward','warm','warn','wash','wasp','wave','weak','wear','weed','week','weep','well','went','were','west','what','when','whip','whom','wide','wife','wild','will','wind','wine','wing','wipe','wire','wise','wish','with','wolf','wood','wool','word','work','worm','worn','wrap','yard','yarn','yawn','year','yell','your','zero','zoom'];
function letterCounts(s){
  const m={};
  for(const ch of s.toLowerCase())if(ch>='a'&&ch<='z')m[ch]=(m[ch]||0)+1;
  return m;
}
function canSpell(word,counts){
  const need={};
  for(const ch of word){
    need[ch]=(need[ch]||0)+1;
    if((counts[ch]||0)<need[ch])return false;
  }
  return true;
}
let arcadeBag=null;
function phWord(title,allTitles){
  const own=canSpell.cached||(canSpell.cached={});
  let cand=WORDS.filter(w=>canSpell(w,letterCounts(title)));
  if(!cand.length&&allTitles){
    if(!arcadeBag)arcadeBag=letterCounts(allTitles.join(' '));
    cand=WORDS.filter(w=>canSpell(w,arcadeBag));
  }
  if(!cand.length)return 'PLAY';
  let h=0;for(const ch of title)h=((h*31)+ch.charCodeAt(0))>>>0;
  return cand[h%cand.length].toUpperCase();
}
function cardHtml(g) {
  const thumb = g.screenshot
    ? `<img class="card-thumb" src="${escapeHtml(g.screenshot)}" alt="" loading="lazy">`
    : (() => `<div class="card-thumb-placeholder"><span class="ph-letter" style="font-size:1.02rem">${escapeHtml(phWord(g.title, window.__allTitles))}</span></div>`)();
  const tags = g.tags.map(t => `<span class="mini-tag">${escapeHtml(t)}</span>`).join('');
  return `
  <div class="card">
    <a href="/game.html?id=${g.id}">${thumb}</a>
    <div class="card-body">
      <h3 class="card-title"><a href="/game.html?id=${g.id}">${escapeHtml(g.title)}</a></h3>
      <div class="card-byline">by ${escapeHtml(g.author)} &middot; ${timeAgo(g.created_at)}</div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      <div class="card-stats">
        ${starsDisplay(g.rating)} <span>${g.rating || '&ndash;'}</span>
        <span>&hearts; ${g.likes}</span>
        <span>&#9654; ${g.views}</span>
      </div>
    </div>
  </div>`;
}

async function loadGames() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  params.set('sort', state.sort);
  params.set('page', state.page);

  const grid = document.getElementById('games');
  grid.innerHTML = '<div class="empty-state"><h3>Loading...</h3></div>';

  try {
    const data = await api(`/games?${params}`);
    window.__allTitles = data.games.map(g => g.title).concat(window.__allTitles || []);
    renderPager(data.page, data.pages, data.total);
    if (!data.games.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No games here yet</h3>
          <p>Be the first! <a href="/upload.html">Upload your game</a> and kick things off.</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.games.map(cardHtml).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderPager(page, pages, total) {
  let pager = document.getElementById('pager');
  if (!pager) {
    pager = document.createElement('div');
    pager.id = 'pager';
    pager.className = 'pager';
    document.getElementById('games').after(pager);
  }
  if (pages <= 1) {
    if (total > 0) pager.innerHTML = `<span class="muted">${total} game${total === 1 ? '' : 's'}</span>`;
    else pager.innerHTML = '';
    return;
  }
  pager.innerHTML = `
    <button class="btn btn-sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>&#9664; Prev</button>
    <span class="muted">Page ${page} / ${pages}</span>
    <button class="btn btn-sm" id="pg-next" ${page >= pages ? 'disabled' : ''}>Next &#9654;</button>`;
  const go = (p) => { state.page = p; loadGames(); window.scrollTo({ top: 0 }); };
  document.getElementById('pg-prev').addEventListener('click', () => go(page - 1));
  document.getElementById('pg-next').addEventListener('click', () => go(page + 1));
}

async function loadTags() {
  const { tags } = await api('/games/tags/popular');
  const el = document.getElementById('tags');
  el.innerHTML = tags.map(t =>
    `<button class="chip${state.tag === t.tag ? ' active' : ''}" data-tag="${escapeHtml(t.tag)}">${escapeHtml(t.tag)} (${t.n})</button>`
  ).join('');
}

document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(window.__searchTimer);
  window.__searchTimer = setTimeout(() => {
    state.q = e.target.value.trim(); state.page = 1; loadGames();
  }, 300);
});

document.getElementById('sort').addEventListener('change', (e) => {
  state.sort = e.target.value; state.page = 1; loadGames();
});

document.getElementById('tags').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.tag = state.tag === chip.dataset.tag ? '' : chip.dataset.tag;
  state.page = 1;
  loadTags();
  loadGames();
});

loadTags().catch(() => {});
loadGames();
