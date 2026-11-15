/**
 * SPILE map — camera: the intro, the flight to a zone, the framing per screen.
 * Owned by Agent A.
 *
 * The map canvas never resizes. On screens 6 and 7 a panel covers part of it, and
 * the camera pads that part so the zone stays in what is still visible.
 *
 *   SPILE.map.playIntro()   orbit, then zoom onto the demo hillside. Emits INTRO_DONE.
 *   SPILE.map.skipIntro()
 *
 * Bus, in:  SCREEN_SHOW, ZONE_SELECTED
 * Bus, out: INTRO_DONE
 */
(() => {
  'use strict';
  const E = SPILE.EVENTS, S = SPILE.SCREENS, bus = SPILE.bus, D = SPILE.data;

  const ORBIT_MS = 6200;
  const DIVE_MS = 3800;

  /**
   * The intro opens flat on the whole block (the overview is 2D), then tilts and
   * turns a quarter around it: only then is the map 3D.
   */
  const ORBIT_END = { center: [8.5330, 45.9330], zoom: 11.75, pitch: 58, bearing: -34 };

  const NO_PAD = { top: 0, right: 0, bottom: 0, left: 0 };

  let map = null;
  let introState = 'idle';   // idle | running | done
  let introWanted = false;
  let token = 0;             // invalidates callbacks of an interrupted move

  const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /** Bearing that looks up the slope a zone sits on: opposite to its aspect. */
  function upslope(zone) {
    const a = Number(zone && zone.aspect);
    if (!isFinite(a)) return map.getBearing();
    let b = (a + 180) % 360;
    if (b > 180) b -= 360;
    return b;
  }

  /**
   * Camera options that really put a zone in the middle of the view.
   *
   * During a programmatic move MapLibre keeps the camera target at the altitude
   * it had when the move started (transform.elevation), not at the altitude of
   * the destination. Aiming at a zone's lon/lat therefore looks at a point above
   * or below the hillside and the zone slides off screen. Two corrections, from
   * the zone's own elevation: push the target along the bearing until the line
   * of sight crosses the zone, and adjust the zoom so the zone is seen from the
   * distance `view.zoom` means. (transform.elevation is read at each move.)
   */
  function lookAt(zone, view) {
    const rad = Math.PI / 180;
    const base = (map.transform && Number(map.transform.elevation)) || 0;
    const E = (Number(zone.elev) || 0) * SPILE.map.EXAGGERATION - base; // metres above the target plane, as drawn
    const th = view.pitch * rad, be = view.bearing * rad;
    const shift = E * Math.tan(th);                                    // metres along the bearing
    const center = [
      zone.lon + shift * Math.sin(be) / (111320 * Math.cos(zone.lat * rad)),
      zone.lat + shift * Math.cos(be) / 111320,
    ];
    const fov = (map.transform && map.transform._fov) || 0.6435;
    const mPerPx = 40075016.686 * Math.cos(zone.lat * rad) / (512 * Math.pow(2, view.zoom));
    const wanted = 0.5 * map.getContainer().clientHeight / Math.tan(fov / 2) * mPerPx; // camera to zone
    const zoom = view.zoom - Math.log2(Math.max(0.25, 1 + E / (Math.cos(th) * wanted)));
    return { center, zoom, pitch: view.pitch, bearing: view.bearing };
  }

  /** Padding that keeps the zone clear of whatever panel the screen shows. */
  function paddingFor(screen) {
    if (screen === S.AREA) {
      const w = Math.min(SPILE.map.cssLen('--spile-area-w', 440), window.innerWidth * 0.6);
      return Object.assign({}, NO_PAD, { right: w });
    }
    if (screen === S.PLANS) {
      const band = SPILE.map.cssLen('--spile-plans-map-h', window.innerHeight * 0.42);
      return Object.assign({}, NO_PAD, { bottom: Math.max(0, Math.min(window.innerHeight * 0.75, window.innerHeight - band)) });
    }
    return NO_PAD;
  }

  /* --------------------------------------------------------------- intro */

  function finishIntro() {
    if (introState === 'done') return;
    introState = 'done';
    token++;
    SPILE.map.revealZones(0);
    bus.emit(E.INTRO_DONE, {});
  }

  function skipIntro() {
    // Invalidate first: stop() fires moveend synchronously.
    token++;
    if (introState === 'running' && map) map.stop();
    finishIntro();
  }

  function playIntro() {
    if (introState !== 'idle') return;
    if (!map) { introWanted = true; return; }
    introState = 'running';
    const mine = ++token;
    const zone = D.getDemoZone();

    map.stop();
    map.jumpTo(Object.assign({ padding: NO_PAD }, SPILE.map.START));
    SPILE.map.revealZones(1500);

    // 1. Orbit: a slow quarter turn around the town while the zones come up.
    map.easeTo(Object.assign({ duration: ORBIT_MS, easing: easeInOut, essential: true }, ORBIT_END));

    map.once('moveend', () => {
      if (mine !== token) return;
      if (!zone) { finishIntro(); return; }
      // 2. Dive onto the hillside of the demo zone, looking up the slope.
      map.flyTo(Object.assign(lookAt(zone, { zoom: 14.3, pitch: 64, bearing: upslope(zone) }),
        { duration: DIVE_MS, curve: 1.15, essential: true }));
      map.once('moveend', () => { if (mine === token) finishIntro(); });
    });
  }

  /* -------------------------------------------------------------- framing */

  function flyToZone(zone, screen) {
    if (!map || !zone) return;
    token++;
    map.flyTo(Object.assign(lookAt(zone, { zoom: 15.2, pitch: 62, bearing: upslope(zone) }),
      { padding: paddingFor(screen), duration: 1700, curve: 1.2, essential: true }));
  }

  /** Operator, procurement and final: the same place, seen from the same side, a step back. */
  function jobView(screen) {
    const job = SPILE.state && SPILE.state.job;
    if (!job || !job.zone) return;
    if (introState !== 'done') skipIntro();
    token++;
    const bottom = screen === S.PROCUREMENT ? Math.round(window.innerHeight * 0.4) : 0;
    map.flyTo(Object.assign(lookAt(job.zone, { zoom: screen === S.FINAL ? 14.2 : 13.7, pitch: 56, bearing: -34 }),
      { padding: Object.assign({}, NO_PAD, { bottom }), duration: 1600, curve: 1.2, essential: true }));
  }

  function onScreen(p) {
    if (!map) { if (p.screen === S.MAP && p.prev === S.LOADING) introWanted = true; return; }
    const zone = SPILE.state && SPILE.state.zone;
    if (p.screen === S.OPERATOR || p.screen === S.PROCUREMENT || p.screen === S.FINAL) { jobView(p.screen); return; }

    if (p.screen === S.MAP) {
      if (introState === 'idle') {
        // First arrival plays the intro; a ?screen=map jump shows the zones at once.
        if (p.prev === S.LOADING || p.prev == null) playIntro();
        else finishIntro();
      } else if (p.prev === S.AREA || p.prev === S.PLANS) {
        // Pull back a little so the hillside sits in its valley again.
        map.easeTo({ padding: NO_PAD, zoom: Math.max(12.4, map.getZoom() - 1.6), duration: 1500, essential: true });
      }
    } else if (p.screen === S.AREA) {
      if (introState !== 'done') skipIntro();
      // Coming back from the plans view: same zone, only the framing changes.
      if (p.prev === S.PLANS && zone) flyToZone(zone, S.AREA);
    } else if (p.screen === S.PLANS) {
      if (introState !== 'done') skipIntro();
      if (zone) {
        map.easeTo(Object.assign(lookAt(zone, { zoom: 15.0, pitch: 58, bearing: upslope(zone) }),
          { padding: paddingFor(S.PLANS), duration: 1300, essential: true }));
      }
    }
  }

  bus.on(E.SCREEN_SHOW, onScreen);

  // Fires before the shell switches to the area screen, and again for every other
  // zone picked while the panel is open.
  bus.on(E.ZONE_SELECTED, p => {
    if (!map || !p || !p.zone) return;
    if (introState !== 'done') skipIntro();
    if (SPILE.state && SPILE.state.screen === S.PLANS) return;
    flyToZone(p.zone, S.AREA);
  });

  Object.assign(SPILE.map, { playIntro, skipIntro, introState: () => introState });

  SPILE.map.onLoad(m => {
    map = m;
    // Any deliberate gesture hands the camera to the presenter.
    const cancel = () => { if (introState === 'running') skipIntro(); };
    ['mousedown', 'touchstart', 'wheel'].forEach(evt => map.getCanvas().addEventListener(evt, cancel, { passive: true }));

    const now = SPILE.state && SPILE.state.screen;
    if (introWanted || now === S.MAP) {
      introWanted = false;
      if (introState === 'idle') playIntro();
    } else if (now === S.AREA || now === S.PLANS) {
      finishIntro();
    } else if (now === S.OPERATOR || now === S.PROCUREMENT || now === S.FINAL) {
      finishIntro();
      jobView(now);
    }
  });
})();
