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
  const OPACITY = { cells: 0.9, fill: 0.28, line: 0.9 };

  const hexToRgb = hex => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const CLASS_RGB = {};
  Object.keys(SPILE.CLASS_COLOR).forEach(k => { CLASS_RGB[k] = hexToRgb(SPILE.CLASS_COLOR[k]); });

  const zones = D.getZones();
  const current = new Map(zones.map(z => [z.id, (CLASS_RGB[z.cls] || CLASS_RGB.medio).slice()]));

  let map = null, cellsByZone = new Map();
  let selectedId = null, selectedIds = [], hoveredId = null;
  let committedPlan = null;       // plan id the map is coloured by, or null
  let committedMix = null;        // {zoneId: planId} overriding it for the zones of a selection, or null
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
      paint: { 'line-color': '#141a14', 'line-width': 2.4, 'line-opacity': 0.95, 'line-blur': 0.3 },
    }, before);

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('mouseout', () => setHover(null));

    if (revealPending != null) { const d = revealPending; revealPending = null; revealZones(d); }
    // A job seeded before the map existed (?screen=operator) still gets its pin.
    const job = SPILE.state && SPILE.state.job;
    if (job && job.zone) setPin(job.zone.id, job.step);
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
    if (hoveredId != null && !selectedIds.includes(hoveredId)) setLift(hoveredId, 0, 260);
    hoveredId = zoneId;
    if (hoveredId != null && !selectedIds.includes(hoveredId)) setLift(hoveredId, 0.3, 200);
  }

  let moveRaf = 0, lastPoint = null;
  function onMove(e) {
    lastPoint = e.point;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      const zone = interactive() && !lasso && !map.isMoving() ? zoneAt(lastPoint) : null;
      if (!lasso) map.getCanvas().style.cursor = zone ? 'pointer' : '';
      setHover(zone ? zone.id : null);
    });
  }

  function onClick(e) {
    if (!interactive() || lasso) return;
    const zone = zoneAt(e.point);
    if (!zone) return;
    // On the bare map a click starts a selection; with the panel open it adds to
    // it, or takes the area out again (never the last one).
    if (SPILE.state.screen === S.AREA && selectedIds.length) {
      const has = selectedIds.includes(zone.id);
      if (has && selectedIds.length === 1) return;
      setSelection(has ? selectedIds.filter(id => id !== zone.id) : selectedIds.concat(zone.id));
    } else setSelection([zone.id]);
  }

  /**
   * Replace the selection. The first id is the primary zone: the one the camera,
   * the pin and the job hang on. Emits ZONE_SELECTED {zone, zones}.
   */
  function setSelection(ids, silent) {
    if (!map) return;
    ids = ids.filter((id, i) => D.getZone(id) && ids.indexOf(id) === i);
    selectedIds.filter(id => !ids.includes(id)).forEach(id => setLift(id, 0));
    ids.filter(id => !selectedIds.includes(id)).forEach(id => setLift(id, 1, 520));
    selectedIds = ids;
    selectedId = ids.length ? ids[0] : null;
    map.setFilter('zones-selected', ids.length ? ['in', ['get', 'id'], ['literal', ids]] : ['==', ['get', 'id'], -1]);
    if (ids.length && !silent) bus.emit(E.ZONE_SELECTED, { zone: D.getZone(ids[0]), zones: ids.map(D.getZone) });
  }

  function selectZone(id) { if (D.getZone(id)) setSelection([id]); }
  function clearSelection() { if (selectedIds.length && map) setSelection([], true); }

  /** Primary first: the demo zone if it is in, else the highest score. */
  function ordered(ids) {
    const demo = D.getDemoZoneId();
    return ids.slice().sort((x, y) => (y === demo) - (x === demo) || D.getZone(y).score - D.getZone(x).score);
  }

  /** Every red area of the block. */
  function selectRegion() {
    if (!map || !interactive()) return;
    setSelection(ordered(zones.filter(z => z.cls === 'alto').map(z => z.id)));
  }

  /* --------------------------------------------------------------- lasso */

  let lasso = null;   // {svg, path, pts, drawing, handlers} while the tool is armed

  function inside(pt, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }

  /** Where a zone is drawn on screen, terrain included. */
  function screenPoint(zone) {
    const tr = map.transform;
    const elev = (Number(zone.elev) || 0) * SPILE.map.EXAGGERATION;
    if (tr && typeof tr.locationPoint3D === 'function' && window.maplibregl) {
      try { const p3 = tr.locationPoint3D(new maplibregl.LngLat(zone.lon, zone.lat), elev - (tr.elevation || 0)); if (p3) return [p3.x, p3.y]; } catch (err) { /* fall through */ }
    }
    const p = map.project([zone.lon, zone.lat]);
    return [p.x, p.y];
  }

  /** Arm the lasso: the next drag on the map draws a loop and selects the red areas in it. */
  function startLasso() {
    if (!map || lasso || !interactive()) return;
    const box = map.getCanvasContainer();
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('class', 'lasso'); svg.appendChild(path);
    map.getContainer().appendChild(svg);
    ['dragPan', 'dragRotate', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate'].forEach(hd => map[hd] && map[hd].disable());
    map.getCanvas().style.cursor = 'crosshair';

    const pos = e => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const draw = closed => path.setAttribute('d', lasso.pts.length ? 'M' + lasso.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + (closed ? ' Z' : '') : '');
    const down = e => { if (e.button) return; lasso.drawing = true; lasso.pts = [pos(e)]; box.setPointerCapture && box.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); };
    const move = e => {
      if (!lasso.drawing) return;
      const p = pos(e), q = lasso.pts[lasso.pts.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 4) { lasso.pts.push(p); draw(false); }
    };
    const up = () => { if (!lasso.drawing) return; lasso.drawing = false; draw(true); endLasso(true); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); endLasso(false); } };

    lasso = { svg, path, pts: [], drawing: false, off() {
      box.removeEventListener('pointerdown', down, true); box.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true); window.removeEventListener('keydown', key, true);
    } };
    box.addEventListener('pointerdown', down, true); box.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true); window.addEventListener('keydown', key, true);
  }

  function endLasso(apply) {
    if (!lasso) return;
    const { svg, pts } = lasso;
    lasso.off();
    ['dragPan', 'dragRotate', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate'].forEach(hd => map[hd] && map[hd].enable());
    map.getCanvas().style.cursor = '';
    svg.classList.add('is-done');
    setTimeout(() => svg.remove(), 700);
    // Keep onClick from firing on the mouseup that closes the loop.
    setTimeout(() => { lasso = null; }, 0);

    let ids = [];
    if (apply && pts.length > 5) ids = ordered(zones.filter(z => z.cls === 'alto' && inside(screenPoint(z), pts)).map(z => z.id));
    bus.emit(E.LASSO_END, { count: ids.length });
    if (ids.length) setSelection(ids);
  }

  bus.on(E.LASSO_START, startLasso);
  bus.on(E.REGION_SELECT, selectRegion);

  /* ------------------------------------------------------------ recolour */

  const jobs = new Map(); // zone id -> {from, to, start, ms}
  let colorRaf = 0;

  function targetFor(zone, planId) {
    // The optimized plan of a selection gives each of its zones its own plan.
    if (planId && committedMix && committedMix[zone.id] && planId === committedPlan) planId = committedMix[zone.id];
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
    committedMix = (planId && opts.planByZone) || null;
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

  /* ---------------------------------------------------------------- pins */

  /**
   * A pin stands only on a zone with an active plan, request or job. The pin is
   * neutral: its ring shows progress in three steps (SPILE.PIN_STEPS) and never
   * carries a risk colour. Steps: 1 plan saved, 2 cutting request filed,
   * 3 job assigned (third segment a third full: done, verified and paid still to come).
   */
  const PIN_LABEL = ['Plan', 'Request', 'Job'];
  const PIN_FILL = [0, 1, 2, 2 + 1 / 3];
  let pin = null, pinZone = null, pinStep = 0;

  /** The pin as an SVG string. Segments reached since `prevStep` draw themselves in. */
  function pinSVG(step, prevStep = step) {
    const fill = PIN_FILL[step] || 0, before = PIN_FILL[prevStep] || 0, r = 17;
    const arc = (i, share, cls) => {
      // Three 100 degree arcs around the head of the pin, 20 degree gaps.
      const a0 = (-90 + i * 120 + 10) * Math.PI / 180, a1 = (-90 + i * 120 + 10 + 100 * share) * Math.PI / 180;
      const p = a => (23 + r * Math.cos(a)).toFixed(2) + ' ' + (23 + r * Math.sin(a)).toFixed(2);
      return '<path class="pin-seg ' + cls + '" pathLength="1" d="M' + p(a0) + ' A' + r + ' ' + r + ' 0 0 1 ' + p(a1) + '"/>';
    };
    let segs = '';
    for (let i = 0; i < 3; i++) {
      segs += arc(i, 1, '');
      const share = Math.max(0, Math.min(1, fill - i));
      if (share > 0) segs += arc(i, share, 'is-done' + (fill > before && before < i + share ? ' is-new' : ''));
    }
    return '<svg viewBox="0 0 46 58" aria-hidden="true">' +
      // Head: a true circle of radius 21 centred on (23, 23), the centre the ring
      // and the label share. The tail leaves it at two points of that same circle.
      '<path class="pin-body" d="M23 57 L11.54 40.6 A21 21 0 1 1 34.46 40.6 Z"/>' + segs +
      '<text x="23" y="23" dominant-baseline="central">' + (PIN_LABEL[step - 1] || '') + '</text></svg>';
  }

  function setPin(zoneId, step) {
    const prev = zoneId === pinZone ? pinStep : 0;
    if (pin) { pin.remove(); pin = null; }
    pinZone = null; pinStep = 0;
    const zone = zoneId != null && D.getZone(zoneId);
    if (!zone || !step || !map || !window.maplibregl) return;
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'pin'; el.setAttribute('aria-label', 'Open the job on this area');
    el.innerHTML = pinSVG(step, prev);
    el.addEventListener('click', e => { e.stopPropagation(); bus.emit(E.PIN_CLICKED, { zoneId: zone.id }); });
    pin = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -26], opacity: '1', opacityWhenCovered: '1' })
      .setLngLat([zone.lon, zone.lat]).addTo(map);
    pinZone = zone.id; pinStep = step;
  }

  bus.on(E.PLAN_SELECTED, p => { if (p && p.planId) showPlan(p.planId, p.zoneId, { planByZone: p.planByZone }); });
  bus.on(E.PLAN_CLEARED, () => showPlan(null, selectedId));

  // The pin follows the job, not the plan toggle.
  const jobZone = p => (p && p.zoneId != null ? p.zoneId : (SPILE.state.job && SPILE.state.job.zone ? SPILE.state.job.zone.id : selectedId));
  bus.on(E.PLAN_SAVED, p => setPin(jobZone(p), 1));
  bus.on(E.REQUEST_SAVED, p => setPin(jobZone(p), 2));
  bus.on(E.JOB_ASSIGNED, p => setPin(jobZone(p), 3));

  bus.on(E.PLAN_HOVER, p => {
    if (!p) return;
    const zoneId = p.zoneId != null ? p.zoneId : (previewZone != null ? previewZone : selectedId);
    previewPlan(zoneId, p.planId || null);
  });

  // Back on the bare map, and for the operator and procurement: nothing selected,
  // class colours again. The work is not done yet, so the risk colour has not changed.
  bus.on(E.SCREEN_SHOW, p => {
    if (p.screen !== S.MAP && p.screen !== S.OPERATOR && p.screen !== S.PROCUREMENT && p.screen !== S.FINAL) return;
    // The map can finish loading before the shell seeds a job (?screen=operator): catch up here.
    const job = SPILE.state.job;
    if (map && job && job.zone && p.screen !== S.MAP && (pinZone !== job.zone.id || pinStep !== job.step)) setPin(job.zone.id, job.step);
    clearSelection();
    if (committedPlan) showPlan(null, null);
  });

  // plans.json may land after a plan was selected against the fixture.
  bus.on('data:plans', () => { if (committedPlan) showPlan(committedPlan, selectedId, { instant: true, planByZone: committedMix }); });

  Object.assign(SPILE.map, {
    selectZone, setSelection, selectRegion, startLasso, clearSelection, revealZones, showPlan, setPin, pinSVG,
    selectedZoneIds: () => selectedIds.slice(),
    pinElement: () => (pin ? pin.getElement() : null),
    selectedZoneId: () => selectedId,
    shownPlan: () => committedPlan,
  });

  SPILE.map.onLoad(build);
})();
