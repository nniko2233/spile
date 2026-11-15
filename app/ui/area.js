/**
 * Screen 6: the area panel. Agent B.
 * Four blocks and nothing more, plus one action button:
 *   1 Area information  2 Risk  3 Mitigation plan  4 Scenario analysis
 */
(() => {
  'use strict';
  const { h, k } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus;

  const ICON = {
    fire: '<path d="M12 3c1 3-2 4.5-2 7.5a2 2 0 0 0 4 0c2 1.5 3 3.4 3 5.5a5 5 0 0 1-10 0c0-4.500 4-6 5-13z"/>',
    slope: '<path d="M3 20h18L14 6l-4 7-2-3z"/><path d="M15 15l3 1M13 18l2 .6"/>',
    flood: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    power: '<path d="M13 2 5 13.500h6L10 22l9-12.500h-6z"/>',
    transit: '<path d="M4 20 9 4M20 20 15 4M7 10h10M5.500 16h13"/>',
  };
  const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg>`;

  const RISK_LABEL = {
    fire: ['fire', 'Wildfire ignition from line fault'],
    slope: ['slope', 'Post-fire slope instability'],
    hydro: ['flood', 'Flash flood and debris flow'],
    power: ['power', 'Power service interruption'],
    rail: ['transit', 'Railway service interruption'],
    road: ['transit', 'Road closure'],
  };

  const ASSET_EN = [[/Linea AT/i, 'HV line'], [/Linea MT/i, 'MV line'], [/Ferrovia/i, 'Railway'], [/Strada/i, 'Road']];
  const assetName = t => ASSET_EN.reduce((s, [re, en]) => s.replace(re, en), t || '');

  function level(score) {
    if (score >= 0.7) return 'Very high';
    if (score >= 0.45) return 'High';
    if (score >= 0.2) return 'Moderate';
    return 'Low';
  }

  /** Everything the panel prints, for one zone. */
  function model(zone) {
    const D = SPILE.data;
    const zp = D.getPlans(zone.id) || {};
    const opt = D.getOptimumPlan(zone.id);
    const demo = zone.id === D.getDemoZoneId();
    const fall = zone.cells_fall != null ? zone.cells_fall : (zone.cells_in || 0) + (zone.cells_out || 0);

    if (demo) {
      // Reference scenario of PROJECT.md, screen 6.
      return {
        zp, opt, fall, title: 'Area ' + zone.id, level: 'Very high', cls: 'alto',
        info: [
          ['Area', `${k(zp.area_ha)} ha`],
          ['Forest type', 'Broadleaf, chestnut and beech'],
          ['Mean slope', '28%'],
          ['Line crossing', '2 km of bare overhead 15 kV MV line'],
          ['Watercourse', 'Torrent discharging onto the provincial road and the settlement below'],
        ],
        risks: ['fire', 'slope', 'hydro', 'power'],
      };
    }
    const am = zone.asset_main;
    const types = (zone.types || []).slice();
    if (types.includes('fire') && zone.slope >= 20) types.splice(types.indexOf('fire') + 1, 0, 'slope');
    return {
      zp, opt, fall, title: 'Area ' + zone.id, level: level(zone.score), cls: zone.cls,
      info: [
        ['Area', `${k(zp.area_ha != null ? zp.area_ha : zone.area_ha)} ha`],
        ['Forest type', `Tree cover, canopy ${Math.round(zone.h_mean)} m mean, ${Math.round(zone.h_max)} m max`],
        ['Mean slope', `${Math.round(Math.tan(zone.slope * Math.PI / 180) * 100)}%`],
        ['Line crossing', am ? `${assetName(am.type)}${zone.d_min != null ? `, ${Math.round(zone.d_min)} m from the canopy` : ''}` : 'None'],
        ['Watercourse', (zone.types || []).includes('hydro') ? 'Upstream of a mapped watercourse' : 'None mapped in the zone'],
      ],
      risks: types.filter(t => RISK_LABEL[t]),
    };
  }

  const block = (n, title, ...kids) =>
    h('section.block', null, h('header.block-head', null, h('span.block-n', { text: '0' + n }), h('h2', { text: title })), kids);

  const figure = (value, unit, label, cls) =>
    h('div.figure' + (cls ? '.' + cls : ''), null, h('span.figure-v', null, value, h('small', { text: ' ' + unit })), h('span.figure-l', { text: label }));

  let panel, body, zone = null, wheelAcc = 0, wheelT = 0, touchY = null;

  function openPlans() { if (zone) bus.emit(E.PLANS_OPEN, { zoneId: zone.id }); }

  function render(z) {
    zone = z;
    const m = model(z);
    const p = m.opt;
    const acts = p && p.actions && p.actions.length ? p.actions : null;

    body.replaceChildren(
      h('header.area-head', null,
        h('div', null, h('p.eyebrow', { text: 'Selected area' }), h('h1', { text: m.title })),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
          onclick: () => bus.emit(E.ZONE_CLEARED, {}) })),

      block(1, 'Area information',
        h('dl.facts', null, m.info.map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]))),

      block(2, 'Risk',
        h('div.risk-level', { 'data-cls': m.cls }, h('i.dot'), h('b', { text: m.level })),
        h('ul.risk-list', null, m.risks.map(t => h('li', { html: icon(RISK_LABEL[t][0]) + `<span>${RISK_LABEL[t][1]}</span>` }))),
        m.fall > 0 && h('div.driver', null,
          h('span.driver-k', { text: 'Fall-in reach' }),
          h('span.driver-v', null, h('b', { text: String(m.fall) }), ' trees taller than their distance to the line')),
        figure(k(m.zp.eal_k_yr), 'k€/yr', 'Expected annual loss')),

      block(3, 'Mitigation plan',
        h('p.plan-name', { text: p ? p.label : 'No plan clears the threshold' }),
        acts ? h('ol.actions', null, acts.map(a => h('li', { text: a })))
             : h('p.muted', { text: 'Risk already below the acceptance threshold. No works required.' }),
        p && h('div.figures', null,
          figure(k(p.capex_k), 'k€', 'CAPEX'),
          figure(k(p.opex_k_yr), 'k€/yr', 'OPEX'))),

      block(4, 'Scenario analysis',
        h('p.muted', { text: 'If nothing is done' }),
        h('div.figures', null,
          figure(k(m.zp.eal_k_yr), 'k€/yr', 'Emergency maintenance, expected annual loss', 'is-loss'),
          figure(k(m.zp.event_cost_k), 'k€', 'Single wildfire event', 'is-loss'))),

      h('button.btn.btn-primary.area-cta', { type: 'button', onclick: openPlans },
        h('span', { text: 'Create plan for selected areas' }),
        h('svg', null)));
    body.querySelector('.area-cta svg').outerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
    body.scrollTop = 0;
  }

  /** Swipe down past the end of the panel raises the plans view. */
  function onWheel(e) {
    const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
    const now = performance.now();
    if (!atEnd || e.deltaY <= 0) { wheelAcc = 0; return; }
    if (now - wheelT > 500) wheelAcc = 0;
    wheelT = now; wheelAcc += e.deltaY;
    if (wheelAcc > 320) { wheelAcc = 0; openPlans(); }
  }

  SPILE.ui.screen('area', {
    init(el) {
      body = h('div.area-scroll');
      panel = h('aside.area-panel.glass', { 'aria-label': 'Area' }, body);
      el.append(panel);
      body.addEventListener('wheel', onWheel, { passive: true });
      body.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
      body.addEventListener('touchend', e => {
        const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
        if (touchY != null && atEnd && e.changedTouches[0].clientY - touchY > 90) openPlans();
        touchY = null;
      }, { passive: true });
      // Clicking another red zone while the panel is open swaps its content.
      bus.on(E.ZONE_SELECTED, p => { if (p && p.zone) render(p.zone); });
      bus.on('data:plans', () => { if (zone && SPILE.state.screen === 'area') render(zone); });
    },
    show() {
      const z = SPILE.state.zone || zone;
      if (z && (!zone || zone.id !== z.id || !body.childElementCount)) render(z);
    },
  });
})();
