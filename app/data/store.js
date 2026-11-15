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
    getPlans,
    getPlan,
    getOptimumPlan: zoneId => { const zp = getPlans(zoneId); return (zp && zp.plans.find(p => p.optimum)) || null; },
    residualRatio,
    residualColor: (zoneId, planId) => { const r = residualRatio(zoneId, planId); return r == null ? null : bandColor(r); },
    bandColor,
    plansSource: () => source,
  };
})();
