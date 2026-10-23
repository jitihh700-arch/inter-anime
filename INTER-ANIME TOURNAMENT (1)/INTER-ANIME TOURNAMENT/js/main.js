import { ROSTER, PLAYABLE, byId } from './engine/roster.js';
import { Match, simulateBout, MAX_HP } from './engine/sim.js';
import { makeAI, AI_LEVELS } from './engine/ai.js';
import { Stage } from './render/stage.js';
import { Input } from './input.js';
import { sfx, sound } from './sound.js';

const $ = (id) => document.getElementById(id);
const stage = new Stage($('stage'));
const input = new Input(stage);
input.bindTouch($('touch'));

const ROUND_NAMES = ['QUARTERFINALS', 'SEMIFINALS', 'FINAL'];
const ROUND_SHORT = ['Quarterfinal', 'Semifinal', 'Final'];
const ARCADE_LEN = 7;

const app = {
  mode: 'versus', difficulty: 1, mirror: false,
  p1: null, cpu: null, selStep: 'p1', cursor: 'goku',
  match: null, running: false, paused: false, acc: 0,
  ctx: null, arcade: null, tour: null, lastArgs: null,
};

// ------------------------------------------------------------------ helpers
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clampLv = (v) => Math.max(0, Math.min(2, v));
function portraitHTML(def) {
  if (!def || def.reserved) return '<div class="pimg ph" style="background:linear-gradient(135deg,#1c1840,#0c0a1e)">?</div>';
  if (def.portrait) return `<div class="pimg" style="background-image:url('${def.portrait}')"></div>`;
  const [a, b] = def.portraitColors || ['#333', '#777'];
  const ini = def.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return `<div class="pimg ph" style="background:linear-gradient(160deg,${a},${b})">${ini}</div>`;
}
const SCREENS = ['title', 'select', 'ladder', 'bracket', 'vs', 'hud', 'pause', 'result', 'champion', 'controls'];
function show(...ids) {
  for (const s of SCREENS) $(s).classList.toggle('active', ids.includes(s));
  document.body.classList.toggle('in-match', ids.includes('hud'));
}
function on(id, fn) { $(id).addEventListener('click', (e) => { sfx.unlock(); sfx.ui(); fn(e); }); }

// ------------------------------------------------------------------ title
document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
  sfx.unlock(); sfx.ui();
  const n = b.dataset.nav;
  if (n === 'controls') { app.controlsBack = 'title'; show('title', 'controls'); }
  else if (n === 'sound') { sound.on = !sound.on; $('soundBtn').textContent = `Sound: ${sound.on ? 'On' : 'Off'}`; }
  else openSelect(n);
}));
on('ctlClose', () => show(app.controlsBack || 'title'));

// ------------------------------------------------------------------ select
function openSelect(mode) {
  stopMatch();
  app.mode = mode; app.selStep = 'p1'; app.cpu = null;
  app.cursor = app.p1 || 'goku'; app.p1 = null;
  $('selMode').textContent = mode === 'versus' ? 'VERSUS' : mode === 'arcade' ? 'ARCADE MODE' : 'TOURNAMENT MODE';
  $('mirrorWrap').style.display = mode === 'versus' ? '' : 'none';
  show('select');
  renderSelect();
}
function cardDisabled(def) {
  if (def.reserved) return false;
  return app.selStep === 'cpu' && !app.mirror && def.id === app.p1;
}
function renderSelect() {
  $('selTitle').textContent = app.selStep === 'p1' ? 'CHOOSE YOUR FIGHTER' : 'CHOOSE YOUR CPU OPPONENT';
  document.querySelectorAll('#diffSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.diff === app.difficulty));
  $('mirrorChk').checked = app.mirror;
  const g = $('grid');
  g.innerHTML = ROSTER.map((d) => {
    const cls = ['card'];
    if (d.reserved) cls.push('reserved');
    if (d.id === app.cursor) cls.push('sel');
    if (d.id === app.p1) cls.push('p1pick');
    if (d.id === app.cpu) cls.push('cpupick');
    if (cardDisabled(d)) cls.push('disabled');
    const inner = d.reserved ? '<div class="q">?</div>' : portraitHTML(d);
    return `<button class="${cls.join(' ')}" data-id="${d.id}" aria-label="${d.name}"><span class="cslot">${String(d.slot).padStart(2, '0')}</span>${inner}<span class="cname">${d.name}</span></button>`;
  }).join('');
  g.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('click', () => { sfx.unlock(); sfx.ui(); setCursor(c.dataset.id); });
    c.addEventListener('dblclick', () => confirmSelect());
  });
  renderInfo(app.cursor);
  const p1 = app.p1 ? byId(app.p1).name : '—';
  const cpu = app.cpu ? byId(app.cpu).name : (app.selStep === 'cpu' && app.cursor ? byId(app.cursor).name + '?' : '—');
  $('picks').innerHTML = `<span><span class="tag p1">P1</span>${app.selStep === 'p1' && !app.p1 ? byId(app.cursor).name + '?' : p1}</span>` +
    (app.mode === 'versus' ? `<span><span class="tag cpu">CPU</span>${cpu}</span>` : `<span><span class="tag cpu">CPU</span>${AI_LEVELS[app.difficulty].name} difficulty</span>`);
  const cur = byId(app.cursor);
  $('selConfirm').disabled = !cur || cur.reserved || cardDisabled(cur);
}
function setCursor(id) { app.cursor = id; renderSelect(); }
function renderInfo(id) {
  const d = byId(id);
  $('infoPortrait').innerHTML = portraitHTML(d);
  $('infoSlot').textContent = `SLOT ${String(d.slot).padStart(2, '0')} / 17`;
  $('infoName').textContent = d.name;
  if (d.reserved) {
    $('infoSeries').textContent = 'Reserved slot';
    $('infoStyle').textContent = 'To be revealed.';
    $('infoSpecial').textContent = 'This slot unlocks once the new fighter\'s profile and moves have been added. It can\'t be selected yet.';
    $('infoStats').innerHTML = '';
    return;
  }
  $('infoSeries').textContent = d.series;
  $('infoStyle').textContent = d.style;
  $('infoSpecial').innerHTML = `<b>${d.special.name}</b>: ${d.special.desc} <span style="opacity:.7">(cooldown ${d.special.cooldown}s)</span>`;
  const s = d.stats;
  const bar = (label, v) => `<span>${label}</span><span class="sb"><i style="width:${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%"></i></span>`;
  $('infoStats').innerHTML = bar('Speed', (s.speed - 6.2) / 2.2) + bar('Power', (s.heavy - 70) / 50) + bar('Reach', (s.heavyRange - 1.8) / 1.2) + bar('Weight', s.weight / 0.5);
}
function confirmSelect() {
  const d = byId(app.cursor);
  if (!d || d.reserved || cardDisabled(d)) return;
  if (app.selStep === 'p1') {
    app.p1 = d.id;
    if (app.mode === 'versus') {
      app.selStep = 'cpu';
      if (!app.mirror) { const pool = PLAYABLE.filter((x) => x.id !== app.p1); app.cursor = pool[(Math.random() * pool.length) | 0].id; }
      renderSelect();
    } else if (app.mode === 'arcade') startArcade();
    else startTournament();
  } else {
    app.cpu = d.id;
    startVersus();
  }
}
on('selConfirm', confirmSelect);
on('selRandom', () => {
  const pool = PLAYABLE.filter((x) => !cardDisabled(x));
  app.cursor = pool[(Math.random() * pool.length) | 0].id;
  renderSelect();
  setTimeout(confirmSelect, 250);
});
on('selBack', () => {
  if (app.selStep === 'cpu') { app.selStep = 'p1'; app.cursor = app.p1; app.p1 = null; app.cpu = null; renderSelect(); }
  else show('title');
});
document.querySelectorAll('#diffSeg button').forEach((b) => b.addEventListener('click', () => { sfx.ui(); app.difficulty = +b.dataset.diff; renderSelect(); }));
$('mirrorChk').addEventListener('change', (e) => { app.mirror = e.target.checked; renderSelect(); });
window.addEventListener('keydown', (e) => {
  if (!$('select').classList.contains('active')) return;
  const ids = ROSTER.map((d) => d.id);
  const cols = getComputedStyle($('grid')).gridTemplateColumns.split(' ').length;
  let i = ids.indexOf(app.cursor);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') i = Math.min(ids.length - 1, i + 1);
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') i = Math.max(0, i - 1);
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') i = Math.min(ids.length - 1, i + cols);
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') i = Math.max(0, i - cols);
  else if (e.code === 'Enter' || e.code === 'KeyJ') { confirmSelect(); return; }
  else if (e.code === 'Escape' || e.code === 'Backspace') { $('selBack').click(); return; }
  else return;
  e.preventDefault(); setCursor(ids[i]);
});

// ------------------------------------------------------------------ versus
function startVersus() {
  playMatch(app.p1, app.cpu, app.difficulty, { type: 'versus', label: `VERSUS · ${AI_LEVELS[app.difficulty].name.toUpperCase()}` });
}

// ------------------------------------------------------------------ arcade
function startArcade() {
  const others = shuffle(PLAYABLE.map((d) => d.id).filter((id) => id !== app.p1));
  const boss = app.p1 !== 'gogeta' ? 'gogeta' : others[0];
  const ladder = others.filter((id) => id !== boss).slice(0, ARCADE_LEN - 1).concat(boss);
  app.arcade = { ladder, stage: 0, wins: 0, losses: 0 };
  showLadder();
}
function arcadeLevel(i) { return clampLv(app.difficulty + (i >= 3 ? 1 : 0) + (i === ARCADE_LEN - 1 ? 1 : 0)); }
function showLadder() {
  const A = app.arcade;
  $('ladderTitle').textContent = `STAGE ${A.stage + 1} / ${ARCADE_LEN}`;
  $('ladderRow').innerHTML = A.ladder.map((id, i) => {
    const d = byId(id);
    const cls = ['lad', i < A.stage ? 'done' : '', i === A.stage ? 'cur' : '', i === ARCADE_LEN - 1 ? 'boss' : ''].join(' ');
    return `<div class="${cls}">${portraitHTML(d)}<span class="lnum">${i + 1}</span><span class="lname">${d.name}</span></div>`;
  }).join('');
  const n = byId(A.ladder[A.stage]);
  $('ladderNext').innerHTML = `${byId(app.p1).name} vs <b>${n.name}</b>${A.stage === ARCADE_LEN - 1 ? ' (final challenger)' : ''}. Their special: ${n.special.name}. CPU: ${AI_LEVELS[arcadeLevel(A.stage)].name}.`;
  $('ladderRecord').textContent = `Record: ${A.wins} win${A.wins === 1 ? '' : 's'} · ${A.losses} loss${A.losses === 1 ? '' : 'es'}`;
  show('ladder');
}
on('ladderFight', () => {
  const A = app.arcade;
  playMatch(app.p1, A.ladder[A.stage], arcadeLevel(A.stage), { type: 'arcade', label: `ARCADE · STAGE ${A.stage + 1}/${ARCADE_LEN}` });
});
on('ladderQuit', () => show('title'));

// ------------------------------------------------------------------ tournament
function startTournament() {
  const others = shuffle(PLAYABLE.map((d) => d.id).filter((id) => id !== app.p1)).slice(0, 7);
  const entrants = shuffle([app.p1, ...others]);
  const rounds = [
    [0, 1, 2, 3].map((i) => ({ a: entrants[i * 2], b: entrants[i * 2 + 1], winner: null, res: '' })),
    [0, 1].map(() => ({ a: null, b: null, winner: null, res: '' })),
    [{ a: null, b: null, winner: null, res: '' }],
  ];
  app.tour = { entrants, rounds, round: 0, retries: 0, wins: 0, log: [] };
  showBracket();
}
function tourMatchOfPlayer() { return app.tour.rounds[app.tour.round].find((m) => m.a === app.p1 || m.b === app.p1); }
function tourLevel() { return clampLv(app.difficulty + (app.tour.round >= 1 ? 1 : 0) - (app.tour.round === 0 && app.difficulty === 2 ? 0 : 0)); }
function showBracket() {
  const T = app.tour;
  $('bracketTitle').textContent = ROUND_NAMES[T.round];
  const pm = tourMatchOfPlayer();
  const entry = (id, m) => {
    if (!id) return '<div class="be"><span style="opacity:.4">—</span></div>';
    const d = byId(id);
    const cls = ['be', m.winner ? (m.winner === id ? 'win' : 'lose') : '', id === app.p1 ? 'you' : ''].join(' ');
    const res = m.winner === id && m.res ? `<span class="hpres">${m.res}</span>` : '';
    return `<div class="${cls}">${portraitHTML(d)}<span>${d.name}</span>${res}</div>`;
  };
  const col = (r, title) => `<div class="bcol"><h4>${title}</h4>${T.rounds[r].map((m) => `<div class="bm ${m === pm ? 'next' : ''} ${(m.a === app.p1 || m.b === app.p1) ? 'player' : ''}">${entry(m.a, m)}${entry(m.b, m)}</div>`).join('')}</div>`;
  const champ = T.rounds[2][0].winner;
  $('bracketView').innerHTML = col(0, 'QUARTERFINALS') + col(1, 'SEMIFINALS') + col(2, 'FINAL') +
    `<div class="bcol"><h4>CHAMPION</h4><div class="champ-slot">${champ ? byId(champ).name : '?'}</div></div>`;
  $('bracketLog').innerHTML = T.log.length ? T.log.slice(-3).join('<br>') : 'Quarterfinal draw is set. Every match is decided by a real fight in the arena.';
  const opp = pm ? (pm.a === app.p1 ? pm.b : pm.a) : null;
  $('bracketFight').textContent = opp ? `Fight ${ROUND_SHORT[T.round]} vs ${byId(opp).name}` : 'Fight!';
  show('bracket');
}
on('bracketFight', () => {
  const pm = tourMatchOfPlayer(); if (!pm) return;
  const opp = pm.a === app.p1 ? pm.b : pm.a;
  playMatch(app.p1, opp, tourLevel(), { type: 'tournament', label: `TOURNAMENT · ${ROUND_NAMES[app.tour.round]}` });
});
on('bracketQuit', () => show('title'));

function tourAdvanceAfterPlayerWin(result) {
  const T = app.tour, r = T.round;
  const pm = tourMatchOfPlayer();
  pm.winner = app.p1; pm.res = `${result.reason} · ${result.hp} HP`;
  T.wins++;
  const lines = [];
  // the other matches of this round are fought CPU vs CPU with the same engine and rules
  for (const m of T.rounds[r]) {
    if (m.winner) continue;
    const lv = clampLv(app.difficulty);
    const out = simulateBout(byId(m.a), byId(m.b), makeAI, lv, lv);
    m.winner = out.winner === 0 ? m.a : m.b;
    const loser = out.winner === 0 ? m.b : m.a;
    m.res = `${out.reason} · ${out.hp[out.winner]} HP`;
    lines.push(`${byId(m.winner).name} defeated ${byId(loser).name} (${out.reason}, ${out.hp[out.winner]} HP left, ${Math.round(out.time)}s)`);
  }
  T.log = lines.length ? lines.map((l) => `${ROUND_SHORT[r]}: ${l}`) : [];
  if (r < 2) {
    T.rounds[r].forEach((m, i) => { const nx = T.rounds[r + 1][i >> 1]; if (i % 2 === 0) nx.a = m.winner; else nx.b = m.winner; });
    T.round++;
    showBracket();
  } else {
    showChampion('TOURNAMENT MODE', `Won ${T.wins} matches · ${T.retries} rematch${T.retries === 1 ? '' : 'es'} needed`);
  }
}

// ------------------------------------------------------------------ champion
function showChampion(kicker, record) {
  const d = byId(app.p1);
  $('champKicker').textContent = kicker;
  $('champPortrait').innerHTML = portraitHTML(d);
  $('champName').textContent = d.name;
  $('champRecord').textContent = record;
  show('champion');
}
on('champTitle', () => show('title'));
on('champSelect', () => openSelect(app.mode));

// ------------------------------------------------------------------ match
const human = { update(me) { input.apply(me.intent); } };

function playMatch(aId, bId, level, ctx) {
  stopMatch();
  app.lastArgs = [aId, bId, level, ctx];
  app.ctx = ctx;
  const A = byId(aId), B = byId(bId);
  app.match = new Match(A, B, { ctrlA: human, ctrlB: makeAI(level), intro: 1.3 });
  app.level = level;
  stage.setMatch(app.match);
  // HUD static info
  $('hudP1Name').textContent = A.name; $('hudP2Name').textContent = B.name;
  $('hudP1Portrait').innerHTML = portraitHTML(A); $('hudP2Portrait').innerHTML = portraitHTML(B);
  $('hudRound').textContent = ctx.label;
  hudLag = [MAX_HP, MAX_HP];
  updateHud(true);
  // VS splash
  $('vsLeft').innerHTML = `${portraitHTML(A)}<div class="vname">${A.name}</div><div class="vsp">${A.special.name}</div>`;
  $('vsRight').innerHTML = `${portraitHTML(B)}<div class="vname">${B.name}</div><div class="vsp">${B.special.name} · CPU ${AI_LEVELS[level].name}</div>`;
  $('vsLabel').textContent = ctx.label;
  show('vs');
  clearTimeout(app.vsTimer);
  const go = () => {
    if (app.match === null || !$('vs').classList.contains('active')) return;
    show('hud'); app.running = true; app.paused = false; input.enabled = true; app.acc = 0;
    announce('READY', 1100);
  };
  app.vsTimer = setTimeout(go, 1900);
  $('vs').onclick = () => { clearTimeout(app.vsTimer); go(); };
}

function stopMatch() {
  clearTimeout(app.vsTimer);
  app.running = false; app.paused = false; input.enabled = false;
  app.match = null; stage.setMatch(null);
  $('floaters').innerHTML = '';
  $('announce').className = 'announce';
}

function endMatch() {
  app.running = false; input.enabled = false;
  const m = app.match, ctx = app.ctx;
  const won = m.winner === 0;
  const [p, c] = m.fighters;
  const result = { won, reason: m.reason, hp: p.hp, cpuHp: c.hp };
  const word = $('resWord');
  word.textContent = won ? 'WIN' : 'DEFEAT';
  word.classList.toggle('lose', !won);
  const how = m.reason === 'KO' ? 'by K.O.' : m.reason === 'TIME' ? 'on time (more HP left)' : 'in sudden death';
  $('resSub').textContent = won ? `${p.def.name} defeats ${c.def.name} ${how}` : `${c.def.name} defeats ${p.def.name} ${how}`;
  $('resStats').innerHTML = `<span class="h"></span><span class="h">${p.def.name}</span><span class="h">${c.def.name}</span>` +
    `<span>HP left</span><b>${p.hp}</b><b>${c.hp}</b>` +
    `<span>Damage dealt</span><b>${p.stats.dealt}</b><b>${c.stats.dealt}</b>` +
    `<span>Clean hits</span><b>${p.stats.hits}</b><b>${c.stats.hits}</b>` +
    `<span>Best combo</span><b>${p.stats.maxCombo}</b><b>${c.stats.maxCombo}</b>`;
  const btns = [];
  const B = (label, fn, primary) => btns.push({ label, fn, primary });
  if (ctx.type === 'versus') {
    B('Rematch', () => playMatch(...app.lastArgs), true);
    B('Continue', () => { // keep your fighter, face a new CPU opponent
      const pool = PLAYABLE.filter((d) => app.mirror || d.id !== app.p1).filter((d) => d.id !== app.cpu);
      app.cpu = pool[(Math.random() * pool.length) | 0].id; startVersus();
    });
    B('Character Select', () => openSelect('versus'));
  } else if (ctx.type === 'arcade') {
    const A = app.arcade;
    if (won) {
      A.wins++; A.stage++;
      if (A.stage >= ARCADE_LEN) { $('resSub').textContent += '. You cleared Arcade Mode!'; B('Continue', () => showChampion('ARCADE MODE', `Cleared ${ARCADE_LEN} stages · ${A.wins} wins · ${A.losses} losses`), true); }
      else B('Continue', () => showLadder(), true);
    } else {
      A.losses++;
      B('Rematch', () => playMatch(...app.lastArgs), true);
    }
    B('Character Select', () => openSelect('arcade'));
    if (!won) B('Title', () => show('title'));
  } else if (ctx.type === 'tournament') {
    if (won) B('Continue', () => tourAdvanceAfterPlayerWin(result), true);
    else {
      $('resSub').textContent += `. Eliminated in the ${ROUND_SHORT[app.tour.round]}. Rematch to fight for the spot again.`;
      B('Rematch', () => { app.tour.retries++; playMatch(...app.lastArgs); }, true);
    }
    B('Character Select', () => openSelect('tournament'));
    if (!won) B('Title', () => show('title'));
  }
  const wrap = $('resButtons'); wrap.innerHTML = '';
  for (const b of btns) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : '');
    el.textContent = b.label;
    el.addEventListener('click', () => { sfx.ui(); b.fn(); });
    wrap.appendChild(el);
  }
  show('hud', 'result');
  setTimeout(() => { const f = wrap.querySelector('.primary'); if (f) f.focus(); }, 50);
}

// ------------------------------------------------------------------ pause
function pause() {
  if (!app.running || app.match.over) return;
  app.paused = true; input.enabled = false;
  show('hud', 'pause');
}
input.onPause = () => { if (app.paused) resume(); else pause(); };
function resume() { app.paused = false; input.enabled = true; show('hud'); }
on('pauseBtn', pause);
on('pResume', resume);
on('pRestart', () => playMatch(...app.lastArgs));
on('pSelect', () => openSelect(app.mode));
on('pTitle', () => { stopMatch(); show('title'); });
on('guideToggle', () => $('guide').classList.toggle('collapsed'));

// ------------------------------------------------------------------ HUD
let hudLag = [MAX_HP, MAX_HP];
let comboShown = 0;
function updateHud(force) {
  const m = app.match; if (!m) return;
  m.fighters.forEach((f, i) => {
    const P = i === 0 ? 'P1' : 'P2';
    const pct = (f.hp / MAX_HP) * 100;
    const fill = $(`hud${P}Fill`);
    fill.style.width = pct + '%';
    fill.classList.toggle('low', pct < 30);
    if (force || hudLag[i] !== f.hp) { $(`hud${P}Lag`).style.width = pct + '%'; hudLag[i] = f.hp; }
    $(`hud${P}Hp`).textContent = `${f.hp} / ${MAX_HP}`;
    const sp = f.def.special, cd = f.cd.special;
    $(`hud${P}Sp`).style.width = ((1 - cd / sp.cooldown) * 100) + '%';
    $(`hud${P}SpTxt`).textContent = cd <= 0 ? `${sp.name.toUpperCase()} READY` : `${sp.name.toUpperCase()} ${cd.toFixed(1)}s`;
    $(`hud${P}Sp`).parentElement.classList.toggle('ready', cd <= 0);
  });
  $('hudTimer').textContent = m.suddenDeath ? 'SD' : Math.max(0, Math.ceil(m.timeLimit - m.time));
  const c = m.fighters[0].combo;
  if (c >= 2 && c !== comboShown) { $('combo').innerHTML = `${c} HITS<small>combo</small>`; $('combo').classList.add('show'); }
  if (c < 2 && comboShown >= 2) $('combo').classList.remove('show');
  comboShown = c;
}
let announceT = null;
function announce(text, ms = 900) {
  const a = $('announce'); a.textContent = text; a.className = 'announce'; void a.offsetWidth; a.className = 'announce show';
  clearTimeout(announceT); announceT = setTimeout(() => { a.className = 'announce'; }, ms);
}
const calloutT = [null, null];
function callout(side, text) {
  const el = $(side === 0 ? 'calloutP1' : 'calloutP2');
  el.textContent = text; el.className = `callout ${side === 0 ? 'left' : 'right'}`; void el.offsetWidth; el.classList.add('show');
  clearTimeout(calloutT[side]); calloutT[side] = setTimeout(() => el.classList.remove('show'), 1300);
}
function floater(x, y, z, text, cls) {
  const p = stage.project(x, y + 0.6, z); if (p.behind) return;
  const el = document.createElement('div'); el.className = 'floater ' + (cls || ''); el.textContent = text;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  $('floaters').appendChild(el); setTimeout(() => el.remove(), 820);
}

stage.onEvent = (e) => {
  switch (e.type) {
    case 'fight': announce('FIGHT!', 800); sfx.fight(); break;
    case 'hit':
      if (e.blocked) { sfx.block(); floater(e.x, e.y, e.z, `${e.dmg}`, 'blk'); }
      else { (e.heavy || e.kind === 'special' ? sfx.heavy : sfx.light)(); floater(e.x, e.y, e.z, `${e.dmg}`, e.dmg >= 100 ? 'big' : ''); }
      break;
    case 'nullify': floater(e.x, e.y, e.z, 'INFINITY', 'blk'); sfx.block(); break;
    case 'special': callout(e.side, e.name.toUpperCase() + '!'); sfx.special(); break;
    case 'shock': sfx.boom(); break;
    case 'swing': case 'dodge': sfx.whoosh(); break;
    case 'beam': sfx.boom(); break;
    case 'ko': sfx.ko(); announce(e.reason === 'KO' ? 'K.O.' : e.reason === 'TIME' ? 'TIME!' : 'DECIDED!', 2000); break;
    case 'suddenDeath': announce('SUDDEN DEATH', 1400); break;
  }
};

// ------------------------------------------------------------------ device
function detectDevice() {
  const touch = (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch-mode', touch);
  document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
}
detectDevice();
window.addEventListener('resize', detectDevice);

// ------------------------------------------------------------------ loop
const STEP = 1 / 60;
let last = performance.now(), clock = 0;
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  clock += dt;
  const m = app.match;
  const blocked = document.body.classList.contains('touch-mode') && document.body.classList.contains('portrait');
  if (m && app.running && !app.paused && !blocked) {
    // brief slow motion on the finishing blow
    const slow = m.koTimer >= 0 && m.koTimer > 1.2 ? 0.35 : 1;
    const turbo = window.__iat ? window.__iat.turbo || 1 : 1; // QA-only fast-forward hook
    app.acc += dt * slow * turbo;
    let n = 0;
    while (app.acc >= STEP && n < 5 * turbo) { m.step(STEP); app.acc -= STEP; n++; }
    if (m.over) endMatch();
  }
  stage.render(app.paused || blocked ? 0 : dt, clock);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('loading').classList.add('gone');

// QA / debugging hook (not shown in the UI)
window.__iat = { app, stage, input, byId, PLAYABLE, ROSTER };
