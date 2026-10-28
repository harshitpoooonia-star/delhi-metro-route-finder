// NextStop UI. All routing, search and line data come from the C engine (metro.wasm);
// this file only presents it, remembers trips on this device and runs ride mode.
'use strict';

const $ = (id) => document.getElementById(id);
let metro;
let lastRoute = null;
let chosen = 0;
let ride = null;
let lines = [];
const lineOf = {};      // line -> ordered station names
const linesAt = {};     // station name -> lines that stop there

const call = (fn, ...args) =>
  JSON.parse(metro.ccall(fn, 'string', args.map(() => 'string'), args));

const lineVars = (line) => {
  const k = String(line).toLowerCase();
  return `--c: var(--${k}, #888); --ci: var(--${k}-ink, #fff)`;
};
const chip = (line, text) => `<span class="chip" style="${lineVars(line)}">${esc(text || line)}</span>`;
const dots = (ls) => `<span class="dots" aria-label="${esc(ls.join(', '))} line${ls.length > 1 ? 's' : ''}">${ls
  .map((l) => `<i style="${lineVars(l)}"></i>`).join('')}</span>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const changesText = (n) => (n ? plural(n, 'change') : 'No changes');
const clock = (mins) =>
  new Date(Date.now() + mins * 60000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const icon = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0-4 4m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

// --- device storage (can be blocked; the app must work without it) -----

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const sameTrip = (a, b) => a.from === b.from && a.to === b.to;
const recents = () => store.get('recent', []);
const saved = () => store.get('saved', []);
const isSaved = (t) => saved().some((s) => sameTrip(s, t));

function remember(from, to) {
  store.set('recent', [{ from, to }, ...recents().filter((r) => !sameTrip(r, { from, to }))].slice(0, 6));
}

function toggleSaved(t) {
  const list = saved();
  const on = !list.some((s) => sameTrip(s, t));
  store.set('saved', on ? [t, ...list].slice(0, 12) : list.filter((s) => !sameTrip(s, t)));
  return on;
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

// --- forgiving input: riders type short forms and Hinglish spellings ----

const ALIASES = {
  cp: 'Rajiv Chowk', 'connaught place': 'Rajiv Chowk', 'rajiv chowk metro': 'Rajiv Chowk',
  'kashmiri gate': 'Kashmere Gate', 'kashmir gate': 'Kashmere Gate', isbt: 'Kashmere Gate',
  'hauz khaas': 'Hauz Khas', 'qutub minar': 'Qutab Minar', ina: 'Dilli Haat INA',
  'du': 'Vishwavidyalaya', 'delhi university': 'Vishwavidyalaya', 'north campus': 'Vishwavidyalaya',
  'airport': 'Terminal 1 IGI Airport', 'igi': 'Terminal 1 IGI Airport', 't1': 'Terminal 1 IGI Airport',
  'gurgaon': 'Millennium City Centre Gurugram', 'gurugram': 'Millennium City Centre Gurugram',
  'huda city centre': 'Millennium City Centre Gurugram', 'ndls': 'New Delhi', 'new delhi railway station': 'New Delhi',
  'race course': 'Lok Kalyan Marg', 'aiims delhi': 'AIIMS', 'botanical': 'Botanical Garden',
  'jamia': 'Jamia Millia Islamia', 'iit': 'IIT Delhi', 'gk': 'Greater Kailash', 'lotus temple': 'Kalkaji Mandir',
};

function normalise(text) {
  let t = String(text).toLowerCase().replace(/[.,'’]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\bsec(tor)?\s*-?\s*(\d)/g, 'sector $2').replace(/\b(metro )?(stn|station)$/, '').trim();
  return t;
}

function resolveAlias(text) {
  const t = normalise(text);
  if (ALIASES[t]) return ALIASES[t];
  if (/^sector \d/.test(t)) return 'Noida ' + t.replace(/\b\w/g, (c) => c.toUpperCase());
  return t;
}

function search(text) {
  const t = resolveAlias(text);
  if (!t) return [];
  const hits = call('api_search', t);
  return hits.length || t === text ? hits : call('api_search', text.trim());
}

// --- station combobox ---------------------------------------------------

function recentStations() {
  const seen = new Set();
  for (const r of [...saved(), ...recents()]) for (const s of [r.from, r.to]) seen.add(s);
  return [...seen].filter((s) => linesAt[s]).slice(0, 5).map((name) => ({ name, lines: linesAt[name] }));
}

function highlight(name, text) {
  const q = normalise(text);
  const i = q ? name.toLowerCase().indexOf(q) : -1;
  if (i < 0) return esc(name);
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
}

function combobox(input, list) {
  let items = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };

  const pick = (i) => {
    input.value = items[i].name;
    close();
    input.dispatchEvent(new CustomEvent('picked', { bubbles: true }));
  };

  const options = () => [...list.querySelectorAll('[role="option"]')];

  const mark = () => {
    options().forEach((li, i) => li.setAttribute('aria-selected', i === active));
    if (active >= 0) {
      const li = options()[active];
      input.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    }
  };

  const open = () => {
    const text = input.value.trim();
    const isRecent = !text;
    items = isRecent ? recentStations() : search(text).slice(0, 8);
    if (!items.length) return close();
    list.innerHTML =
      (isRecent ? '<li class="group" role="presentation">Recent stations</li>' : '') +
      items
        .map((s, i) => `<li role="option" id="${list.id}-${i}" aria-selected="false">
          <span>${highlight(s.name, text)}</span>
          <span class="chips">${s.lines.map((l) => chip(l)).join('')}</span></li>`)
        .join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = text ? 0 : -1;
    mark();
  };

  input.addEventListener('input', open);
  input.addEventListener('focus', () => !input.value && open());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && list.hidden && input.value) {
      input.value = '';
      return;
    }
    if (list.hidden) return;
    if (e.key === 'ArrowDown') active = Math.min(active + 1, items.length - 1);
    else if (e.key === 'ArrowUp') active = Math.max(active - 1, 0);
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault();
      if (active >= 0 || input.value.trim()) pick(Math.max(active, 0));
      return;
    } else if (e.key === 'Escape') return close();
    else return;
    e.preventDefault();
    mark();
  });

  // pointerdown so the pick lands before the input loses focus
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[role="option"]');
    if (!li) return;
    e.preventDefault();
    pick(options().indexOf(li));
  });

  input.addEventListener('blur', close);
}

// --- route ---------------------------------------------------------------

const KIND = { FASTEST: 'Fastest', FEWEST_CHANGES: 'Fewest changes' };
const PREF = { FASTEST: 'fastest', FEWEST_CHANGES: 'fewest-changes' };

function walkTotal(o) {
  return o.changes.reduce((n, c) => n + c.walk, 0);
}

function legHtml(l) {
  const first = l.stations[0];
  const last = l.stations[l.stations.length - 1];
  const stops = l.stations.length - 1;
  const mid = l.stations.slice(1, -1);
  return `<li class="leg" style="${lineVars(l.line)}">
    <span class="track" aria-hidden="true"></span>
    <div class="body">
      <div class="leg-head">${chip(l.line, l.line + ' line')}
        ${l.towards ? `<span class="dir">towards <b>${esc(l.towards)}</b></span>` : ''}</div>
      <p class="leg-meta">${esc(first)} to ${esc(last)}, ${plural(stops, 'stop')}</p>
      ${mid.length ? `<details><summary>${plural(mid.length, 'station')} in between</summary>
        <ol>${mid.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
    </div>
  </li>`;
}

function changeHtml(c, nextLeg) {
  const walkway = c.at !== c.toStation;
  return `<li class="change" style="--c1: var(--${c.fromLine.toLowerCase()}, #888); --c2: var(--${c.toLine.toLowerCase()}, #888)">
    <span class="knot" aria-hidden="true"></span>
    <div class="box">
      <p><b>Change at ${esc(c.at)}</b> to the ${chip(c.toLine, c.toLine + ' line')}</p>
      <p class="walk">${walkway ? `Exit and walk to ${esc(c.toStation)}, ` : 'Follow the signs, '}about ${c.walk} min${
        nextLeg && nextLeg.towards ? `. Board towards ${esc(nextLeg.towards)}` : ''}</p>
    </div>
  </li>`;
}

function shareText(r, o) {
  const lines = [`${r.from} to ${r.to} on the Delhi Metro`, `${o.minutes} min, ${changesText(o.interchanges).toLowerCase()}, about Rs ${o.fare}`];
  o.legs.forEach((l, i) => {
    if (i) lines.push(`Change at ${o.changes[i - 1].at} (${o.changes[i - 1].walk} min walk)`);
    lines.push(`${l.line} line towards ${l.towards}: ${l.stations[0]} to ${l.stations[l.stations.length - 1]}, ${plural(l.stations.length - 1, 'stop')}`);
  });
  lines.push('Times and fares are estimates. Sent from NextStop');
  return lines.join('\n');
}

function renderRoute(animate) {
  const r = lastRoute;
  const o = r.options[chosen];
  const trip = { from: r.from, to: r.to };
  const savedNow = isSaved(trip);

  let strip = `<li class="stop"><span class="node" aria-hidden="true"></span><p>${esc(r.from)} <span class="when">now</span></p></li>`;
  o.legs.forEach((l, i) => {
    if (i) strip += changeHtml(o.changes[i - 1], l);
    strip += legHtml(l);
  });
  strip += `<li class="stop end"><span class="node" aria-hidden="true"></span><p>${esc(r.to)} <span class="when">about ${clock(o.minutes)}</span></p></li>`;

  const tabs =
    r.options.length > 1
      ? `<div class="options" role="group" aria-label="Route options">${r.options
          .map((x, i) => `<button type="button" data-opt="${i}" aria-pressed="${i === chosen}">
            ${KIND[x.kind] || x.kind} <span>${x.minutes} min</span></button>`)
          .join('')}</div>`
      : '';

  const el = $('result');
  el.innerHTML = `
    <h2 class="route-name">${esc(r.from)} to ${esc(r.to)}</h2>
    <div class="figure-row">
      <p class="figure">${o.minutes} <small>min</small></p>
      <p class="arrive" id="arrive">Arrive about ${clock(o.minutes)} if you leave now</p>
    </div>
    <ul class="facts">
      <li><b>${changesText(o.interchanges)}</b></li>
      <li>${plural(o.stops, 'stop')}</li>
      <li>about <b>Rs ${o.fare}</b></li>
    </ul>
    <div class="actions">
      <button type="button" class="btn primary" id="start">${icon.play} Start trip</button>
      <button type="button" class="btn" id="save" aria-pressed="${savedNow}">${icon.star} ${savedNow ? 'Saved' : 'Save'}</button>
      <button type="button" class="btn" id="share">${icon.share} Share</button>
    </div>
    ${tabs}
    <ol class="strip" aria-label="Route steps">${strip}</ol>
    <p class="fare-note">Times are estimates from the network data. The fare is approximate; check it at the station.</p>`;
  el.hidden = false;
  el.classList.toggle('enter', !!animate);

  $('trip-text').textContent = `${r.from} to ${r.to}`;
  $('go').textContent = 'Update route';
}

function didYouMean(text) {
  const words = normalise(text).split(' ').filter((w) => w.length > 2);
  const names = new Set();
  for (const w of words) for (const s of call('api_search', w).slice(0, 3)) names.add(s.name);
  return [...names].slice(0, 3);
}

function showError(r, from, to) {
  lastRoute = null;
  $('result').hidden = true;
  document.body.classList.remove('has-result');
  const status = $('status');
  status.classList.add('error');
  if (r.error.code === 'UNKNOWN_STATION') {
    const bad = r.error.message;
    const field = bad === from ? 'from' : 'to';
    const ideas = didYouMean(bad);
    status.innerHTML = `<p>No station called "${esc(bad)}".${ideas.length ? ' Did you mean:' : ' Check the spelling, or pick from the list as you type.'}</p>
      ${ideas.length ? `<div class="did">${ideas.map((n) => `<button type="button" class="btn quiet" data-fix="${field}" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}`;
    return;
  }
  const msg = {
    SAME_STATION: `You're already at ${esc(call('api_search', from)[0]?.name || from)}. Pick a different destination.`,
    NO_ROUTE: 'No route joins these two stations on the lines NextStop covers.',
  }[r.error.code] || esc(r.error.message);
  status.innerHTML = `<p>${msg}</p>`;
}

function findRoute(push, pref) {
  const fromText = $('from').value.trim();
  const toText = $('to').value.trim();
  if (!fromText || !toText) {
    $('status').classList.remove('error');
    $('status').innerHTML = `<p>${fromText ? 'Now pick where you are going.' : 'Pick the station you are starting from.'}</p>`;
    (fromText ? $('to') : $('from')).focus();
    return;
  }
  const from = resolveAlias(fromText);
  const to = resolveAlias(toText);
  const r = call('api_route', from, to);
  if (!r.ok) return showError(r, from, to);

  $('status').innerHTML = '';
  $('status').classList.remove('error');
  // the engine may have matched "cp" to Rajiv Chowk; show what it used
  $('from').value = r.from;
  $('to').value = r.to;
  const changed = !lastRoute || lastRoute.from !== r.from || lastRoute.to !== r.to;
  lastRoute = r;
  const want = pref && r.options.findIndex((o) => PREF[o.kind] === pref);
  chosen = want > 0 ? want : changed ? 0 : Math.min(chosen, r.options.length - 1);
  renderRoute(changed);
  document.body.classList.add('has-result');
  document.body.classList.remove('editing');
  remember(r.from, r.to);
  const url = tripUrl(r.from, r.to, chosen ? PREF[r.options[chosen].kind] : '');
  if (push && location.search !== url) history.pushState(null, '', url);
  showView('plan');

  const live = store.get('ride');
  if (live && sameTrip(live, r) && !push) startRide(live);
}

const tripUrl = (from, to, pref) =>
  `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${pref ? `&pref=${pref}` : ''}`;

// --- ride mode: stop by stop, with the change called out ----------------

function rideSteps(o) {
  const steps = [];
  o.legs.forEach((l, li) => l.stations.forEach((name, si) => steps.push({ name, leg: li, first: si === 0 })));
  return steps;
}

function startRide(saved) {
  const o = lastRoute.options[chosen];
  ride = saved && saved.opt === chosen ? saved : { from: lastRoute.from, to: lastRoute.to, opt: chosen, at: 0, started: Date.now() };
  store.set('ride', ride);
  document.body.classList.add('riding');
  renderRide(o);
}

function endRide() {
  ride = null;
  store.set('ride', null);
  document.body.classList.remove('riding');
  if (lastRoute) renderRoute(false);
}

function renderRide(o) {
  const steps = rideSteps(o);
  const last = steps.length - 1;
  const el = $('result');
  if (ride.at >= last) return renderArrived(o);

  const here = steps[ride.at];
  const next = steps[ride.at + 1];
  const leg = o.legs[here.leg];
  const changeNext = next.leg !== here.leg;
  const hop = Math.max(1, (o.minutes - walkTotal(o)) / Math.max(1, o.stops));
  let left = 0;
  for (let i = ride.at + 1; i <= last; i++) left += steps[i].first ? o.changes[steps[i].leg - 1].walk : hop;
  left = Math.max(1, Math.round(left));
  const stopsLeft = steps.slice(ride.at + 1).filter((s) => !s.first).length;
  const pct = Math.round((ride.at / last) * 100);
  const c = changeNext ? o.changes[here.leg] : null;
  const nextLeg = changeNext ? o.legs[next.leg] : leg;

  const upcoming = steps
    .slice(ride.at + 2, ride.at + 5)
    .map((s) => `<li><span>${esc(s.name)}</span><span>${s.first ? 'change' : o.legs[s.leg].line + ' line'}</span></li>`)
    .join('');

  el.innerHTML = `
    <div class="ride-top">
      <p>To <b>${esc(lastRoute.to)}</b>, arriving about ${clock(left)}</p>
      <button type="button" class="btn quiet" id="end-ride">End trip</button>
    </div>
    <div class="progress" style="--p: ${pct}%; ${lineVars(leg.line)}" role="progressbar" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${ride.at}" aria-label="Trip progress"><i></i></div>
    <p class="progress-label"><span><b>${plural(stopsLeft, 'stop')}</b> to go</span><span>about ${left} min left</span></p>
    <div class="now">
      <p class="label">${changeNext ? 'Get off here' : 'Next stop'}</p>
      <p class="station" aria-live="polite">${esc(changeNext ? here.name : next.name)}</p>
      ${chip(nextLeg.line, nextLeg.line + ' line')} <span class="dir">towards ${esc(nextLeg.towards)}</span>
    </div>
    ${c ? `<div class="alert" style="--c1: var(--${c.fromLine.toLowerCase()}); --c2: var(--${c.toLine.toLowerCase()})">
      <span class="knot" aria-hidden="true"></span>
      <div><p><b>Change to the ${esc(c.toLine)} line</b></p>
      <p class="sm">${c.at !== c.toStation ? `Exit and walk to ${esc(c.toStation)}, ` : ''}about ${c.walk} min. Board towards ${esc(nextLeg.towards)}.</p></div>
    </div>` : ''}
    ${upcoming ? `<h2 class="sr-only">After that</h2><ul class="upcoming">${upcoming}</ul>` : ''}
    <div class="ride-bar">
      <button type="button" class="btn primary" id="next-stop">${changeNext ? `I've changed lines` : `I'm at ${esc(next.name)}`}</button>
      ${ride.at ? '<button type="button" class="btn" id="prev-stop" aria-label="Go back one stop">Back</button>' : ''}
    </div>`;
  el.classList.remove('enter');
}

function renderArrived(o) {
  const took = Math.max(1, Math.round((Date.now() - ride.started) / 60000));
  const r = lastRoute;
  $('result').innerHTML = `
    <div class="arrived">
      <div class="tick" aria-hidden="true">${icon.tick}</div>
      <h2 class="title">You've arrived at ${esc(r.to)}</h2>
      <p class="sub">${took >= 3 ? `${took} min door to door against an estimate of ${o.minutes} min` : `${o.minutes} min estimated`}, ${changesText(o.interchanges).toLowerCase()}, ${plural(o.stops, 'stop')}.</p>
      <div class="actions">
        <button type="button" class="btn primary" id="return">Plan the trip back</button>
        <button type="button" class="btn" id="done">Done</button>
      </div>
    </div>`;
  $('result').classList.add('enter');
  store.set('ride', null);
}

// --- views ---------------------------------------------------------------

function tripItem(t, removable, kind) {
  return `<li><a href="${tripUrl(t.from, t.to)}">
    <span class="names">${dots(linesAt[t.from] || [])}<span>${esc(t.from)}</span><span class="arrow" aria-hidden="true">to</span><span>${esc(t.to)}</span></span></a>
    ${removable ? `<button type="button" class="x" data-remove="${kind}" data-from="${esc(t.from)}" data-to="${esc(t.to)}" aria-label="Remove ${esc(t.from)} to ${esc(t.to)}">${icon.x}</button>` : ''}</li>`;
}

const POPULAR = [
  { from: 'Kashmere Gate', to: 'Hauz Khas' },
  { from: 'Knowledge Park II', to: 'Rajiv Chowk' },
  { from: 'Dwarka Sector 21', to: 'Botanical Garden' },
  { from: 'Vishwavidyalaya', to: 'Millennium City Centre Gurugram' },
];

function renderLists() {
  const s = saved();
  const r = recents();
  $('saved-box').hidden = !s.length;
  $('saved-list').innerHTML = $('saved-list-2').innerHTML = s.map((t) => tripItem(t, true, 'saved')).join('');
  $('recent-box').hidden = !r.length;
  $('recent').innerHTML = r.slice(0, 4).map((t) => tripItem(t, false)).join('');
  $('recent-2').innerHTML = r.map((t) => tripItem(t, true, 'recent')).join('');
  $('saved-empty').hidden = !!s.length;
  $('recent-empty').hidden = !!r.length;
  $('clear-recent-2').hidden = !r.length;
  $('popular').innerHTML = POPULAR.map((t) => tripItem(t, false)).join('');
}

function showView(view) {
  document.body.dataset.view = view;
  $('lines-view').hidden = view !== 'lines';
  $('saved-view').hidden = view !== 'saved';
  $('search').hidden = view !== 'plan';
  $('result').hidden = view !== 'plan' || !lastRoute;
  $('home').hidden = view !== 'plan';
  document.querySelectorAll('.tab').forEach((t) =>
    t.dataset.view === view ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'));
  if (view === 'lines' && !$('line-stations').children.length) showLine(lines[0]);
  renderLists();
}

const viewFromHash = () => (location.hash === '#lines' ? 'lines' : location.hash === '#saved' ? 'saved' : 'plan');

function loadFromUrl() {
  const q = new URLSearchParams(location.search);
  $('from').value = q.get('from') || '';
  $('to').value = q.get('to') || '';
  if ($('from').value && $('to').value) findRoute(false, q.get('pref'));
  else {
    lastRoute = null;
    $('result').hidden = true;
    document.body.classList.remove('has-result', 'riding');
    $('go').textContent = 'Find route';
  }
  showView(viewFromHash());
}

// --- lines ---------------------------------------------------------------

// interchanges between two differently named stations; the engine links them by a walk
const WALKWAYS = {
  'Noida Sector 51': 'Walk to Noida Sector 52 for the Blue line',
  'Noida Sector 52': 'Walk to Noida Sector 51 for the Aqua line',
};

function showLine(line) {
  const stations = lineOf[line];
  const swaps = stations.filter((s) => linesAt[s].length > 1 || WALKWAYS[s]).length;
  $('line-meta').textContent = `${line} line: ${stations[0]} to ${stations[stations.length - 1]}, ${plural(stations.length, 'station')}, ${plural(swaps, 'interchange')}`;
  $('line-stations').style.cssText = lineVars(line);
  $('line-stations').innerHTML = stations
    .map((s) => {
      const other = linesAt[s].filter((l) => l !== line);
      const note = other.length ? `Change for the ${other.map((l) => l + ' line').join(', ')}` : WALKWAYS[s];
      return `<li class="${note ? 'x' : ''}">
        <span class="nm">${esc(s)}${note ? `<small>${esc(note)}</small>` : ''}</span>
        <span class="act">
          <button type="button" class="btn" data-set="from" data-name="${esc(s)}" aria-label="Start from ${esc(s)}">From</button>
          <button type="button" class="btn" data-set="to" data-name="${esc(s)}" aria-label="Go to ${esc(s)}">To</button>
        </span></li>`;
    })
    .join('');
  $('line-swaps').innerHTML = stations
    .filter((s) => linesAt[s].length > 1 || WALKWAYS[s])
    .map((s) => {
      const other = linesAt[s].filter((l) => l !== line);
      return `<li><span>${esc(s)}</span><span class="chips">${other.length
        ? other.map((l) => chip(l, l)).join('')
        : `<span class="sub">${esc(WALKWAYS[s])}</span>`}</span></li>`;
    })
    .join('') || '<li class="sub">No interchanges on this line.</li>';
  [...$('line-tabs').children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.line === line));
}

function setupLines() {
  lines = call('api_lines');
  for (const l of lines) {
    lineOf[l] = call('api_line', l);
    for (const s of lineOf[l]) (linesAt[s] ||= []).push(l);
  }
  $('line-tabs').innerHTML = lines
    .map((l) => `<button type="button" style="${lineVars(l)}" data-line="${esc(l)}" aria-pressed="false"><i aria-hidden="true"></i>${esc(l)}</button>`)
    .join('');
  $('line-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) showLine(b.dataset.line);
  });
  $('line-stations').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    $(b.dataset.set).value = b.dataset.name;
    history.pushState(null, '', location.pathname + location.search);
    showView('plan');
    if ($('from').value && $('to').value) findRoute(true);
    else {
      toast(`${b.dataset.set === 'from' ? 'Starting from' : 'Going to'} ${b.dataset.name}`);
      $(b.dataset.set === 'from' ? 'to' : 'from').focus();
    }
  });
}

// --- start ---------------------------------------------------------------

function wire() {
  combobox($('from'), $('from-list'));
  combobox($('to'), $('to-list'));
  document.addEventListener('picked', (e) => {
    if (e.target.id === 'from' && !$('to').value) return $('to').focus();
    findRoute(true);
  });
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    findRoute(true);
  });
  $('swap').addEventListener('click', () => {
    [$('from').value, $('to').value] = [$('to').value, $('from').value];
    $('swap').classList.toggle('spin');
    if ($('from').value && $('to').value) findRoute(true);
  });
  $('edit').addEventListener('click', () => {
    document.body.classList.add('editing');
    $('from').focus();
  });

  $('status').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fix]');
    if (!b) return;
    $(b.dataset.fix).value = b.dataset.name;
    findRoute(true);
  });

  $('result').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const o = lastRoute && lastRoute.options[chosen];
    if (t.dataset.opt) {
      chosen = Number(t.dataset.opt);
      renderRoute(false);
      history.replaceState(null, '', tripUrl(lastRoute.from, lastRoute.to, chosen ? PREF[lastRoute.options[chosen].kind] : ''));
      $('result').querySelector(`[data-opt="${chosen}"]`).focus();
    } else if (t.id === 'save') {
      const on = toggleSaved({ from: lastRoute.from, to: lastRoute.to });
      t.setAttribute('aria-pressed', on);
      t.lastChild.textContent = on ? ' Saved' : ' Save';
      toast(on ? 'Saved. Find it under Saved.' : 'Removed from Saved');
    } else if (t.id === 'share') {
      const text = shareText(lastRoute, o);
      const url = location.href;
      if (navigator.share) navigator.share({ title: 'NextStop route', text, url }).catch(() => {});
      else
        navigator.clipboard?.writeText(`${text}\n${url}`).then(
          () => toast('Route copied. Paste it into any chat.'),
          () => toast('Copy the address bar to share this route')
        );
    } else if (t.id === 'start') {
      startRide();
      $('result').scrollIntoView({ block: 'start' });
      $('next-stop').focus();
    } else if (t.id === 'next-stop' || t.id === 'prev-stop') {
      ride.at += t.id === 'next-stop' ? 1 : -1;
      store.set('ride', ride);
      renderRide(o);
      ($('next-stop') || $('return'))?.focus();
    } else if (t.id === 'end-ride' || t.id === 'done') {
      endRide();
    } else if (t.id === 'return') {
      endRide();
      [$('from').value, $('to').value] = [lastRoute.to, lastRoute.from];
      findRoute(true);
    }
  });

  const removeTrip = (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const t = { from: b.dataset.from, to: b.dataset.to };
    const key = b.dataset.remove;
    store.set(key, store.get(key, []).filter((x) => !sameTrip(x, t)));
    renderLists();
    toast(key === 'saved' ? 'Removed from Saved' : 'Removed from Recent');
  };
  $('home').addEventListener('click', removeTrip);
  $('saved-view').addEventListener('click', removeTrip);
  const clear = () => {
    store.set('recent', []);
    renderLists();
    toast('Recent routes cleared');
  };
  $('clear-recent').addEventListener('click', clear);
  $('clear-recent-2').addEventListener('click', clear);

  window.addEventListener('popstate', loadFromUrl);
  window.addEventListener('hashchange', () => showView(viewFromHash()));
  $('brand').addEventListener('click', (e) => {
    e.preventDefault();
    endRide();
    history.pushState(null, '', location.pathname);
    loadFromUrl();
  });
  document.querySelector('.tab[data-view="plan"]').addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState(null, '', location.pathname + location.search);
    showView('plan');
  });

  // "/" jumps to the search, like most search-first apps
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || /input|textarea/i.test(document.activeElement.tagName)) return;
    e.preventDefault();
    if (viewFromHash() !== 'plan') {
      history.pushState(null, '', location.pathname + location.search);
      showView('plan');
    }
    document.body.classList.add('editing');
    $('from').focus();
  });

  // keep "arrive about" honest while the page stays open
  setInterval(() => {
    if (lastRoute && !ride && !document.hidden) {
      const a = $('arrive');
      if (a) a.textContent = `Arrive about ${clock(lastRoute.options[chosen].minutes)} if you leave now`;
    }
  }, 30000);
}

$('from').placeholder = $('to').placeholder = 'Loading stations…';

createMetro().then(
  (m) => {
    metro = m;
    const n = metro.ccall('api_load', 'number', ['string'], ['/data']);
    if (n < 0) {
      $('status').classList.add('error');
      $('status').innerHTML = "<p>Couldn't load the network data. Reload the page to try again.</p>";
      return;
    }
    $('from').disabled = $('to').disabled = false;
    $('from').placeholder = 'Station, e.g. Kashmere Gate';
    $('to').placeholder = 'Station, e.g. Hauz Khas';
    setupLines();
    wire();
    loadFromUrl();
  },
  () => {
    $('status').classList.add('error');
    $('status').innerHTML = "<p>NextStop couldn't start in this browser. Reload the page, or try an up-to-date browser.</p>";
  }
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.ready.then(() => ($('offline').hidden = false)).catch(() => {});
}
