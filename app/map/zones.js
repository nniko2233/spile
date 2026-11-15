/**
 * SPILE map — risk zones: drawing, selection, recolouring. Owned by Agent A.
 *
 * Each zone is drawn twice from data/zones.geojson: a faint fill and outline draped
 * on the terrain (the true polygon), and pillars extruded from it (cells.js).
 * Colour is by class (SPILE.CLASS_COLOR) until a plan is selected, then by that
 * plan's residual risk against the acceptance threshold (SPILE.RESIDUAL_BANDS).
 *
 *   SPILE.map.selectZone(id)        select a zone, emits ZONE_SELECTED {zone}
 *   SPILE.map.clearSelection()
 *   SPILE.map.revealZones(delayMs)  fade the zones in
 *   SPILE.map.showPlan(planId, originZoneId)   recolour, null = back to class colours
 *
 * Bus, in:  ZONE_CLEARED, PLAN_HOVER, PLAN_SELECTED, PLAN_CLEARED, SCREEN_SHOW
 * Bus, out: ZONE_SELECTED
 */
(() => {
  'use strict';
  const E = SPILE.EVENTS, S = SPILE.SCREENS, bus = SPILE.bus, D = SPILE.data;

  const CELL_M = 20;
  const OPACITY = { cells: 0.84, fill: 0.16, line: 0.72 };

  const hexToRgb = hex => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const CLASS_RGB = {};
  Object.keys(SPILE.CLASS_COLOR).forEach(k => { CLASS_RGB[k] = hexToRgb(SPILE.CLASS_COLOR[k]); });

  const zones = D.getZones();
  const current = new Map(zones.map(z => [z.id, (CLASS_RGB[z.cls] || CLASS_RGB.medio).slice()]));

  let map = null, cellsByZone = new Map();
  let selectedId = null, hoveredId = null;
  let committedPlan = null;       // plan id the map is coloured by, or null
  let previewZone = null;         // zone currently showing a PLAN_HOVER preview
  let revealed = false;

  /* -------------------------------------------------------------- layers */

  function build(m) {
    map = m;
    const before = SPILE.map.firstSymbolId;
    const cells = SPILE.buildCells(D.getZonesGeoJSON(), { size: CELL_M });
    cellsByZone = cells.byZone;

    map.addSource('zones', { type: 'geojson', data: D.getZonesGeoJSON(), promoteId: 'id' });
    map.addSource('zone-cells', { type: 'geojson', data: cells.fc, tolerance: 0, buffer: 8 });

    const classColor = ['match', ['get', 'cls'],
      'alto', SPILE.CLASS_COLOR.alto, 'medio', SPILE.CLASS_COLOR.medio, SPILE.CLASS_COLOR.basso];
    const color = ['to-color', ['coalesce', ['feature-state', 'col'], classColor]];
    const fade = { duration: 1600, delay: 0 };

    map.addLayer({
      id: 'zones-fill', type: 'fill', source: 'zones',
      paint: { 'fill-color': color, 'fill-opacity': 0, 'fill-opacity-transition': fade },
    }, before);

    map.addLayer({
      id: 'zones-line', type: 'line', source: 'zones',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': color, 'line-opacity': 0, 'line-opacity-transition': fade,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 1.6], 'line-blur': 0.4,
      },
    }, before);

    map.addLayer({
      id: 'zones-cells', type: 'fill-extrusion', source: 'zone-cells',
      paint: {
        'fill-extrusion-color': color,
        // k is 0..1, raised while a zone is hovered or selected.
        'fill-extrusion-height': ['*', ['get', 'h'], ['+', 1, ['*', 1.3, ['to-number', ['feature-state', 'k']]]]],
        'fill-extrusion-base': 0,
        'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-opacity': 0, 'fill-extrusion-opacity-transition': fade,
      },
    }, before);

    map.addLayer({
      id: 'zones-selected', type: 'line', source: 'zones',
      filter: ['==', ['get', 'id'], -1],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 2.2, 'line-opacity': 0.9, 'line-blur': 0.6 },
    }, before);

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('mouseout', () => setHover(null));

    if (revealPending != null) { const d = revealPending; revealPending = null; revealZones(d); }
  }

  /* ------------------------------------------------------------- reveal */

  let revealPending = null;

  function revealZones(delayMs = 0) {
    if (!map) { revealPending = delayMs; return; }
    if (revealed) return;
    revealed = true;
    setTimeout(() => {
      map.setPaintProperty('zones-fill', 'fill-opacity', OPACITY.fill);
      map.setPaintProperty('zones-line', 'line-opacity', OPACITY.line);
      map.setPaintProperty('zones-cells', 'fill-extrusion-opacity', OPACITY.cells);
    }, delayMs);
  }

  /* ---------------------------------------------------- hover and select */

  /** Only red zones open the area panel. */
  function zoneAt(point) {
    const hits = map.queryRenderedFeatures(point, { layers: ['zones-cells', 'zones-fill'] });
    for (let i = 0; i < hits.length; i++) {
      const p = hits[i].properties;
      const id = p.z != null ? p.z : p.id;
      const zone = D.getZone(id);
      if (zone && zone.cls === 'alto') return zone;
    }
    return null;
  }

  const interactive = () => SPILE.state && (SPILE.state.screen === S.MAP || SPILE.state.screen === S.AREA);

  // Lift tweens: zone id -> {from, to, t0}
  const lifts = new Map();
  const liftNow = new Map();
  let liftRaf = 0;

  function setLift(zoneId, to, ms = 380) {
    if (zoneId == null) return;
    lifts.set(zoneId, { from: liftNow.get(zoneId) || 0, to, t0: performance.now(), ms });
    if (!liftRaf) liftRaf = requestAnimationFrame(stepLift);
  }

  function stepLift(now) {
    liftRaf = 0;
    lifts.forEach((job, zoneId) => {
      const t = Math.min(1, (now - job.t0) / job.ms);
      const e = 1 - Math.pow(1 - t, 3);
      const k = job.from + (job.to - job.from) * e;
      liftNow.set(zoneId, k);
      (cellsByZone.get(zoneId) || []).forEach(id => map.setFeatureState({ source: 'zone-cells', id }, { k }));
      if (t >= 1) lifts.delete(zoneId);
    });
    if (lifts.size) liftRaf = requestAnimationFrame(stepLift);
  }

  function setHover(zoneId) {
    if (zoneId === hoveredId) return;
    if (hoveredId != null && hoveredId !== selectedId) setLift(hoveredId, 0, 260);
    hoveredId = zoneId;
    if (hoveredId != null && hoveredId !== selectedId) setLift(hoveredId, 0.3, 200);
  }

  let moveRaf = 0, lastPoint = null;
  function onMove(e) {
    lastPoint = e.point;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      const zone = interactive() && !map.isMoving() ? zoneAt(lastPoint) : null;
      map.getCanvas().style.cursor = zone ? 'pointer' : '';
      setHover(zone ? zone.id : null);
    });
  }

  function onClick(e) {
    if (!interactive()) return;
    const zone = zoneAt(e.point);
    if (zone) selectZone(zone.id);
  }

  function selectZone(id) {
    const zone = D.getZone(id);
    if (!zone || !map) return;
    if (selectedId !== zone.id) {
      if (selectedId != null) setLift(selectedId, 0);
      selectedId = zone.id;
      map.setFilter('zones-selected', ['==', ['get', 'id'], zone.id]);
      setLift(zone.id, 1, 520);
    }
    bus.emit(E.ZONE_SELECTED, { zone });
  }

  function clearSelection() {
    if (selectedId == null || !map) return;
    setLift(selectedId, 0);
    selectedId = null;
    map.setFilter('zones-selected', ['==', ['get', 'id'], -1]);
  }

  /* ------------------------------------------------------------ recolour */

  const jobs = new Map(); // zone id -> {from, to, start, ms}
  let colorRaf = 0;

  function targetFor(zone, planId) {
    const hex = planId ? D.residualColor(zone.id, planId) : null;
    return hex ? hexToRgb(hex) : (CLASS_RGB[zone.cls] || CLASS_RGB.medio);
  }

  function paint(zoneId, rgb) {
    const col = 'rgb(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ')';
    map.setFeatureState({ source: 'zones', id: zoneId }, { col });
    (cellsByZone.get(zoneId) || []).forEach(id => map.setFeatureState({ source: 'zone-cells', id }, { col }));
  }

  function queue(zone, to, delay, ms) {
    const from = current.get(zone.id);
    if (from[0] === to[0] && from[1] === to[1] && from[2] === to[2]) { jobs.delete(zone.id); return; }
    jobs.set(zone.id, { from: from.slice(), to, start: performance.now() + delay, ms });
    if (!colorRaf) colorRaf = requestAnimationFrame(stepColor);
  }

  function stepColor(now) {
    colorRaf = 0;
    jobs.forEach((job, zoneId) => {
      const t = (now - job.start) / job.ms;
      if (t <= 0) return;
      const u = Math.min(1, t);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const rgb = [0, 1, 2].map(i => job.from[i] + (job.to[i] - job.from[i]) * e);
      current.set(zoneId, rgb);
      paint(zoneId, rgb);
      if (u >= 1) jobs.delete(zoneId);
    });
    if (jobs.size) colorRaf = requestAnimationFrame(stepColor);
  }

  /**
   * Colour every zone by a plan's residual risk. The change spreads outwards from
   * the origin zone, so the selected hillside turns first and the rest follows.
   */
  function showPlan(planId, originZoneId, opts = {}) {
    committedPlan = planId || null;
    previewZone = null;
    if (!map) return;
    const origin = D.getZone(originZoneId) || D.getZone(selectedId) || D.getDemoZone();
    const kx = Math.cos((origin ? origin.lat : 45.94) * Math.PI / 180);
    const dist = z => origin ? Math.hypot((z.lon - origin.lon) * kx, z.lat - origin.lat) : 0;
    const far = zones.reduce((m, z) => Math.max(m, dist(z)), 0) || 1;
    const spread = opts.instant ? 0 : 1300, ms = opts.instant ? 1 : 560;
    zones.forEach(z => queue(z, targetFor(z, committedPlan), dist(z) / far * spread, ms));
  }

  /** Preview one plan on one zone while the pointer is over its bar. */
  function previewPlan(zoneId, planId) {
    if (!map) return;
    if (previewZone != null && previewZone !== zoneId) {
      const old = D.getZone(previewZone);
      if (old) queue(old, targetFor(old, committedPlan), 0, 220);
    }
    const zone = D.getZone(zoneId);
    previewZone = zone && planId ? zone.id : null;
    if (zone) queue(zone, targetFor(zone, planId || committedPlan), 0, 220);
  }

  /* --------------------------------------------------------------- wiring */

  bus.on(E.ZONE_CLEARED, clearSelection);

  bus.on(E.PLAN_SELECTED, p => { if (p && p.planId) showPlan(p.planId, p.zoneId); });
  bus.on(E.PLAN_CLEARED, () => showPlan(null, selectedId));
  bus.on(E.PLAN_HOVER, p => {
    if (!p) return;
    const zoneId = p.zoneId != null ? p.zoneId : (previewZone != null ? previewZone : selectedId);
    previewPlan(zoneId, p.planId || null);
  });

  // Back on the bare map: nothing selected, class colours again.
  bus.on(E.SCREEN_SHOW, p => {
    if (p.screen !== S.MAP) return;
    clearSelection();
    if (committedPlan) showPlan(null, null);
  });

  // plans.json may land after a plan was selected against the fixture.
  bus.on('data:plans', () => { if (committedPlan) showPlan(committedPlan, selectedId, { instant: true }); });

  Object.assign(SPILE.map, {
    selectZone, clearSelection, revealZones, showPlan,
    selectedZoneId: () => selectedId,
    shownPlan: () => committedPlan,
  });

  SPILE.map.onLoad(build);
})();
