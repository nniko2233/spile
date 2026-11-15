# SPILE — project description

> **Rule for both agents.** This file always describes the project *as it is*,
> never as it was planned. Whenever you reason about design, make a choice, or
> change a number, you update this file **in the same commit** as the code.
> The Decisions section at the bottom is append-only.

## What this is

SPILE turns free geospatial data into a risk management plan for forested areas.
It finds where vegetation threatens assets (power lines, railway, roads, hydro
intakes) or feeds wildfire and flooding, prices the risk in euros per year, and
compares intervention plans against an acceptable risk level.

Scope of this build: the municipality of Verbania (VB), Italy.

Three users, picked on the login screen:

| User | What they come for |
|---|---|
| Risk Manager | Where the risk is, what it costs, which plan clears the threshold |
| Regional Operator (grid utility) | Which line segments are exposed, what to cut and when |
| Procurement | What the works cost, and what inaction costs instead |

The demo logs in as **Risk Manager** and runs the full risk flow (screens 1 to 7).
The other two roles then take one turn each on the same job (screens 8 to 10):
their screens are scripted demo data, not a working back office.

Slogan, wherever one is shown: **For Reliable Infrastructure**. Not "Cut the
trees, not the power".

UI specs: docs/specs/01-04 (reference only; PROJECT.md wins on any conflict)

## The demo, 10 screens

Authoritative spec. Neither agent reinterprets it alone.

Design principle, it governs every screen: **clean and cinematic. The map carries
no information around it. Data appears only on click.** No sidebars, no tickers,
no stat strips, no clocks. The old prototype failed on exactly this.

### Look

Misty grey-green, not dark and not white. A hazy grey-green backdrop (`#9ba198`,
lighter in the middle, a soft mist over the edges of the map), a mossy block
(olive ground `#aebb8c`, woods `#788f45`), and on it near-black rounded cards (`#111311`, radius 28 px) with white pill buttons.
Typeface Outfit (Google Fonts, system fallback). The only saturated colours on
any screen are the three risk colours. Reference: the upper half of the "Orion"
dashboard shot Kurt supplied; we borrow its palette, card segmentation and
restraint, not its content.

### UI rules, all screens

- **Colour means risk, the ring means progress. Never mixed.** Corridors and
  zones are coloured by risk only: red, amber, green.
- **Pins only where there is an active plan, request or job.** No pin on a zone
  nobody has acted on. Each pin carries a progress ring with three steps:
  Plan → Request → Procurement. The pin itself has no risk colour.
- **One accent colour per role**, used for that role's column, buttons and
  focus states: Risk Manager, Regional Operator, Procurement each get their own.
  The accent is never red, amber or green.
- **At most one short caption per screen.**
- **A small "demo data" label on the map**, bottom left, dim. It is the one
  permanent text on the map besides the compass.
- **Flat map for overviews, 3D only when zoomed into one area.**
- **No budget control on any screen, ever.** Not a slider, not a field. A budget
  question in the questionnaire spec (Part F) and "within budget" in the
  voice-over do not change this.

### 1. Login, three-way split
Three vertical columns, full height: Risk Manager / Regional Operator (grid
utility) / Procurement. Hover highlights a column. The cursor picks Risk Manager.

### 2. Login form
Credentials and a sign-in button. Fake: any input is accepted.

### 3. Profiling questionnaire
Displays `3 of 12` so it reads as a longer form, but only three questions are
answered, and these three drive the model:

- Top priority asset to protect → **MV line + downstream settlement**
- Acceptable risk level → **green (low)**
- Planning horizon → **20 years**

### 4. Loading
Animated logo, loading ring with the digits of pi scrolling along its edge.

### 5. 3D map
Verbania as **a closed block**: one 14 km square of terrain centred on the
municipality, standing as a slab on the plain backdrop, like a physical model.
Nothing is drawn outside the square and the camera cannot scroll away from it
(`maxBounds`, min zoom 10.6). It is not a window on a world map. Terrain
exaggeration 1.9. On the block: light ground, the lake, woods and buildings in
pale tones, roads, the municipal boundary, the HV lines, an 8 x 8 grid. On
screen besides the map: a compass, top right, and the "demo data" label.

Short automatic intro on entry: the block seen flat from above, then it tilts
and turns a quarter (the map becomes 3D), then zooms onto one hillside.

Risk zones drawn as extruded colored polygons from `data/zones.geojson`:
green = `cls` basso, amber = medio, red = alto. Clicking a red zone opens screen 6.

Also on the map, per the UI rules above: the "demo data" label, and a pin with a
progress ring on any zone that has a plan selected (ring at step 1, Plan).

### 6. Area panel
A side panel scrolling through four blocks, and nothing else, plus one action
button under the last block: **Create plan for selected areas**, which opens
screen 7.

1. **Area information** — hectares, forest type, mean slope, length of the
   crossing MV/HV line, the watercourse and what it discharges onto.
2. **Risk** — level (Very high), an icon list of the risks actually present in
   that zone (wildfire ignition from line fault, post-fire slope instability,
   flash flood and debris flow, power service interruption), and the expected
   annual loss in k€/yr. One driver is highlighted in this block:
   **Fall-in reach: N trees taller than their distance to the line**, with N from
   the zone's `cells_fall` (10 m canopy cells where `d <= h`; say so if asked).
3. **Mitigation plan** — the action scheme of the optimized plan, with CAPEX and
   OPEX.
4. **Scenario analysis** — what emergency maintenance costs if nothing is done:
   the expected annual loss, plus the cost of a single wildfire event.

Reference content for the 50 ha demo zone: 50 ha broadleaf forest (chestnut and
beech), mean slope 28%, 2 km of bare overhead 15 kV MV line crossing it, torrent
discharging onto the provincial road and the settlement below. Risk **Very high**,
expected annual loss **45 k€/yr**. Optimized plan **119 k€ + 10 k€/yr**. Single
wildfire event **450 k€**.

### 7. Management plans view
The map stays visible at the top as context. The button of screen 6, or a
**swipe down**, raises the plan comparison panel: the map shrinks to a band at
the top and the bars for the alternative plans appear below it, one per row,
after a 1.2 s "optimizing" shimmer.

**The acceptance threshold line is the point of this screen.** It is the
brightest, most deliberate element in the panel, it is labelled with its value,
and nothing else in the panel competes with it: no extra charts, no totals
strip, no secondary controls.

Each bar is split into two adjacent segments: **annualized cost on the left,
residual risk on the right**. One vertical line crosses the risk side of every
bar: the **acceptance threshold**, the green level. Bars that cross it are greyed
out and tagged *not acceptable*. Among the compliant bars, the shortest is the
optimum, labelled **Optimized plan (MILP)**.

One control only. **No budget slider.** A **map toggle**: selecting a plan
recolors the map zones with that plan's residual risk. Red turning green is the
key moment of the demo.

One action besides the control: **Save plan**, top right of the panel. It keeps
the plan shown on the map (the optimum if none is toggled), is disabled for a
plan that is not acceptable, puts the pin on the zone with ring step 1 filling,
and after 2.4 s hands over to the Regional Operator on the role picker. The
zones go back to their risk colours: nothing has been cut yet.

The objective is printed in the UI, one line:
*minimize annualized cost subject to residual risk below the acceptance threshold.*

For the 50 ha demo zone the numbers must come out exactly like this:

| Plan | CAPEX | Residual risk | Annualized cost | Status |
|---|---|---|---|---|
| No action | 0 | 45 k€/yr | 45 k€/yr | not acceptable |
| Minimum plan (ROW + access) | 40 k€ | 26 k€/yr | 35 k€/yr | not acceptable |
| **Optimized plan (MILP)** | 119 k€ | 12 k€/yr | **30 k€/yr** | **optimum** |
| Maximum plan (undergrounding) | 310 k€ | 6 k€/yr | 43 k€/yr | acceptable, dearer |

Acceptance threshold for that zone: 15 k€/yr.

### 8. Regional Operator: cutting request
The role picker returns with the Regional Operator card lit and the Risk Manager
marked done; only the role whose turn it is gets in, and there is no second
sign-in form. Then the same map, the same place, one pin whose ring shows Plan
done, pulsing because it waits for this user. Tap the pin: **Request cutting
job?** Tap that: the cutting request pop-up, the eight steps of
`docs/specs/02` as eight tiles (Scope, Field check, Work needed, Timing, Safety,
Access, Land and permits, Hand-over), three answers each, filling themselves in
at 0.3 s per tile. **Save request**: the second ring segment fills, 2.4 s later
the role picker returns for Procurement. No costs on this form: the operator
gives quantities and constraints.

### 9. Procurement: assignment and dashboard
Same map, same pin, two segments full. Tap the pin: **Procure resources?**, then
the assignment pop-up, the four steps of `docs/specs/03` (Contractor, Contract
and price, Schedule, Documents). **Send work order**: the third segment fills by
a third, and the dashboard rises from the bottom, one row per request, where the
row of this job turns from *In procurement* to **Assigned**. Button **All three
roles** opens screen 10.

### 10. Three roles, one pin
Three thin views side by side, one per role, each with its accent, the same
still of the map cropped on the same pin, and what that role sees of the job.
Under each: Assigned (done), Verified and Paid (faded, still to come). Caption:
*One pin, three roles*.

The job is the same everywhere, invented, and labelled demo data: CR-0142, VCO,
15 kV MV line, 146 trees to fell and 62 to prune over 3.2 ha, window 24 Nov to
15 Dec, line outage 1 to 3 Dec, Forestry firm A, estimate 18,400 €, order
17,900 €, PO-4500123. The 146 is the fall-in reach count of screen 6.

### Storyboard and the demo video

The 45-second video follows `docs/specs/04-demo-storyboard.md`: 15 panels with
timing and voice-over. The storyboard counts panels, this file counts screens;
**match by content, not by number**. Where the two disagree on a number, a label
or a control, this file wins.

| Storyboard panel | Screen here | Built | Difference that stands |
|---|---|---|---|
| 1 Role picker | 1 Login split | yes | one accent per role, slogan as the only caption |
| 2 Login | 2 Login form | yes | credentials fill themselves in |
| 3 Questionnaire | 3 Questionnaire | yes | three questions, "3 of 12"; no points slider, no importance scores |
| 4 Loading | 4 Loading | yes | pi ring |
| 5 Risk map | 5 3D map | yes | zones (not corridors) in red and amber; block shown tilted after a flat first beat |
| 6 Area detail | 6 Area panel | yes | the four blocks of this file, not "area / flood / fire / fault"; fall-in reach count comes from the data (146), not 14 |
| 7 Optimiser running | 7, the 1.2 s shimmer | yes | no "within budget": the constraint is the acceptance threshold |
| 8 Plan result | 7, the bars | yes | bars and threshold line instead of "actions, cost, months"; Save plan fills ring step 1 |
| 9 Role picker, operator | 1 again, operator lit | yes | |
| 10-11 Operator map, cutting request | 8 | yes | eight tiles, scripted values |
| 12 Role picker, procurement | 1 again, procurement lit | yes | |
| 13-14 Procurement map, assignment, dashboard | 9 | yes | four tiles, scripted values; three sample rows |
| 15 Split view of the three roles | 10 | yes | one still of the map shown three times, not three live maps |

Not taken from the specs, on purpose: any budget field or slider (01 Part F2,
04 panel 7); the spec optimiser objective "most risk removed within budget"
(ours is minimum annualized cost under the risk threshold); planning horizons
of 1, 3 or 5 years (ours is 20); pin clustering with counts, pulsing pins and
the "Cleared" state (04, map and pin rules).

## Economic model — there is no solver

There is **no optimization at runtime and no solver dependency anywhere**. The UI
says MILP; the plans are precomputed. If asked, the honest answer is: the
optimization is formulated, the demo serves precomputed plans.

`opt/make_plans.py` is plain Python — no PuLP, no scipy — and writes
`data/plans.json` for every zone in `zones.geojson` from the formulas below.
Constants live in `opt/econ.py`, in one place, commented as prototype figures,
not calibrations.

```
EAL        = 0.9 * area_ha * (score / 0.7)        k€/yr
threshold  = 0.30 * area_ha                       k€/yr   (green level)
annualization factor = 0.0672                     (3% over 20 years)

plan            CAPEX [k€]       OPEX [k€/yr]     residual risk
no_action       0                0                1.00 * EAL
minimum         0.80 * area_ha   0.12 * area_ha   0.58 * EAL
optimized       2.38 * area_ha   0.20 * area_ha   0.27 * EAL
maximum         6.20 * area_ha   0.32 * area_ha   0.13 * EAL

annualized_cost = CAPEX * 0.0672 + OPEX + residual_risk
acceptable      = residual_risk <= threshold
optimum         = cheapest annualized_cost among the acceptable plans
event_cost      = 18 k€/ha * 0.5 (share burnt in one event) * area_ha   k€
```

`acceptable` and `optimum` are decided on unrounded values. Money in
`plans.json` is rounded half-up: whole k€ for zones of 10 ha or more (only the
50 ha reference scenario), 0.001 k€ for the real zones, which are all under
6.2 ha. The reference scenario (50 ha, score 0.7) is written on zone 406,
`params.demo_zone_id`; `make_plans.py` asserts the anchor table before writing.
Over the 443 zones the optimum is: optimized 234, minimum 191, maximum 9,
no action 9.

Action list carried by each plan, for the panel:

- **minimum** — ROW vegetation management, access tracks
- **optimized** — the above, plus insulated conductor on the critical spans,
  check dams and drainage works, water points, monitoring
- **maximum** — the above, plus full line undergrounding

Where the anchor numbers come from: the cost of a wildfire is taken at 18 k€/ha
(above the ~10 k€/ha quoted by Coldiretti for extinction, clean-up and
restoration, because that figure excludes lost ecosystem services); aerial
extinction runs ~15 k€/h for a Canadair, ~10 k€/h for an Erickson, ~2 k€/h for
regional AIB aircraft; works unit costs follow the Prezzario Regione Piemonte,
section 18 (naturalistic engineering, check dams in timber and stone) and
section 23 (forestry operations). Event probabilities are order-of-magnitude
estimates, not derived from local time series. Say so if asked.

## Stack

Vanilla JS, no framework, no build step. MapLibre GL JS 4.7.1 vendored in
`vendor/maplibre-gl/` (unpkg only as a fallback). Terrain from
AWS Terrain Tiles (terrarium), passed through a `spdem://` protocol in
`app/map/map.js` that sets every pixel outside the block to -140 m: that cut is
what makes the slab. Tiles wholly outside the block are never fetched, and a
tile that fails comes back flat, so the map starts even offline. No basemap
style: the block's surface is our own layers, plus water, woods and buildings
from the OpenFreeMap vector tiles when they answer (optional). No API keys
anywhere.

Run it: `python -m http.server 8765` from the repo root, then open
`http://localhost:8765/`. Keep the tab in the foreground: MapLibre suspends
rendering in a background tab. Serve it over http, not `file://`: from a file
the plans come from the formula fixture instead of `data/plans.json` (same
numbers, but not the file).

Recording the video: `http://localhost:8765/?auto` plays all ten screens by
itself, pressing what a presenter would press and waiting on the real screen
changes (`?auto=fast` shortens the pauses; any key or click stops it). It runs
about a minute on a laptop; cut it to the 45 s voice-over in the edit. The
network is still needed for the terrain tiles and the lake (AWS, OpenFreeMap)
and for the Outfit typeface; without it the block is flat and the type falls
back to the system font.

```
spile/
├── index.html          entry, owned by A
├── app/
│   ├── contract.js     shared data shapes and event names, frozen
│   ├── shell/          screen state machine and transitions, owned by A
│   ├── map/            3D map, terrain, zones, camera, owned by A
│   ├── data/           loading and helpers over bundle.js, owned by A
│   ├── ui/             all screens and panels, owned by B
│   └── styles/         CSS, owned by B
├── opt/                econ.py + make_plans.py, owned by B
├── vendor/             MapLibre GL JS, vendored
├── data/               pipeline output, reused unchanged, plus plans.json
├── docs/specs/         the four UI spec files, reference only, owned by B
└── pipeline/           Python pipeline, inherited, never re-run
```

## Shell and mount points

`index.html` holds one empty `<section class="screen" id="screen-<name>"
data-screen="<name>">` per screen, over a persistent map stage (`#stage` > `#map`
+ `#compass`). `app/shell/shell.js` is the only code that changes screen: it
toggles `.is-active` on the section, sets `<body data-screen>` and
`<body data-stage="on|off">`, then emits `screen:show {screen, prev}`. The UI
renders into the sections and never switches them itself.

```
login --role:picked--> auth --auth:done--> questionnaire --survey:done-->
loading --(map:ready, held at least 4.2 s, at most 16 s)--> map
map --zone:selected--> area --plans:open--> plans
zone:cleared returns to map; screen:back steps plans -> area -> map.

plans --plan:saved, 2.4 s--> login (stage operator) --role:picked--> operator
operator --request:saved, 2.4 s--> login (stage procurement) --role:picked--> procurement
procurement --job:assigned, then final:open--> final
```

`SPILE.state.stage` is the role whose turn it is; the role picker ignores the
others. `SPILE.state.job` is `{zone, planId, step}` from the moment a plan is
saved (step 1 Plan, 2 Request, 3 Procurement) and the pin follows it.

`index.html` loads exactly two UI files: `app/styles/main.css` and
`app/ui/main.js`. Everything else the UI needs is loaded from those two.

Layout constants are CSS variables on `:root`, read by the map at each
transition, so the UI can change them from CSS: `--spile-area-w` (440px, the
width the area panel covers on the right) and `--spile-plans-map-h` (42vh, the
map band left visible at the top of screen 7). The map never resizes: the panels
cover it and the camera pads itself to keep the zone in the visible part.

Presenter safety net: `PageDown` advances one beat, `PageUp` and `Esc` step
back, whatever the UI is doing. The whole demo can be driven with `PageDown`
alone, 17 presses from the role picker to the three-role view: on screen 7 the
first press shows the optimum on the map and the second saves it; on screens 8
and 9 the presses are question, pop-up, save (then, on 9, the three-role view). `?screen=<name>` jumps to a screen and `?dev`
labels empty screens; both are development only.

## Data

`data/` is inherited from the previous prototype and reused **unchanged**.
`pipeline/` is the Python code that produced it and is **never re-run** during
the hackathon.

`data/bundle.js` inlines all of `data/*`, so the demo also works from `file://`.

`data/zones.geojson` — 443 zones. Properties per zone:

`id`, `score` (0-1), `cls` (alto|medio|basso), `dom`, `types[]`,
`risk{type: score}`, `n_cells`, `area_ha`, `h_mean`, `h_max`, `d_min`, `slope`,
`aspect`, `elev`, `fascia`, `cells_out`, `cells_in`, `bld500`, `assets{}`,
`asset_main`, `lon`, `lat`, `rank`.

Risk type keys: `power`, `rail`, `road`, `fire`, `hydro`.

Also in `data/`: `assets.geojson`, `boundary.geojson`, `stats.json`, `top50.csv`.

### Sources, all free, no API key

| Source | Used for | Status / caveat |
|---|---|---|
| OpenStreetMap via Overpass (`lz4.overpass-api.de`, `z.`, `overpass.osm.ch`) | municipal boundary (relation 46498), power=line/minor_line/substation/plant/generator, railway, highway, waterway, building | the main node was saturated (502), mirrors used with automatic fallback |
| ESA WorldCover 2021 v200 (tile N45E006) | class 10 = tree cover | OK |
| Copernicus DEM GLO-30 (tile N45 E008) | slope, aspect, upstream position for hydro | OK |
| Meta/WRI Global Canopy Height 1 m (Tolan et al. 2024, AWS Open Data) | canopy height per cell, read at ~2.5 m from the COG overviews, aggregated by max over 10 m | the ETH Lang et al. tile is no longer served (HTTP 500); fallback is a constant 20 m, flagged in the UI |
| Agenzia delle Entrate cadastre | sheet and parcel of a zone | bulk GML unreachable (HTTP 500 / SOAP fault); INSPIRE WMS `GetFeatureInfo` on `CP.CadastralParcel` at the centroid of the top 120 zones instead |
| AWS Terrain Tiles (terrarium) + OpenFreeMap vector tiles (`planet`) | 3D terrain; lake, woods, buildings on the block | CARTO raster tiles now return "API KEY REQUIRED", hence OpenFreeMap; if it does not answer the block is plain relief |
| Sentinel-2 NDVI/NDWI | optional | not integrated |

**Declared limit:** OSM does not contain e-distribuzione's MV network at
Verbania, only Terna's 132/220 kV lines and two 50 kV lines. The "MV lines" count
is therefore zero and is labelled *not in OSM*. The 50 ha demo zone described in
the panel presents an MV line because that is the scenario the product addresses;
keep that distinction honest if the jury asks.

### Risk model behind `zones.geojson`

10 m grid in UTM 32N, clipped to the municipal boundary. Tree cells from
WorldCover class 10; `h` = canopy height (max over 10 m, min 3 m, cap 45 m);
slope and aspect from the DEM. Linear assets split into 25 m segments; distance
`d` per cell by Euclidean distance transform. Fall zone where `d <= h`.

```
R_fall = max(0, (h - d) / h) * (1 + s / 45) * w_asset
```

- `h`: canopy height, m
- `d`: distance to the nearest asset segment, m
- `s`: slope, degrees
- `w_asset`: asset criticality weight, dimensionless — HV 1.0, MV 0.75, rail 0.9,
  trunk 0.7, primary 0.6, secondary 0.5

Electrical risk is further multiplied by `0.6 + 0.4 * building density within
500 m` as a proxy for customers served. Cells inside the statutory clearance
corridor are multiplied by 0.7, because cutting there is already scheduled. Fire
and hydro scores, class thresholds (alto ≥ 0.45, medio ≥ 0.20) and zone
construction are in `pipeline/compute_risk.py`; every weight is in
`pipeline/config.py`. They are prototype choices, not calibrations.

## Decisions

Append-only. One line each: what was decided, why.

- **2026-11-15** Interface rebuilt from scratch, data and pipeline kept. The old
  dashboard put every number on screen at once; the demo needs one thing visible
  at a time.
- **2026-11-15** No budget slider in screen 7. The acceptable risk level is the
  constraint, not the budget; a slider would tell the opposite story.
- **2026-11-15** No solver in the demo. A real MILP adds a dependency and a
  failure mode on stage, and buys nothing a precomputed plan set does not.
- **2026-11-15** B starts with `opt/make_plans.py` rather than the login screen,
  because `data/plans.json` is the only real dependency A has on B.
- **2026-11-15** Contract gained `auth:done` and `screen:back`. Without them the
  flow could not leave the sign-in form or return from the plans view.
- **2026-11-15** The map never resizes for screens 6 and 7; panels cover it and
  the camera pads. Resizing a WebGL canvas mid-transition stutters on stage.
- **2026-11-15** Only the Risk Manager column advances the flow; `role:picked`
  with another role is ignored by the shell.
- **2026-11-15** The 50 ha reference scenario is pinned on zone 406. No real zone
  is that large (max 6.15 ha); 406 is forest on a 31 degree slope with fire and
  power risk under a 132 kV line. `params.demo_zone_id` in plans.json overrides it.
- **2026-11-15** The data layer answers plan lookups from a formula fixture until
  `data/plans.json` loads, and whenever it cannot (file://), so the map never
  waits on the file.
- **2026-11-15** Single wildfire event = 18 k€/ha on half the zone (9 k€/ha
  effective), so the 50 ha scenario gives the 450 k€ of screen 6. Matches A's fixture.
- **2026-11-15** plans.json rounding: whole k€ at 10 ha and above, 1 € below.
  One decimal turned the threshold of the smallest zones into 0 and the map
  divides by it.
- **2026-11-15** (Kurt) UI rules section added: risk colour vs progress ring,
  pins only on active plan/request/job, one accent per role, one caption per
  screen, "demo data" label, flat overview and 3D on zoom. Slogan fixed as
  "For Reliable Infrastructure".
- **2026-11-15** (Kurt) Screen 6 keeps its four blocks and gains exactly one
  button, "Create plan for selected areas", and one highlighted driver, fall-in
  reach. Screen 7: the threshold line is the point; nothing from the specs may
  compete with it. No budget control anywhere, including the questionnaire.
- **2026-11-15** (Kurt) The 15-panel storyboard is matched to the 7 screens by
  content; its panels 7 and 8 are both screen 7.
- **2026-11-15** (Kurt) Look changed from dark to light: sage backdrop, black
  rounded cards, white pills, after the Orion reference. The dark map read as a
  generic GIS viewer.
- **2026-11-15** (Kurt) The map is a closed 14 km block around Verbania on a
  plain backdrop, no world basemap, no free scrolling. Done by cutting the DEM
  in a custom tile protocol rather than masking, so the block has real sides.
- **2026-11-15** A stopped (credits). On Kurt's instruction B edited
  `app/map/map.js`, `zones.js`, `camera.js` for the two items above and the pin.
  Ownership in PROTOCOL.md is otherwise unchanged; A takes them back on return.
- **2026-11-15** The overview is flat only as the first beat of the intro; the
  block is then shown tilted, because the tilted slab is the look Kurt asked for.
- **2026-11-15** Pin with progress ring is drawn by the map (`zones.js`), on the
  selected zone once a plan other than "No action" is toggled on; ring at step 1.
- **2026-11-15** Primary buttons are white, not the role accent; the accent
  (cyan for Risk Manager) is kept to eyebrows, focus and the map toggle.
- **2026-11-15** (Kurt) Backdrop and block made greener and mistier: the first
  light version read as white. Ground greens are olive so risk green still stands out.
- **2026-11-15** Specs 01-04 added under docs/specs/ as reference. The storyboard
  table in this file records how its 15 panels map to the 7 screens and which
  spec items are deliberately not taken.
- **2026-11-15** Captions kept to five words or fewer (spec 04 clean-screen rule).
- **2026-11-15** (Kurt) Storyboard panels 9 to 15 are built as screens 8, 9, 10:
  scripted, one job, demo data. Contract gained three screens and six events.
- **2026-11-15** Screen 7 gained one action, Save plan. The pin now appears on
  save, not on the map toggle: a toggle is a preview, a saved plan is a job.
- **2026-11-15** After a save the zones return to their risk colours and stay
  that way for the operator and procurement. Colour means risk, and the risk has
  not changed until the work is verified.
- **2026-11-15** No second sign-in for the operator and procurement: the role
  picker is the hand-over. A sign-in form twice more would cost the video 3 s.
- **2026-11-15** Screen 10 shows one still of the map three times rather than
  three live maps: three WebGL contexts with terrain would stutter on a laptop.
- **2026-11-15** Shell and index.html (A's files) extended by B for the above,
  on Kurt's instruction, A still stopped.
- **2026-11-15** MapLibre vendored into the repo. A CDN is one blocked host away
  from a dead map on stage.
- **2026-11-15** `?auto` autoplay added for recording. It drives the real app,
  it is not a second code path.
- **2026-11-15** The plan fixture rounds like `make_plans.py` (whole k€ from
  10 ha, 1 € below), so the anchor table is exact on `file://` too.
