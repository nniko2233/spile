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
 *
 * Then the job cycle (added by Agent B on Kurt's instruction, storyboard 9-15).
 * `state.stage` is the role whose turn it is; the role picker only lets that one in.
 *   plans --PLAN_SAVED--> login (stage operator) --ROLE_PICKED--> operator
 *   --REQUEST_SAVED--> login (stage procurement) --ROLE_PICKED--> procurement
 *   --JOB_ASSIGNED, FINAL_OPEN--> final
 */
(() => {
  'use strict';
  const S = SPILE.SCREENS, E = SPILE.EVENTS, R = SPILE.ROLES, bus = SPILE.bus;

  const ORDER = [S.LOGIN, S.AUTH, S.QUESTIONNAIRE, S.LOADING, S.MAP, S.AREA, S.PLANS, S.OPERATOR, S.PROCUREMENT, S.FINAL];
  const MAP_SCREENS = new Set([S.MAP, S.AREA, S.PLANS, S.OPERATOR, S.PROCUREMENT, S.FINAL]);
  const HANDOFF_MS = 2400;       // time to watch the ring segment fill before the role picker returns

  const LOADING_MIN_MS = 1000;   // one turn of the loading ring (Niko: 1 s loading + 4 s map = 5 s)
  const LOADING_MAX_MS = 16000;  // never strand the demo on a slow network

  const params = new URLSearchParams(location.search);
  const DEV = params.has('dev');

  /** Read-only snapshot for anyone who loads late and missed SCREEN_SHOW. */
  const state = SPILE.state = {
    screen: null, prev: null, role: null, answers: null, zone: null,
    selection: [],           // every selected Zone; zone is the primary one
    mapReady: false, introDone: false,
    stage: R.RISK_MANAGER,   // the role whose turn it is on the role picker
    job: null,               // {zone, planId, step} once a plan is saved; step 1 Plan, 2 Request, 3 Procurement
  };

  const sections = new Map();
  let loadingTimer = null, loadingSince = 0, handoffTimer = null;

  function show(screen) {
    if (!ORDER.includes(screen) || screen === state.screen) return;
    clearTimeout(loadingTimer);
    clearTimeout(handoffTimer);

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
    if (screen === S.MAP) { state.zone = null; state.selection = []; }
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
    else if (from === S.OPERATOR || from === S.PROCUREMENT) show(S.LOGIN);
    else if (from === S.FINAL) show(S.PROCUREMENT);
  }

  /** The role picker comes back for the next role once the ring has been seen filling. */
  function handoff(stage) {
    state.stage = stage;
    clearTimeout(handoffTimer);
    handoffTimer = setTimeout(() => show(S.LOGIN), HANDOFF_MS);
  }

  /** Presenter safety net and dev stepping: move along the flow without the UI. */
  function next() {
    const from = state.screen;
    if (from === S.LOGIN) { bus.emit(E.ROLE_PICKED, { role: state.stage }); return; }
    // On these the UI knows what the next beat is (toggle the plan, open the pop-up, save).
    if (from === S.QUESTIONNAIRE || from === S.PLANS || from === S.OPERATOR || from === S.PROCUREMENT) { bus.emit(E.PRESENTER_NEXT, { screen: from }); return; }
    if (from === S.FINAL) return;
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
    // Only the role whose turn it is gets in.
    if (role !== state.stage) return;
    state.role = role;
    if (role === R.RISK_MANAGER) show(S.AUTH);
    else if (role === R.OPERATOR && state.job) show(S.OPERATOR);
    else if (role === R.PROCUREMENT && state.job) show(S.PROCUREMENT);
  });

  bus.on(E.PLAN_SAVED, p => {
    if (state.screen !== S.PLANS || !state.zone) return;
    state.job = { zone: state.zone, zones: state.selection.slice(), planId: (p && p.planId) || null, step: 1 };
    handoff(R.OPERATOR);
  });
  bus.on(E.REQUEST_SAVED, () => {
    if (state.screen !== S.OPERATOR || !state.job) return;
    state.job.step = 2;
    handoff(R.PROCUREMENT);
  });
  bus.on(E.JOB_ASSIGNED, () => { if (state.screen === S.PROCUREMENT && state.job) state.job.step = 3; });
  bus.on(E.FINAL_OPEN, () => { if (state.screen === S.PROCUREMENT && state.job && state.job.step >= 3) show(S.FINAL); });

  bus.on(E.AUTH_DONE, () => { if (state.screen === S.AUTH) show(S.QUESTIONNAIRE); });

  bus.on(E.SURVEY_DONE, p => {
    if (state.screen !== S.QUESTIONNAIRE) return;
    state.answers = (p && p.answers) || null;
    show(S.LOADING);
  });

  bus.on(E.MAP_READY, () => { state.mapReady = true; });
  bus.on(E.INTRO_DONE, () => { state.introDone = true; });

  bus.on(E.ZONE_SELECTED, p => {
    if (state.screen !== S.MAP && state.screen !== S.AREA) return;
    state.zone = (p && p.zone) || null;
    state.selection = state.zone ? ((p.zones && p.zones.length) ? p.zones : [state.zone]) : [];
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
    // Jumping into the job cycle needs a job: seed it with the demo zone.
    const seed = { operator: [R.OPERATOR, 1], procurement: [R.PROCUREMENT, 2], final: [R.PROCUREMENT, 3] }[jump];
    if (seed && SPILE.data) {
      state.stage = seed[0];
      state.job = { zone: SPILE.data.getDemoZone(), zones: [SPILE.data.getDemoZone()], planId: 'optimized', step: seed[1] };
    }
    show(ORDER.includes(jump) ? jump : S.LOGIN);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
