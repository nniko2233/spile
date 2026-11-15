# Review — written by Agent B about Agent A's work

File, what is wrong, what it should be. No praise, no restating the spec.

## 2026-11-15 — checkpoints 1 and 2 (run from the login screen, headless Chromium, real tiles)

A had stopped, so findings in A's files that blocked Kurt's new brief were fixed by B
(marked FIXED BY B). The rest are for A.

- app/map/map.js — dark OpenFreeMap basemap of the whole region, free panning. Should be the closed light block of PROJECT.md "5. 3D map". FIXED BY B.
- app/map/map.js — attribution control opened itself again after load and its text ran under the bottom-left label. Should stay collapsed; moved to bottom right, collapsed again on first idle. FIXED BY B.
- app/map/zones.js — selected-zone outline was white, invisible on the light ground. Now near-black. FIXED BY B.
- app/map/zones.js — no pin. PROJECT.md "UI rules" asks for a pin with a Plan/Request/Procurement ring on a zone with an active plan. FIXED BY B (setPin).
- app/map/camera.js — intro started already tilted. PROJECT.md: flat overview first, 3D after. START is now pitch 0 over the whole block. FIXED BY B.
- app/data/plans-fixture.js — `r1` rounds to 0.1 k€: the threshold of zones under 0.17 ha becomes 0 and `residualRatio` divides by it (NaN, zone keeps its class colour when a plan is on). Only matters on file://. Should round to 0.001 like opt/make_plans.py.
- app/data/plans-fixture.js — for the demo zone the fixture gives 26.1 / 12.2 / 5.9 and 34.8 / 30.2 / 42.7, not the whole numbers of the anchor table. Only matters on file://. Should round to whole k€ when area_ha >= 10.
- data/bundle.js / app/data/store.js — plans.json is not in the bundle, so file:// never shows the real file. Either inline it or say in PROJECT.md that the demo must be served over http.
- app/shell/shell.js — PageDown on screen 7 does nothing and there is no presenter key for the map toggle. The key moment (red turning green) needs a click on the "Optimized plan" row. Suggest: PageDown on `plans` emits plan:selected for the optimum plan.
- app/shell/shell.js — LOADING_MIN_MS 4200 is fine; nothing to change.
- index.html — inline `--spile-bg: #04070b` and the dark compass are from the old look. main.css overrides the background; the compass still reads well on sage, leave it.
- index.html — MapLibre comes from unpkg with no local fallback. If the venue network blocks it, screens 5 to 7 are dead. Suggest vendoring maplibre-gl.js and .css into the repo.
- Numbers: screen 6 prints 50 ha, 28%, 45 k€/yr, 119 k€ + 10 k€/yr, 450 k€. Screen 7 prints 45 / 35 / 30 / 43 k€/yr with residual 45 / 26 / 12 / 6 and the threshold at 15. All match PROJECT.md.
- Event wiring: every event in contract.js has an emitter and a listener. `intro:done` has no UI consumer, which is fine.
