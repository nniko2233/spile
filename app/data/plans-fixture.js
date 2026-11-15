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
  const r1 = x => Math.round(x * 10) / 10;

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
    const eal = 0.9 * areaHa * (score / 0.7);
    const threshold = 0.30 * areaHa;

    const plans = SPILE.PLAN_IDS.map(id => {
      const [label, capexHa, opexHa, share] = SPEC[id];
      const capex = capexHa * areaHa, opex = opexHa * areaHa, residual = share * eal;
      return {
        id, label,
        capex_k: r1(capex), opex_k_yr: r1(opex), residual_k_yr: r1(residual),
        annualized_k_yr: r1(capex * AF + opex + residual),
        acceptable: residual <= threshold, optimum: false,
        actions: ACTIONS[id],
      };
    });

    const ok = plans.filter(p => p.acceptable).sort((a, b) => a.annualized_k_yr - b.annualized_k_yr);
    if (ok.length) ok[0].optimum = true;

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
