# Board

Status: `todo` / `doing` / `done`. Each agent edits only its own rows.
Order matters: do your tasks top to bottom.

## Agent A — shell, map, data

| id | task | status |
|---|---|---|
| A1 | app shell: 7-screen state machine, transitions, no framework | done |
| A2 | data layer over `bundle.js`: `getZones`, `getZone`, `getStats`, plan lookup helpers | done |
| A3 | 3D map screen: terrain, dark and minimal, compass only, zones extruded by class | doing |
| A4 | camera intro (orbit then zoom) and click-to-select on zones | doing |
| A5 | plan toggle: recolor zones from the residual risk in `plans.json` | doing |
| A6 | final integration pass over the whole flow | todo |

## Agent B — UI, optimizer

| id | task | status |
|---|---|---|
| B6 | `opt/econ.py` + `opt/make_plans.py` → `data/plans.json`, no solver. **Do this first.** | done |
| B1 | login three-way split + login form | done |
| B2 | questionnaire, 3 of 12 | done |
| B3 | loading screen with the pi ring | done |
| B4 | area panel, four blocks, fed by the data layer | done |
| B5 | plans panel: swipe-down, split bars, threshold line, greyed rows, shimmer | done |
| B7 | visual pass: typography, palette, motion, so it reads as cinematic | done |
| B8 | contract + shell: job cycle, role stages (plan saved, request saved, job assigned) | done |
| B9 | screen 8, operator: pin, "Request cutting job?", cutting request pop-up | done |
| B10 | screen 9, procurement: "Procure resources?", assignment pop-up, dashboard | done |
| B11 | screen 10, three roles, one pin | done |

## Checkpoints

- **CP1** after A3 and B4 — mutual review, see `PROTOCOL.md`.
- **CP2** after A5 and B5 — mutual review.
