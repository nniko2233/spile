# Status — Agent A

One entry per push. Newest at the bottom.
Format: see PROTOCOL.md.

## 2026-11-15 01:41 — A1 done
Touched: index.html, app/shell/shell.js, app/contract.js (own commit), PROJECT.md, BOARD.md
CONTRACT CHANGE: two events added, nothing renamed or removed. `AUTH_DONE: 'auth:done'` {} ui -> shell, emit it when the sign-in form is submitted. `SCREEN_BACK: 'screen:back'` {} ui -> shell, steps plans -> area -> map and auth -> login.
For B:
- Mount points. index.html has one empty `<section class="screen" id="screen-<name>" data-screen="<name>">` per screen: login, auth, questionnaire, loading, map, area, plans. Render into them. The shell toggles `.is-active` and fades them; do not show or hide the sections yourself. Sections for map, area and plans let clicks through to the map, their direct children do not.
- Entry points. index.html loads exactly `app/styles/main.css` and `app/ui/main.js` (classic script, last on the page, after contract, data, map and shell). Load anything else from those two. If you already pushed other file names, say so in STATUS-B and I add the tags.
- `screen:show` payload is `{screen, prev}`. The first one (`login`) fires on DOMContentLoaded, so listeners registered while main.js evaluates receive it. Code that loads later can read `SPILE.state.screen`.
- What the shell listens to: `role:picked {role}` on login (only `risk_manager` advances), `auth:done` on auth, `survey:done {answers}` on questionnaire, `zone:cleared` on area or plans (returns to map), `plans:open {zoneId}` on area, `screen:back` anywhere.
- Loading leaves by itself: when the map is ready and the screen has been up 4.2 s. You emit nothing.
- Layout. The area panel belongs on the RIGHT; the map pads `--spile-area-w` (440px) on that side. On screen 7 the map stays visible in the top `--spile-plans-map-h` (42vh) and your panel should cover the rest. Both are CSS variables on :root, override them in main.css if your panel differs, the map reads them at each transition.
- The compass is mine and sits top right at 28px, 54px wide. Keep that corner clear.
- Coming in A2: `SPILE.data.getZones()`, `getZone(id)`, `getStats()`, `getPlans(zoneId)`, `getPlan(zoneId, planId)`, `getDemoZoneId()`, `SPILE.data.ready` (promise).
Blocked on: nothing

## 2026-11-15 01:43 — A2 done
Touched: app/data/store.js, app/data/plans-fixture.js, BOARD.md, PROJECT.md
For B:
- `SPILE.data` is live and synchronous for zones: `getZones()`, `getZone(id)`, `getZoneFeature(id)` (with geometry), `getStats()`, `getDemoZoneId()`, `getDemoZone()`.
- Plans: `getPlans(zoneId)` -> ZonePlans, `getPlan(zoneId, planId)` -> Plan, `getOptimumPlan(zoneId)`, `residualRatio(zoneId, planId)`, `residualColor(zoneId, planId)`, `bandColor(ratio)`. They answer immediately from a fixture built with the PROJECT.md formulas, and switch to data/plans.json as soon as it loads; await `SPILE.data.ready` (or listen for `data:plans` on the bus) if you need the final set. `plansSource()` says 'file' or 'fixture'.
- DEMO ZONE. No zone in zones.geojson is 50 ha (the largest is 6.15 ha), so the 50 ha scenario has to be pinned on one real zone. I use zone **406** (4.16 ha, fire + power, 132 kV line, slope 31 deg): the intro camera ends on it and PageDown selects it. Please give zone 406 the anchor numbers in plans.json (area_ha 50, eal 45, threshold 15, plans 0/40/119/310 k€). If you pin another zone, put `"demo_zone_id": <id>` in `params` and the map follows; I also recognise the entry by area_ha 50 + eal 45.
- The map colours every zone by its own entry in plans.json when a plan is selected, so every zone id needs an entry.
Blocked on: nothing
