/**
 * Fallback plan set, used ONLY when data/plans.json cannot be loaded (not pushed
 * yet, or the page is opened from file://). Owned by Agent A.
 *
 * It mirrors the formulas in PROJECT.md, "Economic model", so the map behaves the
 * same either way. The source of truth is opt/make_plans.py (Agent B): when
 * data/plans.json exists, nothing in this file is used.
 */
(() => {
  'use strict';

  const AF = SPILE.ANNUALIZATION;
  // Same rounding as opt/make_plans.py: whole k€ from 10 ha up, 1 € below, so the
  // 50 ha anchor table is exact and the smallest zones keep a non-zero threshold.
  const rounder = areaHa => { const f = areaHa >= 10 ? 1 : 1000; return x => Math.floor(Math.round(x * f * 1e6) / 1e6 + 0.5) / f; };

  // id: [label, CAPEX k€/ha, OPEX k€/ha/yr, residual share of EAL]
  const SPEC = {
    no_action: ['No action', 0, 0, 1.00],
    minimum: ['Minimum plan (ROW + access)', 0.80, 0.12, 0.58],
    optimized: ['Optimized plan (MILP)', 2.38, 0.20, 0.27],
    maximum: ['Maximum plan (undergrounding)', 6.20, 0.32, 0.13],
  };

  const ACTIONS = {
    no_action: [],
    minimum: ['ROW vegetation management', 'Access tracks'],
    optimized: ['ROW vegetation management', 'Access tracks', 'Insulated conductor on the critical spans',
      'Check dams and drainage works', 'Water points', 'Monitoring'],
    maximum: ['ROW vegetation management', 'Access tracks', 'Insulated conductor on the critical spans',
      'Check dams and drainage works', 'Water points', 'Monitoring', 'Full line undergrounding'],
  };

  /** ZonePlans for one zone, from its area and score. */
  function build(zoneId, areaHa, score) {
    const r1 = rounder(areaHa);
    const eal = 0.9 * areaHa * (score / 0.7);
    const threshold = 0.30 * areaHa;

    const plans = SPILE.PLAN_IDS.map(id => {
      const [label, capexHa, opexHa, share] = SPEC[id];
      const capex = capexHa * areaHa, opex = opexHa * areaHa, residual = share * eal;
      return {
        id, label,
        capex_k: r1(capex), opex_k_yr: r1(opex), residual_k_yr: r1(residual),
        annualized_k_yr: r1(capex * AF + opex + residual),
        acceptable: residual <= threshold + 1e-9, optimum: false, _ann: capex * AF + opex + residual,
        actions: ACTIONS[id],
      };
    });

    const ok = plans.filter(p => p.acceptable).sort((a, b) => a._ann - b._ann);
    if (ok.length) ok[0].optimum = true;
    plans.forEach(p => { delete p._ann; });

    return {
      zone_id: zoneId, area_ha: areaHa,
      eal_k_yr: r1(eal), threshold_k_yr: r1(threshold),
      event_cost_k: r1(9 * areaHa),
      plans,
    };
  }

  /**
   * @param {Zone[]} zones
   * @param {number} demoZoneId  gets the 50 ha reference scenario of PROJECT.md
   */
  SPILE.plansFixture = (zones, demoZoneId) => {
    const out = {};
    zones.forEach(z => {
      out[z.id] = z.id === demoZoneId ? build(z.id, 50, 0.7) : build(z.id, z.area_ha, z.score);
    });
    return { generated_at: null, params: { fixture: true, demo_zone_id: demoZoneId }, zones: out };
  };
})();
