/* Stayingfit app (vanilla JS, no build step) */
(function () {
'use strict';

/* ---------- helpers ---------- */
const CFG = window.STAYINGFIT_CONFIG || {};
const COACH = CFG.coachName || 'your coach';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = (s) => { const a = String(s).slice(0, 10).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const utc = (s) => { const a = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); };
const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
let TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const syncToday = () => { const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); const changed = t !== TODAY; TODAY = t; return changed; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtShort = (s) => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
const fmtDay = (s) => { const d = parse(s); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
/* change between the last two weigh-ins: how much, and when the earlier one was */
const wChange = (ws) => { if (!ws || ws.length < 2) return null; const a = ws[ws.length - 1], b = ws[ws.length - 2]; return { df: Math.round((a.v - b.v) * 10) / 10, prev: b.v, when: b.d === addDays(TODAY, -1) ? 'yesterday' : fmtShort(b.d) }; };
const wChangeTxt = (ch) => (ch.df === 0 ? 'same as ' + ch.when : (ch.df < 0 ? 'down ' : 'up ') + Math.abs(ch.df).toFixed(1) + ' kg from ' + ch.when + ' (' + ch.prev.toFixed(1) + ' kg)');
const wChangeHtml = (ch) => (ch ? '<span class="chg' + (ch.df < 0 ? ' down' : ch.df > 0 ? ' up' : '') + '">' + (ch.df === 0 ? 'No change' : (ch.df < 0 ? '↓ ' : '↑ ') + Math.abs(ch.df).toFixed(1) + ' kg') + '</span> <span class="muted">' + (ch.when === 'yesterday' ? 'yesterday ' : 'on ' + ch.when + ' ') + ch.prev.toFixed(1) + '</span>' : '');
const clock = () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
const initials = (n) => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };
const short = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[1][0] + '.' : p[0]; };
const first = (n) => String(n || '').trim().split(/\s+/)[0];
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const num = (v) => (v == null ? null : +v);

/* ---------- reference data ---------- */
const FOODS = [
  ['Roti','1 medium',120],['Chapati with ghee','1 medium',160],['Steamed rice','1 cup cooked',205],['Brown rice','1 cup cooked',215],
  ['Dal tadka','1 bowl',180],['Moong dal','1 bowl',150],['Rajma','1 bowl',240],['Chole','1 bowl',270],['Sambar','1 bowl',140],
  ['Paneer bhurji','1 bowl',290],['Palak paneer','1 bowl',280],['Paneer butter masala','1 bowl',350],['Paneer tikka','1 plate (6 pieces)',260],
  ['Idli','1 piece',60],['Plain dosa','1 dosa',170],['Masala dosa','1 dosa',390],['Poha','1 plate',250],['Upma','1 bowl',230],
  ['Besan chilla','1 chilla',110],['Moong dal chilla','1 chilla',130],['Oats chilla','1 chilla',140],['Ragi chilla','1 chilla',120],['Paneer stuffed chilla','1 chilla',200],['Vegetable khichdi','1 bowl',300],['Aloo paratha','1 paratha',300],['Mixed veg sabzi','1 bowl',150],
  ['Bhindi sabzi','1 bowl',140],['Lauki sabzi','1 bowl',110],['Chicken curry','1 bowl',300],['Grilled chicken breast','150 g',250],['Fish curry','1 bowl',240],
  ['Grilled fish','150 g',200],['Boiled egg','1 egg',78],['Masala omelette','1 omelette (2 eggs)',190],['Curd','1 bowl',100],['Raita','1 bowl',90],
  ['Buttermilk','1 glass',40],['Sprouts salad','1 bowl',150],['Oats with milk','1 bowl',250],['Banana','1 medium',105],['Apple','1 medium',95],
  ['Papaya','1 cup',60],['Almonds','10 almonds',70],['Roasted chana','1 handful',120],['Makhana','1 cup roasted',90],['Samosa','1 piece',260],['Masala chai','1 cup',90],
  ['Black coffee','1 cup',5],['Green tea','1 cup',2],['Coconut water','1 glass',45],['Cucumber salad','1 bowl',30],['Clear vegetable soup','1 bowl',70],
  ['Phulka without ghee','1 small',70],['Multigrain roti','1 medium',110],['Bajra roti','1 medium',120],['Jowar roti','1 medium',110],['Plain paratha','1 paratha',200],
  ['Paneer paratha','1 paratha',320],['Methi thepla','1 thepla',120],['Khakhra','1 piece',60],['Dhokla','1 piece',80],['Vegetable dalia','1 bowl',220],
  ['Sattu drink','1 glass',150],['Quinoa','1 cup cooked',220],['Vegetable pulao','1 cup',250],['Curd rice','1 bowl',280],['Kadhi','1 bowl',150],
  ['Aloo sabzi','1 bowl',200],['Gobi sabzi','1 bowl',140],['Mixed dal','1 bowl',170],['Tofu bhurji','1 bowl',220],['Paneer','100 g',265],
  ['Milk','1 glass',120],['Ghee','1 teaspoon',45],['Orange','1 medium',60],['Guava','1 medium',70],['Pomegranate','1 cup',140],['Watermelon','1 cup',45],
  ['Fruit bowl','1 bowl',120],['Walnuts','4 halves',52],['Peanuts','1 handful',170],['Vegetable sandwich','1 sandwich',250],['Bhel','1 plate',200],
  ['Pav bhaji','1 plate',400],['Vegetable biryani','1 plate',350],['Chicken biryani','1 plate',450],['Instant noodles','1 pack',310],['Pizza','1 slice',285],
  ['Veg burger','1 burger',350],['Gulab jamun','1 piece',150],['Rasgulla','1 piece',110],['Ice cream','1 scoop',140],['Marie biscuit','1 biscuit',25],
  ['Lemon water without sugar','1 glass',10],['Protein shake','1 scoop in water',120]
].map((f) => ({ n: f[0], s: f[1], k: f[2] }));
const MEALS = ['Breakfast', 'Mid meal', 'Lunch', 'Snack', 'Dinner'];
/* diets written before the mid meal was added hold four meals: breakfast, lunch, snack, dinner */
const dietMeals = (dt) => { const m = (dt && dt.meals) || []; return m.length === 4 ? [m[0], '', m[1], m[2], m[3]] : m; };
/* a guess at the calories of a food that is not on the list, from the closest dish that is */
function estimateFood(name) {
  const words = String(name).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2); if (!words.length) return null;
  const same = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0));
  let best = null, bs = 0;
  FOODS.forEach((f) => { const fw = f.n.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
    let sc = words.filter((w) => fw.some((x) => same(x, w))).length * 2; if (!sc) return;
    if (same(fw[fw.length - 1], words[words.length - 1])) sc += 3;
    sc -= fw.filter((x) => !words.some((w) => same(x, w))).length * 0.5;
    if (sc > bs) { bs = sc; best = f; } });
  return best;
}
const qtyTxt = (q) => (q === 0.5 ? '½' : q % 1 ? Math.floor(q) + '½' : String(q));
const G = {
  flame: 'M12 3c.8 3-2 4.6-2 7.4 0 1.3.9 2.3 2 2.3 1.5 0 2.2-1.2 2-2.8 1.9 1.5 3 3.7 3 5.8A5 5 0 0 1 7 16c0-4.5 3.8-6.6 5-13z',
  drop: 'M12 3.5c2.8 3.6 5.5 6.6 5.5 9.9a5.5 5.5 0 0 1-11 0c0-3.3 2.7-6.3 5.5-9.9z',
  meal: 'M7 3v6a2 2 0 0 0 2 2v10M11 3v6a2 2 0 0 1-2 2M16.5 21V3c-2 1.5-3 4-3 7h3',
  crown: 'M4 17 3 7l5 4 4-6 4 6 5-4-1 10zM5 20h14',
  leaf: 'M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l7-7',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z'
};
const BADGES = [
  { k: 'streak7', name: '7-Day Streak', desc: 'Log your weight 7 days running', fill: 'var(--ember)', g: G.flame },
  { k: 'water', name: 'Water Master', desc: 'Finish all 10 glasses in a day', fill: 'var(--water)', g: G.drop },
  { k: 'meal', name: 'Meal Tracker', desc: 'Log 3 meals in one day', fill: 'var(--forest)', g: G.meal },
  { k: 'king', name: 'Consistency King', desc: 'Hold a 30-day streak', fill: 'var(--gold-fill)', g: G.crown },
  { k: 'detox', name: 'Detox Champion', desc: 'Complete 3 detox days', fill: 'var(--slate)', g: G.leaf }
];
const HEX = 'M32 3 L57 17.5 V46.5 L32 61 L7 46.5 V17.5 Z';
const LEVELS = ['Seedling', 'Sprout', 'Steady', 'Strong', 'Unstoppable', 'Legend'];

/* ---------- state ---------- */
const S = {};
const emptyDay = () => ({ water: 0, meals: [], exercise: [], photos: [], done: {} });

function friendly(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || '';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'No connection. Check your internet and try again.';
  if (/Invalid login credentials/i.test(m)) return 'That username and password don’t match. Passwords are case-sensitive.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute, then try again.';
  if (/JWT|refresh token|session/i.test(m)) return 'You were signed out. Sign in again.';
  if (/permission denied|row-level security/i.test(m)) return 'You don’t have access to do that.';
  return m || 'Something went wrong. Try again.';
}

/* ---------- fx ---------- */
let AC = null, SOUND = lsGet('sf-sound') !== '0';
function sfx(kind) {
  try { if (navigator.vibrate) navigator.vibrate(kind === 'win' ? [20, 40, 30] : 12); } catch (e) {}
  if (!SOUND) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime;
    const tone = (f, at, dur, type, vol, f2) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0 + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + dur);
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur); o.connect(g).connect(AC.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02); };
    if (kind === 'water') { tone(1250, 0, 0.09, 'sine', 0.1, 520); tone(900, 0.07, 0.12, 'sine', 0.07, 380); }
    else if (kind === 'star') { tone(880, 0, 0.12, 'triangle', 0.1); tone(1320, 0.08, 0.18, 'triangle', 0.1); }
    else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.4, 'triangle', 0.09)); tone(1568, 0.36, 0.5, 'sine', 0.06); }
    else tone(660, 0, 0.05, 'sine', 0.05);
  } catch (e) {}
}
function toast(text, star) {
  const fx = $('#fx'), el = document.createElement('div');
  el.className = 'toast' + (star ? ' star' : ''); el.setAttribute('role', 'status');
  el.innerHTML = (star ? '<svg class="burst" viewBox="0 0 48 48" aria-hidden="true"><line class="ray" x1="24" y1="2" x2="24" y2="8"/><line class="ray" x1="24" y1="40" x2="24" y2="46"/><line class="ray" x1="2" y1="24" x2="8" y2="24"/><line class="ray" x1="40" y1="24" x2="46" y2="24"/><line class="ray" x1="8" y1="8" x2="12" y2="12"/><line class="ray" x1="36" y1="36" x2="40" y2="40"/><line class="ray" x1="40" y1="8" x2="36" y2="12"/><line class="ray" x1="8" y1="40" x2="12" y2="36"/><polygon class="st" points="24 11 27.8 19 36.5 19.9 30 25.8 31.8 34.4 24 30 16.2 34.4 18 25.8 11.5 19.9 20.2 19"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path class="ic" style="stroke-width:2.6" d="M4 12.5l5 5L20 6.5"/></svg>') + '<span>' + esc(text) + '</span>';
  fx.querySelectorAll('.toast').forEach((t) => t.remove());
  fx.appendChild(el); setTimeout(() => el.remove(), 3000); if (star) sfx('star');
}
function bumpStars() { const s = $('#st-stars'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
function growFlame() { const f = $('#flame'); f.classList.remove('grow'); void f.getBoundingClientRect(); f.classList.add('grow'); setTimeout(() => f.classList.remove('grow'), 950); }
let celQueue = Promise.resolve();
function celebrate(b, extra, eyebrow) {
  celQueue = celQueue.then(() => new Promise((done) => {
    const colors = ['var(--forest)', 'var(--slate)', 'var(--gold-fill)', 'var(--ember)', 'var(--water)'];
    let conf = ''; for (let i = 0; i < 36; i++) conf += '<i class="cf ' + 'abc'[i % 3] + '" style="left:' + ((i * 37 + 11) % 100) + '%;background:' + colors[i % 5] + ';animation-delay:' + ((i * 53) % 500) + 'ms"></i>';
    const el = document.createElement('div'); el.className = 'celebrate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'cel-t');
    el.innerHTML = conf + '<div class="cel-body"><svg viewBox="0 0 64 64" aria-hidden="true"><path style="fill:' + b.fill + '" d="' + HEX + '"/><g transform="translate(20 20)"><path class="gl on" d="' + b.g + '"/></g></svg><div class="eyebrow" style="color:var(--forest)">' + esc(eyebrow || 'Badge unlocked') + '</div><h2 id="cel-t" style="font-size:32px">' + esc(b.name) + '</h2><p class="muted">' + esc(b.desc) + '. ' + esc(extra || '') + '</p><button class="btn" type="button">Keep going</button></div>';
    const close = () => { if (!el.isConnected) return; el.remove(); document.removeEventListener('keydown', onKey); done(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    el.querySelector('button').addEventListener('click', close); document.addEventListener('keydown', onKey);
    $('#fx').appendChild(el); el.querySelector('button').focus(); sfx('win');
    setTimeout(close, 5000);
  }));
}
function setNum(sel, to, key) {
  const el = $(sel);
  if (S.counted[key] || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; S.counted[key] = 1; return; }
  S.counted[key] = 1; const t0 = performance.now();
  const step = (t) => { const k = Math.min((t - t0) / 900, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- shared maths ---------- */
function dietDayOf(c) { return c && c.diet_anchor ? ((diffDays(c.diet_anchor, TODAY) % 4) + 4) % 4 + 1 : 1; }
function liveStreak(c) { return c.last_log_date && diffDays(c.last_log_date, TODAY) <= 1 ? c.streak : 0; }
function detoxUntil(c) { return diffDays(TODAY, addDays(c.last_detox, c.detox_freq)); }
function planLeft(c) { return diffDays(TODAY, c.plan_end); }
function lastLogAgo(c) { return c.last_log_date ? diffDays(c.last_log_date, TODAY) : 999; }
function curOf(c, ws) { return ws && ws.length ? ws[ws.length - 1].v : num(c.start_kg); }
function lossPctOf(c, ws) { return (num(c.start_kg) - curOf(c, ws)) / num(c.start_kg) * 100; }
function monthLoss(c, ws) { if (!ws || !ws.length) return 0; const m0 = TODAY.slice(0, 8) + '01'; const b = ws.filter((x) => x.d < m0); return (b.length ? b[b.length - 1].v : ws[0].v) - ws[ws.length - 1].v; }
function tierCls(t) { return t === 'Hand-holding' ? 'gold' : 'slate'; }

/* ---------- chart ---------- */
function renderChart(goal, w, box, start) {
  if (w.length < 2) { box.innerHTML = '<div class="empty">Your trend line appears after your second weigh-in.</div>'; box.dataset.sig = ''; return; }
  const sig = w.length + '|' + w[w.length - 1].v, anim = box.dataset.sig !== sig; box.dataset.sig = sig;
  const pts = w.slice(-30), W = Math.max(Math.round(box.clientWidth || 700), 280), H = W < 500 ? 200 : 250, pl = 38, pr = 14, pt = 24, pb = 30;
  const showStart = !!start && Math.abs(pts[0].v - start) > 0.05;
  const vals = pts.map((p) => p.v).concat(goal ? [goal] : []).concat(showStart ? [start] : []);
  let lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const step = hi - lo <= 4 ? 1 : hi - lo <= 10 ? 2 : hi - lo <= 20 ? 5 : 10;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const t0 = utc(pts[0].d), tspan = Math.max(utc(pts[pts.length - 1].d) - t0, 1);
  const X = (d) => pl + (utc(d) - t0) / tspan * (W - pl - pr), Y = (v) => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight from ' + pts[0].v + ' kg on ' + fmtShort(pts[0].d) + ' to ' + pts[pts.length - 1].v + ' kg on ' + fmtShort(pts[pts.length - 1].d) + '">';
  for (let v = lo; v <= hi + 1e-9; v += step) s += '<line class="grid-l" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text x="' + (pl - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
  if (showStart) s += '<line style="stroke:var(--muted);stroke-width:1.5;stroke-dasharray:2 5" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(start).toFixed(1) + '" y2="' + Y(start).toFixed(1) + '"/><text style="fill:var(--muted);font-weight:600" x="' + (pl + 6) + '" y="' + (Y(start) - 7).toFixed(1) + '">STARTED AT ' + start.toFixed(1) + '</text>';
  if (goal) s += '<line class="goal" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '"/><text class="goal-t" x="' + (W - pr) + '" y="' + (Y(goal) - 7).toFixed(1) + '" text-anchor="end">GOAL ' + goal.toFixed(1) + '</text>';
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  s += '<path class="area' + (anim ? ' draw' : '') + '" d="' + line + ' L' + X(pts[pts.length - 1].d).toFixed(1) + ' ' + (H - pb) + ' L' + X(pts[0].d).toFixed(1) + ' ' + (H - pb) + ' Z"/><path class="line' + (anim ? ' draw' : '') + '" pathLength="1" d="' + line + '"/>';
  pts.slice(0, -1).forEach((p) => { s += '<circle class="dot" cx="' + X(p.d).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="3"/>'; });
  const L = pts[pts.length - 1], lx = X(L.d), ly = Y(L.v);
  s += '<circle class="halo" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="7"/><circle class="last" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="5.5"/><text class="tip" x="' + (lx - 10).toFixed(1) + '" y="' + (ly - 13).toFixed(1) + '" text-anchor="end">' + L.v.toFixed(1) + ' kg</text>';
  s += '<text x="' + pl + '" y="' + (H - 8) + '">' + fmtShort(pts[0].d) + '</text><text x="' + (W - pr) + '" y="' + (H - 8) + '" text-anchor="end">' + (L.d === TODAY ? 'Today' : fmtShort(L.d)) + '</text></svg>';
  box.innerHTML = s;
  const svg = box.querySelector('svg'), P = pts.map((p) => ({ x: X(p.d), y: Y(p.v), p }));
  const hov = document.createElementNS('http://www.w3.org/2000/svg', 'g'); svg.appendChild(hov);
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) / r.width * W;
    let b = P[0]; P.forEach((q) => { if (Math.abs(q.x - mx) < Math.abs(b.x - mx)) b = q; });
    const tw = 96, tx = Math.min(Math.max(b.x - tw / 2, pl), W - pr - tw), ty = b.y - 58 < 2 ? b.y + 14 : b.y - 52;
    hov.innerHTML = '<line class="hov-l" x1="' + b.x + '" x2="' + b.x + '" y1="' + pt + '" y2="' + (H - pb) + '"/><circle class="hov-d" cx="' + b.x + '" cy="' + b.y + '" r="6"/><rect class="hov-bg" x="' + tx + '" y="' + ty + '" width="' + tw + '" height="38" rx="3"/><text class="hov-t" x="' + (tx + 10) + '" y="' + (ty + 17) + '">' + b.p.v.toFixed(1) + ' kg</text><text class="hov-s" x="' + (tx + 10) + '" y="' + (ty + 30) + '">' + (b.p.d === TODAY ? 'TODAY' : fmtDay(b.p.d).toUpperCase()) + '</text>';
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', () => { hov.innerHTML = ''; });
}
function spark(ws) {
  const w = (ws || []).slice(-30); if (w.length < 2) return '<span class="small muted">No data</span>';
  const W = 96, H = 28, vs = w.map((x) => x.v), lo = Math.min(...vs), hi = Math.max(...vs), r = Math.max(hi - lo, 0.1);
  const pts = w.map((x, i) => [(i / (w.length - 1)) * (W - 6) + 2, 3 + (hi - x.v) / r * (H - 6)]), L = pts[pts.length - 1];
  return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + '"/><circle cx="' + L[0].toFixed(1) + '" cy="' + L[1].toFixed(1) + '" r="2.5"/></svg>';
}

/* ================================================================== */
/*  STATE                                                              */
/* ================================================================== */
const DOMAIN = CFG.loginDomain || 'stayingfit.app';
const ROLE_NAME = { client: 'Client', coach: 'Coach', assistant: 'Assistant' };
const REACTS = ['👍', '❤️', '👏', '🙏'];
const LVL = ['st-ok', 'st-warn', 'st-bad'];
const TESTS = [
  ['hba1c', 'HbA1c', '%', (v) => (v < 5.7 ? 0 : v < 6.5 ? 1 : 2), 'below 5.7', -1, ['Normal', 'Prediabetes range', 'Diabetes range']],
  ['ldl', 'LDL', 'mg/dL', (v) => (v < 100 ? 0 : v < 160 ? 1 : 2), 'below 100', -1, ['Optimal', 'Above optimal', 'High']],
  ['hdl', 'HDL', 'mg/dL', (v) => (v >= 50 ? 0 : v >= 40 ? 1 : 2), '40 or higher', 1, ['Good', 'Borderline', 'Low']],
  ['tg', 'Triglycerides', 'mg/dL', (v) => (v < 150 ? 0 : v < 200 ? 1 : 2), 'below 150', -1, ['Normal', 'Borderline', 'High']]
];
function freshState() {
  return {
    role: null, profile: null, pickRole: null, lastPw: '',
    me: null, weights: [], day: null, plan: null, board: [], photoUrls: {}, tests: [], reportUrls: {},
    threads: [], msgs: {}, openThread: null, dmId: null, kThread: null, pcs: [], zoom: null, pushOn: false, pushErr: '',
    clients: [], profiles: {}, allWeights: {}, days: {}, diets: {}, liq: {}, ticks: {}, allTests: {}, ibox: 'mine', kOpen: false, dietFor: null,
    exType: 'Walk', q: '', pick: null, seen: {}, diet: null, liquids: [], ticked: new Set(), asstId: null, lb: 'loss', tier: 'All', cq: '', sortK: 'name', sortDir: 1, sel: null, drawer: null, drawerMode: null,
    counted: {}, lvlSeen: null, chain: Promise.resolve(), lastGlass: -1, tab: null, cred: null
  };
}
Object.assign(S, { sb: null, session: null, rt: null }, freshState());
const uidNow = () => (S.session && S.session.user.id) || '';
const isCoach = () => S.role === 'coach';
const isStaff = () => S.role === 'coach' || S.role === 'assistant';
const fixErr = (r) => { if (r && r.error) throw r.error; return r; };
async function allRows(make) { let out = [], from = 0; for (;;) { const r = fixErr(await make().range(from, from + 999)); const rows = r.data || []; out = out.concat(rows); if (rows.length < 1000 || from >= 99000) break; from += 1000; } return { data: out }; }
const START_HTML = '<strong style="display:block;font:600 20px var(--display);color:var(--ink);margin-bottom:6px">Start by adding your first client</strong>You pick their username. The app makes a temporary password and a ready-to-send WhatsApp message.<br><br><button class="btn" type="button" data-first-client="1">Add your first client</button>';
const msgTime = (iso) => { const d = new Date(iso), day = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); return (day === TODAY ? '' : fmtShort(day) + ', ') + d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(); };
const planHas = (p) => Array.isArray(p) && p.some((d) => Array.isArray(d) && d.some((x) => x && String(x).trim()));
const istHour = () => +new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
const appUrl = () => CFG.appUrl || (location.origin + location.pathname.replace(/index\.html$/, ''));
const WORDS = ['Wellness', 'Balance', 'Vitality', 'Healthy', 'Active', 'Energy', 'Strong', 'Fresh'];
function tempPassword() { const r = new Uint32Array(2); crypto.getRandomValues(r); return WORDS[r[0] % WORDS.length] + '@' + String(1000 + (r[1] % 9000)); }
function suggestUsername(name) { const p = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean); if (!p.length) return ''; let u = p[0] + (p[1] ? p[1][0] : ''); if (u.length < 3) u = (u + 'fit').slice(0, 6); return u.slice(0, 30); }
function loginMessage(name, username, pw) {
  return 'Hi ' + first(name) + '! Here is your Stayingfit login.\n\nOpen: ' + appUrl() + '\nSign in with:\nUsername: ' + username + '\nPassword: ' + pw + '\n\nThe first time you sign in, you can change your username and password.';
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied. Paste it into WhatsApp.'); } catch (e) { toast('Couldn’t copy. Select the text and copy it.'); } }

/* ================================================================== */
/*  SCREENS + SIGN-IN                                                  */
/* ================================================================== */
const GATES = ['gate-setup', 'gate-loading', 'gate-login', 'gate-newpw', 'gate-noprofile', 'gate-consent'];
function show(id) {
  GATES.forEach((g) => { $('#' + g).hidden = g !== id; });
  $('#app').hidden = id !== 'app';
  syncMbar(); renderNotify();
  const auto = { 'gate-login': '#li-user' }[id];
  if (auto) setTimeout(() => { const el = $(auto); if (el && !el.hidden && !el.value) el.focus(); }, 30);
}
function loading(text) { $('#loading-text').innerHTML = '<span class="spin"></span> ' + esc(text || 'Loading…'); show('gate-loading'); }

async function boot() {
  if (!CFG.supabaseUrl || /YOUR-/.test(CFG.supabaseUrl) || !CFG.supabaseAnonKey || /YOUR-/.test(CFG.supabaseAnonKey) || !window.supabase) { show('gate-setup'); return; }
  $('#land-sub').textContent = (CFG.coachFullName || 'Pushpanjali Khaitan') + '’s nutrition coaching';
  S.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sf-auth' } });
  S.sb.auth.onAuthStateChange((ev, session) => {
    const had = !!S.session; S.session = session;
    if (S.quietOut) return;
    if (ev === 'SIGNED_OUT' || (!session && had)) { signedOut(); }
  });
  const { data } = await S.sb.auth.getSession();
  S.session = data.session;
  if (S.session) await route(); else showLogin();
}
function signedOut() {
  if (S.rt && S.sb) { try { S.sb.removeChannel(S.rt); } catch (e) {} }
  S.rt = null; closeDrawer(); closeModal(); closeZoom(); forgetPush();
  Object.assign(S, freshState()); S.session = null;
  document.body.classList.remove('readonly');
  ['#li-pw', '#np-user', '#np-old', '#np-new', '#np-new2'].forEach((s) => { $(s).value = ''; });
  $('#view-client').hidden = true; $('#view-staff').hidden = true;
  showLogin();
}
async function signOut() { try { await Promise.race([dropPush(), new Promise((r) => setTimeout(r, 2500))]); } catch (e) {} try { await S.sb.auth.signOut({ scope: 'local' }); } catch (e) {} signedOut(); }

async function route() {
  if (!S.session) { showLogin(); return; }
  loading('Opening your dashboard…');
  try {
    const { data: prof, error } = await S.sb.from('profiles').select('id,username,role,display_name,must_change_pw').eq('id', S.session.user.id).maybeSingle();
    if (error) throw error;
    if (!prof) { show('gate-noprofile'); return; }
    S.profile = prof; S.role = prof.role;
    if (prof.must_change_pw) { showFirst(); return; }
    S.lastPw = '';
    setWho();
    if (S.role === 'client') {
      await loadClient();
      if (!S.me) { show('gate-noprofile'); return; }
      if (!S.me.consent_at) { show('gate-consent'); return; }
      $('#view-staff').hidden = true; $('#view-client').hidden = false; show('app'); renderClient();
      if (S.justJoined) { S.justJoined = false; celebrate({ name: 'Welcome, ' + first(S.me.name), desc: 'You’re all set', fill: 'var(--forest)', g: G.leaf }, 'Start with your morning weigh-in to earn your first star.', 'Stayingfit'); }
    } else {
      document.body.classList.toggle('readonly', !isCoach());
      await loadStaff();
      $('#view-client').hidden = true; $('#view-staff').hidden = false; show('app');
      if (!S.tab) S.tab = lsGet('sf-tab-' + S.role) || 'today';
      renderStaff();
    }
    startRealtime();
    syncPush().catch(() => {}).then(renderNotify);
    if (pendingLink) openLink(pendingLink);
  } catch (e) {
    if (/JWT|session|refresh/i.test((e && e.message) || '')) { signOut(); return; }
    $('#loading-text').innerHTML = esc(friendly(e)) + '<br><br><button class="btn" type="button" id="retry">Try again</button> <button class="ghost" style="height:44px" type="button" data-signout>Sign out</button>';
    show('gate-loading');
  }
}

/* sign-in form: the login itself decides which screens open */
const UNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const UNAME_HELP = 'Usernames are 3 to 30 characters: small letters, numbers, dots, dashes or underscores.';
function showLogin() { $('#li-err').hidden = true; show('gate-login'); }
function setWho() { const p = S.profile; if (p) $('#nav-who').textContent = p.display_name + ' · ' + ROLE_NAME[p.role] + ' · @' + p.username; }
$('#li-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#li-err'), fail = (m) => { err.textContent = m; err.hidden = false; };
  let user = $('#li-user').value.trim().toLowerCase(); if (user.indexOf('@') > -1) user = user.split('@')[0];
  const pw = $('#li-pw').value;
  if (!user) return fail('Enter your username.');
  if (!pw) return fail('Enter your password.');
  err.hidden = true;
  const btn = $('#li-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Signing in…';
  try {
    const { data, error } = await S.sb.auth.signInWithPassword({ email: user + '@' + DOMAIN, password: pw });
    if (error) throw error;
    S.session = data.session; S.lastPw = pw; $('#li-pw').value = '';
    await route();
  } catch (ex) { fail(friendly(ex)); }
  finally { btn.disabled = false; btn.textContent = 'Sign in'; }
});

/* first sign-in: "do you want to change your username and password?" */
function showFirst() {
  const p = S.profile;
  $('#fl-h').textContent = 'Welcome, ' + first(p.display_name);
  $('#fl-user').textContent = p.username;
  $('#fl-ask').hidden = false; $('#np-form').hidden = true; $('#np-err').hidden = true;
  show('gate-newpw');
}
$('#fl-yes').addEventListener('click', () => {
  $('#np-user').value = S.profile.username; $('#np-old-f').hidden = !!S.lastPw;
  $('#fl-ask').hidden = true; $('#np-form').hidden = false; $('#np-user').focus();
});
$('#fl-back').addEventListener('click', () => { $('#np-form').hidden = true; $('#fl-ask').hidden = false; $('#np-err').hidden = true; });
$('#fl-no').addEventListener('click', async () => {
  const b = $('#fl-no'); b.disabled = true;
  const { error } = await S.sb.rpc('keep_my_login'); b.disabled = false;
  if (error) { toast(friendly(error)); return; }
  S.lastPw = ''; await route();
});
/* shared by the first sign-in form and the Account dialog; returns an error message or '' */
async function saveLogin(user, old, n1, n2) {
  user = String(user || '').trim().toLowerCase();
  const newUser = user !== S.profile.username, newPw = !!(n1 || n2);
  if (newUser && !UNAME.test(user)) return UNAME_HELP;
  if (newPw) {
    if (!old) return 'Enter your current password.';
    if (n1.length < 8) return 'Use at least 8 characters for the new password.';
    if (n1 !== n2) return 'The two new passwords don’t match.';
    if (n1 === old) return 'Pick a password different from the current one.';
  }
  if (newUser) {
    const r = await S.sb.rpc('change_my_username', { p_new: user });
    if (r.error) return friendly(r.error);
    S.profile.username = user; setWho(); $('#li-user').value = '';
  }
  if (newPw) {
    const r = await S.sb.rpc('change_my_password', { p_old: old, p_new: n1 });
    if (r.error) return friendly(r.error);
  }
  return '';
}
$('#np-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#np-err'), n1 = $('#np-new').value, n2 = $('#np-new2').value;
  const btn = $('#np-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving…';
  let msg = await saveLogin($('#np-user').value, S.lastPw || $('#np-old').value, n1, n2);
  if (!msg && !(n1 || n2)) { const r = await S.sb.rpc('keep_my_login'); if (r.error) msg = friendly(r.error); }
  btn.disabled = false; btn.textContent = 'Save and continue';
  if (msg) { if (/current password/i.test(msg)) { S.lastPw = ''; $('#np-old-f').hidden = false; } err.textContent = msg; err.hidden = false; return; }
  ['#np-old', '#np-new', '#np-new2'].forEach((x) => { $(x).value = ''; }); S.lastPw = '';
  toast('Saved'); await route();
});
$('#consent-box').addEventListener('change', (e) => { $('#consent-go').disabled = !e.target.checked; });
$('#consent-go').addEventListener('click', async () => {
  const b = $('#consent-go'); b.disabled = true;
  const { error } = await S.sb.rpc('give_consent'); b.disabled = false;
  if (error) { toast(friendly(error)); return; }
  S.justJoined = true;
  await route();
});

/* Account dialog: change username and/or password any time */
function openModal() { $('#pw-modal').hidden = false; $('#pwm-err').hidden = true; $('#pwm-user').value = S.profile ? S.profile.username : ''; ['#pwm-old', '#pwm-new', '#pwm-new2'].forEach((x) => { $(x).value = ''; }); }
function closeModal() { const m = $('#pw-modal'); if (m) m.hidden = true; }
$('#pw-open').addEventListener('click', openModal);
$('#pwm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#pwm-err'), b = $('#pwm-go'); b.disabled = true;
  const msg = await saveLogin($('#pwm-user').value, $('#pwm-old').value, $('#pwm-new').value, $('#pwm-new2').value);
  b.disabled = false;
  if (msg) { err.textContent = msg; err.hidden = false; return; }
  closeModal(); toast('Saved');
});

/* ================================================================== */
/*  CLIENT                                                             */
/* ================================================================== */
async function loadClient() {
  const { data: c, error } = await S.sb.from('clients').select('*').eq('user_id', S.session.user.id).maybeSingle();
  if (error) throw error;
  S.me = c; if (!c || !c.consent_at) return;
  const [w, d, p, b, t, lq, tk] = await Promise.all([
    S.sb.from('weights').select('d,kg').eq('client_id', c.id).order('d'),
    S.sb.from('day_logs').select('*').eq('client_id', c.id).eq('d', TODAY).maybeSingle(),
    S.sb.from('diets').select('id,start_date,meals,notes').eq('client_id', c.id).lte('start_date', TODAY).order('start_date', { ascending: false }).limit(1),
    S.sb.rpc('leaderboard'),
    S.sb.from('blood_tests').select('*').eq('client_id', c.id).order('d'),
    S.sb.from('liquids').select('id,name,when_text,sort').eq('client_id', c.id).eq('active', true).order('sort'),
    S.sb.from('liquid_ticks').select('liquid_id').eq('client_id', c.id).eq('d', TODAY)
  ]);
  [w, d, p, b, t, lq, tk].forEach(fixErr);
  S.weights = (w.data || []).map((x) => ({ d: x.d, v: num(x.kg) }));
  S.day = d.data || emptyDay();
  S.diet = (p.data || [])[0] || null;
  S.liquids = lq.data || []; S.ticked = new Set((tk.data || []).map((x) => x.liquid_id));
  S.board = b.data || [];
  S.tests = t.data || [];
  await loadComments();
  await Promise.all([loadPhotoUrls((S.day.photos || []).map((x) => x.path).concat(S.pcs.map((x) => x.path))), loadReportUrls(S.tests)]);
  if (!S.dmId) { const r = fixErr(await S.sb.rpc('ensure_chat', { p_kind: 'dm' })); S.dmId = r.data; }
  if (!S.asstId) { const r = fixErr(await S.sb.rpc('ensure_chat', { p_kind: 'asst' })); S.asstId = r.data; }
  await loadThreads();
  if (!S.openThread || !S.threads.find((x) => x.id === S.openThread)) S.openThread = S.dmId;
  await loadMsgs(S.openThread);
}
async function loadPhotoUrls(paths) {
  const need = paths.filter((p) => p && !S.photoUrls[p]); if (!need.length) return;
  const { data } = await S.sb.storage.from('meal-photos').createSignedUrls(need, 3600);
  (data || []).forEach((x) => { if (x.signedUrl) S.photoUrls[x.path] = x.signedUrl; });
}
async function loadReportUrls(tests) {
  const need = tests.map((x) => x.file_path).filter((p) => p && !S.reportUrls[p]); if (!need.length) return;
  const { data } = await S.sb.storage.from('reports').createSignedUrls(need, 3600);
  (data || []).forEach((x) => { if (x.signedUrl) S.reportUrls[x.path] = x.signedUrl; });
}
function queue(task) {
  S.chain = S.chain.then(task).catch((e) => { toast(friendly(e)); return refreshClient(); });
  return S.chain;
}
async function refreshClient() { try { await loadClient(); renderClient(); } catch (e) { toast(friendly(e)); } }
function reward(r, msg, opts) {
  opts = opts || {};
  const gained = (r && r.gained) || 0, badges = (r && r.badges) || [];
  if (gained > 0) bumpStars();
  if (opts.weight && gained > 0) growFlame();
  if (gained > 0 && !badges.length && !(r && r.perfect)) toast('+' + gained + (gained === 1 ? ' star · ' : ' stars · ') + msg, true);
  badges.forEach((k) => { const b = BADGES.find((x) => x.k === k); if (b) celebrate(b, '+5 stars.'); });
  if (r && r.perfect) celebrate({ name: 'Perfect day', desc: 'All three challenges done today', fill: 'var(--gold-fill)', g: G.star }, '+5 bonus stars.', 'Challenge bonus');
}
function logDay(action, payload, msg) {
  return queue(async () => {
    const { data, error } = await S.sb.rpc('log_day', { p_action: action, p_payload: payload || {} });
    if (error) throw error;
    await loadClient(); renderClient(); reward(data, msg);
  });
}

function renderClient() {
  const c = S.me; if (!c) return;
  const w = S.weights, d = S.day || emptyDay(), start = num(c.start_kg), goal = num(c.goal_kg);
  const cur = curOf(c, w), lost = start - cur, toGo = goal ? Math.max(cur - goal, 0) : 0;
  const meals = d.meals || [], ex = d.exercise || [], exMin = ex.reduce((a, e) => a + (+e.min || 0), 0), water = d.water || 0, done = d.done || {};
  const doneN = ['water', 'meals', 'move'].filter((k) => done[k]).length, logged = c.last_log_date === TODAY, streak = liveStreak(c);

  // renewal notice
  const pl = planLeft(c); $('#c-renew').hidden = pl > 3;
  $('#c-renew-t').innerHTML = '<strong>' + (pl < 0 ? 'Your plan ended ' + (-pl) + ' day' + (-pl === 1 ? '' : 's') + ' ago.' : pl === 0 ? 'Your plan ends today.' : 'Your plan ends in ' + pl + ' day' + (pl === 1 ? '' : 's') + '.') + '</strong> Message ' + esc(COACH) + ' to keep your ' + esc(c.tier) + ' check-ins going.';

  // hero
  const hr = +new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  $('#c-date').textContent = fmtDay(TODAY) + ' · Day ' + (diffDays(c.plan_start, TODAY) + 1) + ' of your plan · ' + c.tier + ' check-ins';
  $('#c-h1').textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', ' + first(c.name) + '.';
  $('#c-line').textContent = (lost > 0.05 ? lost.toFixed(1) + ' kg down' + (goal ? (toGo > 0 ? ', ' + toGo.toFixed(1) + ' to go. ' : '. Goal reached! ') : '. ') : '')
    + (!logged ? (streak ? 'Log your morning weight to keep the ' + streak + '-day streak going.' : 'Log your morning weight to start a streak.') : doneN === 3 ? 'Every challenge done today. A clean day.' : 'Weigh-in logged. ' + (3 - doneN) + ' of today’s challenges still open.');
  const gp = goal && start > goal ? Math.max(0, Math.min(lost / (start - goal), 1)) : 0, gr = $('#goal-ring');
  gr.hidden = !goal; gr.setAttribute('aria-label', Math.round(gp * 100) + '% of the way to the goal weight');
  if (!gr.firstChild) gr.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="gr-t"/><circle cx="60" cy="60" r="50" class="gr-v" style="stroke-dasharray:0 314.2"/></svg><div class="gr-in"><strong class="num">0%</strong><span>of goal</span></div>';
  requestAnimationFrame(() => { gr.querySelector('.gr-v').style.strokeDasharray = (gp * 314.2).toFixed(1) + ' 314.2'; });
  gr.querySelector('strong').textContent = Math.round(gp * 100) + '%';
  setNum('#v-stars', c.stars, c.id + 's'); setNum('#v-streak', streak, c.id + 'k');
  $('#v-lost').textContent = (lost >= 0 ? '−' : '+') + Math.abs(lost).toFixed(1);
  $('#v-lost-sub').textContent = 'kg · ' + Math.abs(lost / start * 100).toFixed(1) + '% of start';
  $('#v-ch').textContent = doneN + '/3';
  const per = 50, lvl = Math.floor(c.stars / per) + 1, lvName = LEVELS[Math.min(lvl - 1, LEVELS.length - 1)];
  $('#lvl-n').textContent = 'Level ' + lvl; $('#lvl-name').textContent = lvName;
  $('#lvl-next').textContent = (per - c.stars % per) + ' stars to level ' + (lvl + 1);
  $('#lvl-fill').style.width = (c.stars % per / per * 100).toFixed(1) + '%';
  if (S.lvlSeen && lvl > S.lvlSeen) celebrate({ name: 'Level ' + lvl + ': ' + lvName, desc: 'You levelled up', fill: 'var(--slate)', g: G.star }, 'Next level at ' + (lvl * per) + ' stars.', 'Level up');
  S.lvlSeen = lvl;
  const wset = new Set(w.map((x) => x.d)); let cal = '';
  for (let i = 13; i >= 0; i--) { const dd = addDays(TODAY, -i), on = wset.has(dd); cal += '<span class="cal-d' + (on ? ' on' : '') + (i === 0 ? ' today' : '') + '" title="' + fmtDay(dd) + (on ? ' · weighed in' : ' · missed') + '">' + parse(dd).getDate() + '</span>'; }
  $('#cal').innerHTML = cal;

  // weight
  $('#goal-tag').textContent = goal ? 'Goal ' + goal.toFixed(1) + ' kg' : 'Goal not set';
  $('#wt-form').hidden = logged;
  const wd = $('#wt-done'); wd.hidden = !logged; wd.style.display = logged ? 'flex' : '';
  if (logged) wd.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--forest);flex-shrink:0"><path class="ic" style="stroke-width:2.4" d="M4 12.5l5 5L20 6.5"/></svg><span style="flex:1"><strong>' + cur.toFixed(1) + ' kg</strong> logged today' + (wChange(w) ? ', ' + wChangeTxt(wChange(w)) : '') + '. Streak: ' + streak + (streak === 1 ? ' day.' : ' days.') + '</span><button class="ghost" type="button" id="wt-edit">Fix today’s weight</button>';
  renderChart(goal, w, $('#chart-box'), start);
  const wk = w.filter((x) => x.d >= addDays(TODAY, -7)), wkD = wk.length > 1 ? wk[wk.length - 1].v - wk[0].v : null;
  $('#wt-kv').innerHTML = '<div><span class="eyebrow">Start</span><strong class="num">' + start.toFixed(1) + ' kg</strong></div><div><span class="eyebrow">Last 7 days</span><strong class="num">' + (wkD == null ? '—' : (wkD > 0 ? '+' : '−') + Math.abs(wkD).toFixed(1) + ' kg') + '</strong></div><div><span class="eyebrow">Current</span><strong class="num">' + cur.toFixed(1) + ' kg</strong></div><div><span class="eyebrow">Goal</span><strong class="num" style="color:var(--slate)">' + (goal ? goal.toFixed(1) + ' kg' : '—') + '</strong></div>';
  const jr = $('#journey');
  if (goal && goal < start) {
    const total = start - goal, lostC = Math.max(0, lost), pct = Math.min(lostC / total, 1), marks = [];
    for (let k = 2; k < total - 0.5; k += 2) marks.push(k);
    const nxt = marks.find((k) => k > lostC);
    jr.hidden = false;
    jr.innerHTML = '<div class="jr-head"><span class="eyebrow">Your journey · ' + start.toFixed(1) + ' to ' + goal.toFixed(1) + ' kg</span><strong class="small">' + (pct >= 1 ? 'Goal reached.' : nxt ? 'Next milestone: ' + (start - nxt).toFixed(1) + ' kg · ' + (nxt - lostC).toFixed(1) + ' kg to go' : 'Final stretch: ' + (total - lostC).toFixed(1) + ' kg to go') + '</strong></div>'
      + '<div class="jr" role="img" aria-label="' + Math.round(pct * 100) + '% of the way to goal"><div class="jr-fill" style="width:' + (pct * 100).toFixed(1) + '%"></div>' + marks.map((k) => '<span class="jr-m' + (lostC >= k ? ' on' : '') + '" style="left:' + (k / total * 100).toFixed(1) + '%"><i></i><b>−' + k + ' kg</b></span>').join('')
      + '<span class="jr-m goal' + (pct >= 1 ? ' on' : '') + '" style="left:100%"><i></i><b>Goal</b></span><span class="jr-me" style="left:' + (pct * 100).toFixed(1) + '%"></span></div>';
  } else { jr.hidden = true; }

  // calories + photos
  const kcal = meals.reduce((a, m) => a + (+m.k || 0), 0), target = c.kcal_target || 1500;
  $('#kcal').textContent = kcal.toLocaleString('en-IN');
  $('#kcal-sub').textContent = 'of ' + target.toLocaleString('en-IN') + ' kcal · ' + (kcal <= target ? (target - kcal).toLocaleString('en-IN') + ' left' : 'over by ' + (kcal - target).toLocaleString('en-IN'));
  $('#meal-count').textContent = meals.length + ' of 3 meals logged';
  const ring = $('#ring'); ring.style.strokeDasharray = (Math.min(kcal / target, 1) * 276.5).toFixed(1) + ' 276.5'; ring.classList.toggle('over', kcal > target);
  $('#meals').innerHTML = meals.length ? meals.map((m, i) => '<div class="list-row"><span class="mono small muted" style="width:62px">' + esc(m.t) + '</span><span style="flex:1">' + esc(m.n) + '</span><span class="mono num small">' + (+m.k) + '</span><button class="x" type="button" data-rm-meal="' + i + '" aria-label="Remove ' + esc(m.n) + '"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path class="ic" d="M6 6l12 12M18 6L6 18"/></svg></button></div>').reverse().join('') : '<div class="small muted">Nothing logged yet today.</div>';
  renderFood();
  const ph = d.photos || [];
  renderPhotoComments();

  // water
  $('#wa-h').textContent = water + ' of 10 glasses';
  $('#wa-ml').textContent = (water * 250).toLocaleString('en-IN') + ' of 2,500 ml · tap a glass to fill it';
  const gl = $('#glasses');
  if (!gl.children.length) { let h = ''; for (let i = 0; i < 10; i++) h += '<button class="glass-btn" type="button" data-glass="' + i + '"><svg class="glass" viewBox="0 0 60 88" aria-hidden="true"><g class="wclip"><g class="wf" style="transform:translateY(88px)"><path class="wave" d="M-48 8 Q-42 3 -36 8 T-24 8 T-12 8 T0 8 T12 8 T24 8 T36 8 T48 8 T60 8 T72 8 V96 H-48 Z"/></g></g><path class="g-out" d="M6 4 H54 L48 84 H12 Z"/><path class="g-shine" d="M15 14 L18 72"/></svg><span>' + (i + 1) + '</span></button>'; gl.innerHTML = h; }
  paintGlasses(water);
  $('#wa-tip').textContent = water >= 10 ? 'Target reached. Anything more today is a bonus.' : water >= 5 ? 'Past halfway. Keep a bottle nearby for the afternoon.' : 'Aim for 5 glasses by lunch. ' + (5 - water) + ' to go.';

  // exercise
  $('#ex-types').innerHTML = ['Walk', 'Run', 'Yoga', 'Strength', 'Cycling', 'Dance'].map((t) => '<button class="chip" type="button" data-ex="' + t + '" aria-pressed="' + (t === S.exType) + '">' + t + '</button>').join('');
  $('#ex-btn').textContent = 'Log ' + S.exType.toLowerCase();
  $('#ex-total').textContent = exMin + ' of 30 min'; $('#ex-fill').style.width = Math.min(exMin / 30 * 100, 100) + '%';
  $('#ex-list').innerHTML = ex.map((e) => '<div class="list-row"><span style="flex:1">' + esc(e.type) + ' · ' + (+e.min) + ' min</span><span class="mono small muted">' + esc(e.t) + '</span></div>').join('') || '<div class="small muted">No workouts yet today. A 30-minute walk completes the challenge.</div>';

  // diet (a fresh one every 4 days) + tomorrow
  const diet = S.diet, dn = diet ? diffDays(diet.start_date, TODAY) + 1 : 0;
  $('#pl-eyebrow').textContent = !diet ? 'Your diet' : dn <= 4 ? 'Your diet · day ' + dn + ' of 4' : 'Your diet · new one due';
  $('#pl-h').textContent = 'From ' + COACH;
  $('#plan-today').innerHTML = diet ? dietHtml(diet, 96)
    + '<div class="diet-foot"><span class="diet-dots" aria-hidden="true">' + [1, 2, 3, 4].map((k) => '<i class="' + (k < dn ? 'past' : k === dn ? 'now' : '') + '"></i>').join('') + '</span><span class="small">'
    + (dn < 4 ? 'Follow this until ' + fmtDay(addDays(diet.start_date, 3)) + '. New diet from ' + fmtDay(addDays(diet.start_date, 4)) + '.' : dn === 4 ? 'Last day of this diet. Your new diet starts tomorrow.' : esc(COACH) + ' will send your next diet soon. Keep following this one until then.') + '</span></div>'
    : '<div class="empty">' + esc(COACH) + ' hasn’t added your diet yet. It shows up here as soon as she does.</div>';
  const items = [];
  if (diet && dn === 4) items.push('A new diet starts tomorrow');
  items.push('Weigh in to reach a ' + (logged ? streak + 1 : streak ? streak + 1 : 1) + '-day streak');
  const u = detoxUntil(c) - 1; if (u >= 0 && u <= 3) items.push(u === 0 ? 'Detox day tomorrow' : 'Detox in ' + (u + 1) + ' days');
  $('#tomorrow').innerHTML = '<div class="tmr"><span class="eyebrow">Coming up tomorrow</span><ul>' + items.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul></div>';
  renderLiquids();

  // challenges
  const ch = [['water', 'Drink 10 glasses', water, 10, 'glasses', 'var(--water)'], ['meals', 'Log 3 meals', Math.min(meals.length, 3), 3, 'meals', 'var(--ember)'], ['move', 'Move for 30 minutes', Math.min(exMin, 30), 30, 'min', 'var(--slate)']];
  $('#challenges').innerHTML = ch.map((x) => { const ok = !!done[x[0]], pct = Math.round(x[2] / x[3] * 100);
    return '<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px">' + (ok ? '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--gold)"><path class="ic" style="stroke-width:2.6" d="M4 12.5l5 5L20 6.5"/></svg>' : '') + x[1] + '</span><span class="mono small muted num">' + x[2] + ' / ' + x[3] + ' ' + x[4] + ' · ' + (ok ? 'Done' : '+2') + '</span></div><div class="track" role="progressbar" aria-label="' + x[1] + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><div class="fill' + (ok ? ' done' : '') + '" style="width:' + pct + '%' + (ok ? '' : ';background:' + x[5]) + '"></div></div></div>'; }).join('');
  $('#ch-line').textContent = doneN === 3 ? 'All three done. Bonus collected: +5 stars.' : doneN === 0 ? 'Each challenge pays 2 stars. Finish all three for a 5-star bonus.' : doneN + ' down, ' + (3 - doneN) + ' to go. The bonus unlocks when all three are done.';

  // badges
  const bs = c.badges || {};
  const prog = { streak7: [Math.min(streak / 7, 1), Math.min(streak, 7) + ' / 7 days'], water: [water / 10, water + ' / 10 today'], meal: [Math.min(meals.length / 3, 1), Math.min(meals.length, 3) + ' / 3 today'], king: [Math.min(streak / 30, 1), Math.min(streak, 30) + ' / 30 days'], detox: [Math.min(c.detox_done / 3, 1), Math.min(c.detox_done, 3) + ' / 3 detox days'] };
  $('#ac-h').textContent = BADGES.filter((b) => bs[b.k]).length + ' of 5 badges';
  $('#badges').innerHTML = BADGES.map((b) => { const on = !!bs[b.k];
    return '<div class="badge"><svg viewBox="0 0 64 64" aria-hidden="true"><path ' + (on ? 'style="fill:' + b.fill + '"' : 'class="hex-l"') + ' d="' + HEX + '"/><g transform="translate(20 20)"><path class="gl' + (on ? ' on' : '') + '" d="' + b.g + '"/></g></svg><strong style="font-size:14px">' + b.name + '</strong><span class="small muted" style="line-height:1.35">' + b.desc + '</span>'
      + (on ? '<span class="mono small" style="color:var(--forest)">Earned ' + fmtShort(bs[b.k]) + '</span>' : '<div style="width:100%;display:flex;flex-direction:column;gap:4px"><div class="track" style="height:4px"><div class="fill" style="width:' + Math.round(prog[b.k][0] * 100) + '%"></div></div><span class="mono small muted">' + prog[b.k][1] + '</span></div>') + '</div>'; }).join('');

  renderLeaderboard();
  renderClientHealth();
  renderClientMsgs();
}
function paintGlasses(water) {
  [...$('#glasses').children].forEach((b, i) => {
    const full = i < water;
    b.classList.toggle('full', full); b.classList.toggle('tapped', i === S.lastGlass);
    b.setAttribute('aria-pressed', full ? 'true' : 'false'); b.setAttribute('aria-label', 'Glass ' + (i + 1) + (full ? ', filled' : ', empty'));
    b.querySelector('.wf').style.transform = 'translateY(' + (full ? 0 : 88) + 'px)';
  });
}
function renderLeaderboard() {
  const key = S.lb, rows = S.board.map((r) => ({ ...r, loss_pct: +r.loss_pct, past_pct: +r.past_pct }));
  if (!rows.length) { $('#lb').innerHTML = '<div class="empty" style="margin:0 24px 24px">The leaderboard fills in as clients log.</div>'; return; }
  const val = (x) => key === 'loss' ? x.loss_pct : key === 'stars' ? x.stars : x.streak;
  rows.sort((a, b) => val(b) - val(a));
  const pastRank = {}; rows.slice().sort((a, b) => b.past_pct - a.past_pct).forEach((x, i) => { pastRank[x.client_id] = i + 1; });
  const max = Math.max(val(rows[0]) || 0, 0.0001), myRank = rows.findIndex((x) => x.is_me) + 1;
  $('#lb-h').textContent = myRank ? 'You’re #' + myRank + ' of ' + rows.length + ' on ' + (key === 'loss' ? 'weight lost' : key) : 'Leaderboard';
  document.querySelectorAll('.lbtab').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lb === key ? 'true' : 'false'));
  const shown = rows.slice(0, 5); if (myRank > 5) shown.push(rows[myRank - 1]);
  $('#lb').innerHTML = shown.map((x) => { const r = rows.indexOf(x) + 1, v = val(x), d = key === 'loss' ? pastRank[x.client_id] - r : null;
    const mv = d == null ? '' : '<span class="mv ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'same') + '">' + (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–') + '</span>';
    return '<div class="lb-row' + (x.is_me ? ' me' : '') + '"><span class="rank' + (r === 1 ? ' first' : '') + '">' + r + mv + '</span><span class="avatar">' + esc(x.initials) + '</span><strong style="font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (x.is_me ? 'You' : esc(x.label)) + '</strong><div class="lb-track" style="background:var(--soft)"><div class="lb-bar" style="width:' + Math.max(v / max * 100, 0).toFixed(1) + '%"></div></div><span class="mono num" style="text-align:right;font-size:13px">' + (key === 'loss' ? v.toFixed(1) + '%' : key === 'stars' ? v + ' stars' : v + ' days') + '</span></div>'; }).join('');
}
/* the client's photos for today, and what the team said about their photos this fortnight */
function renderPhotoComments() {
  const ph = (S.day && S.day.photos) || [];
  $('#photos').innerHTML = ph.length ? ph.map((p) => photoFig(p, 'Today, ' + p.t, p.t) || '<figure><figcaption>' + esc(p.t) + '</figcaption></figure>').join('') : '<span class="small muted" style="grid-column:1/-1">Snap each meal so ' + esc(COACH) + ' can check portions. +1 star per photo.</span>';
  const pcs = (S.pcs || []).slice().reverse().slice(0, 8), box = $('#pcs');
  box.hidden = !pcs.length;
  box.innerHTML = pcs.length ? '<strong class="small" id="pc-h">Comments on your photos</strong>' + pcs.map((x) => '<div class="pc-row">' + (S.photoUrls[x.path] ? '<button class="ph-btn pc-th" type="button" data-zoom="' + esc(x.path) + '" data-cap="Your meal photo" aria-label="Open the photo"><img loading="lazy" src="' + esc(S.photoUrls[x.path]) + '" alt=""></button>' : '<span class="pc-th"></span>') + pcHtml(x, false) + '</div>').join('') : '';
}
function renderFood() {
  const raw = S.q.trim(), q = raw.toLowerCase(), res = q ? FOODS.filter((f) => f.n.toLowerCase().indexOf(q) > -1).slice(0, 6) : [];
  const own = raw.length > 1 && !FOODS.some((f) => f.n.toLowerCase() === q);
  const box = $('#food-res'); box.hidden = !(res.length || own) || !!S.pick;
  box.innerHTML = res.map((f) => '<button class="result" type="button" role="listitem" data-food="' + esc(f.n) + '"><span style="display:flex;flex-direction:column"><span>' + esc(f.n) + '</span><span class="small muted">' + esc(f.s) + '</span></span><span style="display:flex;gap:10px;align-items:center"><span class="mono num small">' + f.k + ' kcal</span><strong style="color:var(--forest);font-size:13px">Choose</strong></span></button>').join('')
    + (own ? '<button class="result" type="button" role="listitem" data-food-own="1"><span style="display:flex;flex-direction:column"><span>Add “' + esc(raw.slice(0, 48)) + '”</span><span class="small muted">Not on the list? Add it as your own food</span></span><strong style="color:var(--forest);font-size:13px">Add</strong></button>' : '');
  renderPick();
}
/* after choosing a food: how many, and for your own foods, the calories in one */
function renderPick() {
  const p = S.pick, box = $('#food-pick'); box.hidden = !p; if (!p) { box.innerHTML = ''; return; }
  box.innerHTML = '<div style="display:flex;flex-direction:column;gap:2px"><strong>' + esc(p.n) + '</strong><span class="small muted">' + (p.own ? 'Your own food' : esc(p.s) + ' · ' + p.k + ' kcal each') + '</span></div>'
    + (p.own ? '<div class="field"><label class="lbl" for="fp-k">Calories in one serving</label><input class="input num" id="fp-k" type="number" inputmode="numeric" min="0" max="2000" step="1" value="' + (p.k == null ? '' : p.k) + '" style="max-width:160px"><span class="small muted">' + (p.est ? 'Estimated from ' + esc(p.est) + '. Change it if you know the real number.' : 'We couldn’t estimate this one. Enter your best guess.') + '</span></div>' : '')
    + '<div class="field"><span class="lbl" id="fp-ql">How many did you have?</span><div class="fp-q" role="group" aria-labelledby="fp-ql">' + [0.5, 1, 2, 3, 4].map((v) => '<button class="chip" type="button" data-fp-set="' + v + '" aria-pressed="' + (p.q === v) + '">' + qtyTxt(v) + '</button>').join('')
    + '<span class="stepper"><button class="st" type="button" data-fp-step="-0.5" aria-label="Half less">−</button><span class="num" id="fp-qv" aria-live="polite">' + qtyTxt(p.q) + '</span><button class="st" type="button" data-fp-step="0.5" aria-label="Half more">+</button></span></div></div>'
    + '<div class="err" id="fp-err" role="alert" hidden></div>'
    + '<div class="row"><button class="btn" type="button" id="fp-add"></button><button class="ghost" style="height:44px" type="button" id="fp-cancel">Cancel</button></div>';
  paintPickTotal();
}
function paintPickTotal() { const p = S.pick, b = $('#fp-add'); if (!p || !b) return; b.textContent = p.k == null || isNaN(p.k) ? 'Add' : 'Add · ' + Math.round(p.k * p.q) + ' kcal'; }
function addPicked() {
  const p = S.pick, err = $('#fp-err'), fail = (m) => { err.textContent = m; err.hidden = false; };
  if (p.k == null || isNaN(p.k) || p.k < 0) return fail('Enter the calories in one serving.');
  const total = Math.round(p.k * p.q);
  if (total > 3000) return fail('That is over 3,000 kcal. Check the number.');
  const label = p.n.slice(0, 50) + (p.q !== 1 ? ' × ' + qtyTxt(p.q) : '');
  S.pick = null; S.q = ''; $('#food-in').value = ''; renderFood();
  logDay('meal_add', { n: label, k: total, t: clock() }, label + ' logged');
}

/* client events */
$('#wt-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = parseFloat($('#wt-in').value), err = $('#wt-err');
  if (!(v >= 30 && v <= 250)) { err.textContent = 'Enter a weight between 30 and 250 kg, like 73.6.'; err.hidden = false; return; }
  err.hidden = true; $('#wt-in').value = '';
  queue(async () => {
    const before = start0(); const { data, error } = await S.sb.rpc('log_weight', { p_kg: Math.round(v * 10) / 10 });
    if (error) throw error;
    await loadClient(); renderClient(); reward(data, 'Morning weigh-in logged', { weight: true });
    const c = S.me, start = num(c.start_kg), goal = num(c.goal_kg), after = start - curOf(c, S.weights);
    const hit = Math.floor(after / 2) * 2;
    if (goal && curOf(c, S.weights) <= goal && before.cur > goal) celebrate({ name: 'Goal reached', desc: 'You hit ' + goal.toFixed(1) + ' kg', fill: 'var(--gold-fill)', g: G.star }, COACH + ' will set your maintenance plan.', 'Huge day');
    else if (hit >= 2 && hit > Math.floor(before.lost / 2) * 2) celebrate({ name: hit + ' kg down', desc: 'Another milestone on your journey', fill: 'var(--forest)', g: G.star }, 'Next stop: ' + (hit + 2) + ' kg.', 'Milestone');
  });
});
function start0() { const c = S.me, cur = curOf(c, S.weights); return { cur, lost: num(c.start_kg) - cur }; }
$('#ex-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = parseInt($('#ex-min').value, 10), err = $('#ex-err');
  if (!(m >= 5 && m <= 300)) { err.textContent = 'Enter between 5 and 300 minutes.'; err.hidden = false; return; }
  err.hidden = true; logDay('exercise', { type: S.exType, min: m, t: clock() }, S.exType + ' logged');
});
$('#food-in').addEventListener('input', (e) => { S.q = e.target.value; S.pick = null; renderFood(); });
$('#food-pick').addEventListener('input', (e) => { if (e.target.id === 'fp-k' && S.pick) { S.pick.k = e.target.value === '' ? null : Math.round(+e.target.value); $('#fp-err').hidden = true; paintPickTotal(); } });
$('#food-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = $('#food-res .result'); if (b) b.click(); } });
$('#ph-in').addEventListener('change', (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Choose a photo (JPG or PNG).'); return; }
  if (((S.day && S.day.photos) || []).length >= 6) { toast('You can add up to 6 photos a day.'); return; }
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1024 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    cv.toBlob((blob) => {
      if (!blob) { toast('That photo couldn’t be read. Try another.'); return; }
      toast('Uploading photo…');
      queue(async () => {
        const rnd = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
        const path = S.me.id + '/' + TODAY + '/' + rnd + '.jpg';
        const up = await S.sb.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        const { data, error } = await S.sb.rpc('log_day', { p_action: 'photo', p_payload: { path, t: clock() } });
        if (error) throw error;
        await loadClient(); renderClient(); reward(data, 'Meal photo shared');
      });
    }, 'image/jpeg', 0.78);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('That photo couldn’t be read. Try a JPG or PNG.'); };
  img.src = url;
});

function renderClientHealth() {
  const c = S.me, ok = !!c.health_consent_at;
  $('#hs-consent').hidden = ok; $('#hs-body').hidden = !ok; $('#bt-toggle').hidden = !ok;
  if (!ok) return;
  const tl = S.tests[S.tests.length - 1];
  $('#bt-h').textContent = tl ? 'Report from ' + fmtDay(tl.d) : 'No reports yet';
  $('#bt-view').innerHTML = testsHtml(S.tests, S.reportUrls);
}
function dietHtml(diet, w) {
  const m = dietMeals(diet);
  return MEALS.map((name, i) => (m[i] && String(m[i]).trim() ? '<div class="diet-row" style="grid-template-columns:' + w + 'px minmax(0,1fr)"><span class="eyebrow" style="padding-top:3px">' + name + '</span><span style="white-space:pre-line">' + esc(m[i]) + '</span></div>' : '')).join('')
    + (diet.notes ? '<div class="notice" style="margin-top:12px"><strong>Note:</strong> <span style="white-space:pre-line">' + esc(diet.notes) + '</span></div>' : '');
}
const TICK = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path class="ic" style="stroke-width:3" d="M4 12.5l5 5L20 6.5"/></svg>';
function renderLiquids() {
  const L = S.liquids || [], T = S.ticked || new Set(), n = L.filter((x) => T.has(x.id)).length;
  $('#lq-h').textContent = L.length ? n + ' of ' + L.length + ' taken today' : 'Daily liquids';
  $('#lq-list').innerHTML = L.length ? L.map((x) => { const on = T.has(x.id);
    return '<button class="lq' + (on ? ' on' : '') + '" type="button" role="checkbox" aria-checked="' + on + '" data-liquid="' + esc(x.id) + '"><span class="lq-box">' + TICK + '</span><span class="lq-t"><strong>' + esc(x.name) + '</strong>' + (x.when_text ? '<span class="small muted">' + esc(x.when_text) + '</span>' : '') + '</span></button>'; }).join('')
    : '<div class="empty">' + esc(COACH) + ' hasn’t added your liquids yet.</div>';
  $('#lq-tip').textContent = !L.length ? '' : n >= L.length ? 'All done for today.' : 'Tick each one as you take it. +2 stars when you finish the list.';
}
function renderClientMsgs() {
  if (!S.me) return;
  const fam = S.threads.filter((t) => t.kind === 'family');
  const opts = [{ id: S.dmId, label: COACH }, { id: S.asstId, label: 'Assistant' }].concat(fam.map((t) => ({ id: t.id, label: t.title + ' · family' })));
  const fresh = (id) => { const t = S.threads.find((x) => x.id === id); return t && t.last_from_staff && t.last_text && id !== S.openThread && S.seen[id] !== t.last_at; };
  $('#c-threads').innerHTML = opts.map((o) => '<button class="chip" type="button" data-thread="' + esc(o.id) + '" aria-pressed="' + (o.id === S.openThread) + '">' + esc(o.label) + (fresh(o.id) ? '<span class="dot-new" style="margin-left:8px"></span>' : '') + '</button>').join('');
  const th = S.threads.find((t) => t.id === S.openThread);
  if (th) S.seen[th.id] = th.last_at;
  const asst = S.openThread === S.asstId;
  $('#ms-h').textContent = th && th.kind === 'family' ? th.title : asst ? 'Chat with the assistant' : 'Chat with ' + COACH;
  paintThread('#c-thread', S.openThread, 'No messages yet. Say hello to ' + (asst ? 'the assistant' : COACH) + '.');
}
$('#hs-agree').addEventListener('click', () => queue(async () => { fixErr(await S.sb.rpc('give_health_consent')); await loadClient(); renderClient(); toast('Blood test tracking is on'); }));
$('#bt-toggle').addEventListener('click', (e) => { const f = $('#bt-form'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); e.currentTarget.textContent = f.hidden ? 'Add a result' : 'Cancel'; if (!f.hidden) { $('#bt-d').value = TODAY; $('#bt-d').max = TODAY; $('#bt-a').focus(); } });
$('#bt-file').addEventListener('change', (e) => { const f = e.target.files[0]; $('#bt-file-l').textContent = f ? f.name.slice(0, 22) : 'Attach report'; });
$('#bt-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('#bt-err'), val = (id) => { const v = $(id).value.trim(); return v ? +v : null; };
  const d = $('#bt-d').value || TODAY, row = { hba1c: val('#bt-a'), ldl: val('#bt-l'), hdl: val('#bt-hd'), tg: val('#bt-t') }, file = $('#bt-file').files[0];
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (Object.values(row).every((v) => v == null)) return fail('Enter at least one result from your report.');
  if (d > TODAY) return fail('The test date can’t be in the future.');
  if (row.hba1c != null && !(row.hba1c >= 3 && row.hba1c <= 20)) return fail('HbA1c is usually between 4 and 14%. Check the number.');
  if (row.ldl != null && !(row.ldl >= 10 && row.ldl <= 500)) return fail('LDL should be between 10 and 500 mg/dL.');
  if (row.hdl != null && !(row.hdl >= 5 && row.hdl <= 200)) return fail('HDL should be between 5 and 200 mg/dL.');
  if (row.tg != null && !(row.tg >= 10 && row.tg <= 2000)) return fail('Triglycerides should be between 10 and 2000 mg/dL.');
  if (file && file.size > 10 * 1024 * 1024) return fail('That file is over 10 MB. Try a photo of the report instead.');
  if (file && !/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.type)) return fail('Attach a photo (JPG or PNG) or a PDF.');
  err.hidden = true;
  queue(async () => {
    let path = null;
    if (file) { path = S.me.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) + '-' + file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60); fixErr(await S.sb.storage.from('reports').upload(path, file, { contentType: file.type })); }
    const r = fixErr(await S.sb.rpc('add_blood_test', { p_d: d, p_hba1c: row.hba1c, p_ldl: row.ldl, p_hdl: row.hdl, p_tg: row.tg, p_file: path }));
    $('#bt-form').reset(); $('#bt-file-l').textContent = 'Attach report'; $('#bt-form').hidden = true; $('#bt-toggle').textContent = 'Add a result'; $('#bt-toggle').setAttribute('aria-expanded', 'false');
    await loadClient(); renderClient();
    if (r.data && r.data.gained) reward(r.data, 'Blood test saved'); else toast('Blood test saved');
  });
});
$('#c-comp').addEventListener('submit', (e) => {
  e.preventDefault(); const v = $('#c-comp-in').value.trim(); if (!v || !S.openThread) return;
  $('#c-comp-in').value = '';
  queue(async () => { fixErr(await S.sb.rpc('send_message', { p_thread: S.openThread, p_body: v })); await loadMsgs(S.openThread); await loadThreads(); renderClientMsgs(); });
});

/* ================================================================== */
/*  COACH + ASSISTANT                                                  */
/* ================================================================== */
async function loadStaff() {
  const since = addDays(TODAY, -120);
  const [c, p, w, d, dt, t, lq, tk] = await Promise.all([
    S.sb.from('clients').select('*').order('name'),
    S.sb.from('profiles').select('id,username,role,display_name,must_change_pw'),
    allRows(() => S.sb.from('weights').select('client_id,d,kg,at').gte('d', since).order('d').order('client_id')),
    S.sb.from('day_logs').select('*').eq('d', TODAY),
    S.sb.from('diets').select('id,client_id,start_date,meals,notes').order('start_date'),
    S.sb.from('blood_tests').select('*').order('d'),
    S.sb.from('liquids').select('id,client_id,name,when_text,sort').eq('active', true).order('sort'),
    S.sb.from('liquid_ticks').select('client_id,liquid_id,at').eq('d', TODAY)
  ]);
  [c, p, w, d, dt, t, lq, tk].forEach(fixErr);
  S.clients = c.data || []; S.profiles = {}; S.allWeights = {}; S.days = {}; S.diets = {}; S.allTests = {}; S.liq = {}; S.ticks = {};
  (p.data || []).forEach((x) => { S.profiles[x.id] = x; });
  (w.data || []).forEach((x) => { (S.allWeights[x.client_id] = S.allWeights[x.client_id] || []).push({ d: x.d, v: num(x.kg), at: x.at }); });
  (d.data || []).forEach((x) => { S.days[x.client_id] = x; });
  (dt.data || []).forEach((x) => { (S.diets[x.client_id] = S.diets[x.client_id] || []).push(x); });
  (t.data || []).forEach((x) => { (S.allTests[x.client_id] = S.allTests[x.client_id] || []).push(x); });
  (lq.data || []).forEach((x) => { (S.liq[x.client_id] = S.liq[x.client_id] || []).push(x); });
  (tk.data || []).forEach((x) => { (S.ticks[x.client_id] = S.ticks[x.client_id] || {})[x.liquid_id] = x.at; });
  await loadComments();
  await loadThreads();
  const mine = inboxThreads();
  if (!S.kThread || !mine.find((x) => x.id === S.kThread)) { const wt = mine.find((x) => !x.last_from_staff) || mine[0]; S.kThread = wt ? wt.id : null; }
  await loadMsgs(S.kThread);
}
let staffBusy = false;
async function refreshStaff() {
  if (staffBusy) return; staffBusy = true;
  try { await loadStaff(); renderStaff(); if (S.drawer) renderDrawer(); } catch (e) { toast(friendly(e)); } finally { staffBusy = false; }
}
const wsOf = (c) => S.allWeights[c.id] || [];
const profOf = (c) => S.profiles[c.user_id] || {};
/* the coach's own inbox is her chats and family groups; she can also look at the assistant's chats */
const inboxKinds = () => (isCoach() ? (S.ibox === 'asst' ? ['asst'] : ['dm', 'family']) : ['asst', 'family']);
const inboxThreads = () => S.threads.filter((t) => inboxKinds().indexOf(t.kind) > -1);
const waitingThreads = () => S.threads.filter((t) => !t.last_from_staff && (!isCoach() || t.kind !== 'asst'));
const threadName = (t) => (t.kind === 'family' ? t.title : ((S.clients.find((c) => c.id === t.client_id) || {}).name || t.title));
const curDiet = (c) => { const a = (S.diets[c.id] || []).filter((x) => x.start_date <= TODAY); return a[a.length - 1] || null; };
const dietDay = (dt) => diffDays(dt.start_date, TODAY) + 1;
const liqOf = (c) => S.liq[c.id] || [];
const liqDone = (c) => { const T = S.ticks[c.id] || {}; return liqOf(c).filter((x) => T[x.id]).length; };
const tmin = (t) => { const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(String(t || '').trim()); if (!m) return -1; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + +m[2]; };
const isoDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const isoMin = (iso) => { const x = new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }); return +x.slice(0, 2) * 60 + +x.slice(3, 5); };
const minLabel = (m) => (m < 0 ? 'TODAY' : ((Math.floor(m / 60) + 11) % 12 + 1) + ':' + pad(m % 60) + (m < 720 ? ' AM' : ' PM'));
async function coachUpdate(id, patch, msg) {
  if (!isCoach()) return false;
  const { data, error } = await S.sb.from('clients').update(patch).eq('id', id).select('id');
  if (error || !data || !data.length) { toast(error ? friendly(error) : 'That change didn’t save. Try again.'); return false; }
  if (msg) toast(msg); await refreshStaff(); return true;
}

function staffTabs() {
  const t = [['today', isCoach() ? 'Today' : 'Follow-ups'], ['clients', 'Clients'], ['messages', 'Messages'], ['plans', 'Renewals & detox']];
  if (isCoach()) t.splice(3, 0, ['diet', 'Diet plans']);
  return t;
}
function setTab(id) {
  if (!staffTabs().some((t) => t[0] === id)) id = 'today';
  S.tab = id; lsSet('sf-tab-' + S.role, id);
  ['today', 'clients', 'messages', 'diet', 'plans'].forEach((k) => { $('#p-' + k).hidden = k !== id; });
  document.querySelectorAll('.stab').forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll('#sbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  if (id === 'messages') { const th = $('#k-thread'); th.scrollTop = th.scrollHeight; }
}

function renderStaff() {
  const cs = S.clients, n = cs.length, hr = istHour();
  const logged = cs.filter((c) => c.last_log_date === TODAY).length, waiting = waitingThreads().length, tasks = buildTasks();
  $('#k-eyebrow').textContent = fmtDay(TODAY) + ' · ' + (isCoach() ? 'Coach' : 'Assistant');
  $('#k-h1').textContent = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', ' + first(S.profile.display_name) + '.';
  $('#k-line').textContent = !n ? (isCoach() ? 'No clients yet. Open Clients and tap Add client to create the first login.' : 'No clients yet. They appear here once ' + COACH + ' adds them.')
    : (tasks.length ? tasks.length + ' thing' + (tasks.length > 1 ? 's' : '') + ' need' + (tasks.length > 1 ? '' : 's') + ' attention today. ' : 'Nothing needs attention right now. ') + logged + ' of ' + n + ' clients have weighed in.';
  const avgLoss = n ? cs.reduce((a, c) => a + lossPctOf(c, wsOf(c)), 0) / n : 0;
  $('#kpis').innerHTML = [['clients', n, 'clients', ''], ['today', logged + '/' + n, 'weighed in today', ''], ['messages', waiting, 'waiting for a reply', waiting ? 'warm' : ''], ['', avgLoss.toFixed(1) + '%', 'avg lost since start', '']]
    .map((k) => (k[0] ? '<button class="kpi" type="button" data-tab="' + k[0] + '">' : '<div class="kpi">') + '<strong class="num ' + k[3] + '">' + k[1] + '</strong><span class="small muted">' + k[2] + '</span>' + (k[0] ? '</button>' : '</div>')).join('');
  const counts = { today: tasks.length, messages: waiting };
  $('#stabs').innerHTML = staffTabs().map((t) => '<button class="stab" type="button" role="tab" id="t-' + t[0] + '" aria-controls="p-' + t[0] + '" data-tab="' + t[0] + '">' + t[1] + (counts[t[0]] ? '<span class="cnt">' + counts[t[0]] + '</span>' : '') + '</button>').join('');
  const SB = { today: ['M3 11l9-7 9 7v9H3z', isCoach() ? 'Today' : 'Tasks'], clients: [ICONS.users, 'Clients'], messages: [ICONS.chat, 'Chat'], diet: [G.leaf, 'Diets'], plans: [ICONS.clock, 'Plans'] };
  $('#sbar').innerHTML = staffTabs().map((t) => '<button type="button" data-tab="' + t[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ic" d="' + SB[t[0]][0] + '"/></svg>' + SB[t[0]][1] + (counts[t[0]] ? '<span class="cnt">' + counts[t[0]] + '</span>' : '') + '</button>').join('');
  setTab(S.tab || 'today');
  renderTasks(tasks); renderCheckins(); renderQuick(); renderPhotos(); renderWeek(); renderActivity(); renderW7();
  renderClientsTable(); renderInbox(); renderGroupPeople();
  if (isCoach()) renderDiet();
  renderPlans();
}
function renderQuick() {
  $('#k-quick').innerHTML = (isCoach() ? '<button class="btn" type="button" data-first-client="1">Add client</button>' : '')
    + '<button class="ghost" type="button" data-open-bc="1">Broadcast a message</button>'
    + (isCoach() ? '<button class="ghost" type="button" data-tab="diet">Write a diet</button>' : '<button class="ghost" type="button" data-tab="messages">Open inbox</button>');
}
/* every meal photo sent today, across all clients */
async function renderPhotos() {
  const items = []; S.clients.forEach((c) => (((S.days[c.id] || {}).photos) || []).forEach((ph) => items.push({ c, ph })));
  $('#ph-h').textContent = items.length ? items.length + ' photo' + (items.length > 1 ? 's' : '') + ' today' : 'Today’s photos';
  const box = $('#k-photos'), sig = items.map((x) => x.ph.path + pcOf(x.ph.path).length).join();
  if (!items.length) { box.dataset.sig = ''; box.innerHTML = '<div class="empty" style="grid-column:1/-1">No meal photos yet today. They show up here as clients upload them.</div>'; return; }
  if (box.dataset.sig === sig) return;
  await loadPhotoUrls(items.map((x) => x.ph.path));
  box.dataset.sig = sig;
  box.innerHTML = items.slice().reverse().map((x) => photoFig(x.ph, x.c.name + ' · ' + x.ph.t, first(x.c.name) + ' · ' + x.ph.t)).join('');
}
function photoFig(ph, cap, label) {
  return S.photoUrls[ph.path] ? '<figure><button class="ph-btn" type="button" data-zoom="' + esc(ph.path) + '" data-cap="' + esc(cap) + '" aria-label="Open photo, ' + esc(cap) + '"><img loading="lazy" src="' + esc(S.photoUrls[ph.path]) + '" alt="Meal photo, ' + esc(cap) + '"></button><figcaption>' + esc(label + pcCount(ph.path)) + '</figcaption></figure>' : '';
}
/* ---------- comments on meal photos ---------- */
const pcOf = (path) => (S.pcs || []).filter((x) => x.path === path);
const pcCount = (path) => { const n = pcOf(path).length; return n ? ' · ' + n + (n === 1 ? ' comment' : ' comments') : ''; };
const pcHtml = (x, canDel) => '<div class="pc"><div class="pc-h"><strong>' + esc(x.author_name) + '</strong><span class="small muted">' + msgTime(x.created_at) + '</span>' + (canDel ? '<button class="linkbtn" style="padding:0" type="button" data-pc-del="' + esc(x.id) + '">Delete</button>' : '') + '</div><span style="white-space:pre-line">' + esc(x.body) + '</span></div>';
async function loadComments() {
  const r = await S.sb.from('photo_comments').select('id,client_id,path,author,author_name,body,created_at').gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('created_at');
  S.pcs = r.error ? (S.pcs || []) : (r.data || []);
}
function openZoom(path, cap) { S.zoom = { path, cap: cap || '' }; renderZoom(); }
function closeZoom() { S.zoom = null; const z = $('#zoom'); if (z) z.remove(); }
/* the photo opened large, with the team's comments; the team can add one */
function renderZoom() {
  let z = $('#zoom'); if (!S.zoom) { if (z) z.remove(); return; }
  const old = z && z.querySelector('#pc-text'), draft = old ? old.value : '';
  if (!z) {
    z = document.createElement('div'); z.id = 'zoom'; z.className = 'pz'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); z.setAttribute('aria-label', 'Meal photo'); document.body.appendChild(z);
    z.addEventListener('click', (e) => {
      if (e.target === z || e.target.closest('[data-zoom-close]')) { closeZoom(); return; }
      const del = e.target.closest('[data-pc-del]');
      if (del) { del.disabled = true; S.sb.rpc('delete_photo_comment', { p_id: del.dataset.pcDel }).then(async (r) => { if (r.error) { toast(friendly(r.error)); del.disabled = false; return; } await loadComments(); renderZoom(); if (isStaff()) renderStaff(); }); }
    });
    z.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!S.zoom || !isStaff()) return;
      const v = $('#pc-text').value.trim(), err = $('#pc-err'), b = $('#pc-go');
      if (!v) { err.textContent = 'Write the comment first.'; err.hidden = false; return; }
      err.hidden = true; b.disabled = true;
      const r = await S.sb.rpc('comment_photo', { p_path: S.zoom.path, p_body: v });
      if (r.error) { b.disabled = false; err.textContent = friendly(r.error); err.hidden = false; return; }
      $('#pc-text').value = ''; await loadComments(); renderZoom(); renderStaff(); toast('Comment sent');
    });
  }
  const list = pcOf(S.zoom.path), staff = isStaff();
  z.innerHTML = '<div class="pz-in"><div class="pz-top"><span class="small">' + esc(S.zoom.cap) + '</span><button class="ghost" type="button" data-zoom-close="1">Close</button></div>'
    + '<img src="' + esc(S.photoUrls[S.zoom.path] || '') + '" alt="Meal photo">'
    + '<div class="pz-c">' + (list.length ? list.map((x) => pcHtml(x, staff && (isCoach() || x.author === S.session.user.id))).join('') : '<span class="small muted">' + (staff ? 'No comments yet. The client sees what you write here.' : 'No comments on this photo yet.') + '</span>')
    + (staff ? '<form id="pc-form" novalidate style="display:flex;flex-direction:column;gap:10px"><label class="lbl" for="pc-text">Comment for the client</label><textarea class="ta" id="pc-text" maxlength="500" rows="2" placeholder="e.g. Good portion. Add more salad next time."></textarea><div class="err" id="pc-err" role="alert" hidden></div><button class="btn" type="submit" id="pc-go" style="align-self:flex-start">Send comment</button></form>' : '') + '</div></div>';
  if (draft && $('#pc-text')) $('#pc-text').value = draft;
}

/* ---------- phone notifications ---------- */
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let installEvt = null, pendingLink = /^#(chat=[0-9a-f-]{36}|photos)$/.test(location.hash) ? location.hash : null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && typeof e.data.sfOpen === 'string') openLink(e.data.sfOpen); });
}
window.addEventListener('hashchange', () => { if (/^#(chat=[0-9a-f-]{36}|photos)$/.test(location.hash)) openLink(location.hash); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; renderNotify(); });
window.addEventListener('appinstalled', () => { installEvt = null; renderNotify(); });
const keyBytes = (k) => Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const bytesKey = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const swReady = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('The app isn’t ready for notifications yet. Close it and open it again.')), 8000))]);
/* register this phone for the signed-in person (only once they have allowed notifications) */
async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted' || !S.session) return false;
  const reg = await swReady(), key = (await S.sb.rpc('push_key')).data;
  if (!key) return false;
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options && sub.options.applicationServerKey && bytesKey(sub.options.applicationServerKey) !== key) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const j = sub.toJSON(), r = await S.sb.rpc('save_push_sub', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 300) });
  if (r.error) throw r.error;
  S.pushOn = true; S.pushErr = ''; return true;
}
/* on sign-out this phone must stop getting that person's notifications */
async function dropPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (!sub) return;
  try { if (S.session) await S.sb.rpc('drop_push_sub', { p_endpoint: sub.endpoint }); } catch (e) {}
  try { await sub.unsubscribe(); } catch (e) {}
}
function forgetPush() { if (!pushSupported()) return; navigator.serviceWorker.getRegistration().then((r) => r && r.pushManager.getSubscription()).then((sub) => sub && sub.unsubscribe()).catch(() => {}); }
async function enablePush() {
  const b = $('#nt-on'); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span> Turning on…'; }
  S.pushErr = '';
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (await syncPush()) { toast('Notifications are on'); try { (await swReady()).showNotification('Notifications are on', { body: 'You’ll get a notification here when there is a new message.', icon: 'icon-192.png', badge: 'badge-96.png', tag: 'sf-hello' }); } catch (e) {} }
      else S.pushErr = 'Notifications aren’t ready yet. Try again in a minute.';
    }
  } catch (e) { S.pushErr = 'Couldn’t turn notifications on. ' + ((e && e.message) || ''); }
  renderNotify();
}
function renderNotify() {
  const box = $('#nt'); if (!box) return;
  const live = !$('#app').hidden && !!S.session && !!S.role && (S.role !== 'client' || !!(S.me && S.me.consent_at));
  const who = S.role === 'client' ? COACH + ' or the assistant messages you' : 'a client messages you';
  const later = Date.now() < (+lsGet('sf-nt-later') || 0), perm = pushSupported() ? Notification.permission : '';
  const card = (title, text, extra, btns) => '<div class="nt-card"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--forest);flex-shrink:0;margin-top:2px"><path class="ic" d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg><div class="nt-t"><strong>' + title + '</strong><span class="small">' + text + '</span>' + (extra || '') + '<div class="row" style="margin-top:4px">' + (btns || '') + '<button class="ghost" style="height:44px" type="button" id="nt-later">Not now</button></div></div></div>';
  let h = '';
  if (live && !later) {
    if (IOS && !standalone()) h = card('Get notifications on your iPhone', 'Add Stayingfit to your home screen to get a notification when ' + esc(who) + '.', '<ol class="nt-steps"><li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li><li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li><li>Open <strong>Stayingfit</strong> from the new icon, sign in, and tap <strong>Turn on notifications</strong>.</li></ol>', '');
    else if (perm === 'default' || (perm === 'granted' && S.pushErr)) h = card('Turn on notifications', 'Get a notification on this phone when ' + esc(who) + ', even when the app is closed.', S.pushErr ? '<span class="small" style="color:var(--danger)">' + esc(S.pushErr) + '</span>' : '', '<button class="btn" type="button" id="nt-on">Turn on notifications</button>' + (installEvt && !standalone() ? '<button class="ghost" style="height:44px" type="button" id="nt-install">Add to home screen</button>' : ''));
    else if (perm === 'denied') h = card('Notifications are blocked on this phone', 'To get a notification when ' + esc(who) + ', allow notifications for Stayingfit, then close the app and open it again.', '<span class="small muted">' + (IOS ? 'iPhone: Settings, then Notifications, then Stayingfit, then turn on Allow Notifications.' : 'Android: press and hold the Stayingfit icon, tap App info, then Notifications, and turn them on. In Chrome: tap the icon to the left of the address bar, then Permissions.') + '</span>', '');
  }
  box.hidden = !h; box.innerHTML = h;
}
/* a tapped notification opens the right place */
async function openLink(h) {
  h = String(h || ''); if (!h) return;
  if (!S.session || !S.role || $('#app').hidden) { pendingLink = h; return; }
  pendingLink = null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  const m = /^#chat=([0-9a-f-]{36})$/.exec(h);
  try {
    if (m) {
      await loadThreads(); const th = S.threads.find((x) => x.id === m[1]); if (!th) return;
      if (S.role === 'client') { S.openThread = th.id; await loadMsgs(th.id); renderClientMsgs(); const el = $('#ms-h'); if (el) el.scrollIntoView({ block: 'start' }); }
      else { closeDrawer(); S.ibox = isCoach() && th.kind === 'asst' ? 'asst' : 'mine'; S.kThread = th.id; S.kOpen = true; setTab('messages'); await loadMsgs(th.id); renderInbox(); window.scrollTo({ top: 0 }); }
    } else if (h === '#photos' && S.role === 'client') { await refreshClient(); const el = $('#pcs'); if (el && !el.hidden) el.scrollIntoView({ block: 'center' }); }
  } catch (e) { /* opening the app is enough */ }
}
function renderWeek() {
  const from = addDays(TODAY, -7), rows = [];
  S.clients.forEach((c) => { const ws = wsOf(c); if (ws.length < 2) return;
    const before = ws.filter((x) => x.d <= from), base = before.length ? before[before.length - 1] : ws[0], cur = ws[ws.length - 1];
    if (cur.d > from && base !== cur) rows.push({ c, loss: base.v - cur.v }); });
  const top = rows.filter((x) => x.loss > 0.05).sort((a, b) => b.loss - a.loss).slice(0, 3);
  const st = S.clients.map((c) => ({ c, n: liveStreak(c) })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);
  $('#k-week').innerHTML = (top.length || st.length)
    ? (top.length ? '<span class="eyebrow">Most weight lost</span>' + top.map((x) => '<div class="wk-row"><span>' + esc(x.c.name) + '</span><strong class="num" style="color:var(--forest)">−' + x.loss.toFixed(1) + ' kg</strong></div>').join('') : '')
      + (st.length ? '<span class="eyebrow" style="display:block;margin-top:' + (top.length ? 14 : 0) + 'px">Longest streaks</span>' + st.map((x) => '<div class="wk-row"><span>' + esc(x.c.name) + '</span><strong class="num">' + x.n + ' days</strong></div>').join('') : '')
    : '<div class="small muted">Leaders show up here after a few days of weigh-ins.</div>';
}
function renderActivity() {
  const ev = [];
  S.clients.forEach((c) => {
    const ws = wsOf(c), lw = ws[ws.length - 1], d = S.days[c.id];
    if (lw && lw.d === TODAY && c.last_log_date === TODAY) ev.push({ m: lw.at && isoDay(lw.at) === TODAY ? isoMin(lw.at) : -1, c, t: 'weighed in at ' + lw.v.toFixed(1) + ' kg' + (wChange(ws) ? ', ' + wChangeTxt(wChange(ws)) : '') });
    if (d) {
      (d.meals || []).forEach((x) => ev.push({ m: tmin(x.t), c, t: 'logged ' + x.n }));
      (d.exercise || []).forEach((x) => ev.push({ m: tmin(x.t), c, t: 'did ' + (+x.min) + ' min of ' + String(x.type).toLowerCase() }));
      (d.photos || []).forEach((x) => ev.push({ m: tmin(x.t), c, t: 'sent a meal photo' }));
      if ((d.water || 0) >= 10) ev.push({ m: -1, c, t: 'finished all 10 glasses of water' });
    }
    const L = liqOf(c), T = S.ticks[c.id] || {};
    if (L.length && L.every((x) => T[x.id])) ev.push({ m: Math.max(...L.map((x) => isoMin(T[x.id]))), c, t: 'ticked all ' + L.length + ' liquids' });
  });
  inboxThreads().forEach((t) => { const c = S.clients.find((x) => x.id === t.client_id); if (c && !t.last_from_staff && t.last_text && isoDay(t.last_at) === TODAY) ev.push({ m: isoMin(t.last_at), c, t: 'sent a message: “' + t.last_text + '”' }); });
  ev.sort((a, b) => b.m - a.m);
  $('#ac2-h').textContent = ev.length ? ev.length + ' update' + (ev.length > 1 ? 's' : '') + ' today' : 'Activity';
  $('#k-activity').innerHTML = ev.length ? ev.slice(0, 14).map((x) => '<div class="act"><span class="mono muted">' + minLabel(x.m) + '</span><span class="avatar" style="width:28px;height:28px;font-size:10px">' + esc(initials(x.c.name)) + '</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><button class="linkbtn" style="padding:0;text-decoration:none;color:var(--ink);font-weight:700" type="button" data-pick="' + esc(x.c.id) + '">' + esc(first(x.c.name)) + '</button> ' + esc(x.t) + '</span></div>').join('')
    : '<div class="empty">Nothing logged yet today. Weigh-ins, meals, photos and liquids show up here as they happen.</div>';
}
function renderW7() {
  const n = S.clients.length, days = []; for (let i = 6; i >= 0; i--) days.push(addDays(TODAY, -i));
  const cnt = days.map((d) => S.clients.filter((c) => wsOf(c).some((x) => x.d === d)).length), max = Math.max(n, 1);
  $('#k-w7').innerHTML = days.map((d, i) => '<div title="' + fmtDay(d) + ': ' + cnt[i] + ' of ' + n + ' weighed in"><b class="num">' + cnt[i] + '</b><i class="' + (cnt[i] ? '' : 'zero') + '" style="height:' + Math.round(cnt[i] / max * 86) + 'px"></i><span>' + (i === 6 ? 'Today' : DOW[parse(d).getDay()]) + '</span></div>').join('');
}

/* follow-ups: what needs doing today, most urgent first */
function buildTasks() {
  const out = [], hr = istHour();
  waitingThreads().forEach((t) => out.push({ p: 1, title: threadName(t) + (t.kind === 'family' ? ' (family group)' : '') + ' is waiting for a reply', sub: '“' + (t.last_text || '') + '” · ' + msgTime(t.last_at), acts: [['Reply', 'data-kth="' + esc(t.id) + '" data-go="messages"', 'btn'], ['Mark done', 'data-done-thread="' + esc(t.id) + '"', 'ghost']] }));
  S.clients.forEach((c) => {
    const pr = profOf(c), ago = lastLogAgo(c), age = diffDays(String(c.created_at).slice(0, 10), TODAY);
    if (!c.consent_at) { if (age >= 1) out.push({ p: 3, title: c.name + ' hasn’t signed in yet', sub: 'Added ' + fmtShort(String(c.created_at).slice(0, 10)) + '. Check they got their login.', acts: isCoach() ? [['Send new login', 'data-pick="' + esc(c.id) + '" data-dmode="reset"', 'ghost']] : [] }); return; }
    if (ago >= 2 && (c.last_log_date || age >= 2)) out.push({ p: c.tier === 'Hand-holding' ? 1 : 2, title: c.name + (c.last_log_date ? ' hasn’t logged for ' + ago + ' days' : ' hasn’t logged anything yet'), sub: c.tier + ' check-ins' + (c.last_log_date ? ' · last weigh-in ' + fmtShort(c.last_log_date) : ''), acts: [['Message', 'data-msg-client="' + esc(c.id) + '" data-draft="checkin"', 'ghost']] });
    else if (c.tier === 'Hand-holding' && ago >= 1 && hr >= 11) out.push({ p: 2, title: c.name + ': no weigh-in yet today', sub: 'Hand-holding · streak ' + liveStreak(c) + ' days', acts: [['Nudge', 'data-msg-client="' + esc(c.id) + '" data-draft="nudge"', 'ghost']] });
    const pl = planLeft(c);
    if (pl <= 3) out.push({ p: pl < 0 ? 1 : 2, title: c.name + '’s plan ' + (pl < 0 ? 'ended ' + (-pl) + ' day' + (pl === -1 ? '' : 's') + ' ago' : pl === 0 ? 'ends today' : 'ends in ' + pl + ' day' + (pl === 1 ? '' : 's')), sub: c.tier + ' · ' + fmtDay(c.plan_end), acts: [['Send reminder', 'data-remind="' + esc(c.id) + '"', 'ghost']].concat(isCoach() ? [['Renew 30 days', 'data-renew="' + esc(c.id) + '"', 'ghost']] : []) });
    const dx = detoxUntil(c);
    if (dx <= 1) out.push({ p: dx < 0 ? 2 : 3, title: c.name + ': detox day ' + (dx < 0 ? 'overdue by ' + (-dx) + ' day' + (dx === -1 ? '' : 's') : dx === 0 ? 'today' : 'tomorrow'), sub: 'Every ' + c.detox_freq + ' days · ' + c.detox_done + ' done', acts: isCoach() ? [['Mark done', 'data-detox="' + esc(c.id) + '"', 'ghost']] : [['Message', 'data-msg-client="' + esc(c.id) + '" data-draft="detox"', 'ghost']] });
    if (c.consent_at) {
      const dt = curDiet(c), dn = dt ? dietDay(dt) : 0, wd = [['Write diet', 'data-edit-plan="' + esc(c.id) + '"', 'ghost']];
      if (isCoach() && !dt) out.push({ p: 2, title: c.name + ' has no diet yet', sub: 'Write their first 4-day diet', acts: wd });
      else if (isCoach() && dn > 4) out.push({ p: 1, title: c.name + ' needs a new diet', sub: 'The last one ended ' + fmtDay(addDays(dt.start_date, 3)), acts: wd });
      else if (isCoach() && dn === 4) out.push({ p: 3, title: c.name + '’s diet ends today', sub: 'The next one starts ' + fmtDay(addDays(dt.start_date, 4)), acts: wd });
      const L = liqOf(c).length, D = liqDone(c);
      if (L && D < L && hr >= 14) out.push({ p: 3, title: c.name + ' hasn’t ticked today’s liquids', sub: D + ' of ' + L + ' taken so far', acts: [['Message', 'data-msg-client="' + esc(c.id) + '" data-draft="liquids"', 'ghost']] });
      if (isCoach() && L && c.liquids_updated && diffDays(c.liquids_updated, TODAY) >= 30) out.push({ p: 3, title: c.name + '’s liquids list is a month old', sub: 'Last updated ' + fmtShort(c.liquids_updated), acts: [['Update list', 'data-pick="' + esc(c.id) + '" data-dmode="liquids"', 'ghost']] });
    }
    const ts = S.allTests[c.id] || [], tl = ts[ts.length - 1];
    if (tl && diffDays(String(tl.created_at).slice(0, 10), TODAY) <= 7) { const bad = TESTS.filter((T) => tl[T[0]] != null && T[3](+tl[T[0]]) === 2).map((T) => T[1] + ' ' + (+tl[T[0]])); if (bad.length) out.push({ p: 2, title: c.name + ': blood test needs a look', sub: bad.join(' · ') + ' · report ' + fmtShort(tl.d), acts: [['View', 'data-pick="' + esc(c.id) + '"', 'ghost']] }); }
  });
  return out.sort((a, b) => a.p - b.p);
}
function renderTasks(tasks) {
  $('#tk-eyebrow').textContent = isCoach() ? 'Needs you today' : 'Your list for today';
  $('#tk-count').textContent = tasks.length ? tasks.length + ' open' : '';
  $('#tasks').innerHTML = tasks.length ? tasks.map((t) => '<div class="fu"><span class="dot p' + t.p + '" aria-hidden="true"></span><div class="fu-t"><strong>' + esc(t.title) + '</strong><span class="small muted">' + esc(t.sub) + '</span></div><div class="fu-a">' + t.acts.map((a) => '<button class="' + a[2] + '" type="button" ' + a[1] + ' style="height:36px">' + a[0] + '</button>').join('') + '</div></div>').join('')
    : '<div class="empty">' + (S.clients.length ? 'All clear. Nobody needs a follow-up right now.' : (isCoach() ? START_HTML : 'Follow-ups appear here once ' + esc(COACH) + ' adds clients.')) + '</div>';
}
function renderCheckins() {
  const cs = S.clients, n = cs.length, done = cs.filter((c) => c.last_log_date === TODAY);
  $('#ci-h').textContent = n ? done.length + ' of ' + n + ' weighed in' : 'Weigh-ins';
  $('#ci-fill').style.width = n ? (done.length / n * 100).toFixed(1) + '%' : '0%';
  const rows = cs.slice().sort((a, b) => (b.last_log_date === TODAY) - (a.last_log_date === TODAY) || a.name.localeCompare(b.name));
  $('#ci-list').innerHTML = n ? rows.map((c) => { const d = S.days[c.id], ok = c.last_log_date === TODAY;
    return '<div class="ci-row"><span class="avatar">' + esc(initials(c.name)) + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.name) + '</span><span class="small ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'Weighed in' : 'Not yet') + (d ? ' · ' + (d.water || 0) + '/10 water' : '') + '</span></div>'; }).join('')
    : '<div class="small muted">No clients yet.</div>';
}

/* clients table */
function renderClientsTable() {
  const cs = S.clients;
  $('#tiers').innerHTML = ['All', 'Hand-holding', 'Weekly', 'Quiet 2+ days'].map((t) => '<button class="chip" type="button" data-tier="' + t + '" aria-pressed="' + (S.tier === t) + '">' + t + '</button>').join('');
  const cols = [['name', 'Client'], ['cur', 'Weight'], ['trend', 'Trend'], ['loss', 'Lost'], ['tier', 'Check-ins'], ['streak', 'Streak'], ['today', 'Today'], ['last', 'Last weigh-in'], ['end', 'Plan ends']];
  $('#thead').innerHTML = cols.map((c) => { const on = S.sortK === c[0]; return '<th scope="col" aria-sort="' + (on ? (S.sortDir > 0 ? 'ascending' : 'descending') : 'none') + '"><button class="th' + (on ? ' on' : '') + '" type="button" data-sort="' + c[0] + '">' + c[1] + (on ? (S.sortDir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>'; }).join('');
  const dayScore = (c) => { const d = S.days[c.id]; return d ? (d.water || 0) / 10 + Math.min((d.meals || []).length / 3, 1) : 0; };
  const get = { name: (c) => c.name.toLowerCase(), cur: (c) => curOf(c, wsOf(c)), trend: (c) => monthLoss(c, wsOf(c)), loss: (c) => lossPctOf(c, wsOf(c)), tier: (c) => (c.tier === 'Hand-holding' ? 1 : 0), streak: liveStreak, today: dayScore, last: lastLogAgo, end: planLeft };
  const q = S.cq.trim().toLowerCase();
  const list = cs.filter((c) => (S.tier === 'All' || c.tier === S.tier || (S.tier === 'Quiet 2+ days' && lastLogAgo(c) >= 2))
      && (!q || c.name.toLowerCase().indexOf(q) > -1 || String(profOf(c).username || '').indexOf(q) > -1))
    .sort((a, b) => { const x = get[S.sortK](a), y = get[S.sortK](b); return (x < y ? -1 : x > y ? 1 : 0) * S.sortDir; });
  const maxL = Math.max(...cs.map((c) => lossPctOf(c, wsOf(c))), 0.0001);
  $('#cl-h').textContent = cs.length ? cs.length + ' client' + (cs.length > 1 ? 's' : '') : 'All clients';
  $('#tbl-empty').hidden = !!list.length;
  $('#tbl-empty').textContent = cs.length ? 'No clients match.' : (isCoach() ? 'No clients yet. Tap Add client to create the first login.' : 'No clients yet.');
  $('#tbody').innerHTML = list.map((c) => { const ago = lastLogAgo(c), lp = lossPctOf(c, wsOf(c)), d = S.days[c.id], pr = profOf(c), pl = planLeft(c);
    const lqn = liqOf(c).length, lqt = lqn ? ' · ' + liqDone(c) + '/' + lqn + ' liquids' : '';
    const today0 = d ? (d.water || 0) + '/10 water · ' + (d.meals || []).length + ((d.meals || []).length === 1 ? ' meal' : ' meals') + ((d.photos || []).length ? ' · ' + d.photos.length + ' photo' + (d.photos.length > 1 ? 's' : '') : '') : '<span class="muted">Nothing yet</span>';
    const today = d ? today0 + lqt : (lqn ? '<span class="muted">0/' + lqn + ' liquids</span>' : today0);
    return '<tr class="click' + (c.id === S.drawer ? ' sel' : '') + '" data-row="' + esc(c.id) + '"><td><span style="display:flex;align-items:center;gap:10px"><span class="avatar">' + esc(initials(c.name)) + '</span><span style="display:flex;flex-direction:column"><button class="linkbtn" style="padding:0;text-decoration:none;color:var(--ink);font-weight:700" type="button" data-pick="' + esc(c.id) + '">' + esc(c.name) + '</button><span class="small muted">@' + esc(pr.username || '') + (!c.consent_at ? ' · not signed in yet' : pr.must_change_pw ? ' · temporary password' : '') + '</span></span></span></td>'
      + '<td class="num">' + curOf(c, wsOf(c)).toFixed(1) + ' kg' + (wChange(wsOf(c)) ? '<span class="small" style="display:block;white-space:nowrap">' + wChangeHtml(wChange(wsOf(c))) + '</span>' : '') + '</td><td>' + spark(wsOf(c)) + '</td><td class="num"><span class="minibar"><i style="width:' + Math.max(lp / maxL * 100, 0).toFixed(0) + '%"></i></span>' + lp.toFixed(1) + '%</td>'
      + '<td><span class="tag ' + tierCls(c.tier) + '">' + esc(c.tier) + '</span></td><td class="num">' + liveStreak(c) + (liveStreak(c) === 1 ? ' day' : ' days') + '</td><td class="small">' + today + '</td>'
      + '<td><span class="status ' + (ago >= 2 ? 'over' : 'ok') + '" style="text-align:left">' + (ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : ago > 900 ? 'Never' : ago + ' days ago') + '</span></td>'
      + '<td><span class="status ' + (pl < 0 ? 'over' : pl <= 7 ? 'soon' : 'ok') + '" style="text-align:left">' + (pl < 0 ? 'Ended ' + fmtShort(c.plan_end) : fmtShort(c.plan_end)) + '</span></td></tr>'; }).join('');
  $('#cl-cards').innerHTML = list.map((c) => { const ago = lastLogAgo(c), lp = lossPctOf(c, wsOf(c)), d = S.days[c.id], pr = profOf(c), lqn = liqOf(c).length;
    const bits = []; if (d) { bits.push((d.water || 0) + '/10 water'); bits.push((d.meals || []).length + ((d.meals || []).length === 1 ? ' meal' : ' meals')); if ((d.photos || []).length) bits.push(d.photos.length + (d.photos.length === 1 ? ' photo' : ' photos')); }
    if (lqn) bits.push(liqDone(c) + '/' + lqn + ' liquids');
    return '<button class="cl-card" type="button" data-pick="' + esc(c.id) + '"><span class="avatar">' + esc(initials(c.name)) + '</span><span class="cl-c-t"><strong>' + esc(c.name) + '</strong><span class="small">' + curOf(c, wsOf(c)).toFixed(1) + ' kg · ' + lp.toFixed(1) + '% lost · ' + liveStreak(c) + '-day streak</span>' + (wChange(wsOf(c)) ? '<span class="small">' + wChangeHtml(wChange(wsOf(c))) + '</span>' : '') + '<span class="small muted">' + (bits.length ? esc(bits.join(' · ')) : (!c.consent_at ? 'Not signed in yet' : 'Nothing logged today')) + '</span></span><span class="status ' + (ago >= 2 ? 'over' : 'ok') + '">' + (ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : ago > 900 ? 'Never' : ago + 'd ago') + '</span></button>'; }).join('');
  renderCred();
}
function renderCred() {
  const box = $('#add-cred'), c = S.cred;
  box.innerHTML = c && c.where === 'add' ? '<div class="cred"><strong>' + esc(c.name) + ' is set up. Send them this login.</strong><pre id="cred-text">' + esc(c.text) + '</pre><div class="row"><button class="btn" type="button" data-copy-cred="1">Copy message</button><a class="ghost wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(c.text) + '">Send on WhatsApp</a><button class="ghost" style="height:44px" type="button" data-cred-close="1">Done</button></div><span class="small muted">The password isn’t stored anywhere you can see it again. If it’s lost, use Reset password on their profile.</span></div>' : '';
}
$('#add-toggle').addEventListener('click', (e) => {
  const f = $('#add-form'); f.hidden = !f.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); e.currentTarget.textContent = f.hidden ? 'Add client' : 'Close';
  if (!f.hidden) { if (!$('#add-pw').value) $('#add-pw').value = tempPassword(); $('#add-name').focus(); }
});
$('#add-name').addEventListener('input', () => { const u = $('#add-user'); if (!u.dataset.touched) u.value = suggestUsername($('#add-name').value); });
$('#add-user').addEventListener('input', (e) => { e.target.dataset.touched = e.target.value ? '1' : ''; });
$('#add-pw-new').addEventListener('click', () => { $('#add-pw').value = tempPassword(); });
$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!isCoach()) return;
  const err = $('#add-err'), fail = (m) => { err.textContent = m; err.hidden = false; };
  const name = $('#add-name').value.trim().replace(/\s+/g, ' '), user = $('#add-user').value.trim().toLowerCase(), pw = $('#add-pw').value.trim();
  const start = parseFloat($('#add-start').value), goalRaw = $('#add-goal').value.trim(), goal = goalRaw ? parseFloat(goalRaw) : null;
  if (!name) return fail('Enter the client’s name.');
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(user)) return fail('Usernames are 3 to 30 characters: small letters, numbers, dots, dashes or underscores.');
  if (pw.length < 8) return fail('The temporary password needs at least 8 characters.');
  if (!(start >= 30 && start <= 250)) return fail('Enter a start weight between 30 and 250 kg.');
  if (goalRaw && !(goal >= 30 && goal <= 250)) return fail('Enter a goal between 30 and 250 kg, or leave it blank.');
  err.hidden = true;
  const b = $('#add-go'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Creating…';
  const { error } = await S.sb.rpc('add_client', { p_username: user, p_password: pw, p_name: name, p_start_kg: Math.round(start * 10) / 10, p_goal_kg: goal == null ? null : Math.round(goal * 10) / 10, p_tier: $('#add-tier').value, p_days: +$('#add-days').value });
  b.disabled = false; b.textContent = 'Create client and login';
  if (error) return fail(friendly(error));
  S.cred = { where: 'add', name, text: loginMessage(name, user, pw) };
  ['#add-name', '#add-user', '#add-start', '#add-goal'].forEach((s) => { $(s).value = ''; }); $('#add-user').dataset.touched = ''; $('#add-pw').value = tempPassword();
  $('#add-form').hidden = true; $('#add-toggle').textContent = 'Add client'; $('#add-toggle').setAttribute('aria-expanded', 'false');
  await refreshStaff(); toast(name + ' added');
});
$('#cl-q').addEventListener('input', (e) => { S.cq = e.target.value; renderClientsTable(); });

/* client profile drawer */
function openDrawer(id, mode) {
  S.drawer = id; S.drawerMode = mode || null; S.rmConfirm = null; S.dcred = null;
  let root = $('#drawer-root');
  if (!root) { root = document.createElement('div'); root.id = 'drawer-root'; document.body.appendChild(root); }
  root.innerHTML = '<div class="drawer-bg" data-close-drawer="1"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-h" id="drawer-body"></aside>';
  renderDrawer(); const x = $('#dr-close'); if (x) x.focus();
}
function closeDrawer() { S.drawer = null; S.drawerMode = null; S.rmConfirm = null; S.dcred = null; const r = $('#drawer-root'); if (r) r.innerHTML = ''; }
async function renderDrawer() {
  const body = $('#drawer-body'); if (!body) return;
  const c = S.clients.find((x) => x.id === S.drawer); if (!c) { closeDrawer(); return; }
  const ws = wsOf(c), d = S.days[c.id] || emptyDay(), meals = d.meals || [], ex = d.exercise || [], exMin = ex.reduce((a, e) => a + (+e.min || 0), 0);
  const kcal = meals.reduce((a, m) => a + (+m.k || 0), 0), ago = lastLogAgo(c), bs = c.badges || {}, dt = curDiet(c), dn = dt ? dietDay(dt) : 0, pr = profOf(c), ts = S.allTests[c.id] || [];
  await Promise.all([loadPhotoUrls((d.photos || []).map((p) => p.path)), loadReportUrls(ts.slice(-1))]);
  if (!$('#drawer-body')) return;
  const keep = body.scrollTop, mode = S.drawerMode;
  let h = '<div style="display:flex;align-items:center;gap:14px"><span class="avatar" style="width:48px;height:48px;font-size:15px;background:var(--forest);color:var(--btn-ink)">' + esc(initials(c.name)) + '</span>'
    + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><h2 id="dr-h" style="font-size:26px">' + esc(c.name) + '</h2><span style="display:flex;gap:8px;flex-wrap:wrap"><span class="tag ' + tierCls(c.tier) + '">' + esc(c.tier) + '</span><span class="tag ' + (ago >= 2 ? 'danger' : '') + '">' + (ago === 0 ? 'Weighed in today' : ago === 1 ? 'Last weigh-in yesterday' : ago > 900 ? 'No weigh-ins yet' : 'Quiet for ' + ago + ' days') + '</span></span><span class="small muted">@' + esc(pr.username || '') + (!c.consent_at ? ' · hasn’t signed in yet' : pr.must_change_pw ? ' · still on a temporary password' : '') + '</span></div>'
    + '<button class="x" id="dr-close" type="button" data-close-drawer="1" aria-label="Close profile"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path class="ic" d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-msg-client="' + esc(c.id) + '">Message ' + esc(first(c.name)) + '</button>'
    + (isCoach() ? '<button class="ghost" style="height:44px" type="button" data-dmode="edit" data-for="' + esc(c.id) + '">Edit details</button><button class="ghost" style="height:44px" type="button" data-edit-plan="' + esc(c.id) + '">Diet plan</button><button class="ghost" style="height:44px" type="button" data-dmode="reset" data-for="' + esc(c.id) + '">Reset password</button>' : '') + '</div>';
  if (isCoach() && mode === 'edit') {
    h += '<form class="card dform" id="dr-edit" style="padding:16px;animation:none" novalidate><span class="eyebrow" style="grid-column:1/-1">Edit details</span>'
      + '<div class="field" style="grid-column:1/-1"><label class="lbl" for="de-name">Name</label><input class="input" id="de-name" maxlength="80" value="' + esc(c.name) + '"></div>'
      + '<div class="field"><label class="lbl" for="de-goal">Goal (kg)</label><input class="input num" id="de-goal" type="number" step="0.1" value="' + (c.goal_kg == null ? '' : num(c.goal_kg)) + '"></div>'
      + '<div class="field"><label class="lbl" for="de-kcal">Calories / day</label><input class="input num" id="de-kcal" type="number" step="50" value="' + c.kcal_target + '"></div>'
      + '<div class="field"><label class="lbl" for="de-tier">Check-ins</label><select class="select" id="de-tier"><option' + (c.tier === 'Hand-holding' ? ' selected' : '') + '>Hand-holding</option><option' + (c.tier === 'Weekly' ? ' selected' : '') + '>Weekly</option></select></div>'
      + '<div class="field"><label class="lbl" for="de-end">Plan ends</label><input class="input" id="de-end" type="date" value="' + esc(c.plan_end) + '"></div>'
      + '<div class="field"><label class="lbl" for="de-detox">Detox every</label><select class="select" id="de-detox">' + [20, 22, 25].concat([20, 22, 25].indexOf(c.detox_freq) < 0 ? [c.detox_freq] : []).map((k) => '<option value="' + k + '"' + (k === c.detox_freq ? ' selected' : '') + '>' + k + ' days</option>').join('') + '</select></div>'
      + '<div class="row" style="grid-column:1/-1"><button class="btn" type="submit">Save changes</button><button class="ghost" style="height:44px" type="button" data-dmode="" data-for="' + esc(c.id) + '">Cancel</button></div><div class="err" id="de-err" role="alert" hidden style="grid-column:1/-1"></div></form>';
  }
  if (isCoach() && mode === 'reset') {
    h += S.dcred ? '<div class="cred"><strong>New password set for ' + esc(first(c.name)) + '.</strong><pre>' + esc(S.dcred) + '</pre><div class="row"><button class="btn" type="button" data-copy-dcred="1">Copy message</button><a class="ghost wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(S.dcred) + '">Send on WhatsApp</a><button class="ghost" style="height:44px" type="button" data-dmode="" data-for="' + esc(c.id) + '">Done</button></div><span class="small muted">They’re signed out on other devices. When they sign in, they’re asked if they want to change it.</span></div>'
      : '<div class="card" style="padding:16px;gap:12px;animation:none"><span class="eyebrow">Reset password</span><p class="small">Sets a new temporary password for @' + esc(pr.username || '') + ' and signs them out everywhere. Next time they sign in, they’re asked if they want to change it.</p><div class="row"><button class="btn" type="button" data-reset-go="' + esc(c.id) + '">Set a new password</button><button class="ghost" style="height:44px" type="button" data-dmode="" data-for="' + esc(c.id) + '">Cancel</button></div></div>';
  }
  h += '<div class="d-stats"><div><span class="eyebrow">Current</span><strong class="num">' + curOf(c, ws).toFixed(1) + '</strong><span class="small muted">kg · goal ' + (c.goal_kg ? num(c.goal_kg).toFixed(1) : '—') + '</span>' + (wChange(ws) ? '<span class="small">' + wChangeHtml(wChange(ws)) + '</span>' : '') + '</div><div><span class="eyebrow">Lost</span><strong class="num">' + lossPctOf(c, ws).toFixed(1) + '%</strong><span class="small muted">' + (num(c.start_kg) - curOf(c, ws)).toFixed(1) + ' kg</span></div><div><span class="eyebrow">Stars</span><strong class="num">' + c.stars + '</strong><span class="small muted">level ' + (Math.floor(c.stars / 50) + 1) + '</span></div><div><span class="eyebrow">Streak</span><strong class="num">' + liveStreak(c) + '</strong><span class="small muted">days</span></div></div>'
    + '<div class="card" style="padding:18px;gap:12px;animation:none"><div class="card-h"><div><span class="eyebrow">Weight trend</span></div><span class="small muted">Started at ' + num(c.start_kg).toFixed(1) + ' kg</span></div><div id="dr-chart"></div></div>'
    + '<div class="card" style="padding:18px;gap:12px;animation:none"><span class="eyebrow">Today so far</span>'
    + [['Water', (d.water || 0) + ' / 10 glasses', (d.water || 0) / 10], ['Meals', meals.length + ' logged · ' + kcal.toLocaleString('en-IN') + ' of ' + c.kcal_target + ' kcal', Math.min(meals.length / 3, 1)], ['Movement', exMin + ' / 30 min', Math.min(exMin / 30, 1)]].map((r) => '<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between" class="small"><strong>' + r[0] + '</strong><span class="muted num">' + r[1] + '</span></div><div class="track"><div class="fill' + (r[2] >= 1 ? ' done' : '') + '" style="width:' + (r[2] * 100).toFixed(0) + '%"></div></div></div>').join('')
    + (meals.length ? '<div class="small muted">' + meals.map((m) => esc(m.n)).join(' · ') + '</div>' : '')
    + ((d.photos || []).length ? '<div class="photos big">' + d.photos.map((ph) => photoFig(ph, c.name + ' · ' + ph.t, ph.t)).join('') + '</div>' : '') + '</div>'
    + (ts.length ? '<div class="card" style="padding:18px;gap:12px;animation:none"><span class="eyebrow">Blood test · ' + fmtShort(ts[ts.length - 1].d) + '</span>' + testsHtml(ts, S.reportUrls) + '</div>' : (c.health_consent_at ? '' : '<div class="small muted">Blood tests: not shared yet.</div>'))
    + '<div class="card" style="padding:18px;gap:10px;animation:none"><span class="eyebrow">Meal photos · earlier this week</span><div id="dr-week"><span class="small muted">Loading…</span></div></div>'
    + '<div class="card" style="padding:18px;gap:6px;animation:none"><div class="card-h"><span class="eyebrow">' + (dt ? (dn <= 4 ? 'Diet · day ' + dn + ' of 4' : 'Diet · new one due') : 'Diet') + '</span>' + (isCoach() ? '<button class="ghost" type="button" data-edit-plan="' + esc(c.id) + '">' + (dt ? 'Write new diet' : 'Write diet') + '</button>' : '') + '</div>' + (dt ? dietHtml(dt, 86) : '<span class="small muted">No diet yet.</span>') + '</div>'
    + liquidsCard(c)
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span class="eyebrow" style="width:100%">Badges</span>' + BADGES.map((b) => '<span style="display:flex;align-items:center;gap:6px" class="small"><svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><path ' + (bs[b.k] ? 'style="fill:' + b.fill + '"' : 'class="hex-l"') + ' d="' + HEX + '"/><g transform="translate(20 20)"><path class="gl' + (bs[b.k] ? ' on' : '') + '" d="' + b.g + '"/></g></svg>' + (bs[b.k] ? b.name : '<span class="muted">' + b.name + '</span>') + '</span>').join('') + '</div>'
    + '<div class="small">Plan ' + fmtShort(c.plan_start) + ' to ' + fmtDay(c.plan_end) + (planLeft(c) < 0 ? ' (ended)' : '') + ' · detox every ' + c.detox_freq + ' days · ' + c.kcal_target + ' kcal target</div>';
  if (isCoach()) h += '<div style="display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px"><button class="ghost" style="height:44px" type="button" data-renew="' + esc(c.id) + '">Renew 30 days</button>'
    + (S.rmConfirm === c.id ? '<span class="small" style="align-self:center;flex-basis:100%">Delete ' + esc(first(c.name)) + ', their login and all their logs? This can’t be undone.</span><button class="ghost" style="height:44px" type="button" data-rm-no="1">Keep</button><button class="ghost danger" style="height:44px" type="button" data-rm-yes="' + esc(c.id) + '">Delete for good</button>' : '<button class="ghost danger" style="height:44px" type="button" data-rm="' + esc(c.id) + '">Delete client</button>') + '</div>';
  body.innerHTML = h; body.scrollTop = keep;
  renderChart(c.goal_kg ? num(c.goal_kg) : null, ws, $('#dr-chart'), num(c.start_kg));
  loadWeekPhotos(c);
  const lf = $('#lq-edit');
  if (lf) {
    $('#lq-add').addEventListener('click', () => { if (document.querySelectorAll('#lq-rows .lq-row').length >= 12) return; $('#lq-rows').insertAdjacentHTML('beforeend', lqRow(['', ''])); const ins = $('#lq-rows').lastElementChild.querySelector('input'); if (ins) ins.focus(); });
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const items = [...document.querySelectorAll('#lq-rows .lq-row')].map((r) => { const i = r.querySelectorAll('input'); return { name: i[0].value.trim(), when: i[1].value.trim() }; }).filter((x) => x.name);
      const r = await S.sb.rpc('set_liquids', { p_client: c.id, p_items: items });
      if (r.error) { const er = $('#lq-err'); er.textContent = friendly(r.error); er.hidden = false; return; }
      S.drawerMode = null; toast(items.length ? 'Liquids list saved' : 'Liquids list cleared'); await refreshStaff();
    });
  }
  const ef = $('#dr-edit');
  if (ef) ef.addEventListener('submit', async (e) => {
    e.preventDefault();
    const er = $('#de-err'), fail = (m) => { er.textContent = m; er.hidden = false; };
    const name = $('#de-name').value.trim().replace(/\s+/g, ' '), gRaw = $('#de-goal').value.trim(), g = gRaw ? parseFloat(gRaw) : null, k = parseInt($('#de-kcal').value, 10), end = $('#de-end').value;
    if (!name) return fail('Enter a name.');
    if (gRaw && !(g >= 30 && g <= 250)) return fail('Goal must be between 30 and 250 kg.');
    if (!(k >= 800 && k <= 4000)) return fail('Calories must be between 800 and 4000.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return fail('Pick the plan end date.');
    S.drawerMode = null;
    await coachUpdate(c.id, { name, goal_kg: g == null ? null : Math.round(g * 10) / 10, kcal_target: k, tier: $('#de-tier').value, plan_end: end, detox_freq: +$('#de-detox').value }, 'Saved');
  });
}

const lqRow = (r) => '<div class="lq-row"><input class="input" maxlength="60" placeholder="Liquid, e.g. Jeera water" aria-label="Liquid" value="' + esc(r[0]) + '"><input class="input" maxlength="60" placeholder="When, e.g. Before breakfast" aria-label="When to take it" value="' + esc(r[1]) + '"><button class="x" type="button" data-lq-rm="1" aria-label="Remove this liquid"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path class="ic" d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
function liquidsCard(c) {
  const L = liqOf(c), T = S.ticks[c.id] || {};
  if (isCoach() && S.drawerMode === 'liquids') {
    const rows = L.length ? L.map((x) => [x.name, x.when_text]) : [['', ''], ['', '']];
    return '<form class="card" id="lq-edit" style="padding:18px;gap:12px;animation:none" novalidate><span class="eyebrow">Daily liquids for ' + esc(first(c.name)) + '</span><span class="small muted">They see this as a checklist every day and tick each one off.</span><div id="lq-rows" style="display:flex;flex-direction:column;gap:8px">' + rows.map(lqRow).join('') + '</div><button class="ghost" type="button" id="lq-add" style="align-self:flex-start">Add another</button><div class="err" id="lq-err" role="alert" hidden></div><div class="row"><button class="btn" type="submit">Save list</button><button class="ghost" style="height:44px" type="button" data-dmode="" data-for="' + esc(c.id) + '">Cancel</button></div></form>';
  }
  return '<div class="card" style="padding:18px;gap:6px;animation:none"><div class="card-h"><span class="eyebrow">Daily liquids' + (L.length ? ' · ' + liqDone(c) + ' of ' + L.length + ' taken today' : '') + '</span>' + (isCoach() ? '<button class="ghost" type="button" data-dmode="liquids" data-for="' + esc(c.id) + '">' + (L.length ? 'Edit list' : 'Add liquids') + '</button>' : '') + '</div>'
    + (L.length ? L.map((x) => '<div class="lq-view' + (T[x.id] ? ' on' : '') + '"><span class="lq-box">' + TICK + '</span><span><strong>' + esc(x.name) + '</strong>' + (x.when_text ? ' <span class="small muted">' + esc(x.when_text) + '</span>' : '') + '</span></div>').join('') + (c.liquids_updated ? '<span class="small muted" style="padding-top:6px">List last updated ' + fmtShort(c.liquids_updated) + '</span>' : '')
      : '<span class="small muted">No liquids list yet.</span>') + '</div>';
}
async function loadWeekPhotos(c) {
  const box = $('#dr-week'); if (!box) return;
  const r = await S.sb.from('day_logs').select('d,photos').eq('client_id', c.id).gte('d', addDays(TODAY, -6)).lt('d', TODAY).order('d', { ascending: false });
  if (S.drawer !== c.id || !$('#dr-week')) return;
  const days = ((r.data || [])).filter((x) => (x.photos || []).length);
  if (r.error || !days.length) { $('#dr-week').innerHTML = '<span class="small muted">' + (r.error ? 'Couldn’t load photos.' : 'No photos in the six days before today.') + '</span>'; return; }
  await loadPhotoUrls([].concat(...days.map((x) => x.photos.map((ph) => ph.path))));
  if (S.drawer !== c.id || !$('#dr-week')) return;
  $('#dr-week').innerHTML = days.map((x) => '<span class="eyebrow" style="display:block;margin:8px 0 6px">' + fmtDay(x.d) + '</span><div class="photos big">' + x.photos.map((ph) => photoFig(ph, c.name + ' · ' + fmtDay(x.d) + ' ' + ph.t, ph.t)).join('') + '</div>').join('');
}

/* inbox */
function renderInbox() {
  const ths = inboxThreads(), waiting = ths.filter((t) => !t.last_from_staff), asstView = isCoach() && S.ibox === 'asst';
  $('#ib-count').textContent = waiting.length ? waiting.length + ' waiting for a reply' : 'All caught up';
  $('#ib-filter').innerHTML = isCoach() ? [['mine', 'My chats'], ['asst', 'Assistant’s chats']].map((f) => '<button class="chip" type="button" data-ibox="' + f[0] + '" aria-pressed="' + ((S.ibox || 'mine') === f[0]) + '">' + f[1] + '</button>').join('') : '';
  if (S.kThread && !ths.find((t) => t.id === S.kThread)) S.kThread = null;
  $('#k-threads').innerHTML = ths.length ? ths.map((t) => '<button class="th-item" type="button" data-kth="' + esc(t.id) + '" aria-pressed="' + (t.id === S.kThread) + '"><span class="avatar"' + (t.kind === 'family' ? ' style="background:var(--slate);color:#fff"' : '') + '>' + esc(t.kind === 'family' ? 'FG' : initials(threadName(t))) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><strong style="font-size:14px">' + esc(threadName(t)) + (t.kind === 'family' ? ' <span class="small muted" style="font-weight:500">· family</span>' : '') + '</strong><span class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.last_text || 'No messages yet') + '</span></span>' + (!t.last_from_staff ? '<span class="dot-new" title="Waiting for a reply"></span>' : '') + '</button>').join('')
    : '<div class="small muted" style="padding:12px">' + (asstView ? 'No chats between clients and the assistant yet.' : 'No conversations yet. Open a client’s profile and tap Message.') + '</div>';
  const kt = ths.find((t) => t.id === S.kThread);
  $('#k-inbox').classList.toggle('open', !!kt && !!S.kOpen);
  $('#k-thread-h').textContent = kt ? threadName(kt) + (kt.kind === 'family' ? ' · family group' : kt.kind === 'asst' && isCoach() ? ' · with the assistant' : '') + ' · ' + msgTime(kt.last_at) : '';
  $('#k-thread-act').innerHTML = kt && !kt.last_from_staff ? '<button class="ghost" type="button" data-done-thread="' + esc(kt.id) + '">Mark done</button>' : '';
  $('#k-comp').hidden = !kt;
  paintThread('#k-thread', S.kThread, kt ? 'No messages yet. Say hello.' : 'Pick a conversation.');
}
function renderGroupPeople() {
  const box = $('#grp-people'), sig = S.clients.map((c) => c.id).join();
  if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  box.innerHTML = S.clients.map((c) => '<label style="display:flex;gap:10px;align-items:center;font-size:14px;cursor:pointer"><input type="checkbox" class="cbx" value="' + esc(c.id) + '"> ' + esc(c.name) + '</label>').join('') || '<span class="small muted">Add clients first.</span>';
}
const DRAFTS = {
  checkin: (c) => 'Hi ' + first(c.name) + ', I haven’t seen your logs for a couple of days. How are you doing? Even a quick weigh-in helps us keep your plan on track.',
  nudge: (c) => 'Good morning ' + first(c.name) + '! Don’t forget your weigh-in today.',
  liquids: (c) => 'Hi ' + first(c.name) + ', a reminder to take your liquids today and tick them off in the app.',
  detox: (c) => 'Hi ' + first(c.name) + ', your detox day is coming up. Let us know if you have any questions about it.'
};
function renewalText(c) { const d = planLeft(c); return 'Hi ' + first(c.name) + ', your ' + c.tier + ' plan ' + (d < 0 ? 'ended on ' : 'ends on ') + fmtDay(c.plan_end) + '. Reply here if you’d like to continue and we’ll renew it for you.'; }
async function openClientChat(clientId, draft) {
  const r = await S.sb.rpc('ensure_chat', { p_client: clientId }); if (r.error) { toast(friendly(r.error)); return; }
  S.ibox = 'mine'; S.kThread = r.data; S.kOpen = true; await loadThreads(); await loadMsgs(S.kThread); closeDrawer();
  setTab('messages'); renderInbox(); window.scrollTo({ top: 0, behavior: 'smooth' });
  if (draft != null) $('#k-comp-in').value = draft;
  $('#k-comp-in').focus({ preventScroll: true });
}
function openBroadcast() { setTab('messages'); const f = $('#bc-form'); f.hidden = false; $('#bc-open').setAttribute('aria-expanded', 'true'); $('#bc-err').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); $('#bc-text').focus({ preventScroll: true }); }
function closeBroadcast() { $('#bc-form').hidden = true; $('#bc-open').setAttribute('aria-expanded', 'false'); }
$('#bc-open').addEventListener('click', () => { if ($('#bc-form').hidden) openBroadcast(); else closeBroadcast(); });
$('#bc-cancel').addEventListener('click', closeBroadcast);
$('#bc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('#bc-text').value.trim(), err = $('#bc-err'), tier = $('#bc-tier').value;
  const who = S.clients.filter((c) => tier === 'All' || c.tier === tier).length;
  if (!v) { err.textContent = 'Write the message first.'; err.hidden = false; return; }
  if (!who) { err.textContent = 'There are no clients in that group.'; err.hidden = false; return; }
  if (S.bcConfirm !== v + '|' + tier) { S.bcConfirm = v + '|' + tier; err.textContent = 'This goes to ' + who + ' client' + (who > 1 ? 's' : '') + '. Tap Send broadcast again to confirm.'; err.hidden = false; return; }
  err.hidden = true; const b = $('#bc-go'); b.disabled = true;
  const r = await S.sb.rpc('broadcast', { p_body: v, p_tier: tier }); b.disabled = false; S.bcConfirm = null;
  if (r.error) { err.textContent = friendly(r.error); err.hidden = false; return; }
  $('#bc-text').value = ''; closeBroadcast(); toast('Sent to ' + r.data + ' client' + (r.data === 1 ? '' : 's'));
  await loadThreads(); await loadMsgs(S.kThread); renderStaff();
});
$('#ib-back').addEventListener('click', () => { S.kOpen = false; renderInbox(); });
$('#k-comp').addEventListener('submit', async (e) => {
  e.preventDefault(); const v = $('#k-comp-in').value.trim(); if (!v || !S.kThread) return;
  $('#k-comp-in').value = '';
  const r = await S.sb.rpc('send_message', { p_thread: S.kThread, p_body: v });
  if (r.error) { toast(friendly(r.error)); $('#k-comp-in').value = v; return; }
  await loadMsgs(S.kThread); await loadThreads(); renderStaff();
});
$('#k-newgroup').addEventListener('click', (e) => { const f = $('#grp-form'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', String(!f.hidden)); e.currentTarget.textContent = f.hidden ? 'New family group' : 'Cancel'; if (!f.hidden) $('#grp-title').focus(); });
$('#grp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#grp-title').value.trim(), ids = [...document.querySelectorAll('#grp-people input:checked')].map((x) => x.value), err = $('#grp-err');
  if (!title) { err.textContent = 'Give the group a name.'; err.hidden = false; return; }
  if (ids.length < 2) { err.textContent = 'Pick at least two people.'; err.hidden = false; return; }
  err.hidden = true;
  const r = await S.sb.rpc('create_family_group', { p_title: title, p_clients: ids });
  if (r.error) { err.textContent = friendly(r.error); err.hidden = false; return; }
  $('#grp-form').reset(); $('#grp-form').hidden = true; $('#k-newgroup').textContent = 'New family group'; $('#k-newgroup').setAttribute('aria-expanded', 'false');
  S.kThread = r.data; await loadThreads(); await loadMsgs(S.kThread); renderInbox(); toast(title + ' created');
});

/* diets: the coach writes a fresh one for each client every 4 days */
function dietStatus(c) {
  const dt = curDiet(c); if (!dt) return ['over', 'No diet yet', 0];
  const dn = dietDay(dt);
  return dn > 4 ? ['over', 'Due ' + (dn - 4) + (dn - 4 === 1 ? ' day ago' : ' days ago'), 1] : dn === 4 ? ['soon', 'Ends today', 2] : ['ok', 'Day ' + dn + ' of 4', 3];
}
function fillDiet(dt) { const m = dietMeals(dt); [0, 1, 2, 3, 4].forEach((i) => { $('#dc-m' + i).value = m[i] || ''; }); $('#dc-notes').value = dt.notes || ''; }
function renderDiet() {
  const cs = S.clients.slice().sort((a, b) => dietStatus(a)[2] - dietStatus(b)[2] || a.name.localeCompare(b.name));
  if (!S.sel || !cs.find((c) => c.id === S.sel)) { S.sel = cs[0] ? cs[0].id : null; S.dietFor = null; }
  const sc = cs.find((c) => c.id === S.sel), dsel = $('#dc-client');
  $('#dc-list').innerHTML = cs.length ? cs.map((c) => { const st = dietStatus(c);
    return '<button class="th-item" type="button" data-diet-client="' + esc(c.id) + '" aria-pressed="' + (c.id === S.sel) + '"><span class="avatar">' + esc(initials(c.name)) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><strong style="font-size:14px">' + esc(c.name) + '</strong><span class="status ' + st[0] + '" style="text-align:left">' + st[1] + '</span></span></button>'; }).join('')
    : '<div class="small muted" style="padding:12px">Add a client first.</div>';
  const opts = cs.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
  if (dsel.dataset.sig !== opts) { dsel.innerHTML = opts; dsel.dataset.sig = opts; }
  $('#dc-form').hidden = !sc;
  if (!sc) { $('#dc-h').textContent = 'Diet'; $('#dc-eyebrow').textContent = 'Diet'; $('#dc-current').innerHTML = '<div class="empty">Add a client to write their diet.</div>'; $('#dc-history').innerHTML = ''; return; }
  dsel.value = sc.id;
  const all = S.diets[sc.id] || [], dt = curDiet(sc), dn = dt ? dietDay(dt) : 0, st = dietStatus(sc);
  $('#dc-h').textContent = sc.name; $('#dc-eyebrow').textContent = 'Diet · ' + st[1];
  $('#dc-current').innerHTML = dt ? '<div class="notice" style="margin-bottom:6px"><strong>' + (dn <= 4 ? 'Current diet' : 'Last diet') + '</strong> · ' + fmtDay(dt.start_date) + ' to ' + fmtDay(addDays(dt.start_date, 3)) + (dn > 4 ? ' · ' + esc(first(sc.name)) + ' is still following this until you send a new one' : '') + '</div>' + dietHtml(dt, 96)
    : '<div class="empty">' + esc(first(sc.name)) + ' has no diet yet. Write the first one below.</div>';
  if (S.dietFor !== sc.id) {
    S.dietFor = sc.id; fillDiet({ meals: [], notes: '' }); $('#dc-err').hidden = true;
    $('#dc-start').value = dt && dn <= 4 ? addDays(dt.start_date, 4) : TODAY;
  }
  $('#dc-form-h').textContent = 'New diet for ' + first(sc.name);
  $('#dc-copy').hidden = !all.length;
  const past = all.slice().reverse().slice(0, 6);
  $('#dc-history').innerHTML = past.length ? '<span class="eyebrow" style="display:block;margin-bottom:4px">Diets sent to ' + esc(first(sc.name)) + '</span>' + past.map((x) => '<div class="dc-hist"><span style="min-width:0;display:flex;flex-direction:column"><strong style="font-size:14px">' + fmtDay(x.start_date) + ' to ' + fmtDay(addDays(x.start_date, 3)) + (x.start_date > TODAY ? ' · upcoming' : '') + '</strong><span class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(dietMeals(x).filter(Boolean).join(' · ')) + '</span></span><span style="display:flex;gap:6px"><button class="ghost" type="button" data-diet-reuse="' + esc(x.id) + '">Reuse</button><button class="ghost danger" type="button" data-diet-del="' + esc(x.id) + '">Delete</button></span></div>').join('') : '';
}
$('#dc-client').addEventListener('change', (e) => { S.sel = e.target.value; S.dietFor = null; renderDiet(); });
$('#dc-copy').addEventListener('click', () => { const all = S.diets[S.sel] || []; if (all.length) { fillDiet(all[all.length - 1]); $('#dc-m0').focus(); } });
$('#dc-form').addEventListener('submit', async (e) => {
  e.preventDefault(); if (!isCoach() || !S.sel) return;
  const err = $('#dc-err'), fail = (m) => { err.textContent = m; err.hidden = false; };
  const meals = [0, 1, 2, 3, 4].map((i) => $('#dc-m' + i).value.trim()), start = $('#dc-start').value, c = S.clients.find((x) => x.id === S.sel);
  if (!meals.some(Boolean)) return fail('Write at least one meal.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return fail('Pick the day this diet starts.');
  err.hidden = true; const b = $('#dc-go'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Sending…';
  const r = await S.sb.rpc('save_diet', { p_client: S.sel, p_start: start, p_meals: meals, p_notes: $('#dc-notes').value.trim() || null });
  b.disabled = false; b.textContent = 'Send diet';
  if (r.error) return fail(friendly(r.error));
  S.dietFor = null; toast('Diet sent to ' + first(c.name)); await refreshStaff();
});

/* renewals + detox */
function renderPlans() {
  const cs = S.clients;
  const rn = cs.filter((c) => planLeft(c) <= 14).sort((a, b) => planLeft(a) - planLeft(b));
  $('#rn-list').innerHTML = rn.length ? rn.map((c) => { const d = planLeft(c);
    return '<div class="dx-row" style="grid-template-columns:minmax(0,1fr) auto"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:14px">' + esc(c.name) + '</strong><span class="small muted">' + esc(c.tier) + ' · ' + (d < 0 ? 'ended ' + fmtShort(c.plan_end) : 'ends ' + fmtDay(c.plan_end)) + '</span></span><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><span class="status ' + (d < 0 ? 'over' : d <= 3 ? 'soon' : 'ok') + '">' + (d < 0 ? 'Lapsed ' + (-d) + 'd' : d === 0 ? 'Today' : d + 'd left') + '</span><button class="ghost" type="button" data-remind="' + esc(c.id) + '">Remind</button><button class="ghost coach-only" type="button" data-renew="' + esc(c.id) + '">Renew 30 days</button></span></div>'; }).join('') : '<div class="small muted">No plans end in the next 14 days.</div>';
  const dx = cs.filter((c) => detoxUntil(c) <= 7).sort((a, b) => detoxUntil(a) - detoxUntil(b));
  $('#dx-list').innerHTML = dx.length ? dx.map((c) => { const u = detoxUntil(c);
    return '<div class="dx-row" style="grid-template-columns:minmax(0,1fr) auto"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:14px">' + esc(c.name) + '</strong><span class="small muted">' + (u < 0 ? 'Was due ' : 'Due ') + fmtDay(addDays(TODAY, u)) + ' · every ' + c.detox_freq + ' days · ' + c.detox_done + ' done</span></span>'
      + '<span style="display:flex;gap:6px;align-items:center"><span class="status ' + (u < 0 ? 'over' : u <= 1 ? 'soon' : 'ok') + '">' + (u < 0 ? 'Overdue ' + (-u) + 'd' : u === 0 ? 'Today' : 'In ' + u + 'd') + '</span><button class="ghost coach-only" type="button" data-detox="' + esc(c.id) + '">Mark done</button></span></div>'; }).join('') : '<div class="small muted">No detox days in the next week.</div>';
}

/* ================================================================== */
/*  MESSAGING (shared)                                                 */
/* ================================================================== */
async function loadThreads() { const r = fixErr(await S.sb.from('threads').select('*').order('last_at', { ascending: false })); S.threads = r.data || []; }
async function loadMsgs(tid) {
  if (!tid) return;
  const r = fixErr(await S.sb.from('messages').select('id,thread_id,sender,sender_name,from_staff,body,reactions,broadcast,created_at').eq('thread_id', tid).order('created_at', { ascending: false }).limit(200));
  S.msgs[tid] = (r.data || []).slice().reverse();
}
function threadHtml(rows, emptyText) {
  const me = uidNow();
  if (!rows || !rows.length) return '<div class="small muted" style="margin:auto;text-align:center">' + esc(emptyText) + '</div>';
  return rows.map((m) => {
    const mine = m.sender === me, re = m.reactions || {};
    const btns = REACTS.map((e) => { const who = re[e] || [], on = who.indexOf(me) > -1; if (!who.length && mine) return '';
      return '<button class="react" type="button" data-react="' + e + '" data-mid="' + esc(m.id) + '" aria-pressed="' + on + '" aria-label="React ' + e + (who.length ? ' (' + who.length + ')' : '') + '">' + e + (who.length ? '<span class="n">' + who.length + '</span>' : '') + '</button>'; }).join('');
    return '<div class="msg' + (mine ? ' mine' : '') + (m.from_staff ? ' coachmsg' : '') + '"><span class="who">' + esc(mine ? 'You' : m.sender_name) + ' · ' + msgTime(m.created_at) + (m.broadcast ? ' · sent to all clients' : '') + '</span><div class="bubble">' + esc(m.body) + '</div>' + (btns ? '<div class="reacts">' + btns + '</div>' : '') + '</div>';
  }).join('');
}
function paintThread(sel, tid, emptyText) {
  const box = $(sel), rows = S.msgs[tid] || [], sig = tid + ':' + rows.length + ':' + (rows.length ? rows[rows.length - 1].id : '');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.innerHTML = threadHtml(rows, emptyText);
  if (box.dataset.sig !== sig || nearBottom) box.scrollTop = box.scrollHeight;
  box.dataset.sig = sig;
}
function testsHtml(list, urls) {
  const tl = list[list.length - 1], tp = list[list.length - 2];
  if (!tl) return '<div class="empty">No blood tests yet. Add your latest report to track HbA1c and cholesterol over time.</div>';
  return '<div class="hl">' + TESTS.map((T) => { const v = tl[T[0]] == null ? null : +tl[T[0]];
    if (v == null) return '<div><span class="eyebrow">' + T[1] + '</span><strong>—</strong><span class="small muted">Not tested</span></div>';
    const l = T[3](v), pv = tp && tp[T[0]] != null ? +tp[T[0]] : null, dl = pv == null ? null : v - pv, better = dl == null ? null : dl * T[5] > 0;
    return '<div><span class="eyebrow">' + T[1] + '</span><strong class="num ' + LVL[l] + '">' + v + '<span class="small muted" style="font:500 12px var(--sans)"> ' + T[2] + '</span></strong><span class="small ' + LVL[l] + '" style="font-weight:600">' + T[6][l] + '</span><span class="small muted">'
      + (dl == null || dl === 0 ? 'Target ' + T[4] : (dl > 0 ? '▲ ' : '▼ ') + Math.abs(dl).toFixed(T[0] === 'hba1c' ? 1 : 0) + ' · ' + (better ? '<span class="st-ok">better</span>' : '<span class="st-bad">worse</span>')) + '</span></div>'; }).join('') + '</div>'
    + (tl.file_path && urls && urls[tl.file_path] ? '<a class="small" href="' + esc(urls[tl.file_path]) + '" target="_blank" rel="noopener">Open the attached report</a>' : '');
}
let liveTimer = null;
function startRealtime() {
  if (S.rt || !S.sb.channel) return;
  const kick = () => { clearTimeout(liveTimer); liveTimer = setTimeout(onLive, 250); };
  try {
    S.rt = S.sb.channel('sf-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, kick)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, kick)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_comments' }, kick)
      .subscribe();
  } catch (e) { S.rt = null; }
}
async function onLive() {
  if (!S.session || $('#app').hidden) return;
  try {
    await loadThreads(); await loadComments();
    if (S.role === 'client') { await loadPhotoUrls(S.pcs.map((x) => x.path)); await loadMsgs(S.openThread); renderClientMsgs(); renderPhotoComments(); }
    else { await loadMsgs(S.kThread); renderInbox(); renderStaff(); }
    if (S.zoom) renderZoom();
  } catch (e) { /* the next refresh catches up */ }
}

/* ================================================================== */
/*  CLICKS + LIFECYCLE                                                 */
/* ================================================================== */
document.addEventListener('click', (e) => {
  if (e.target.closest('.drawer-bg')) { closeDrawer(); return; }
  const row = e.target.closest('tr[data-row]');
  const t = e.target.closest('button');
  if (!t && row) { openDrawer(row.dataset.row); return; }
  if (!t) return;
  if (t.dataset.eye) { const i = document.getElementById(t.dataset.eye), on = i.type === 'password'; i.type = on ? 'text' : 'password'; t.textContent = on ? 'Hide' : 'Show'; t.setAttribute('aria-pressed', String(on)); t.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); return; }
  if (t.id === 'retry') { route(); return; }
  if (t.hasAttribute('data-signout')) { signOut(); return; }
  if (t.dataset.closeModal) { closeModal(); return; }
  if (t.id === 'snd') { SOUND = !SOUND; lsSet('sf-sound', SOUND ? '1' : '0'); syncSound(); if (SOUND) sfx('star'); return; }
  if (!S.session) return;
  if (t.dataset.zoom) { openZoom(t.dataset.zoom, t.dataset.cap); return; }
  if (t.id === 'nt-on') { enablePush(); return; }
  if (t.id === 'nt-later') { lsSet('sf-nt-later', String(Date.now() + 3 * 864e5)); renderNotify(); return; }
  if (t.id === 'nt-install' && installEvt) { const ev = installEvt; installEvt = null; ev.prompt(); renderNotify(); return; }
  // client
  if (t.id === 'wt-edit') { $('#wt-form').hidden = false; $('#wt-done').hidden = true; $('#wt-done').style.display = ''; $('#wt-in').value = curOf(S.me, S.weights).toFixed(1); $('#wt-in').focus(); return; }
  if (t.dataset.glass != null) {
    sfx('water'); const i = +t.dataset.glass, cur = (S.day && S.day.water) || 0, next = (i + 1 === cur) ? i : i + 1;
    S.lastGlass = i; S.day = Object.assign(S.day || emptyDay(), { water: next }); paintGlasses(next); $('#wa-h').textContent = next + ' of 10 glasses';
    logDay('water', { n: next }, 'Water goal done'); return;
  }
  if (t.dataset.food) { const f = FOODS.find((x) => x.n === t.dataset.food); S.pick = { n: f.n, s: f.s, k: f.k, q: 1 }; renderFood(); $('#fp-add').focus({ preventScroll: true }); return; }
  if (t.dataset.foodOwn) { const nm = S.q.trim().replace(/\s+/g, ' ').slice(0, 48), est = estimateFood(nm); S.pick = { n: nm.charAt(0).toUpperCase() + nm.slice(1), own: true, k: est ? est.k : null, est: est ? est.n + ' (' + est.s + ')' : null, q: 1 }; renderFood(); $(est ? '#fp-add' : '#fp-k').focus({ preventScroll: true }); return; }
  if (t.dataset.fpSet && S.pick) { S.pick.q = +t.dataset.fpSet; renderPick(); return; }
  if (t.dataset.fpStep && S.pick) { S.pick.q = Math.min(20, Math.max(0.5, S.pick.q + +t.dataset.fpStep)); renderPick(); return; }
  if (t.id === 'fp-add' && S.pick) { addPicked(); return; }
  if (t.id === 'fp-cancel') { S.pick = null; renderFood(); $('#food-in').focus(); return; }
  if (t.dataset.rmMeal != null) { logDay('meal_remove', { i: +t.dataset.rmMeal }, ''); return; }
  if (t.dataset.ex) { S.exType = t.dataset.ex; renderClient(); return; }
  if (t.dataset.lb) { S.lb = t.dataset.lb; renderLeaderboard(); return; }
  if (t.dataset.liquid) {
    const id = t.dataset.liquid, on = !S.ticked.has(id);
    if (on) S.ticked.add(id); else S.ticked.delete(id);
    sfx('tap'); renderLiquids();
    queue(async () => { const r = fixErr(await S.sb.rpc('tick_liquid', { p_liquid: id, p_on: on })); await loadClient(); renderClient(); if (r.data && r.data.gained) reward(r.data, 'All liquids taken'); });
    return;
  }
  if (t.dataset.thread) { S.openThread = t.dataset.thread; loadMsgs(S.openThread).then(renderClientMsgs).catch((er) => toast(friendly(er))); return; }
  if (t.dataset.jump) { const h = document.getElementById(t.dataset.jump); if (h) { const card = h.closest('.card, .hero') || h; window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' }); } document.querySelectorAll('#mbar button').forEach((b) => b.classList.toggle('on', b === t)); return; }
  if (t.dataset.react) {
    const tid = S.role === 'client' ? S.openThread : S.kThread;
    S.sb.rpc('react', { p_message: t.dataset.mid, p_emoji: t.dataset.react }).then(async (r) => { if (r.error) { toast(friendly(r.error)); return; } sfx('tap'); await loadMsgs(tid); if (S.role === 'client') renderClientMsgs(); else renderInbox(); });
    return;
  }
  if (!isStaff()) return;
  // staff
  if (t.dataset.tab && !t.dataset.go) { setTab(t.dataset.tab); return; }
  if (t.dataset.kth) { S.kThread = t.dataset.kth; S.kOpen = true; if (t.dataset.go) { S.ibox = 'mine'; setTab(t.dataset.go); } loadMsgs(S.kThread).then(() => { renderInbox(); if (t.dataset.go) window.scrollTo({ top: 0, behavior: 'smooth' }); }).catch((er) => toast(friendly(er))); return; }
  if (t.dataset.doneThread) { S.sb.rpc('mark_thread_done', { p_thread: t.dataset.doneThread }).then(async (r) => { if (r.error) { toast(friendly(r.error)); return; } await loadThreads(); renderStaff(); toast('Marked as done'); }); return; }
  if (t.dataset.msgClient) { const c = S.clients.find((x) => x.id === t.dataset.msgClient); const dr = t.dataset.draft && DRAFTS[t.dataset.draft]; openClientChat(t.dataset.msgClient, c ? (dr ? dr(c) : 'Hi ' + first(c.name) + ', ') : ''); return; }
  if (t.dataset.remind) {
    const c = S.clients.find((x) => x.id === t.dataset.remind); if (!c) return; t.disabled = true;
    S.sb.rpc('ensure_chat', { p_client: c.id }).then(async (r) => {
      if (r.error) { toast(friendly(r.error)); t.disabled = false; return; }
      const s2 = await S.sb.rpc('send_message', { p_thread: r.data, p_body: renewalText(c) });
      if (s2.error) { toast(friendly(s2.error)); t.disabled = false; return; }
      toast('Renewal reminder sent to ' + first(c.name)); await loadThreads(); renderStaff();
    });
    return;
  }
  if (t.dataset.tier) { S.tier = t.dataset.tier; renderClientsTable(); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; if (S.sortK === k) S.sortDir = -S.sortDir; else { S.sortK = k; S.sortDir = (k === 'name' || k === 'last' || k === 'end') ? 1 : -1; } renderClientsTable(); return; }
  if (t.dataset.pick) { openDrawer(t.dataset.pick, t.dataset.dmode || null); return; }
  if (t.dataset.closeDrawer) { closeDrawer(); return; }
  if (t.dataset.ibox) { S.ibox = t.dataset.ibox; S.kOpen = false; const m = inboxThreads(); S.kThread = (m.find((x) => !x.last_from_staff) || m[0] || {}).id || null; loadMsgs(S.kThread).then(renderInbox).catch((er) => toast(friendly(er))); return; }
  if (t.dataset.openBc) { openBroadcast(); return; }
  if (t.dataset.lqRm) { const row = t.closest('.lq-row'); if (row) row.remove(); return; }
  if (t.dataset.dietClient) { S.sel = t.dataset.dietClient; S.dietFor = null; renderDiet(); return; }
  if (t.dataset.dietReuse && isCoach()) { const dd = [].concat(...Object.values(S.diets)).find((x) => x.id === t.dataset.dietReuse); if (dd) { fillDiet(dd); $('#dc-m0').focus(); } return; }
  if (t.dataset.dietDel && isCoach()) { t.disabled = true; S.sb.rpc('delete_diet', { p_id: t.dataset.dietDel }).then(({ error }) => { if (error) { toast(friendly(error)); t.disabled = false; } else { toast('Diet removed'); refreshStaff(); } }); return; }
  if (t.dataset.firstClient) { setTab('clients'); if ($('#add-form').hidden) $('#add-toggle').click(); return; }
  if (t.dataset.copyCred) { copyText(S.cred ? S.cred.text : ''); return; }
  if (t.dataset.credClose) { S.cred = null; renderCred(); return; }
  if (t.dataset.copyDcred) { copyText(S.dcred || ''); return; }
  if (!isCoach()) return;
  // coach only
  if (t.dataset.dmode != null && t.dataset.for) { S.drawerMode = t.dataset.dmode || null; S.dcred = null; S.rmConfirm = null; renderDrawer(); return; }
  if (t.dataset.resetGo) {
    const c = S.clients.find((x) => x.id === t.dataset.resetGo), pr = c && profOf(c); if (!pr || !pr.username) return;
    const pw = tempPassword(); t.disabled = true;
    S.sb.rpc('reset_password', { p_username: pr.username, p_new_password: pw }).then(async (r) => {
      if (r.error) { toast(friendly(r.error)); t.disabled = false; return; }
      S.dcred = loginMessage(c.name, pr.username, pw); await refreshStaff(); S.drawerMode = 'reset'; renderDrawer();
    });
    return;
  }
  if (t.dataset.renew) { const c = S.clients.find((x) => x.id === t.dataset.renew); if (!c) return; const base = planLeft(c) < 0 ? TODAY : c.plan_end; coachUpdate(c.id, { plan_end: addDays(base, 30) }, first(c.name) + '’s plan now runs to ' + fmtShort(addDays(base, 30))); return; }
  if (t.dataset.detox) { t.disabled = true; S.sb.rpc('coach_mark_detox', { p_client: t.dataset.detox }).then(({ error }) => { if (error) { toast(friendly(error)); t.disabled = false; } else { toast('Detox day recorded'); refreshStaff(); } }); return; }
  if (t.dataset.editPlan) { S.sel = t.dataset.editPlan; S.dietFor = null; closeDrawer(); setTab('diet'); renderDiet(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('#dc-m0').focus({ preventScroll: true }); return; }
  if (t.dataset.rm) { S.rmConfirm = t.dataset.rm; renderDrawer(); return; }
  if (t.dataset.rmNo) { S.rmConfirm = null; renderDrawer(); return; }
  if (t.dataset.rmYes) { const id = t.dataset.rmYes; t.disabled = true; S.sb.rpc('delete_client', { p_client: id }).then(({ error }) => { if (error) { toast(friendly(error)); t.disabled = false; } else { closeDrawer(); toast('Client deleted'); refreshStaff(); } }); return; }
});
$('#stabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const ids = staffTabs().map((t) => t[0]), i = ids.indexOf(S.tab), n = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
  setTab(n); const b = $('#t-' + n); if (b) b.focus();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('.celebrate')) return;
  if (S.zoom) closeZoom(); else if (!$('#pw-modal').hidden) closeModal(); else if (S.drawer) closeDrawer();
});
function syncSound() { const b = $('#snd'); b.textContent = SOUND ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(SOUND)); }
function syncMbar() { const on = !$('#app').hidden && S.role === 'client' && !!S.me; $('#mbar').hidden = !on; document.body.classList.toggle('has-mbar', on); $('#snd').hidden = S.role !== 'client';  const st = !$('#app').hidden && isStaff(); $('#sbar').hidden = !st; document.body.classList.toggle('has-sbar', st); if (st) document.body.classList.add('has-mbar'); }
let rz = null;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S.role === 'client' && S.me && !$('#app').hidden) renderChart(S.me.goal_kg ? num(S.me.goal_kg) : null, S.weights, $('#chart-box'), num(S.me.start_kg)); }, 150); });
function refreshVisible() {
  if (!S.session || $('#app').hidden) return;
  if (syncToday()) { S.day = null; }
  if (S.role === 'client') refreshClient(); else if (!S.drawer && !(document.activeElement && document.activeElement.closest('#add-form, #grp-form, #dc-form, #bc-form'))) refreshStaff();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshVisible(); });
setInterval(() => { if (document.visibilityState === 'visible' && isStaff()) refreshVisible(); }, 60000);

/* card icons */
const ICONS = { scale: 'M4 20h16M6 20l2-12h8l2 12M12 8V4M9 4h6', plate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', drop: G.drop, run: 'M13 4a2 2 0 1 0 0 .1M7 21l3-6 3 2v4M10 15l1-5 3 2 3 1M8 11l3-1', leaf: G.leaf, target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', medal: 'M8 3l4 6 4-6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21c0-4 3-6 6-6s6 2 6 6M16 3.5a4 4 0 0 1 0 7.5M21 21c0-3-1.5-5-4-5.7', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', pulse: 'M3 12h4l2-5 4 10 2-5h6', chat: 'M4 5h16v11H9l-5 4z', check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9' };
const TILE = { forest: '#1f5233', slate: '#2c5282', ember: '#c2410c', water: '#2a6db0', gold: '#a8690b', danger: '#b42318' };
const CARD_ICONS = { 'wt-h': ['scale', 'forest'], 'cal-h': ['plate', 'ember'], 'wa-h': ['drop', 'water'], 'ex-h': ['run', 'slate'], 'pl-h': ['leaf', 'forest'], 'ch-h': ['target', 'ember'], 'ac-h': ['medal', 'gold'], 'lb-h': ['trophy', 'gold'], 'cl-h': ['users', 'forest'], 'dc-h': ['leaf', 'forest'], 'rn-h': ['clock', 'ember'], 'dx-h': ['leaf', 'slate'], 'bt-h': ['pulse', 'danger'], 'ms-h': ['chat', 'slate'], 'lq-h': ['drop', 'slate'], 'ib-h': ['chat', 'slate'], 'tk-h': ['check', 'ember'], 'ph-h': ['plate', 'ember'], 'wk-h': ['trophy', 'gold'], 'ac2-h': ['pulse', 'slate'], 'w7-h': ['scale', 'forest'], 'dl-h': ['leaf', 'forest'], 'ci-h': ['scale', 'forest'] };
Object.entries(CARD_ICONS).forEach(([hid, [ic, col]]) => {
  const h = document.getElementById(hid); if (!h) return; const head = h.closest('.card-h > div'); if (!head) return;
  const w = document.createElement('div'); w.className = 'head'; head.parentNode.insertBefore(w, head);
  const tile = document.createElement('span'); tile.className = 'ictile'; tile.style.background = TILE[col]; tile.setAttribute('aria-hidden', 'true');
  tile.innerHTML = '<svg viewBox="0 0 24 24"><path class="ic" style="stroke:#fff;stroke-width:2" d="' + ICONS[ic] + '"/></svg>';
  w.appendChild(tile); w.appendChild(head);
});

syncSound();
boot().catch((e) => { $('#loading-text').textContent = friendly(e); show('gate-loading'); });
})();
