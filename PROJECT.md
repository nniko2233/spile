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

The demo logs in as **Risk Manager**. The other two columns are present but not
implemented.

## The demo, 7 screens

Authoritative spec. Neither agent reinterprets it alone.

Design principle, it governs every screen: **clean and cinematic. The map carries
no information around it. Data appears only on click.** No sidebars, no tickers,
no stat strips, no clocks. The old prototype failed on exactly this.

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
Verbania in three dimensions, terrain exaggeration high enough to read the
slopes. On screen: the map and a compass, top right. Nothing else.

Short automatic intro on entry: orbit, then zoom onto one hillside.

Risk zones drawn as extruded colored polygons from `data/zones.geojson`:
green = `cls` basso, amber = medio, red = alto. Clicking a red zone opens screen 6.

### 6. Area panel
A side panel scrolling through four blocks, and nothing else:

1. **Area information** — hectares, forest type, mean slope, length of the
   crossing MV/HV line, the watercourse and what it discharges onto.
2. **Risk** — level (Very high), an icon list of the risks actually present in
   that zone (wildfire ignition from line fault, post-fire slope instability,
   flash flood and debris flow, power service interruption), and the expected
   annual loss in k€/yr.
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
The map stays visible at the top as context. A **swipe down** raises the plan
comparison panel: the map shrinks and the bars for the alternative plans appear
above it, one per row, after a 1.2 s "optimizing" shimmer.

Each bar is split into two adjacent segments: **annualized cost on the left,
residual risk on the right**. One vertical line crosses the risk side of every
bar: the **acceptance threshold**, the green level. Bars that cross it are greyed
out and tagged *not acceptable*. Among the compliant bars, the shortest is the
optimum, labelled **Optimized plan (MILP)**.

One control only. **No budget slider.** A **map toggle**: selecting a plan
recolors the map zones with that plan's residual risk. Red turning green is the
key moment of the demo.

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
```

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

Vanilla JS, no framework, no build step. MapLibre GL JS from CDN. Terrain from
AWS Terrain Tiles (terrarium). Basemap OpenFreeMap `dark`. No API keys anywhere.

Run it: `python -m http.server 8765` from the repo root, then open
`http://localhost:8765/`. Keep the tab in the foreground: MapLibre suspends
rendering in a background tab.

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
├── data/               pipeline output, reused unchanged, plus plans.json
└── pipeline/           Python pipeline, inherited, never re-run
```

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
| AWS Terrain Tiles (terrarium) + OpenFreeMap `dark` | 3D terrain and basemap | CARTO raster tiles now return "API KEY REQUIRED", hence OpenFreeMap; if it does not answer in 8 s, start on black + hillshade |
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
