/**
 * SPILE — shared contract between Agent A (shell, map, data) and Agent B (UI, opt).
 *
 * FROZEN. Both agents code against this file. To change it: one commit of its own,
 * plus a line flagged CONTRACT CHANGE in your STATUS file. See PROTOCOL.md.
 *
 * No build step, no modules bundler: this file is loaded with a plain
 * <script src="app/contract.js"> before everything else and exposes window.SPILE.
 */

window.SPILE = window.SPILE || {};

/* ---------------------------------------------------------------- screens */

/** The 7 screens, in order. The shell owns transitions between them. */
SPILE.SCREENS = Object.freeze({
  LOGIN: 'login',              // 1. three-way split by user role
  AUTH: 'auth',                // 2. credentials form
  QUESTIONNAIRE: 'questionnaire', // 3. 3 of 12
  LOADING: 'loading',          // 4. pi ring
  MAP: 'map',                  // 5. 3D map, nothing else on screen
  AREA: 'area',                // 6. area panel over the map
  PLANS: 'plans',              // 7. plan comparison, map shrunk on top
  OPERATOR: 'operator',        // 8. regional operator: the pin, the cutting request
  PROCUREMENT: 'procurement',  // 9. procurement: assignment pop-up, dashboard
  FINAL: 'final',              // 10. three roles side by side, one pin
});

SPILE.ROLES = Object.freeze({
  RISK_MANAGER: 'risk_manager',
  OPERATOR: 'operator',
  PROCUREMENT: 'procurement',
});

/* ----------------------------------------------------------------- events */

/**
 * Every cross-boundary interaction goes through these events on SPILE.bus.
 * A emits map events and screen changes; B emits user intent from the panels.
 * Nobody calls a function owned by the other agent directly.
 */
SPILE.EVENTS = Object.freeze({
  SCREEN_SHOW: 'screen:show',       // {screen}            shell -> ui
  ROLE_PICKED: 'role:picked',       // {role}              ui -> shell
  AUTH_DONE: 'auth:done',           // {}                  ui -> shell  (sign-in accepted, go to questionnaire)
  SURVEY_DONE: 'survey:done',       // {answers}           ui -> shell
  MAP_READY: 'map:ready',           // {}                  map -> all
  INTRO_DONE: 'intro:done',         // {}                  map -> shell
  ZONE_SELECTED: 'zone:selected',   // {zone}  full Zone   map -> ui
  ZONE_CLEARED: 'zone:cleared',     // {}                  ui -> map
  PLANS_OPEN: 'plans:open',         // {zoneId}            ui -> shell
  PLAN_HOVER: 'plan:hover',         // {zoneId, planId}    ui -> map
  PLAN_SELECTED: 'plan:selected',   // {zoneId, planId}    ui -> map  (recolor)
  PLAN_CLEARED: 'plan:cleared',     // {}                  ui -> map
  SCREEN_BACK: 'screen:back',       // {}                  ui -> shell  (plans -> area, area -> map, auth -> login)
  // The job cycle after the plan: Plan -> Request -> Procurement, one pin all the way.
  PLAN_SAVED: 'plan:saved',         // {zoneId, planId}    ui -> shell, map  (pin, ring step 1; then role picker, operator)
  PIN_CLICKED: 'pin:clicked',       // {zoneId}            map -> ui
  REQUEST_SAVED: 'request:saved',   // {zoneId}            ui -> shell, map  (ring step 2; then role picker, procurement)
  JOB_ASSIGNED: 'job:assigned',     // {zoneId}            ui -> shell, map  (ring step 3, partly full)
  FINAL_OPEN: 'final:open',         // {}                  ui -> shell  (procurement -> final)
  PRESENTER_NEXT: 'presenter:next', // {screen}            shell -> ui  (PageDown on plans, operator, procurement)
});

/** The three steps of the ring on a pin. Ring = progress, never risk. */
SPILE.PIN_STEPS = Object.freeze(['Plan', 'Request', 'Procurement']);

/** Minimal event bus. Owned by A, used by both. */
SPILE.bus = (() => {
  const map = new Map();
  return {
    on(evt, fn) { (map.get(evt) || map.set(evt, []).get(evt)).push(fn); return () => this.off(evt, fn); },
    off(evt, fn) { const l = map.get(evt); if (l) map.set(evt, l.filter(f => f !== fn)); },
    emit(evt, payload = {}) { (map.get(evt) || []).forEach(f => { try { f(payload); } catch (e) { console.error(evt, e); } }); },
  };
})();

/* ------------------------------------------------------------------ types */

/**
 * @typedef {Object} Zone  One feature of data/zones.geojson, properties only.
 *   Produced by the inherited pipeline. Read-only for both agents.
 * @property {number} id
 * @property {number} score      0-1, max over risk types
 * @property {'alto'|'medio'|'basso'} cls
 * @property {RiskType} dom       dominant risk type
 * @property {RiskType[]} types   every risk type present in the zone
 * @property {Object<RiskType, number>} risk  per-type score, 0-1
 * @property {number} n_cells
 * @property {number} area_ha
 * @property {number} h_mean      mean canopy height, m
 * @property {number} h_max       max canopy height, m
 * @property {number|null} d_min  distance to the threatened asset, m
 * @property {number} slope       mean slope, degrees
 * @property {number} aspect      mean aspect, degrees
 * @property {number} elev        mean elevation, m
 * @property {'DENTRO'|'FUORI'} fascia  inside or outside the statutory corridor
 * @property {number} cells_out
 * @property {number} cells_in
 * @property {number} bld500      buildings within 500 m
 * @property {Object} assets      threatened assets by group
 * @property {Object|null} asset_main
 * @property {number} lon
 * @property {number} lat
 * @property {number} rank        1 = highest score
 */

/** @typedef {'power'|'rail'|'road'|'fire'|'hydro'} RiskType */
SPILE.RISK_TYPES = Object.freeze(['power', 'rail', 'road', 'fire', 'hydro']);

/** Canonical plan ids. Order is display order, cheapest CAPEX first. */
SPILE.PLAN_IDS = Object.freeze(['no_action', 'minimum', 'optimized', 'maximum']);

/**
 * @typedef {Object} Plan  One row of the comparison panel. Produced by
 *   opt/make_plans.py. All money in thousands of euro.
 * @property {'no_action'|'minimum'|'optimized'|'maximum'} id
 * @property {string} label        shown on the bar, e.g. "Optimized plan (MILP)"
 * @property {number} capex_k      one-off, k€
 * @property {number} opex_k_yr    recurring, k€/yr
 * @property {number} residual_k_yr expected annual loss after the plan, k€/yr
 * @property {number} annualized_k_yr  capex*0.0672 + opex + residual, k€/yr
 * @property {boolean} acceptable  residual_k_yr <= threshold_k_yr
 * @property {boolean} optimum     cheapest annualized among the acceptable ones
 * @property {string[]} actions    action list for the panel
 */

/**
 * @typedef {Object} ZonePlans  One entry of data/plans.json, keyed by zone id.
 * @property {number} zone_id
 * @property {number} area_ha
 * @property {number} eal_k_yr        expected annual loss, no action, k€/yr
 * @property {number} threshold_k_yr  acceptance threshold (green level), k€/yr
 * @property {number} event_cost_k    single wildfire event, k€, for screen 6
 * @property {Plan[]} plans           one per PLAN_IDS, in that order
 */

/**
 * data/plans.json shape:
 *   { generated_at: ISO string, params: {...econ constants...},
 *     zones: { "<zone_id>": ZonePlans, ... } }
 */

/* -------------------------------------------------------------- constants */

/** Zone fill colors by class. Used by the map and by the panel badges. */
SPILE.CLASS_COLOR = Object.freeze({ alto: '#ff3b30', medio: '#ffb020', basso: '#2fd47a' });

/**
 * Residual-risk coloring for the plan toggle: a zone is colored by
 * residual_k_yr / threshold_k_yr. <= 1 green, <= 2 amber, above red.
 */
SPILE.RESIDUAL_BANDS = Object.freeze([
  { max: 1.0, color: '#2fd47a' },
  { max: 2.0, color: '#ffb020' },
  { max: Infinity, color: '#ff3b30' },
]);

SPILE.ANNUALIZATION = 0.0672; // 3% over 20 years. Mirrors opt/econ.py.
