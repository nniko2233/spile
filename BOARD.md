# Board

Status: `todo` / `doing` / `done`. Each agent edits only its own rows.
Order matters: do your tasks top to bottom.

## Agent A — shell, map, data

| id | task | status |
|---|---|---|
| A1 | app shell: 7-screen state machine, transitions, no framework | todo |
| A2 | data layer over `bundle.js`: `getZones`, `getZone`, `getStats`, plan lookup helpers | todo |
| A3 | 3D map screen: terrain, dark and minimal, compass only, zones extruded by class | todo |
| A4 | camera intro (orbit then zoom) and click-to-select on zones | todo |
| A5 | plan toggle: recolor zones from the residual risk in `plans.json` | todo |
| A6 | final integration pass over the whole flow | todo |

## Agent B — UI, optimizer

| id | task | status |
|---|---|---|
| B6 | `opt/econ.py` + `opt/make_plans.py` → `data/plans.json`, no solver. **Do this first.** | todo |
| B1 | login three-way split + login form | todo |
| B2 | questionnaire, 3 of 12 | todo |
| B3 | loading screen with the pi ring | todo |
| B4 | area panel, four blocks, fed by the data layer | todo |
| B5 | plans panel: swipe-down, split bars, threshold line, greyed rows, shimmer | todo |
| B7 | visual pass: typography, palette, motion, so it reads as cinematic | todo |

## Checkpoints

- **CP1** after A3 and B4 — mutual review, see `PROTOCOL.md`.
- **CP2** after A5 and B5 — mutual review.
