// UI only. All routing, search and line data come from the C engine (metro.wasm).
'use strict';

const $ = (id) => document.getElementById(id);
let metro;
let lastRoute = null;
let chosen = 0;

const call = (fn, ...args) =>
  JSON.parse(metro.ccall(fn, 'string', args.map(() => 'string'), args));

const lineVars = (line) => {
  const k = line.toLowerCase();
  return `--c: var(--${k}, #888); --ci: var(--${k}-ink, #fff)`;
};
const chip = (line) => `<span class="chip" style="${lineVars(line)}">${esc(line)}</span>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function setStatus(text, isError) {
  $('status').textContent = text;
  $('status').classList.toggle('error', !!isError);
}

// --- recent trips (this device only; storage can be blocked, so never rely on it) ---

function recents() {
  try {
    return JSON.parse(localStorage.getItem('recent') || '[]');
  } catch {
    return [];
  }
}

function remember(from, to) {
  const list = [{ from, to }, ...recents().filter((r) => r.from !== from || r.to !== to)].slice(0, 5);
  try {
    localStorage.setItem('recent', JSON.stringify(list));
  } catch {}
}

function renderRecents() {
  const list = recents();
  $('recent-box').hidden = !list.length;
  $('recent').innerHTML = list
    .map((r) => `<li><a href="${tripUrl(r.from, r.to)}">${esc(r.from)} to ${esc(r.to)}</a></li>`)
    .join('');
}

const tripUrl = (from, to) => `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

// --- station combobox ---------------------------------------------------

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

  const mark = () => {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === active));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', list.children[active].id);
      list.children[active].scrollIntoView({ block: 'nearest' });
    }
  };

  input.addEventListener('input', () => {
    const text = input.value.trim();
    items = text ? call('api_search', text).slice(0, 8) : [];
    if (!items.length) return close();
    list.innerHTML = items
      .map((s, i) => `<li role="option" id="${list.id}-${i}" aria-selected="false">
        <span>${esc(s.name)}</span>
        <span class="chips">${s.lines.map(chip).join('')}</span></li>`)
      .join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') active = Math.min(active + 1, items.length - 1);
    else if (e.key === 'ArrowUp') active = Math.max(active - 1, 0);
    else if (e.key === 'Enter') {
      e.preventDefault();
      return pick(Math.max(active, 0));
    } else if (e.key === 'Escape') return close();
    else return;
    e.preventDefault();
    mark();
  });

  // mousedown so the pick lands before the input loses focus
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    pick([...list.children].indexOf(li));
  });

  input.addEventListener('blur', close);
}

// --- route ---------------------------------------------------------------

const KIND = { FASTEST: 'Fastest', FEWEST_CHANGES: 'Fewest changes' };
const changesText = (n) => (n ? plural(n, 'change') : 'No changes');

function legHtml(l) {
  const first = l.stations[0];
  const last = l.stations[l.stations.length - 1];
  const stops = l.stations.length - 1;
  const mid = l.stations.slice(1, -1);
  return `<div class="leg" style="${lineVars(l.line)}">
    <div class="leg-head">${chip(l.line + ' line')}
      ${l.towards ? `<span class="dir">towards ${esc(l.towards)}</span>` : ''}</div>
    <p class="leg-ends">${esc(first)} to <b>${esc(last)}</b></p>
    <p class="leg-meta">${plural(stops, 'stop')}</p>
    ${mid.length ? `<details><summary>Show stations</summary>
      <ol>${mid.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
  </div>`;
}

function changeHtml(c) {
  const k1 = c.fromLine.toLowerCase();
  const k2 = c.toLine.toLowerCase();
  const walkway = c.at !== c.toStation;
  return `<div class="change" style="--c1: var(--${k1}, #888); --c2: var(--${k2}, #888)">
    <span class="knot" aria-hidden="true"></span>
    <div>
      <p><b>Change at ${esc(c.at)}</b> to ${chip(c.toLine + ' line')}</p>
      <p class="walk">${walkway ? `Exit and walk to ${esc(c.toStation)}, ` : ''}about ${c.walk} min</p>
    </div>
  </div>`;
}

function renderRoute() {
  const r = lastRoute;
  const o = r.options[chosen];

  let strip = `<div class="end"><span class="pin" aria-hidden="true"></span><p>${esc(r.from)}</p></div>`;
  o.legs.forEach((l, i) => {
    if (i) strip += changeHtml(o.changes[i - 1]);
    strip += legHtml(l);
  });
  strip += `<div class="end"><span class="pin" aria-hidden="true"></span><p>${esc(r.to)}</p></div>`;

  const tabs =
    r.options.length > 1
      ? `<div class="options" role="group" aria-label="Route options">${r.options
          .map((x, i) => `<button type="button" data-opt="${i}" aria-pressed="${i === chosen}">
            <b>${KIND[x.kind] || x.kind}</b>
            <span>${x.minutes} min, ${changesText(x.interchanges).toLowerCase()}</span></button>`)
          .join('')}</div>`
      : '';

  $('result').innerHTML = `
    <h2>${esc(r.from)} to ${esc(r.to)}</h2>
    <p class="headline">${o.minutes} min</p>
    <p class="subline">${changesText(o.interchanges)}, ${plural(o.stops, 'stop')}, about Rs ${o.fare}</p>
    ${tabs}
    ${strip}
    <p class="fare-note">Times are estimates. Fare is approximate; check at the station.</p>
    <div class="actions"><button type="button" class="ghost" id="share">Copy link</button></div>`;

  $('trip-text').textContent = `${r.from} to ${r.to}`;
  $('go').classList.add('secondary');
}

function findRoute(push) {
  const from = $('from').value.trim();
  const to = $('to').value.trim();
  if (!from || !to) return;
  const r = call('api_route', from, to);
  if (!r.ok) {
    lastRoute = null;
    $('result').innerHTML = '';
    document.body.classList.remove('has-result');
    const msg = {
      UNKNOWN_STATION: `No station matches "${r.error.message}". Pick one from the list.`,
      SAME_STATION: 'Start and end are the same station.',
      NO_ROUTE: 'No route between these stations.',
    }[r.error.code] || r.error.message;
    return setStatus(msg, true);
  }
  setStatus('');
  // the engine may have matched "cp" to Rajiv Chowk; show what it used
  $('from').value = r.from;
  $('to').value = r.to;
  lastRoute = r;
  chosen = 0;
  renderRoute();
  showView('route');
  document.body.classList.add('has-result');
  document.body.classList.remove('editing');
  remember(r.from, r.to);
  const url = tripUrl(r.from, r.to);
  if (push && location.search !== url) history.pushState(null, '', url);
}

// --- views ---------------------------------------------------------------

function showView(view) {
  const lines = view === 'lines';
  document.body.classList.toggle('lines-view', lines);
  $('lines').hidden = !lines;
  $('result').hidden = lines;
  $('start').hidden = lines || !!lastRoute;
  $('nav-lines').toggleAttribute('aria-current', lines);
  $('nav-route').toggleAttribute('aria-current', !lines);
  if (lines) {
    $('nav-lines').setAttribute('aria-current', 'page');
    if (!$('line-stations').children.length) showLine(call('api_lines')[0]);
  } else {
    $('nav-route').setAttribute('aria-current', 'page');
    renderRecents();
  }
}

function loadFromUrl() {
  const q = new URLSearchParams(location.search);
  $('from').value = q.get('from') || '';
  $('to').value = q.get('to') || '';
  if ($('from').value && $('to').value) findRoute(false);
  else {
    lastRoute = null;
    $('result').innerHTML = '';
    document.body.classList.remove('has-result');
    $('go').classList.remove('secondary');
  }
  showView(location.hash === '#lines' ? 'lines' : 'route');
}

// --- lines ---------------------------------------------------------------

function showLine(line) {
  const stations = call('api_line', line);
  $('line-stations').innerHTML = stations.map((s) => `<li>${esc(s)}</li>`).join('');
  [...$('line-tabs').children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.line === line));
}

function setupLines() {
  $('line-tabs').innerHTML = call('api_lines')
    .map((l) => `<button type="button" style="${lineVars(l)}" data-line="${esc(l)}" aria-pressed="false">${esc(l)}</button>`)
    .join('');
  $('line-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) showLine(b.dataset.line);
  });
}

// --- start ---------------------------------------------------------------

createMetro().then((m) => {
  metro = m;
  const n = metro.ccall('api_load', 'number', ['string'], ['/data']);
  if (n < 0) return setStatus("Couldn't load the network data. Try reloading.", true);

  combobox($('from'), $('from-list'));
  combobox($('to'), $('to-list'));
  document.addEventListener('picked', () => findRoute(true));
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    findRoute(true);
  });
  $('swap').addEventListener('click', () => {
    [$('from').value, $('to').value] = [$('to').value, $('from').value];
    findRoute(true);
  });
  $('edit').addEventListener('click', () => {
    document.body.classList.add('editing');
    $('from').focus();
  });
  $('result').addEventListener('click', (e) => {
    const opt = e.target.closest('[data-opt]');
    if (opt) {
      chosen = Number(opt.dataset.opt);
      renderRoute();
      $('result').querySelector(`[data-opt="${chosen}"]`).focus();
    }
    if (e.target.id === 'share') {
      navigator.clipboard?.writeText(location.href).then(
        () => (e.target.textContent = 'Link copied'),
        () => (e.target.textContent = 'Copy the address bar')
      );
    }
  });
  window.addEventListener('popstate', loadFromUrl);
  window.addEventListener('hashchange', () => showView(location.hash === '#lines' ? 'lines' : 'route'));
  $('nav-route').addEventListener('click', (e) => {
    if (!location.hash) return;
    e.preventDefault();
    history.pushState(null, '', location.pathname + location.search);
    showView('route');
  });
  setupLines();
  loadFromUrl();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
