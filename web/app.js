// UI only. All routing, search and line data come from the C engine (metro.wasm).
'use strict';

const $ = (id) => document.getElementById(id);
let metro;

const call = (fn, ...args) =>
  JSON.parse(metro.ccall(fn, 'string', args.map(() => 'string'), args));

function lineVars(line) {
  const k = line.toLowerCase();
  return `--c: var(--${k}, #888); --ci: var(--${k}-ink, #fff)`;
}

function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function setStatus(text, isError) {
  $('status').textContent = text;
  $('status').classList.toggle('error', !!isError);
}

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
      .map((s, i) => `<li role="option" id="${list.id}-${i}">
        <span>${esc(s.name)}</span>
        <span class="dots" aria-label="${esc(s.lines.join(', '))} line">${s.lines
          .map((l) => `<span class="dot" style="background: var(--${l.toLowerCase()}, #888)"></span>`)
          .join('')}</span></li>`)
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

function renderRoute(r) {
  const leg = (l) => {
    const mid = l.stations.slice(1, -1);
    return `<div class="leg" style="${lineVars(l.line)}">
      <div class="leg-head"><span class="chip">${esc(l.line)} line</span>
        <span>${l.stations.length - 1} stop${l.stations.length === 2 ? '' : 's'}</span></div>
      <p class="leg-ends"><b>${esc(l.stations[0])}</b> to <b>${esc(l.stations[l.stations.length - 1])}</b></p>
      ${mid.length ? `<details><summary>${mid.length} stations in between</summary>
        <ol>${mid.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
    </div>`;
  };
  const change = (c) => {
    const where = c.at === c.toStation ? `at ${esc(c.at)}` : `${esc(c.at)} to ${esc(c.toStation)}`;
    return `<p class="change">Change ${where}: ${esc(c.fromLine)} to ${esc(c.toLine)}, about ${c.walk} min walk</p>`;
  };

  let body = '';
  r.legs.forEach((l, i) => {
    if (i) body += change(r.changes[i - 1]);
    body += leg(l);
  });

  $('result').innerHTML = `
    <h2>${esc(r.from)} to ${esc(r.to)}</h2>
    <div class="summary">
      <div><b>${r.minutes}</b><span>min (est.)</span></div>
      <div><b>${r.stops}</b><span>stops</span></div>
      <div><b>${r.interchanges}</b><span>changes</span></div>
      <div><b>Rs ${r.fare}</b><span>fare (approx.)</span></div>
    </div>
    ${body}`;
}

function findRoute(push) {
  const from = $('from').value.trim();
  const to = $('to').value.trim();
  if (!from || !to) return;
  const r = call('api_route', from, to);
  if (!r.ok) {
    $('result').innerHTML = '';
    const msg = {
      UNKNOWN_STATION: `No station called "${r.error.message}". Pick one from the list.`,
      SAME_STATION: 'Start and end are the same station.',
      NO_ROUTE: 'No route between these stations.',
    }[r.error.code] || r.error.message;
    return setStatus(msg, true);
  }
  setStatus('');
  renderRoute(r);
  const url = `?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
  if (push && location.search !== url) history.pushState(null, '', url);
}

function loadFromUrl() {
  const q = new URLSearchParams(location.search);
  $('from').value = q.get('from') || '';
  $('to').value = q.get('to') || '';
  if ($('from').value && $('to').value) findRoute(false);
  else $('result').innerHTML = '';
}

// --- lines ---------------------------------------------------------------

function showLine(line) {
  const stations = call('api_line', line);
  $('line-stations').innerHTML = stations.map((s) => `<li>${esc(s)}</li>`).join('');
}

function setupLines() {
  const lines = call('api_lines');
  $('line-tabs').innerHTML = lines
    .map((l) => `<button type="button" style="${lineVars(l)}" data-line="${esc(l)}">${esc(l)}</button>`)
    .join('');
  $('line-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) showLine(b.dataset.line);
  });
  $('lines-link').addEventListener('click', (e) => {
    e.preventDefault();
    $('lines').hidden = !$('lines').hidden;
    if (!$('lines').hidden && !$('line-stations').children.length) showLine(lines[0]);
  });
}

// --- start ---------------------------------------------------------------

createMetro().then((m) => {
  metro = m;
  const n = metro.ccall('api_load', 'number', ['string'], ['/data']);
  if (n < 0) return setStatus("Couldn't load the network data.", true);
  setStatus(`${n} stations loaded.`);

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
  window.addEventListener('popstate', loadFromUrl);
  setupLines();
  loadFromUrl();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
