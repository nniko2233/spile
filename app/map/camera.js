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

  /** End of the orbit: over the lake shore, looking north-west at the hills. */
  const ORBIT_END = { center: [8.5450, 45.9380], zoom: 12.7, pitch: 60, bearing: -34 };

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
      map.flyTo({
        center: [zone.lon, zone.lat], zoom: 14.7, pitch: 66, bearing: upslope(zone),
        duration: DIVE_MS, curve: 1.15, essential: true,
      });
      map.once('moveend', () => { if (mine === token) finishIntro(); });
    });
  }

  /* -------------------------------------------------------------- framing */

  function flyToZone(zone, screen) {
    if (!map || !zone) return;
    token++;
    map.flyTo({
      center: [zone.lon, zone.lat],
      zoom: Math.max(map.getZoom(), 15.1), pitch: 63, bearing: upslope(zone),
      padding: paddingFor(screen), duration: 1700, curve: 1.2, essential: true,
    });
  }

  function onScreen(p) {
    if (!map) { if (p.screen === S.MAP && p.prev === S.LOADING) introWanted = true; return; }
    const zone = SPILE.state && SPILE.state.zone;

    if (p.screen === S.MAP) {
      if (introState === 'idle') {
        // First arrival plays the intro; a ?screen=map jump shows the zones at once.
        if (p.prev === S.LOADING || p.prev == null) playIntro();
        else finishIntro();
      } else if (p.prev === S.AREA || p.prev === S.PLANS) {
        // Pull back a little so the hillside sits in its valley again.
        map.easeTo({ padding: NO_PAD, zoom: Math.min(map.getZoom(), 14.4), pitch: 60, duration: 1500, essential: true });
      }
    } else if (p.screen === S.AREA) {
      if (introState !== 'done') skipIntro();
      // Coming back from the plans view: same zone, only the framing changes.
      if (p.prev === S.PLANS && zone) flyToZone(zone, S.AREA);
    } else if (p.screen === S.PLANS) {
      if (introState !== 'done') skipIntro();
      if (zone) {
        map.easeTo({
          center: [zone.lon, zone.lat], zoom: 14.9, pitch: 58,
          padding: paddingFor(S.PLANS), duration: 1300, essential: true,
        });
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
    }
  });
})();
