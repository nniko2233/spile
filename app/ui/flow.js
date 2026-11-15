/**
 * Screens 8, 9 and 10: the job cycle after the plan. Agent B.
 *
 *   8  operator     the pin (ring: Plan done) -> "Request cutting job?" -> the
 *                   cutting request, eight steps filled fast-forward -> Save
 *   9  procurement  the pin (two segments) -> "Procure resources?" -> assignment,
 *                   four steps -> Send work order -> the dashboard row turns Assigned
 *   10 final        three thin views, one per role, the same pin in all three
 *
 * Everything here is scripted demo data: field lists follow docs/specs/02 and 03,
 * the values are invented. Colour still means risk only; progress is the ring.
 */
(() => {
  'use strict';
  const { h, k } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus, R = SPILE.ROLES;

  const TILE_MS = 300;   // one step of a pop-up fills in this long

  /** One job, the same all the way through. */
  const JOB = {
    id: 'CR-0142', region: 'VCO', asset: '15 kV MV line', fell: 146, prune: 62, ha: 3.2,
    start: '24 Nov', deadline: '15 Dec', end: '4 Dec', outage: '1–3 Dec, 08:00–16:00',
    contractor: 'Forestry firm A', estimate: '18,400', order: '17,900', po: 'PO-4500123',
  };

  const jobZone = () => (SPILE.state.job && SPILE.state.job.zone) || null;
  const zoneId = () => { const z = jobZone(); return z ? z.id : null; };

  const chip = (name) => h('div.role-chip', null, h('i.dot'), h('span', { text: name }));

  /* -------------------------------------------------------------- pop-up */

  /**
   * A pop-up of numbered steps that fill themselves in, one after the other.
   * cfg: {eyebrow, title, steps: [{name, rows: [[label, value]]}], cta, onSave, onClose}
   */
  function popup(host, cfg) {
    let filled = 0, timer = null, closed = false;
    const tiles = cfg.steps.map((s, i) =>
      h('section.step', null,
        h('header', null, h('span.step-n', { text: String(i + 1) }), h('h3', { text: s.name }), h('i.step-tick')),
        h('dl', null, s.rows.map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]))));
    const cta = h('button.btn.btn-primary', { type: 'button', disabled: true, onclick: () => api.save() }, h('span', { text: cfg.cta }));
    const wrap = h('div.popup-wrap', null,
      h('div.popup', { role: 'dialog', 'aria-label': cfg.title, style: `--cols:${cfg.steps.length > 4 ? 4 : cfg.steps.length}` },
        h('header.popup-head', null,
          h('div', null, h('p.eyebrow', { text: cfg.eyebrow }), h('h2', { text: cfg.title })),
          h('button.icon-btn', { type: 'button', 'aria-label': 'Close', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
            onclick: () => api.close() })),
        h('div.steps', null, tiles),
        h('footer.popup-foot', null, h('span.popup-count', { text: `0 of ${cfg.steps.length}` }), cta)));
    host.append(wrap);

    const count = wrap.querySelector('.popup-count');
    function fillNext() {
      if (closed) return;
      if (filled < tiles.length) {
        tiles[filled].classList.add('is-filled');
        filled += 1;
        count.textContent = `${filled} of ${tiles.length}`;
        timer = setTimeout(fillNext, TILE_MS);
      } else { cta.disabled = false; }
    }
    timer = setTimeout(fillNext, 450);

    const api = {
      isFilled: () => filled >= tiles.length,
      finish() { clearTimeout(timer); tiles.forEach(t => t.classList.add('is-filled')); filled = tiles.length; count.textContent = `${filled} of ${filled}`; cta.disabled = false; },
      save() { if (!api.isFilled()) { api.finish(); return; } api.close(true); cfg.onSave(); },
      close(silent) { if (closed) return; closed = true; clearTimeout(timer); wrap.classList.add('is-leaving'); setTimeout(() => wrap.remove(), 350); if (!silent && cfg.onClose) cfg.onClose(); },
    };
    return api;
  }

  /** The one-line question that follows a tap on the pin. */
  function ask(host, text, onYes) {
    const el = h('button.btn.btn-primary.ask', { type: 'button', onclick: onYes }, h('span', { text }));
    host.append(el);
    return el;
  }

  /* ------------------------------------------------------- 8. operator */

  const REQUEST_STEPS = () => {
    const zp = SPILE.data.getPlans(zoneId()) || {};
    return [
      { name: 'Scope', rows: [['Units', `Area ${zoneId()}, spans 41–44`], ['Type', 'Risk-driven from map'], ['Risk', 'Red, fall-in reach']] },
      { name: 'Field check', rows: [['Site visited', 'Yes, 12 Nov'], ['Map colour', 'Agree'], ['Trees', `${JOB.fell} fell, ${JOB.prune} prune`]] },
      { name: 'Work needed', rows: [['Actions', 'Fell, prune, clear undergrowth'], ['Clearance', '5 m'], ['Area', `${JOB.ha} of ${k(zp.area_ha)} ha`]] },
      { name: 'Timing', rows: [['Priority', 'Urgent'], ['Window', `${JOB.start} → ${JOB.deadline}`], ['Duration', '9 working days']] },
      { name: 'Safety', rows: [['Line outage', JOB.outage], ['Staff', 'CEI 11-27, tree climbers'], ['Public', 'Houses within one tree height']] },
      { name: 'Access', rows: [['Route', 'Forest track, 350 m on foot'], ['Vehicle', '4×4'], ['Crew', '6 people × 9 days']] },
      { name: 'Land and permits', rows: [['Ownership', 'Easement 70%, third party 30%'], ['Owners', 'Notified 10 Nov'], ['Permit', 'Hydrogeological, submitted']] },
      { name: 'Hand-over', rows: [['Budget line', 'VEG-OPEX-VCO-2026'], ['Supervisor', 'Site lead, VCO north'], ['Confirmed', 'Site details accurate']] },
    ];
  };

  function jobScreen(name, role, label, question, makePopup, afterSave) {
    let root, step = 0, pop = null, askEl = null;
    // 0 the pin pulses, 1 the question, 2 the pop-up, 3 saved
    function setStep(n) { step = n; document.body.dataset.pin = n < 3 ? 'pulse' : ''; }
    function showAsk() {
      if (step !== 0) return;
      setStep(1);
      askEl = ask(root, question, openPopup);
    }
    function openPopup() {
      if (step > 1) return;
      setStep(2);
      if (askEl) { askEl.remove(); askEl = null; }
      pop = makePopup(root, () => { setStep(3); afterSave(root); }, () => { pop = null; setStep(0); });
    }
    function next() {
      if (step === 0) showAsk();
      else if (step === 1) openPopup();
      else if (step === 2 && pop) pop.save();
      else if (step === 3 && api.onNextAfterSave) api.onNextAfterSave();
    }
    const api = { onNextAfterSave: null };
    SPILE.ui.screen(name, {
      init(el) {
        root = el;
        bus.on(E.PIN_CLICKED, () => { if (SPILE.state.screen === name) { if (step === 0) showAsk(); } });
        bus.on(E.PRESENTER_NEXT, p => { if (p && p.screen === name) next(); });
      },
      show(el) {
        el.replaceChildren(chip(label));
        pop = null; askEl = null;
        const done = SPILE.state.job && SPILE.state.job.step >= (name === 'operator' ? 2 : 3);
        setStep(done ? 3 : 0);
        if (done && api.onReturn) api.onReturn(el);
      },
      hide() { document.body.dataset.pin = ''; if (pop) pop.close(true); },
    });
    return api;
  }

  jobScreen('operator', R.OPERATOR, 'Regional Operator', 'Request cutting job?',
    (root, onSave, onClose) => popup(root, {
      eyebrow: `${JOB.id} · ${JOB.region} · ${JOB.asset}`, title: 'Cutting request', steps: REQUEST_STEPS(), cta: 'Save request',
      onSave, onClose,
    }),
    () => bus.emit(E.REQUEST_SAVED, { zoneId: zoneId() }));

  /* ---------------------------------------------------- 9. procurement */

  const ASSIGN_STEPS = () => [
    { name: 'Contractor', rows: [['Chosen', `${JOB.contractor}, top suggestion`], ['Qualified', 'CEI 11-27, regional forestry list'], ['Free', `${JOB.start} → ${JOB.end}`]] },
    { name: 'Contract and price', rows: [['Route', 'Call-off, framework FA-2025-017'], ['Estimate', `€ ${JOB.estimate}`], ['Order value', `€ ${JOB.order}`]] },
    { name: 'Schedule', rows: [['Planned', `${JOB.start} → ${JOB.end}`], ['Outage', JOB.outage], ['Site meeting', '21 Nov']] },
    { name: 'Documents', rows: [['Work order', 'Generated from the request'], ['Safety plan', 'Attached'], ['Order number', JOB.po]] },
  ];

  const ROWS = () => [
    { id: JOB.id, where: `${JOB.region} · ${JOB.asset}, area ${zoneId()}`, risk: 'alto', scope: `${JOB.fell} fell, ${JOB.prune} prune, ${JOB.ha} ha`,
      window: `${JOB.start} → ${JOB.deadline}`, status: 'In procurement', contractor: '–', est: JOB.estimate, mine: true },
    { id: 'CR-0139', where: 'VCO · 132 kV line, spans 7–9', risk: 'alto', scope: '9 fell, 0.4 ha', window: '25 Nov → 10 Dec', status: 'Assigned', contractor: 'Forestry firm B', est: '4,100' },
    { id: 'CR-0131', where: 'Novara · 220 kV line, spans 18–22', risk: 'medio', scope: '25 prune, 2.1 ha', window: '1 Nov → 30 Jan', status: 'Verified', contractor: 'Forestry firm B', est: '9,800' },
  ];

  function dashboard(root, assignedNow) {
    const rows = ROWS();
    const sheet = h('div.dash.glass', null,
      h('header.dash-head', null,
        h('div', null, h('p.eyebrow', { text: 'Procurement' }), h('h2', { text: 'Cutting requests' })),
        h('button.btn.btn-primary', { type: 'button', onclick: () => bus.emit(E.FINAL_OPEN, {}) }, h('span', { text: 'All three roles' }))),
      h('table.dash-table', null,
        h('thead', null, h('tr', null, ['Request', 'Region · asset', 'Risk', 'Scope', 'Window', 'Status', 'Contractor', 'Estimate €'].map(t => h('th', { text: t })))),
        h('tbody', null, rows.map(r => h('tr', { class: r.mine ? 'is-mine' : '' },
          h('td', null, h('b', { text: r.id })),
          h('td', { text: r.where }),
          h('td', null, h('i.dot', { style: `background:${SPILE.CLASS_COLOR[r.risk]}` })),
          h('td', { text: r.scope }),
          h('td', { text: r.window }),
          h('td', null, h('span.status', { text: r.status })),
          h('td.dash-contractor', { text: r.contractor }),
          h('td.num', { text: r.est }))))));
    root.append(sheet);
    const mine = sheet.querySelector('tr.is-mine');
    const flip = () => {
      mine.querySelector('.status').textContent = 'Assigned';
      mine.querySelector('.dash-contractor').textContent = JOB.contractor;
      mine.classList.add('is-assigned');
    };
    if (assignedNow) setTimeout(flip, 1100); else flip();
  }

  const proc = jobScreen('procurement', R.PROCUREMENT, 'Procurement', 'Procure resources?',
    (root, onSave, onClose) => popup(root, {
      eyebrow: `${JOB.id} · ${JOB.fell} fell, ${JOB.prune} prune · ${JOB.start} → ${JOB.deadline}`, title: 'Assign the job', steps: ASSIGN_STEPS(), cta: 'Send work order',
      onSave, onClose,
    }),
    root => { bus.emit(E.JOB_ASSIGNED, { zoneId: zoneId() }); dashboard(root, true); });
  proc.onNextAfterSave = () => bus.emit(E.FINAL_OPEN, {});
  proc.onReturn = root => dashboard(root, false);

  /* ---------------------------------------------------------- 10. final */

  const VIEWS = () => {
    const zp = SPILE.data.getPlans(zoneId()) || {}, job = SPILE.state.job || {};
    const plan = (zp.plans || []).find(p => p.id === job.planId) || (zp.plans || []).find(p => p.optimum) || {};
    return [
      { role: R.RISK_MANAGER, name: 'Risk Manager', lines: [['Plan saved', `${k(plan.annualized_k_yr)} k€/yr`], ['Committed', `€ ${JOB.order}`]] },
      { role: R.OPERATOR, name: 'Regional Operator', lines: [[JOB.id, 'Assigned'], [JOB.contractor, `${JOB.start} → ${JOB.end}`]] },
      { role: R.PROCUREMENT, name: 'Procurement', lines: [['Work order', 'Sent'], [JOB.po, `€ ${JOB.order}`]] },
    ];
  };

  let finalToken = 0;
  SPILE.ui.screen('final', {
    show(el) {
      const mine = ++finalToken;
      const pinSVG = (SPILE.map && SPILE.map.pinSVG) ? SPILE.map.pinSVG : () => '';
      const cols = VIEWS().map((v, i) =>
        h('article.view', { style: `--accent:${SPILE.ui.ACCENT[v.role]};--i:${i}` },
          h('div.view-map'),
          h('header.view-top', null, h('i.dot'), h('span', { text: v.name })),
          h('div.view-pin.pin', { html: pinSVG(3, 2) }),
          h('footer.view-card', null,
            h('dl', null, v.lines.map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })])),
            h('ol.view-steps', null,
              h('li.is-done', { text: 'Assigned' }), h('li', { text: 'Verified' }), h('li', { text: 'Paid' })))));
      el.replaceChildren(h('div.views', null, cols), h('p.caption.final-caption', { text: 'One pin, three roles' }));

      // Each view shows the same still of the map, cropped so the pin sits in its middle.
      if (!SPILE.map || !SPILE.map.snapshot) return;
      SPILE.map.snapshot().then(url => {
        if (!url || mine !== finalToken) return;
        const marker = SPILE.map.pinElement && SPILE.map.pinElement();
        const r = marker ? marker.getBoundingClientRect() : null;
        const px = r ? r.left + r.width / 2 : window.innerWidth / 2, py = r ? r.top + r.height / 2 : window.innerHeight / 2;
        cols.forEach(c => {
          const box = c.getBoundingClientRect(), m = c.querySelector('.view-map');
          m.style.backgroundImage = `url(${url})`;
          m.style.backgroundSize = `${window.innerWidth}px ${window.innerHeight}px`;
          m.style.backgroundPosition = `${Math.round(box.width / 2 - px)}px ${Math.round(box.height * 0.42 - py)}px`;
          m.classList.add('is-in');
        });
      });
    },
    hide() { finalToken++; },
  });
})();
