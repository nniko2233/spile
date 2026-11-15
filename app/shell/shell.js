/**
 * SPILE shell — the 7-screen state machine. Owned by Agent A.
 *
 * The shell is the only thing that changes screen. It listens to user intent on
 * SPILE.bus, decides the next screen, flips the DOM state and announces it with
 * SCREEN_SHOW. It never renders screen content: that is app/ui (Agent B).
 *
 * DOM state it maintains:
 *   <section class="screen" data-screen="x">  gets .is-active while x is shown
 *   <body data-screen="x">                    the current screen id
 *   <body data-stage="on|off">                whether the map stage is visible
 *
 * Flow:
 *   login --ROLE_PICKED--> auth --AUTH_DONE--> questionnaire --SURVEY_DONE-->
 *   loading --(MAP_READY and minimum hold)--> map --ZONE_SELECTED--> area
 *   --PLANS_OPEN--> plans.   ZONE_CLEARED returns to map, SCREEN_BACK steps back.
 */
(() => {
  'use strict';
  const S = SPILE.SCREENS, E = SPILE.EVENTS, bus = SPILE.bus;

  const ORDER = [S.LOGIN, S.AUTH, S.QUESTIONNAIRE, S.LOADING, S.MAP, S.AREA, S.PLANS];
  const MAP_SCREENS = new Set([S.MAP, S.AREA, S.PLANS]);

  const LOADING_MIN_MS = 4200;   // long enough to read the pi ring
  const LOADING_MAX_MS = 16000;  // never strand the demo on a slow network

  const params = new URLSearchParams(location.search);
  const DEV = params.has('dev');

  /** Read-only snapshot for anyone who loads late and missed SCREEN_SHOW. */
  const state = SPILE.state = {
    screen: null, prev: null, role: null, answers: null, zone: null,
    mapReady: false, introDone: false,
  };

  const sections = new Map();
  let loadingTimer = null, loadingSince = 0;

  function show(screen) {
    if (!ORDER.includes(screen) || screen === state.screen) return;
    clearTimeout(loadingTimer);

    state.prev = state.screen;
    state.screen = screen;

    sections.forEach((el, id) => el.classList.toggle('is-active', id === screen));
    document.body.dataset.screen = screen;
    document.body.dataset.stage = MAP_SCREENS.has(screen) ? 'on' : 'off';

    if (DEV) sections.forEach(el => {
      if (el.childElementCount === 0) el.setAttribute('data-dev-empty', '');
      else el.removeAttribute('data-dev-empty');
    });

    bus.emit(E.SCREEN_SHOW, { screen, prev: state.prev });

    if (screen === S.LOADING) holdLoading();
    if (screen === S.MAP) state.zone = null;
  }

  /** Loading leaves when the map is ready AND the ring has been on screen long enough. */
  function holdLoading() {
    loadingSince = performance.now();
    const tick = () => {
      if (state.screen !== S.LOADING) return;
      const waited = performance.now() - loadingSince;
      if ((state.mapReady && waited >= LOADING_MIN_MS) || waited >= LOADING_MAX_MS) show(S.MAP);
      else loadingTimer = setTimeout(tick, 120);
    };
    tick();
  }

  function back() {
    const from = state.screen;
    if (from === S.PLANS) show(S.AREA);
    else if (from === S.AREA) show(S.MAP);
    else if (from === S.QUESTIONNAIRE) show(S.AUTH);
    else if (from === S.AUTH) show(S.LOGIN);
  }

  /** Presenter safety net and dev stepping: move along the flow without the UI. */
  function next() {
    const from = state.screen;
    if (from === S.MAP || from === S.AREA && !state.zone) {
      // The only way into the area screen is a selected zone: pick the demo one.
      if (SPILE.map && SPILE.map.selectZone) SPILE.map.selectZone(SPILE.data.getDemoZoneId());
      return;
    }
    if (from === S.AREA) { bus.emit(E.PLANS_OPEN, { zoneId: state.zone.id }); return; }
    const i = ORDER.indexOf(from);
    if (i >= 0 && i < ORDER.length - 1) show(ORDER[i + 1]);
  }

  /* ------------------------------------------------------------- wiring */

  bus.on(E.ROLE_PICKED, p => {
    if (state.screen !== S.LOGIN) return;
    const role = (p && p.role) || p;
    // Only the Risk Manager column is implemented in this build.
    if (role && role !== SPILE.ROLES.RISK_MANAGER) return;
    state.role = SPILE.ROLES.RISK_MANAGER;
    show(S.AUTH);
  });

  bus.on(E.AUTH_DONE, () => { if (state.screen === S.AUTH) show(S.QUESTIONNAIRE); });

  bus.on(E.SURVEY_DONE, p => {
    if (state.screen !== S.QUESTIONNAIRE) return;
    state.answers = (p && p.answers) || null;
    show(S.LOADING);
  });

  bus.on(E.MAP_READY, () => { state.mapReady = true; });
  bus.on(E.INTRO_DONE, () => { state.introDone = true; });

  bus.on(E.ZONE_SELECTED, p => {
    if (!MAP_SCREENS.has(state.screen) || state.screen === S.PLANS) return;
    state.zone = (p && p.zone) || null;
    if (state.zone) show(S.AREA);
  });

  bus.on(E.ZONE_CLEARED, () => { if (state.screen === S.AREA || state.screen === S.PLANS) show(S.MAP); });

  bus.on(E.PLANS_OPEN, () => { if (state.screen === S.AREA && state.zone) show(S.PLANS); });

  bus.on(E.SCREEN_BACK, back);

  window.addEventListener('keydown', e => {
    if (e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'PageUp') { e.preventDefault(); back(); }
    else if (e.key === 'Escape' && (state.screen === S.AREA || state.screen === S.PLANS)) back();
  });

  SPILE.shell = { show, next, back, current: () => state.screen };

  /* -------------------------------------------------------------- start */

  function start() {
    document.querySelectorAll('#screens > .screen').forEach(el => sections.set(el.dataset.screen, el));
    // ?screen=map jumps straight to a screen, for development only.
    const jump = params.get('screen');
    show(ORDER.includes(jump) ? jump : S.LOGIN);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
