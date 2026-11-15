/**
 * Screens 8, 9 and 10: the job cycle after the plan. Agent B.
 *
 *   8  operator     the pin (ring: Plan done) -> "Request cutting job?" -> the
 *                   cutting request of docs/specs/02: what the platform pre-fills,
 *                   then Steps 1 to 8, field by field -> Submit
 *   9  procurement  the dashboard of docs/specs/03 (What, When, Who, Money, Done)
 *                   -> "Procure resources" on the row -> assignment, Steps P1 to P4
 *                   -> Send work order -> the row turns Assigned
 *   10 final        three thin views, one per role, the same pin in all three
 *
 * Field numbers, names, formats and the status flow are the specs'. The values
 * are one invented job, the same everywhere, labelled demo data on the map.
 * Colour still means risk only; progress is the ring and the status.
 */
(() => {
  'use strict';
  const { h, k } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus, R = SPILE.ROLES;

  /** One job, the same all the way through. Estimate = quantities x unit rates x access multiplier. */
  const RATE = { fell: 95, prune: 45, ha: 420, access: 1.1 };
  const JOB = {
    id: 'CR-0142', region: 'VCO', asset: '15 kV MV line', fell: 146, prune: 62, ha: 3.2, metres: '2,000',
    start: '24 Nov', deadline: '15 Dec', end: '4 Dec', outage: '1–3 Dec, 08:00–16:00',
    contractor: 'Forestry firm A', order: '18,900', po: 'PO-4500123',
  };
  JOB.estimate = (Math.round((JOB.fell * RATE.fell + JOB.prune * RATE.prune + JOB.ha * RATE.ha) * RATE.access / 100) * 100).toLocaleString('en-US');

  /** Spec 02, status flow. */
  const STATUS = ['Draft', 'Submitted', 'Returned', 'In procurement', 'Assigned', 'Work done', 'Verified'];

  const jobZone = () => (SPILE.state.job && SPILE.state.job.zone) || null;
  const zoneId = () => { const z = jobZone(); return z ? z.id : null; };
  const chip = name => h('div.role-chip', null, h('i.dot'), h('span', { text: name }));

  /* -------------------------------------------------------------- wizard */

  /**
   * A pop-up of numbered steps, one screen each, that plays itself fast-forward.
   * cfg: { eyebrow, title, pre: [[label, value]], steps: [{name, fields}], status,
   *        cta, checks, readOnly, onSave, onClose }
   * field: { n, label, value (string or array of lines), pre, tag }
   */
  function wizard(host, cfg) {
    let at = 0, done = cfg.readOnly ? cfg.steps.length : 0, timer = null, closed = false, playing = !cfg.readOnly;
    const rail = h('ol.wz-rail', null, cfg.steps.map((s, i) =>
      h('li', { onclick: () => { api.finish(); show(i); } }, h('span', { text: String(i + 1) }), h('b', { text: s.name }), h('i.step-tick'))));
    const pane = h('div.wz-pane');
    const cta = cfg.readOnly ? null : h('button.btn.btn-primary', { type: 'button', disabled: true, onclick: () => api.save() }, h('span', { text: cfg.cta }));
    const wrap = h('div.popup-wrap', null,
      h('div.popup.wz', { role: 'dialog', 'aria-label': cfg.title },
        h('header.popup-head', null,
          h('div', null, h('p.eyebrow', { text: cfg.eyebrow }), h('h2', { text: cfg.title })),
          h('button.icon-btn', { type: 'button', 'aria-label': 'Close', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
            onclick: () => api.close() })),
        cfg.pre && h('dl.wz-pre', null, h('dt.wz-pre-title', { text: cfg.preTitle || 'Pre-filled by the platform' }),
          cfg.pre.map(([a, b]) => h('div', null, h('dt', { text: a }), h('dd', { text: b })))),
        h('div.wz-main', null, rail, pane),
        h('footer.wz-foot', null,
          h('ol.wz-status', null, STATUS.map((s, i) => h('li', { class: i === cfg.status ? 'is-now' : i < cfg.status ? 'is-done' : '', text: s }))),
          cfg.checks && h('p.wz-checks', { text: cfg.checks }),
          cta)));
    host.append(wrap);

    function show(i) {
      at = i;
      const s = cfg.steps[i];
      pane.replaceChildren(
        h('header', null, h('h3', { text: `Step ${i + 1} · ${s.name}` }), h('span', { text: `${s.fields.length} fields` })),
        h('table.wz-fields', null, h('tbody', null, s.fields.map((f, j) =>
          h('tr', { style: `--j:${j}` },
            h('td.wz-n', { text: f.n }),
            h('td.wz-l', { text: f.label }),
            h('td.wz-v', null, Array.isArray(f.value) ? f.value.map(line => h('span', { text: line })) : f.value),
            h('td.wz-t', null, f.pre ? h('em.is-pre', { text: 'Pre-filled' }) : f.tag ? h('em', { text: f.tag }) : null))))));
      rail.querySelectorAll('li').forEach((li, n) => {
        li.classList.toggle('is-now', n === i);
        li.classList.toggle('is-done', n < done || (n === i && !playing));
      });
    }

    function play() {
      if (closed || !playing) return;
      show(at);
      timer = setTimeout(() => {
        done = Math.max(done, at + 1);
        if (at < cfg.steps.length - 1) { at += 1; play(); }
        else { playing = false; show(at); if (cta) cta.disabled = false; }
      }, 300 + cfg.steps[at].fields.length * 45);
    }

    const api = {
      isFilled: () => done >= cfg.steps.length && !playing,
      finish() { clearTimeout(timer); playing = false; done = cfg.steps.length; if (cta) cta.disabled = false; show(at); },
      save() { if (!api.isFilled()) { api.finish(); return; } api.close(true); if (cfg.onSave) cfg.onSave(); },
      close(silent) { if (closed) return; closed = true; clearTimeout(timer); wrap.classList.add('is-leaving'); setTimeout(() => wrap.remove(), 350); if (!silent && cfg.onClose) cfg.onClose(); },
    };
    if (cfg.readOnly) show(0); else timer = setTimeout(play, 500);
    return api;
  }

  /* ------------------------------------------- the cutting request (02) */

  function requestConfig(extra) {
    const zp = SPILE.data.getPlans(zoneId()) || {};
    return Object.assign({
      eyebrow: `${JOB.id} · ${JOB.region} · ${JOB.asset}`, title: 'Cutting request',
      pre: [
        ['Risk', 'Red, very high'],
        ['Driven by', 'Fall-in reach · Slope, trees uphill · Fire danger'],
        ['Deadline', `${JOB.deadline}, red = 30 days`],
        ['Corridor', `${JOB.metres} m, ${JOB.ha} of ${k(zp.area_ha)} ha`],
        ['In fall-in reach', `${JOB.fell} trees`],
        ['Last cut', 'Mar 2023'],
      ],
      steps: [
        { name: 'Scope', fields: [
          { n: '1.1', label: 'Units included', value: `Area ${zoneId()}, spans 41–44`, pre: true },
          { n: '1.2', label: 'Request type', value: 'Risk-driven from map', tag: 'Required' },
          { n: '1.3', label: 'Linked event', value: 'None', tag: 'If emergency' },
          { n: '1.4', label: 'Short description', value: 'Trees within fall-in reach of the line above the settlement', tag: 'Required' } ] },
        { name: 'Field check', fields: [
          { n: '2.1', label: 'Site visited?', value: 'Yes, 12 Nov', tag: 'Required' },
          { n: '2.2', label: 'Is the map colour right?', value: 'Agree', tag: 'Required' },
          { n: '2.3', label: 'Photos', value: '4 uploaded', tag: 'If visited' },
          { n: '2.4', label: 'Trees to fell', value: String(JOB.fell), pre: true },
          { n: '2.5', label: 'Trees to prune', value: String(JOB.prune), pre: true },
          { n: '2.6', label: 'Typical tree size', value: '10–20 m high, trunk 20–40 cm', tag: 'Required' },
          { n: '2.7', label: 'Main species', value: 'Chestnut, beech' },
          { n: '2.8', label: 'Hazard trees outside the corridor', value: '9, pinned on the map' } ] },
        { name: 'Work needed', fields: [
          { n: '3.1', label: 'Actions', value: 'Fell, prune, clear undergrowth', tag: 'Required' },
          { n: '3.2', label: 'Clearance to reach after the work', value: '5 m, company rule', tag: 'Required' },
          { n: '3.3', label: 'Area or length per action', value: `${JOB.ha} ha, ${JOB.metres} m`, pre: true },
          { n: '3.4', label: 'What happens to the wood', value: 'Chip on site', tag: 'Required' },
          { n: '3.5', label: 'Follow-up', value: 'Monitor' } ] },
        { name: 'Timing', fields: [
          { n: '4.1', label: 'Priority', value: 'Urgent', pre: true },
          { n: '4.2', label: 'Must be done by', value: JOB.deadline, pre: true },
          { n: '4.3', label: 'Earliest start', value: JOB.start, tag: 'Required' },
          { n: '4.5', label: 'Dates to avoid, and why', value: 'Mar–Jun, nesting', pre: true },
          { n: '4.6', label: 'Estimated duration', value: '9 working days', tag: 'Required' } ] },
        { name: 'Safety and asset', fields: [
          { n: '5.1', label: 'Must the asset be taken out of service?', value: 'Line outage', tag: 'Required' },
          { n: '5.2', label: 'Agreed outage windows', value: JOB.outage, tag: 'With dispatch' },
          { n: '5.3', label: 'Work near live parts?', value: 'Yes, minimum approach 3 m', tag: 'Grid' },
          { n: '5.4', label: 'Qualified staff needed', value: 'Electrical-risk (CEI 11-27), tree climbers', tag: 'Required' },
          { n: '5.6', label: 'Public exposure', value: 'Houses within one tree height', tag: 'Required' },
          { n: '5.7', label: "Operator's site supervisor", value: 'Site lead, VCO north', tag: 'Required' } ] },
        { name: 'Access and logistics', fields: [
          { n: '6.1', label: 'Access', value: 'Forest track', tag: 'Required' },
          { n: '6.2', label: 'Distance from the last vehicle point', value: '350 m', tag: 'Required' },
          { n: '6.3', label: 'Largest vehicle that can reach the site', value: '4×4', tag: 'Required' },
          { n: '6.4', label: 'Slope at the work site', value: 'Under 35%', pre: true },
          { n: '6.6', label: 'Equipment likely needed', value: 'Chainsaws, climbing kit, forestry mulcher', tag: 'Required' },
          { n: '6.7', label: 'Crew estimate', value: '6 people × 9 days', tag: 'Required' } ] },
        { name: 'Land, permits, environment', fields: [
          { n: '7.1', label: 'Ownership per parcel', value: 'Easement 70%, third party 30%', pre: true },
          { n: '7.2', label: 'Owner contact per third-party parcel', value: 'Notified 10 Nov', tag: 'If third party' },
          { n: '7.3', label: 'Permits needed', value: 'Hydrogeological restriction', pre: true },
          { n: '7.4', label: 'Status of each permit', value: 'Submitted 8 Nov', tag: 'Required' },
          { n: '7.5', label: 'Ecological constraints seen', value: 'Watercourse within 10 m', tag: 'Required' },
          { n: '7.6', label: 'Fire-season rules in force?', value: 'No', tag: 'In fire season' } ] },
        { name: 'Contacts and hand-over', fields: [
          { n: '8.1', label: 'Local contacts', value: 'Comune, technical office' },
          { n: '8.2', label: 'Budget line', value: 'VEG-OPEX-VCO-2026', tag: 'Required' },
          { n: '8.3', label: 'Notes for procurement', value: 'Bundle with CR-0139 if the trip allows' },
          { n: '8.4', label: 'Confirmation', value: 'The site details are accurate to my knowledge', tag: 'Required' } ] },
      ],
      status: 0, cta: 'Submit request', checks: 'Required fields complete · dates fit permits and outage',
    }, extra);
  }

  /* --------------------------------------------- the assignment (03) */

  function assignConfig(extra) {
    return Object.assign({
      eyebrow: `${JOB.id} · ${JOB.region} · ${JOB.asset}`, title: 'Procure resources', preTitle: 'From the request',
      pre: [
        ['Scope', `${JOB.fell} fell, ${JOB.prune} prune, ${JOB.ha} ha`],
        ['Window', `${JOB.start} → ${JOB.deadline}`],
        ['Outage', JOB.outage],
        ['Estimate', `€ ${JOB.estimate}`],
        ['Flags', 'Outage needed · permit pending'],
      ],
      steps: [
        { name: 'Choose the contractor', fields: [
          { n: 'P1.1', label: 'Suggested contractors', value: [
            `1  ${JOB.contractor} · covers VCO · CEI 11-27 · free in window · score 4.6`,
            '2  Forestry firm C · covers VCO · CEI 11-27 · free from 1 Dec · score 4.2',
            '3  Forestry firm B · covers Novara · tree climbers only · score 4.4'], pre: true },
          { n: 'P1.2', label: 'Contractor chosen', value: JOB.contractor, tag: 'Required' },
          { n: 'P1.3', label: 'Reason if not the top suggestion', value: 'Not needed', tag: 'If not first' } ] },
        { name: 'Contract route and price', fields: [
          { n: 'P2.1', label: 'Contract route', value: 'Call-off from an existing framework agreement', tag: 'Required' },
          { n: 'P2.2', label: 'Framework agreement', value: 'FA-2025-017, unit rates pulled in', tag: 'If call-off' },
          { n: 'P2.4', label: 'Price basis', value: `Unit rates: ${RATE.fell} €/tree felled, ${RATE.prune} €/tree pruned, ${RATE.ha} €/ha`, tag: 'Required' },
          { n: 'P2.5', label: 'Order value', value: `€ ${JOB.order}, estimate € ${JOB.estimate}`, tag: 'Required' },
          { n: 'P2.6', label: 'Approval needed?', value: "No, under the buyer's limit", pre: true } ] },
        { name: 'Schedule', fields: [
          { n: 'P3.1', label: 'Planned start and end', value: `${JOB.start} → ${JOB.end}, inside the window and the outage`, tag: 'Required' },
          { n: 'P3.2', label: 'Site meeting before start', value: '21 Nov, operator and contractor' },
          { n: 'P3.3', label: 'Bundle with nearby requests', value: 'CR-0139, same contractor and trip' } ] },
        { name: 'Documents', fields: [
          { n: 'P4.1', label: 'Work order', value: 'Generated from the request: scope, map, windows, access, contacts', pre: true },
          { n: 'P4.2', label: 'Safety documents', value: 'Safety plan, qualifications, insurance', tag: 'Required' },
          { n: 'P4.3', label: 'Permits and owner consents', value: 'Attached from Step 7 of the request', pre: true },
          { n: 'P4.4', label: 'Purchase order number', value: JOB.po, tag: 'Required' } ] },
      ],
      status: 3, cta: 'Send work order', checks: 'Dates inside the operator window · order within the estimate',
    }, extra);
  }

  /* --------------------------------------------------------- 8. operator */

  let opRoot, opStep = 0, opPop = null, opAsk = null;
  const setPulse = on => { document.body.dataset.pin = on ? 'pulse' : ''; };

  function opShowAsk() {
    if (opStep !== 0) return;
    opStep = 1;
    opAsk = h('button.btn.btn-primary.ask', { type: 'button', onclick: opOpen }, h('span', { text: 'Request cutting job?' }));
    opRoot.append(opAsk);
  }
  function opOpen() {
    if (opStep > 1) return;
    opStep = 2;
    if (opAsk) { opAsk.remove(); opAsk = null; }
    opPop = wizard(opRoot, requestConfig({
      onSave: () => { opStep = 3; opPop = null; setPulse(false); bus.emit(E.REQUEST_SAVED, { zoneId: zoneId() }); },
      onClose: () => { opPop = null; opStep = 0; },
    }));
  }

  SPILE.ui.screen('operator', {
    init(el) {
      opRoot = el;
      bus.on(E.PIN_CLICKED, () => { if (SPILE.state.screen === 'operator') opShowAsk(); });
      bus.on(E.PRESENTER_NEXT, p => {
        if (!p || p.screen !== 'operator') return;
        if (opStep === 0) opShowAsk(); else if (opStep === 1) opOpen(); else if (opStep === 2 && opPop) opPop.save();
      });
    },
    show(el) {
      el.replaceChildren(chip('Regional Operator'));
      opPop = null; opAsk = null;
      opStep = SPILE.state.job && SPILE.state.job.step >= 2 ? 3 : 0;
      setPulse(opStep === 0);
    },
    hide() { setPulse(false); if (opPop) opPop.close(true); },
  });

  /* ------------------------------------------------------ 9. procurement */

  const FLAG = {
    outage: ['Outage needed', '<path d="M13 2 5 13.5h6L10 22l9-12.5h-6z"/>'],
    permit: ['Permits pending', '<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>'],
    owner: ['Owner not reached', '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6"/>'],
  };
  const flag = id => h('i.flag', { title: FLAG[id][0], html: `<svg viewBox="0 0 24 24" aria-hidden="true">${FLAG[id][1]}</svg>` });

  /** Spec 03 sample rows, plus this job. */
  const rows = assigned => [
    { id: JOB.id, mine: true, where: `${JOB.region} · ${JOB.asset}, area ${zoneId()}`, risk: 'alto', scope: `${JOB.fell} fell, ${JOB.prune} prune, ${JOB.ha} ha`,
      flags: ['outage', 'permit'], window: `${JOB.start} → ${JOB.deadline}`, status: assigned ? 'Assigned' : 'In procurement',
      contractor: assigned ? JOB.contractor : null, planned: assigned ? `${JOB.start} → ${JOB.end}` : '–', est: JOB.estimate,
      order: assigned ? JOB.order : '–', po: assigned ? JOB.po : '–', invoice: '–', evidence: '–', verified: '–' },
    { id: 'CR-0139', where: 'VCO · 132 kV line, spans 7–9', risk: 'alto', scope: '9 fell, 0.4 ha', flags: ['outage'], window: '25 Nov → 10 Dec',
      status: 'Assigned', contractor: 'Forestry firm A', planned: '27 Nov → 2 Dec', est: '4,100', order: '3,950', po: 'PO-4500117', invoice: '–', evidence: '–', verified: '–' },
    { id: 'CR-0131', where: 'Novara · 220 kV line, spans 18–22', risk: 'medio', scope: '25 prune, 2.1 ha', flags: [], window: '1 Nov → 30 Jan',
      status: 'Verified', contractor: 'Forestry firm B', planned: '4 Nov → 8 Nov', est: '9,800', order: '9,650', po: 'PO-4500098', invoice: 'Matched', evidence: '12 photos', verified: '12 Nov' },
  ];

  const COLS = [
    ['What', ['Request', 'Region · asset', 'Risk', 'Scope', 'Flags']],
    ['When', ['Window', 'Status']],
    ['Who', ['Contractor', 'Planned dates']],
    ['Money', ['Estimate €', 'Order €', 'Order no.', 'Invoice']],
    ['Done', ['Evidence', 'Verified']],
  ];

  let prRoot, prStep = 0, prPop = null, prSheet = null;

  function drawDashboard(assigned, flash) {
    const data = rows(assigned);
    const count = s => data.filter(r => r.status === s).length;
    const sheet = h('div.dash.glass', null,
      h('header.dash-head', null,
        h('div', null, h('p.eyebrow', { text: 'Procurement' }), h('h2', { text: 'Cutting requests' })),
        h('ul.dash-stats', null, [['In procurement', count('In procurement')], ['Assigned', count('Assigned')], ['Verified', count('Verified')], ['Invoices disputed', 0]]
          .map(([t, n]) => h('li', null, h('b', { text: String(n) }), t))),
        assigned && h('button.btn.btn-primary', { type: 'button', onclick: () => bus.emit(E.FINAL_OPEN, {}) }, h('span', { text: 'All three roles' }))),
      h('div.dash-scroll', null, h('table.dash-table', null,
        h('thead', null,
          h('tr.dash-groups', null, COLS.map(([g, cs]) => h('th', { colspan: String(cs.length), text: g }))),
          h('tr', null, COLS.flatMap(([, cs]) => cs).map(t => h('th', { text: t })))),
        h('tbody', null, data.map(r => h('tr', { class: (r.mine ? 'is-mine' : '') + (r.mine && assigned && flash ? ' is-assigned' : '') },
          h('td', null, r.mine ? h('button.dash-link', { type: 'button', text: r.id, onclick: openRequest }) : h('b', { text: r.id })),
          h('td', { text: r.where }),
          h('td', null, h('i.dot', { style: `background:${SPILE.CLASS_COLOR[r.risk]}` })),
          h('td', { text: r.scope }),
          h('td', null, r.flags.map(flag)),
          h('td', { text: r.window }),
          h('td', null, h('span.status', { class: r.status === 'Assigned' && r.mine ? 'is-on' : '', text: r.status })),
          h('td', null, r.contractor ? r.contractor
            : h('button.btn.btn-primary.dash-procure', { type: 'button', onclick: prOpen }, h('span', { text: 'Procure resources' }))),
          h('td', { text: r.planned }),
          h('td.num', { text: r.est }), h('td.num', { text: r.order }), h('td', { text: r.po }), h('td', { text: r.invoice }),
          h('td', { text: r.evidence }), h('td', { text: r.verified })))))));
    if (prSheet) { sheet.classList.add('is-still'); prSheet.replaceWith(sheet); } else prRoot.append(sheet);
    prSheet = sheet;
  }

  /** Request ID on the row: the operator's request, read only (spec 03, "Request detail"). */
  function openRequest() {
    if (prPop) return;
    const view = wizard(prRoot, requestConfig({ readOnly: true, status: prStep === 3 ? 4 : 3, onClose: () => { prPop = null; } }));
    prPop = { save: () => view.close(), close: s => view.close(s), detail: true };
  }

  function prOpen() {
    if (prStep !== 0 || prPop) return;
    prStep = 2;
    prPop = wizard(prRoot, assignConfig({
      onSave: () => {
        prStep = 3; prPop = null; setPulse(false);
        bus.emit(E.JOB_ASSIGNED, { zoneId: zoneId() });
        setTimeout(() => { if (SPILE.state.screen === 'procurement') drawDashboard(true, true); }, 700);
      },
      onClose: () => { prPop = null; prStep = 0; },
    }));
  }

  SPILE.ui.screen('procurement', {
    init(el) {
      prRoot = el;
      bus.on(E.PIN_CLICKED, () => { if (SPILE.state.screen === 'procurement') prOpen(); });
      bus.on(E.PRESENTER_NEXT, p => {
        if (!p || p.screen !== 'procurement') return;
        if (prPop && prPop.detail) { prPop.close(); return; }
        if (prStep === 0) prOpen(); else if (prStep === 2 && prPop) prPop.save(); else if (prStep === 3) bus.emit(E.FINAL_OPEN, {});
      });
    },
    show(el) {
      el.replaceChildren(chip('Procurement'));
      prPop = null; prSheet = null;
      prStep = SPILE.state.job && SPILE.state.job.step >= 3 ? 3 : 0;
      setPulse(prStep === 0);
      drawDashboard(prStep === 3, false);
    },
    hide() { setPulse(false); if (prPop) prPop.close(true); },
  });

  /* ---------------------------------------------------------- 10. final */

  /** What each role is told when a job is assigned (spec 03, "Who sees what, and when"). */
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
