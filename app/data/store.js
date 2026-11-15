/**
 * SPILE data layer. Owned by Agent A, read by everyone through SPILE.data.
 *
 * Zones, assets, boundary and stats come from data/bundle.js (window.SPILE_DATA),
 * so they are available synchronously as soon as this file has run.
 * Plans come from data/plans.json; until that file answers, and whenever it cannot
 * be loaded, a fixture built from the same formulas stands in. `SPILE.data.ready`
 * resolves once the plan set is final.
 *
 *   getZones()                 Zone[]            every zone, properties only
 *   getZone(id)                Zone | null
 *   getZoneFeature(id)         GeoJSON Feature | null   (with geometry)
 *   getStats()                 stats.json content
 *   getDemoZoneId()            number            the zone carrying the 50 ha scenario
 *   getDemoZone()              Zone
 *   getPlans(zoneId)           ZonePlans | null
 *   getPlan(zoneId, planId)    Plan | null
 *   getOptimumPlan(zoneId)     Plan | null       the one flagged optimum
 *   residualRatio(zoneId, planId)   residual_k_yr / threshold_k_yr
 *   residualColor(zoneId, planId)   color of that ratio in SPILE.RESIDUAL_BANDS
 *   bandColor(ratio)           same lookup from a bare ratio
 *   plansSource()              'file' | 'fixture'
 *   ready                      Promise<void>
 */
(() => {
  'use strict';

  const raw = window.SPILE_DATA || {};
  const zonesFC = raw.zones || { type: 'FeatureCollection', features: [] };

  const featureById = new Map();
  const zones = zonesFC.features.map(f => {
    featureById.set(f.properties.id, f);
    return f.properties;
  });
  const zoneById = new Map(zones.map(z => [z.id, z]));

  /**
   * The zone that plays the 50 ha reference scenario. 406 is the best match in the
   * real data: forest on a 31 degree slope, fire and power both present, crossed by
   * an overhead line. plans.json may name another one, see adoptPlans().
   */
  const DEFAULT_DEMO_ZONE = 406;
  let demoZoneId = zoneById.has(DEFAULT_DEMO_ZONE)
    ? DEFAULT_DEMO_ZONE
    : (zones.slice().sort((a, b) => a.rank - b.rank)[0] || {}).id;

  let plans = SPILE.plansFixture(zones, demoZoneId);
  let source = 'fixture';

  /** Accept a plans.json payload, tolerating the shapes B may reasonably produce. */
  function adoptPlans(json) {
    if (!json || typeof json.zones !== 'object') throw new Error('plans.json: no zones');
    const byId = {};
    Object.keys(json.zones).forEach(k => {
      const zp = json.zones[k];
      const id = Number(zp && zp.zone_id != null ? zp.zone_id : k);
      if (zp && Array.isArray(zp.plans) && zoneById.has(id)) byId[id] = zp;
    });
    if (!Object.keys(byId).length) throw new Error('plans.json: no entry matches a zone id');

    // Which zone carries the reference scenario: named explicitly, or recognised
    // by its anchor numbers (50 ha, 45 k€/yr).
    const p = json.params || {};
    const named = [json.demo_zone_id, p.demo_zone_id, p.demo_zone, json.demo_zone]
      .map(Number).find(n => zoneById.has(n));
    const anchored = Object.values(byId).find(zp => zp.demo === true ||
      (Math.abs(zp.area_ha - 50) < 0.01 && Math.abs(zp.eal_k_yr - 45) < 0.5));
    if (named != null) demoZoneId = named;
    else if (anchored) demoZoneId = Number(anchored.zone_id);

    plans = { generated_at: json.generated_at || null, params: p, zones: byId };
    source = 'file';
  }

  const ready = (location.protocol === 'file:'
    ? Promise.reject(new Error('file://'))
    : fetch('data/plans.json', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('plans.json ' + r.status);
        return r.json();
      }).then(adoptPlans))
    .catch(err => { console.info('[data] using the plan fixture:', err.message); })
    .then(() => { SPILE.bus.emit('data:plans', { source }); });

  function bandColor(ratio) {
    const band = SPILE.RESIDUAL_BANDS.find(b => ratio <= b.max);
    return (band || SPILE.RESIDUAL_BANDS[SPILE.RESIDUAL_BANDS.length - 1]).color;
  }

  function getPlans(zoneId) { return plans.zones[zoneId] || null; }

  function getPlan(zoneId, planId) {
    const zp = getPlans(zoneId);
    return (zp && zp.plans.find(p => p.id === planId)) || null;
  }

  function residualRatio(zoneId, planId) {
    const zp = getPlans(zoneId), plan = getPlan(zoneId, planId);
    if (!zp || !plan || !(zp.threshold_k_yr > 0)) return null;
    return plan.residual_k_yr / zp.threshold_k_yr;
  }

  /**
   * Plans for a selection of several zones, in the ZonePlans shape, money summed.
   *
   * No action, minimum and maximum apply one plan to every zone. The optimized
   * plan gives each zone its own plan: the cheapest total annualized cost that
   * keeps the total residual risk under the total acceptance threshold. It is a
   * choice among the four precomputed plans per zone, found by relaxing the risk
   * constraint with a multiplier and bisecting on it; plain JS, no solver. If a
   * single plan applied everywhere beats it, that plan is taken instead, so the
   * optimized row is never dearer than an acceptable row.
   */
  function getSelectionPlans(ids) {
    const list = (ids || []).map(getPlans).filter(Boolean);
    if (!list.length) return null;
    if (list.length === 1) return list[0];

    const r3 = x => Math.round(x * 1000) / 1000;
    const total = f => list.reduce((s, zp) => s + f(zp), 0);
    const threshold = total(zp => zp.threshold_k_yr);
    const plan = (zp, id) => zp.plans.find(p => p.id === id);
    const sumOf = choice => {
      const t = { capex_k: 0, opex_k_yr: 0, residual_k_yr: 0, annualized_k_yr: 0 };
      list.forEach((zp, i) => { const p = plan(zp, choice[i]); Object.keys(t).forEach(key => { t[key] += p[key]; }); });
      return t;
    };

    const uniform = SPILE.PLAN_IDS.map(id => ({ id, choice: list.map(() => id), t: sumOf(list.map(() => id)) }));

    // Per-zone choice: minimise annualized + lambda * residual, smallest feasible lambda.
    const pick = lambda => list.map(zp => zp.plans.reduce((best, p) =>
      (p.annualized_k_yr + lambda * p.residual_k_yr < best.annualized_k_yr + lambda * best.residual_k_yr - 1e-12 ? p : best)).id);
    const feasible = choice => sumOf(choice).residual_k_yr <= threshold + 1e-9;
    let mix = pick(0);
    if (!feasible(mix)) {
      let lo = 0, hi = 1;
      while (!feasible(pick(hi)) && hi < 1e6) hi *= 2;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (feasible(pick(mid))) hi = mid; else lo = mid; }
      mix = pick(hi);
    }
    let best = { choice: mix, t: sumOf(mix) };
    uniform.forEach(u => { if (u.t.residual_k_yr <= threshold + 1e-9 && u.t.annualized_k_yr < best.t.annualized_k_yr - 1e-9) best = u; });

    const ref = list[0].plans;
    const plans = SPILE.PLAN_IDS.map((id, n) => {
      const isMix = id === 'optimized', src = isMix ? best : uniform[n];
      const out = {
        id, label: ref[n].label,
        capex_k: r3(src.t.capex_k), opex_k_yr: r3(src.t.opex_k_yr),
        residual_k_yr: r3(src.t.residual_k_yr), annualized_k_yr: r3(src.t.annualized_k_yr),
        acceptable: src.t.residual_k_yr <= threshold + 1e-9, optimum: isMix,
        actions: ref[n].actions,
      };
      if (isMix) {
        out.planByZone = {}; out.mix = {};
        list.forEach((zp, i) => { out.planByZone[zp.zone_id] = best.choice[i]; out.mix[best.choice[i]] = (out.mix[best.choice[i]] || 0) + 1; });
        // The actions of the widest plan any zone gets.
        const widest = SPILE.PLAN_IDS.slice().reverse().find(pid => out.mix[pid]);
        out.actions = ref[SPILE.PLAN_IDS.indexOf(widest)].actions;
      }
      return out;
    });

    return {
      zone_id: list[0].zone_id, zone_ids: list.map(zp => zp.zone_id), count: list.length,
      area_ha: r3(total(zp => zp.area_ha)), eal_k_yr: r3(total(zp => zp.eal_k_yr)),
      threshold_k_yr: r3(threshold), event_cost_k: r3(total(zp => zp.event_cost_k)),
      plans,
    };
  }

  SPILE.data = {
    ready,
    getZones: () => zones,
    getZone: id => zoneById.get(Number(id)) || null,
    getZoneFeature: id => featureById.get(Number(id)) || null,
    getZonesGeoJSON: () => zonesFC,
    getBoundary: () => raw.boundary || null,
    getAssets: () => raw.assets || null,
    getStats: () => raw.stats || null,
    getDemoZoneId: () => demoZoneId,
    getDemoZone: () => zoneById.get(demoZoneId) || null,
    getPlans, getSelectionPlans,
    getPlan,
    getOptimumPlan: zoneId => { const zp = getPlans(zoneId); return (zp && zp.plans.find(p => p.optimum)) || null; },
    residualRatio,
    residualColor: (zoneId, planId) => { const r = residualRatio(zoneId, planId); return r == null ? null : bandColor(r); },
    bandColor,
    plansSource: () => source,
  };
})();
