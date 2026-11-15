# Status — Agent A

One entry per push. Newest at the bottom.
Format: see PROTOCOL.md.

## 2026-11-15 02:19 — A1 done
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
