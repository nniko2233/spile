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

## 2026-11-15 01:47 — A3, A4, A5 first cut pushed, NOT yet run in a browser
Touched: app/map/map.js, app/map/cells.js, app/map/zones.js, app/map/camera.js, BOARD.md
For B:
- The map code is in so index.html no longer 404s on it, but I have not been able to run it yet. Rows A3 to A5 stay `doing` until I have. Do not start checkpoint 1 on this push.
- What it listens to, as per contract: `zone:cleared`, `plan:hover {zoneId, planId}` (planId null ends the preview), `plan:selected {zoneId, planId}`, `plan:cleared`. It emits `map:ready`, `intro:done`, `zone:selected {zone}`.
- `plan:selected` recolours EVERY zone by its own plans.json entry, spreading outwards from zoneId. `plan:cleared`, or returning to the bare map, restores class colours.
- Only red (`cls` alto) zones are clickable. Clicking another red zone while the area panel is open fires `zone:selected` again with the new zone.
Blocked on: a local server to run the page (asked the user)

## 2026-11-15 02:01 — A3 runs in a browser; A4 and A5 still unverified
Touched: app/map/map.js, app/map/cells.js, app/map/zones.js, app/map/camera.js
For B:
- Verified in a browser: map loads, terrain and hillshade read, zones draw as terrain-following pillars, compass works, intro orbit and dive end centred on zone 406, clicking a red zone emits `zone:selected` and the shell switches to area.
- NOT verified: the flight to a clicked zone (it ended off target in my last run; cause not isolated, may be MapLibre's target altitude after the intro), the plans framing, and the plan recolour. Rows A3 to A5 stay `doing`. Do not start checkpoint 1 yet.
Blocked on: session usage limit reached, work resumes later

## 2026-11-15 07:58 — back after the stop; three changes asked by Niko directly
Touched: app/map/camera.js, app/ui/questionnaire.js (yours), app/styles/main.css (yours), PROJECT.md
For B — I edited two of your files because Niko asked me for these in chat. Keep them unless Kurt says otherwise:
- questionnaire.js: Next on Part A (button and PageDown) now calls `autofill()`: sets the two scripted answers (b1[0] = 56, C1.2 = 5), flashes Parts B to F at 240 ms each, lands on Part G. The button on Part A reads "Next: Check and sign-off". `?auto` still works: its extra presses are ignored while filling, then one press on G builds the map.
- main.css: `.rq` has `grid-template-rows: minmax(0, 1fr)` and a definite height at every width (the old `height: auto; max-height: 94vh` under 1000 px let the body outgrow the card, so the footer with Next was clipped). `.wz-foot` is sticky at the bottom of the pop-up. A last block `@media (max-width: 700px), (max-height: 620px)` tightens questionnaire, sign-in, role picker, pop-ups, plans and area panel. It must stay last in the file.
- camera.js: ORBIT_MS 4000, DIVE_MS 2600 (were 6200, 3800), zones reveal at 0.9 s.
- NOT run in a browser: the local server went down while I was testing and I cannot start one from this session. Please run the questionnaire once at 900 x 560 and at full screen.
- I have read your STATUS-B and REVIEW-B. Your edits to my files stand; I am not reverting any of them. Board rows A3 to A5 are marked done on that basis (you ran them headless).
Blocked on: nothing
