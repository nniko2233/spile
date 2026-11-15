/**
 * Screen 3: the risk manager's questionnaire. Agent B.
 *
 * Built on docs/specs/01-risk-manager-questionnaire.md: Parts A to G, the rule
 * risk = likelihood x consequence, points shared across domains (B), an importance
 * 0-5 and Low / Medium / High thresholds per criterion (C), consequence levels
 * (D), the ISA matrix that decides red, amber and green (E), the optimiser's
 * goal and limits (F), and the consistency checks and sign-off (G).
 *
 * Every part opens pre-filled from the sector template, as the spec says, so the
 * demo is seven short screens and not forty minutes. Deliberately absent: the
 * yearly budget (F2). PROJECT.md: no budget control on any screen.
 */
(() => {
  'use strict';
  const { h } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus;

  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    transmission: '<path d="M12 2v20M7 22l5-16 5 16M4 8h16M7 13h10"/>',
    distribution: '<path d="M12 3v19M6 6h12M8 10h8M6 6v2M18 6v2M8 10v2M16 10v2"/>',
    rail: '<path d="M8 3v18M16 3v18M5 7h14M5 12h14M5 17h14"/>',
    road: '<path d="M7 21 10 3M17 21 14 3M12 5v2M12 11v2M12 17v2"/>',
    hydro: '<path d="M12 3c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C7 9.5 9 7 12 3zM3 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.500 6 0"/>',
    house: '<path d="M4 11 12 4l8 7M6 10v10h12V10M10 20v-6h4v6"/>',
    line: '<path d="M5 4v16M19 4v16M5 7c4 4 10 4 14 0M5 12c4 4 10 4 14 0"/>',
  };

  const PARTS = [
    { id: 'A', name: 'Company and network', builds: 'Template and units' },
    { id: 'B', name: 'Domain weights', builds: 'Likelihood, consequence' },
    { id: 'C', name: 'Criteria', builds: 'Likelihood' },
    { id: 'D', name: 'Consequence calibration', builds: 'Consequence' },
    { id: 'E', name: 'Risk appetite', builds: 'Red, amber, green' },
    { id: 'F', name: 'Optimiser', builds: 'Strategy, not colour' },
    { id: 'G', name: 'Check and sign-off', builds: 'Consistency' },
  ];

  const SECTORS = [
    { v: 'transmission', label: 'Transmission grid', icon: 'transmission' },
    { v: 'distribution', label: 'Distribution grid', icon: 'distribution' },
    { v: 'rail', label: 'Rail', icon: 'rail' },
    { v: 'road', label: 'Road', icon: 'road' },
    { v: 'hydro', label: 'Hydro', icon: 'hydro' },
  ];
  const ASSETS = [
    { v: 'mv_line', label: 'MV overhead line, 15 kV', icon: 'line' },
    { v: 'settlement', label: 'Downstream settlement', icon: 'house' },
    { v: 'hv_line', label: 'HV line, 132 kV', icon: 'transmission' },
    { v: 'road', label: 'Provincial road', icon: 'road' },
    { v: 'rail', label: 'Railway', icon: 'rail' },
    { v: 'hydro', label: 'Hydro intake', icon: 'hydro' },
  ];

  /** Starting templates by sector (spec 01, last section). b1 and b2 each share 100 points. */
  const TEMPLATE = {
    transmission: { b1: [50, 20, 30], b2: [35, 25, 20, 10, 10] },
    distribution: { b1: [50, 20, 30], b2: [35, 25, 20, 10, 10] },
    rail: { b1: [50, 25, 25], b2: [30, 35, 15, 10, 10] },
    road: { b1: [55, 25, 20], b2: [25, 45, 10, 10, 10] },
    hydro: { b1: [40, 40, 20], b2: [35, 20, 10, 25, 10] },
  };
  const B1 = [
    ['Vegetation hazard', 'Distance, height against distance, species, condition, fuel, time since last cut'],
    ['Site and terrain', 'Slope, soil and water, wind exposure, landslides, altitude'],
    ['Weather and season', 'Wind, wet snow and ice, drought and heat, fire danger, past storm damage'],
  ];
  const B2 = [
    ['Service interruption', 'Customers cut off, energy not delivered'],
    ['Safety of people', 'Workers, drivers, residents'],
    ['Fire ignition and spread', 'A fire started by or reaching the asset'],
    ['Asset damage', 'Repair cost and time out of service'],
    ['Regulatory and reputation', 'Penalties, inquiries, press'],
  ];

  /** Part C. [id, criterion, low, medium, high, starting importance] */
  const CRITERIA = [
    [
      ['C1.1', 'Clearance (grow-in)', 'Above clearance + 2 m', 'Within 2 m of clearance', 'Inside clearance: 5 m up to 132 kV', 5],
      ['C1.2', 'Fall-in reach', 'Height < distance − 2 m', 'Height within 2 m of distance', 'Height ≥ distance', 3],
      ['C1.3', 'Growth rate', 'Slow', 'Medium', 'Fast: poplar, willow, black locust', 2],
      ['C1.4', 'Tree condition', 'SIA A–B', 'SIA C', 'SIA C/D–D', 3],
      ['C1.5', 'Fuel load', 'Low', 'Medium', 'High', 3],
      ['C1.6', 'Time since last cut', 'Within cycle', 'Up to 1 year overdue', 'More than 1 year overdue', 2],
    ],
    [
      ['C2.1', 'Slope, trees uphill', 'Under 15%', '15–35%', 'Over 35%, or trees uphill', 4],
      ['C2.2', 'Water and wet soil', 'Over 50 m', '10–50 m', 'Under 10 m, or flood zone', 2],
      ['C2.3', 'Wind exposure', 'Sheltered', 'Open slope', 'Ridge or gap', 3],
      ['C2.4', 'Landslide and erosion', 'None mapped', 'Moderate', 'High, or active slide', 3],
      ['C2.5', 'Altitude (wet snow)', 'Under 600 m', '600–1,000 m', 'Over 1,000 m', 2],
    ],
    [
      ['C3.1', 'Strong gusts', 'Bottom third', 'Middle third', 'Top third', 4],
      ['C3.2', 'Wet snow, ice sleeves', 'Bottom third', 'Middle third', 'Top third', 3],
      ['C3.3', 'Drought and heat', 'Bottom third', 'Middle third', 'Top third', 2],
      ['C3.4', 'Fire danger', 'Bottom third', 'Middle third', 'Top third', 4],
      ['C3.5', 'Past damage here', '0 events', '1 event', '2 or more', 3],
    ],
  ];

  const D1 = [
    ['Service interruption', 'Under 100 users', '100–1,000 users', '1,000–10,000 users', 'Over 10,000 users'],
    ['Safety of people', 'No exposure', 'Workers only', 'Public nearby', 'Public under the asset'],
    ['Fire ignition and spread', 'Low danger, no houses', 'Moderate danger', 'High, houses within 100 m', 'Very high, settlement'],
    ['Asset damage', 'Under 10 k€, 1 day', '10–50 k€', '50–250 k€', 'Over 250 k€, 7 days'],
    ['Regulatory and reputation', 'None', 'Minor penalty', 'Penalty band', 'Notifiable incident'],
  ];

  const LEVELS = ['Low', 'Moderate', 'High', 'Extreme'];
  const LIKELIHOOD = ['Very likely', 'Likely', 'Somewhat likely', 'Unlikely'];
  const CONSEQUENCE = ['Negligible', 'Minor', 'Significant', 'Severe'];
  /** ISA risk matrix, the default of Part E. Indices into LEVELS. */
  const ISA = [[0, 1, 2, 3], [0, 1, 2, 2], [0, 0, 1, 1], [0, 0, 0, 0]];
  const levelColor = i => [SPILE.CLASS_COLOR.basso, SPILE.CLASS_COLOR.medio, SPILE.CLASS_COLOR.alto, SPILE.CLASS_COLOR.alto][i];

  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const AIMS = [
    ['cost', 'Lowest expected cost of outages plus works'],
    ['per_euro', 'Most risk removed per euro'],
    ['no_red', 'No red units left by a set date'],
  ];
  const ACTIONS = ['Prune', 'Fell', 'Widen corridor', 'Replant with slow species', 'Monitor only', 'Engineering fixes'];

  let root, body, part = 0, played, a, filling = null;

  function reset() {
    played = {};
    a = {
      sector: null, assets: ['mv_line', 'settlement'], horizon_years: 20, unit: 'Risk zone',
      b1: TEMPLATE.distribution.b1.slice(), b2: TEMPLATE.distribution.b2.slice(),
      importance: {}, tab: 0,
      reroute: 'No', peak: [5, 6, 7, 8],
      matrix: ISA.map(r => r.slice()), target: 'Low', days: { red: 30, amber: 180 },
      aim: 'cost', blocked: [2, 3, 4, 5], actions: [0, 1, 2, 4, 5],
      hard_rule: true, agree: [true, true, true],
    };
    CRITERIA.forEach(d => d.forEach(c => { a.importance[c[0]] = c[5]; }));
  }

  /* ----------------------------------------------------------- helpers */

  /** Keep a set of points summing to 100 when one of them moves. */
  function rebalance(arr, idx, val) {
    val = Math.max(0, Math.min(100, Math.round(val)));
    const others = arr.map((v, i) => i).filter(i => i !== idx);
    const sum = others.reduce((s, i) => s + arr[i], 0), rest = 100 - val;
    arr[idx] = val;
    others.forEach(i => { arr[i] = sum ? Math.round(arr[i] * rest / sum) : Math.round(rest / others.length); });
    const drift = 100 - arr.reduce((s, v) => s + v, 0);
    if (drift) { const big = others.slice().sort((x, y) => arr[y] - arr[x])[0]; arr[big] += drift; }
  }

  /** Weight of each criterion in the likelihood score: P_d / 100 x I_c / sum of I in its domain. */
  function weights() {
    const out = [];
    CRITERIA.forEach((d, di) => {
      const sum = d.reduce((s, c) => s + a.importance[c[0]], 0) || 1;
      d.forEach(c => out.push({ id: c[0], name: c[1], domain: di, inDomain: a.importance[c[0]] / sum, w: a.b1[di] / 100 * a.importance[c[0]] / sum }));
    });
    return out;
  }

  const field = (n, title, hint, ...kids) =>
    h('div.rq-field', null,
      h('div.rq-label', null, h('span.rq-n', { text: n }), h('b', { text: title }), hint && h('em', { text: hint })), kids);

  function choice(items, isOn, onPick, cls) {
    return h('div.rq-choices' + (cls ? '.' + cls : ''), null, items.map(it =>
      h('button.rq-choice', { type: 'button', class: isOn(it.v) ? 'is-on' : '', onclick: () => { onPick(it.v); render(); } },
        it.icon && h('i.rq-icon', { html: svg(ICON[it.icon]) }), h('span', { text: it.label }))));
  }

  function sliders(n, names, arr) {
    const rows = names.map(([name, hint], i) => {
      const num = h('output', { text: String(arr[i]) });
      const input = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(arr[i]), 'aria-label': name,
        oninput: ev => { rebalance(arr, i, +ev.target.value); sync(); } });
      return { el: h('div.rq-slider', null, h('div', null, h('b', { text: name }), h('em', { text: hint })), input, num), input, num };
    });
    function sync() {
      rows.forEach((r, i) => {
        r.input.value = String(arr[i]); r.num.textContent = String(arr[i]);
        r.input.style.setProperty('--fill', arr[i] + '%');
      });
    }
    sync();
    const wrap = h('div.rq-sliders', { 'data-set': n }, rows.map(r => r.el), h('p.rq-total', null, 'Total ', h('b', { text: '100' }), ' of 100 points'));
    wrap._sync = sync;
    return wrap;
  }

  const months = (key) => h('div.rq-months', null, MONTHS.map((m, i) =>
    h('button', { type: 'button', class: a[key].includes(i) ? 'is-on' : '', text: m,
      onclick: () => { a[key] = a[key].includes(i) ? a[key].filter(x => x !== i) : a[key].concat(i); render(); } })));

  /* -------------------------------------------------------------- parts */

  const VIEW = {
    A: () => [
      field('A1', 'Which sector are you in?', 'Picks the starting template',
        choice(SECTORS, v => a.sector === v, v => { a.sector = v; a.b1 = TEMPLATE[v].b1.slice(); a.b2 = TEMPLATE[v].b2.slice(); played.A = true; }, 'is-tiles')),
      field('A2', 'Which assets are in scope?', null,
        choice(ASSETS, v => a.assets.includes(v), v => { a.assets = a.assets.includes(v) ? a.assets.filter(x => x !== v) : a.assets.concat(v); }, 'is-tiles')),
      h('div.rq-row', null,
        field('A9', 'Planning horizon', null,
          choice([5, 10, 20].map(y => ({ v: y, label: y + ' years' })), v => a.horizon_years === v, v => { a.horizon_years = v; })),
        field('A10', 'One unit on the map', null,
          choice(['Span', '100 m of line', 'Risk zone'].map(u => ({ v: u, label: u })), v => a.unit === v, v => { a.unit = v; }))),
    ],

    B: () => [
      field('B1', 'What makes vegetation likely to hit your assets?', 'Share 100 points', sliders('b1', B1, a.b1)),
      field('B2', 'If it does, what hurts most?', 'Share 100 points', sliders('b2', B2, a.b2)),
    ],

    C: () => {
      const ws = weights();
      return [
        h('div.rq-tabs', null, B1.map(([name], i) =>
          h('button', { type: 'button', class: a.tab === i ? 'is-on' : '', onclick: () => { a.tab = i; render(); } },
            h('span', { text: `C${i + 1}` }), name, h('em', { text: a.b1[i] + ' pts' })))),
        h('table.rq-table', null,
          h('thead', null, h('tr', null, ['', 'Criterion', 'Low', 'Medium', 'High', 'Importance 0–5', 'Weight'].map(t => h('th', { text: t })))),
          h('tbody', null, CRITERIA[a.tab].map(c => {
            const w = ws.find(x => x.id === c[0]);
            return h('tr', { 'data-c': c[0], class: a.importance[c[0]] === 5 ? 'is-top' : '' },
              h('td.rq-id', { text: c[0] }), h('td', null, h('b', { text: c[1] })),
              h('td', { text: c[2] }), h('td', { text: c[3] }), h('td', { text: c[4] }),
              h('td', null, h('div.rq-dots', { role: 'group', 'aria-label': 'Importance' }, [1, 2, 3, 4, 5].map(n =>
                h('button', { type: 'button', class: n <= a.importance[c[0]] ? 'is-on' : '', 'aria-label': String(n),
                  onclick: () => { a.importance[c[0]] = a.importance[c[0]] === n ? n - 1 : n; if (c[0] === 'C1.2') played.C = true; render(); } })))),
              h('td.rq-w', { text: Math.round(w.w * 100) + '%' }));
          }))),
        h('p.rq-note', { text: 'Weight = domain points ÷ 100 × importance ÷ sum of importances in the domain.' }),
      ];
    },

    D: () => [
      field('D1', 'What does each level mean for you?', null,
        h('table.rq-table.is-levels', null,
          h('thead', null, h('tr', null, ['Dimension'].concat(CONSEQUENCE).map(t => h('th', { text: t })))),
          h('tbody', null, D1.map((r, i) => h('tr', null, r.map((t, j) => h('td', null, j ? t : h('b', { text: t })))
            .concat(h('td.rq-w', { text: a.b2[i] + ' pts' }))))))),
      h('div.rq-row', null,
        field('D3', 'Can service be rerouted if this unit fails?', 'No moves the unit up one level',
          choice(['Yes, fully', 'Partly', 'No'].map(v => ({ v, label: v })), v => a.reroute === v, v => { a.reroute = v; })),
        field('D4', 'When does a failure cost more?', 'Peak months', months('peak'))),
    ],

    E: () => [
      field('E1', 'Which combinations are red, amber or green?', 'ISA risk matrix. Tap a cell to change it',
        h('table.rq-matrix', null,
          h('thead', null, h('tr', null, [h('th', { text: 'Likelihood ↓ · Consequence →' })].concat(CONSEQUENCE.map(t => h('th', { text: t }))))),
          h('tbody', null, LIKELIHOOD.map((l, i) => h('tr', null, h('th', { text: l }),
            a.matrix[i].map((lv, j) => h('td', null, h('button', { type: 'button', style: `--c:${levelColor(lv)}`, text: LEVELS[lv],
              onclick: () => { a.matrix[i][j] = (lv + 1) % 4; render(); } })))))))),
      h('div.rq-row', null,
        field('E2', 'How fast must each colour be acted on?', null,
          h('div.rq-days', null,
            h('span', null, h('i.dot', { style: `background:${SPILE.CLASS_COLOR.alto}` }), 'Red ', h('b', { text: a.days.red + ' days' })),
            h('span', null, h('i.dot', { style: `background:${SPILE.CLASS_COLOR.medio}` }), 'Amber ', h('b', { text: a.days.amber + ' days' })),
            h('span', null, h('i.dot', { style: `background:${SPILE.CLASS_COLOR.basso}` }), 'Green ', h('b', { text: 'next cycle' })))),
        field('E', 'After a plan, every unit must be', 'The acceptance threshold of the plans',
          choice(['Low', 'Moderate'].map(v => ({ v, label: v })), v => a.target === v, v => { a.target = v; }))),
    ],

    F: () => [
      field('F1', 'What should the plan aim for?', 'Pick one',
        choice(AIMS.map(([v, label]) => ({ v, label })), v => a.aim === v, v => { a.aim = v; }, 'is-stack')),
      h('div.rq-row', null,
        field('F5', 'When is work not allowed?', 'Nesting, fire season, snow', months('blocked')),
        field('F9', 'Which actions are allowed?', null,
          choice(ACTIONS.map((label, v) => ({ v, label })), v => a.actions.includes(v),
            v => { a.actions = a.actions.includes(v) ? a.actions.filter(x => x !== v) : a.actions.concat(v); }))),
      h('p.rq-note', { text: 'These answers change the cost and the timing of a plan, never the colour of a unit.' }),
    ],

    G: () => {
      const top = weights().sort((x, y) => y.w - x.w).slice(0, 5), max = top[0].w || 1;
      const zs = SPILE.data.getZones().slice().sort((x, y) => x.rank - y.rank);
      const demo = SPILE.data.getDemoZone();
      const units = [demo, zs.find(z => z.cls === 'alto' && z.id !== demo.id), zs.find(z => z.cls === 'medio')].filter(Boolean);
      return [
        h('div.rq-row', null,
          field('G1', 'Swing ranking', 'The five criteria that move the map most',
            h('ol.rq-swing', null, top.map(t => h('li', null, h('span', { text: t.id }), h('b', { text: t.name }),
              h('i', { style: `--w:${Math.round(t.w / max * 100)}%` }), h('em', { text: Math.round(t.w * 100) + '%' }))))),
          field('G2', 'Three test units', 'Agree with the colour?',
            h('ul.rq-units', null, units.map((z, i) => h('li', null,
              h('i.dot', { style: `background:${SPILE.CLASS_COLOR[z.cls]}` }),
              h('span', null, h('b', { text: 'Area ' + z.id }), ` · ${z.types.join(', ')}`),
              h('button', { type: 'button', class: a.agree[i] ? 'is-on' : '', text: a.agree[i] ? 'Agree' : 'Disagree',
                onclick: () => { a.agree[i] = !a.agree[i]; render(); } })))))),
        h('div.rq-row', null,
          field('G3', 'Hard rule', 'Overrides the weighted score',
            choice([{ v: true, label: 'Vegetation inside the safety clearance is always red' }], () => a.hard_rule, () => { a.hard_rule = !a.hard_rule; }, 'is-stack')),
          field('G5', 'Sign-off', null,
            h('dl.rq-sign', null, [['Role', 'Head of asset risk'], ['Version', '1.0 · 15 Nov 2026'], ['Next review', 'Nov 2027']]
              .map(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])))),
      ];
    },
  };

  /* ---------------------------------------------------------------- flow */

  function render() {
    const p = PARTS[part], last = part === PARTS.length - 1;
    body.replaceChildren(
      h('header.rq-head', null,
        h('div', null, h('p.eyebrow', { text: `Part ${p.id} of G` }), h('h1', { text: p.name })),
        h('p.rq-builds', null, 'Builds ', h('b', { text: p.builds }))),
      h('div.rq-part', { 'data-part': p.id }, VIEW[p.id]()),
      h('footer.rq-foot', null,
        part > 0 ? h('button.btn-link', { type: 'button', text: 'Back', onclick: () => go(part - 1) }) : h('span'),
        h('button.btn.btn-primary', { type: 'button', onclick: () => (last ? done() : part === 0 ? autofill() : go(part + 1)) },
          h('span', { text: last ? 'Build the risk map' : `Next: ${PARTS[part === 0 ? PARTS.length - 1 : part + 1].name}` }))));
    root.querySelectorAll('.rq-rail li').forEach((li, i) => {
      li.classList.toggle('is-now', i === part);
      li.classList.toggle('is-done', i < part);
    });
  }

  function go(i) { part = Math.max(0, Math.min(PARTS.length - 1, i)); render(); }

  function stopFilling() {
    clearTimeout(filling); filling = null;
    if (root) root.classList.remove('is-filling');
  }

  /**
   * Demo shortcut (Niko, 15 Nov): Next on Part A does not walk B to F. The middle
   * parts are filled from the sector template, each one flashes by so the viewer
   * sees it happen, and the form lands on Part G with "Build the risk map".
   * Back and the rail still reach every part by hand.
   */
  function autofill() {
    if (filling) return;
    if (!a.sector) { a.sector = 'distribution'; a.b1 = TEMPLATE.distribution.b1.slice(); a.b2 = TEMPLATE.distribution.b2.slice(); }
    // The two answers the scripted walk used to set by hand.
    rebalance(a.b1, 0, 56); a.importance['C1.2'] = 5; a.tab = 0;
    played.A = played.B = played.C = true;
    root.classList.add('is-filling');
    let i = 1;
    (function step() {
      if (i >= PARTS.length - 1) { stopFilling(); go(PARTS.length - 1); return; }
      go(i++);
      filling = setTimeout(step, 240);
    })();
  }

  function done() {
    if (!a.sector) a.sector = 'distribution';
    bus.emit(E.SURVEY_DONE, { answers: JSON.parse(JSON.stringify(a)) });
  }

  /** One signature gesture per part, for the presenter key and the autoplay. */
  const BEAT = {
    A() { a.sector = 'distribution'; render(); },
    B() {
      const wrap = body.querySelector('.rq-sliders[data-set="b1"]');
      let v = a.b1[0];
      const t = setInterval(() => {
        v += 1; rebalance(a.b1, 0, v);
        if (wrap && wrap.isConnected) wrap._sync(); else clearInterval(t);
        if (v >= 56) clearInterval(t);
      }, 60);
    },
    C() { a.tab = 0; a.importance['C1.2'] = 5; render(); },
  };

  function presenterNext() {
    const id = PARTS[part].id;
    if (filling) return;
    if (BEAT[id] && !played[id]) { played[id] = true; BEAT[id](); return; }
    if (part === PARTS.length - 1) done(); else if (part === 0) autofill(); else go(part + 1);
  }

  SPILE.ui.screen('questionnaire', {
    init(el) {
      body = h('div.rq-body');
      root = h('div.rq', null,
        h('aside.rq-rail', null,
          h('p.eyebrow', { text: 'Risk profile' }),
          h('p.rq-rule', { html: 'risk = <b>likelihood</b> × <b>consequence</b>' }),
          h('ol', null, PARTS.map((p, i) => h('li', { onclick: () => go(i) },
            h('span', { text: p.id }), h('div', null, h('b', { text: p.name }), h('em', { text: p.builds }))))),
          h('p.rq-src', { text: 'Likelihood and matrix after the ISA tree risk method' })),
        body);
      el.append(root);
      bus.on(E.PRESENTER_NEXT, p => { if (p && p.screen === 'questionnaire') presenterNext(); });
    },
    show() { stopFilling(); reset(); part = 0; render(); },
  });
})();
