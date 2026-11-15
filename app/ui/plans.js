/**
 * Screen 7: management plans. Agent B.
 *
 * One row per plan. Each bar is two adjacent segments meeting on a shared axis:
 * annualized cost of the works to the left, residual risk to the right. One
 * vertical line crosses the risk side of every bar: the acceptance threshold.
 * That line is the point of the screen. One control: the map toggle on a row.
 * No budget slider.
 */
(() => {
  'use strict';
  const { h, k } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus;
  const SHIMMER_MS = 1200;

  let root, zoneId = null, selected = null, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function status(p) {
    if (!p.acceptable) return ['not acceptable', 'is-out'];
    if (p.optimum) return ['optimum', 'is-optimum'];
    return ['acceptable, dearer', 'is-ok'];
  }

  function toggle(planId) {
    if (selected === planId) { selected = null; bus.emit(E.PLAN_CLEARED, {}); }
    else { selected = planId; bus.emit(E.PLAN_SELECTED, { zoneId, planId }); }
    root.querySelectorAll('.plan-row').forEach(r => {
      const on = r.dataset.plan === selected;
      r.classList.toggle('is-on', on);
      r.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function render() {
    clearTimers();
    selected = null;
    const zone = SPILE.state.zone;
    if (!zone) return;
    zoneId = zone.id;
    const zp = SPILE.data.getPlans(zoneId);
    if (!zp) return;

    // Cost of the works per year = annualized total minus the residual risk.
    const rows = zp.plans.map(p => ({ p, cost: Math.max(0, p.annualized_k_yr - p.residual_k_yr), risk: p.residual_k_yr }));
    const maxCost = Math.max(...rows.map(r => r.cost)) || 1;
    const maxRisk = Math.max(...rows.map(r => r.risk), zp.threshold_k_yr) || 1;
    const unit = 94 / (maxCost + maxRisk);          // % of track per k€, same on both sides
    const axis = 3 + maxCost * unit;                // % from the left edge of the track
    const thr = axis + zp.threshold_k_yr * unit;

    const panel = h('div.plans-panel.glass', { style: `--axis:${axis}%;--thr:${thr}%` },
      h('header.plans-head', null,
        h('button.icon-btn', { type: 'button', 'aria-label': 'Back to the area',
          html: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', onclick: () => bus.emit(E.SCREEN_BACK, {}) }),
        h('div', null,
          h('p.eyebrow', { text: `Area ${zoneId} · ${k(zp.area_ha)} ha` }),
          h('h1', { text: 'Management plans' })),
        h('p.objective', null, h('b', { text: 'Objective ' }),
          'minimize annualized cost subject to residual risk below the acceptance threshold.')),

      h('div.plans-body', null,
        h('div.plans-axis', null,
          h('span.axis-cost', { text: 'Annualized cost' }),
          h('span.axis-risk', { text: 'Residual risk' })),
        h('div.plans-rows', null,
          rows.map(({ p, cost, risk }, i) => {
            const [tag, cls] = status(p);
            return h('button.plan-row.' + cls, {
              type: 'button', 'data-plan': p.id, 'aria-pressed': 'false', style: `--i:${i}`,
              onclick: () => toggle(p.id),
              onmouseenter: () => bus.emit(E.PLAN_HOVER, { zoneId, planId: p.id }),
              onmouseleave: () => bus.emit(E.PLAN_HOVER, { zoneId, planId: null }),
            },
              h('span.plan-label', null,
                h('b', { text: p.label }),
                h('small', { text: p.capex_k ? `CAPEX ${k(p.capex_k)} k€` : 'CAPEX 0' })),
              h('span.plan-track', null,
                h('i.seg.seg-cost', { style: `width:${cost * unit}%` }, cost > 0 && h('em', { text: k(cost) })),
                h('i.seg.seg-risk', { style: `width:${risk * unit}%` }, h('em', { text: k(risk) }))),
              h('span.plan-total', null,
                h('b', null, k(p.annualized_k_yr), h('small', { text: ' k€/yr' })),
                h('span.plan-tag', { text: tag })),
              h('span.plan-map', { title: 'Show this plan on the map' }, h('i'), h('small', { text: 'Map' })));
          }),
          // The acceptance threshold: one line across the risk side of every bar.
          h('div.threshold', { 'aria-hidden': 'true' },
            h('div.threshold-line', null,
              h('span.threshold-label', null, 'Acceptance threshold ', h('b', { text: `${k(zp.threshold_k_yr)} k€/yr` }))))),
        h('div.shimmer', null, h('span', { text: 'Optimizing' }), h('i'), h('i'), h('i'), h('i'))));

    root.replaceChildren(panel);
    later(() => panel.classList.add('is-solved'), SHIMMER_MS);          // bars grow
    later(() => panel.classList.add('is-threshold'), SHIMMER_MS + 900); // the line lands
    later(() => panel.classList.add('is-judged'), SHIMMER_MS + 1700);   // rows that cross it grey out
  }

  SPILE.ui.screen('plans', {
    init(el) { root = h('div.plans'); el.append(root); },
    show() { render(); },
    hide() {
      clearTimers();
      if (selected) { selected = null; bus.emit(E.PLAN_CLEARED, {}); }
    },
  });
})();
