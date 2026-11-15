# SPILE — Risk Manager Questionnaire

Spec exported from the team doc (Nov 14, 2026). Screen 3 of the demo. PROJECT.md wins on any conflict.

## How to use this questionnaire

One risk manager per company answers this once, in about 40 minutes. The answers set the weights that turn map layers into the red, amber and green areas the regional operators see. Re-run it every year, or after a major vegetation-caused outage.

- **Who answers:** the head of risk or of asset management. Invite the vegetation manager and one regional operator to Part C as advisers.
- **Three kinds of answer:** points shared out across domains (Part B), an importance score and thresholds for each criterion (Part C), and limits and targets (Parts D–F).
- **What it does not do:** it does not judge single trees. Field surveys (ISA or SIA forms) feed data into the criteria. This questionnaire decides how much each criterion counts.

**The rule behind it: risk = likelihood × consequence.**

- Parts B and C build the likelihood that vegetation hits the asset.
- Part D builds the consequence if it does.
- Part E decides which combinations are red, amber or green.
- Part F feeds the strategy optimiser. It does not change the colour.

Why keep Part F separate: whether you *can* act (permits, access, landowner) changes the cost and the timing, not how dangerous the tree is. Mixing them would make a dangerous span that is hard to reach look safe.

## Part A — Company and network profile

These answers pick the starting template (see the last section) and set the units. No weights are set yet.

| # | Question | Answer format |
| --- | --- | --- |
| A1 | Which sector are you in? | Transmission grid · distribution grid · rail · road · hydro · other |
| A2 | Which assets are in scope? | Overhead lines by voltage class (kV) · electrified or non-electrified track · road class · penstocks, intakes, reservoir banks |
| A3 | How large is the network in scope, and where? | km per region |
| A4 | Who owns the land under or beside the assets? | % own corridor · % easement · % third-party land |
| A5 | How do you inspect vegetation today, and how often? | Foot patrol · helicopter · LiDAR · satellite; months between inspections |
| A6 | Which data do you already hold? | Tick: asset GIS · outage log with cause codes · LiDAR · past cut records · contractor list · permit records |
| A7 | How many vegetation-caused events in the last 3 years? | Number · worst event · cost if known |
| A8 | Which rules and penalties apply to you? | e.g. ARERA (energy regulator) service-quality and resilience rules · railway safety decree DPR 753/80 · highway code |
| A9 | What planning horizon should the strategies cover? | 1 · 3 · 5 years |
| A10 | What is one unit on the map? | Span between two towers · 100 m of track · 100 m of road · custom |

## Part B — Domain weights

Share 100 points in each question. More points means that domain moves the result more. Zero means ignore it. The grid column is a suggested start for a transmission operator.

**B1. What makes vegetation likely to hit your assets? Share 100 points.**

| Likelihood domain | What it covers | Your points | Grid start |
| --- | --- | --- | --- |
| Vegetation hazard | The plants: distance, height against distance, species, condition, fuel, time since last cut | | 50 |
| Site and terrain | Slope, soil and water, wind exposure, landslides, altitude | | 20 |
| Weather and season | Wind, wet snow and ice, drought and heat, fire danger, past storm damage | | 30 |
| **Total** | | **100** | **100** |

**B2. If vegetation does hit an asset, what hurts most? Share 100 points.**

| Consequence dimension | What it covers | Your points | Grid start |
| --- | --- | --- | --- |
| Service interruption | Customers or traffic cut off, energy not delivered, delay minutes | | 35 |
| Safety of people | Workers, passengers, drivers, residents | | 25 |
| Fire ignition and spread | A fire started by or reaching the asset | | 20 |
| Asset damage | Repair cost and time out of service | | 10 |
| Regulatory and reputation | Penalties, inquiries, press | | 10 |
| **Total** | | **100** | **100** |

## Part C — Criteria inside each domain

For each criterion, give an importance from 0 (ignore) to 5 (critical), and accept or change the thresholds. Thresholds marked *start* are our suggested values; those with a source are set by a rule or standard.

**C1. Vegetation hazard**

| # | Criterion | How the platform measures it | Low | Medium | High | Importance 0–5 |
| --- | --- | --- | --- | --- | --- | --- |
| C1.1 | Clearance (grow-in) | Gap between canopy and conductor, track or road edge, from LiDAR or satellite | Above clearance + 2 m (*start*) | Within 2 m of clearance (*start*) | Inside clearance: 5 m up to 132 kV, 7 m above 132 kV (D.Lgs. 81/2008) | |
| C1.2 | Fall-in reach | Tree height compared with distance to the asset | Height < distance − 2 m | Height within 2 m of distance | Height ≥ distance (rail rule: height + 2 m; highway code: maximum height reachable) | |
| C1.3 | Growth rate | Species group from the regional forest map | Slow | Medium | Fast: poplar, willow, black locust, tree of heaven (*start*) | |
| C1.4 | Tree condition | Field survey class: SIA A–D or ISA likelihood of failure | SIA A–B · ISA improbable | SIA C · ISA possible | SIA C/D–D · ISA probable or imminent | |
| C1.5 | Fuel load | Canopy density and dead material along the corridor | Low | Medium | High | |
| C1.6 | Time since last cut | Cut records against the planned cycle | Within cycle | Up to 1 year overdue | More than 1 year overdue | |

**C2. Site and terrain**

| # | Criterion | How the platform measures it | Low | Medium | High | Importance 0–5 |
| --- | --- | --- | --- | --- | --- | --- |
| C2.1 | Slope, and trees uphill of the asset | Terrain model (1 m) | Under 15% (*start*) | 15–35% (*start*) | Over 35%, or trees uphill (*start*) | |
| C2.2 | Water and wet soil | Distance to river, lake or wetland; flood zones | Over 50 m (*start*) | 10–50 m (*start*) | Under 10 m, or in a flood zone (*start*) | |
| C2.3 | Wind exposure | Position: ridge, gap or channelled valley vs sheltered | Sheltered | Open slope | Ridge or gap | |
| C2.4 | Landslide and erosion | National landslide inventory (IFFI) | None mapped | Moderate | High, or active slide | |
| C2.5 | Altitude (wet snow and ice) | Terrain model | Under 600 m | 600–1,000 m (*start*) | Over 1,000 m (*start*) | |

**C3. Weather and season**

Weather thresholds start as thirds of your own network (bottom, middle and top third), so they work in any climate. Change them to absolute values if you have them.

| # | Criterion | How the platform measures it | Low | Medium | High | Importance 0–5 |
| --- | --- | --- | --- | --- | --- | --- |
| C3.1 | Strong gusts | Gust speed with a 10-year return period | Bottom third | Middle third | Top third | |
| C3.2 | Wet snow and ice sleeves | Modelled frequency of wet snow on conductors | Bottom third | Middle third | Top third | |
| C3.3 | Drought and heat | Dry, hot days in the growing season | Bottom third | Middle third | Top third | |
| C3.4 | Fire danger | Fire weather index in the fire season | Bottom third | Middle third | Top third | |
| C3.5 | Past vegetation damage here | Outage log, events within 1 km in 5 years | 0 | 1 | 2 or more | |

**C4. Anything we missed?** Add up to three criteria of your own, with how you would measure them.

## Part D — Consequence calibration

Write your own numbers for each level. They turn the B2 dimensions into four consequence levels for every map unit. The grid prompts show the kind of number we need, not a recommendation.

**D1. What does each level mean for you?**

| Dimension | Negligible | Minor | Significant | Severe | Grid prompt |
| --- | --- | --- | --- | --- | --- |
| Service interruption | | | | | Users cut off, MWh not served, or minutes out |
| Safety of people | | | | | No exposure · workers only · public nearby · public on or under the asset |
| Fire ignition and spread | | | | | Fire danger class and houses within 100 m |
| Asset damage | | | | | Repair cost (€) and days out of service |
| Regulatory and reputation | | | | | Penalty band, or a notifiable incident |

**D2. How critical is each asset class?** Rank your voltage classes, track categories or road classes from most to least critical.

**D3. Can service be rerouted if this unit fails?** Yes, fully · partly · no. A unit with no alternative route moves up one consequence level.

**D4. When does a failure cost more?** Mark the months of peak demand, fire season or peak traffic. The platform weights consequence by month, using your seasonal demand or traffic forecast if you upload it.

## Part E — Risk appetite and response times

The default is the ISA (International Society of Arboriculture) risk matrix: Extreme and High show red, Moderate amber, Low green. Change any cell you disagree with.

**E1. Which combinations are red, amber or green?**

| Likelihood ↓ / Consequence → | Negligible | Minor | Significant | Severe |
| --- | --- | --- | --- | --- |
| Very likely | Low | Moderate | High | Extreme |
| Likely | Low | Moderate | High | High |
| Somewhat likely | Low | Low | Moderate | Moderate |
| Unlikely | Low | Low | Low | Low |

**E2. How fast must each colour be acted on?**

| Colour | Act within (days) | Start value |
| --- | --- | --- |
| Red | | 30 |
| Amber | | 180 |
| Green | | Next planned cycle |

**E3.** What share of the network in red should trigger an alert to management? (%)

**E4.** Who may change a unit's colour after a field visit, and must they attach evidence? (Role · evidence yes/no)

**E5.** How often should the whole map be re-scored? (Monthly · quarterly · after each new survey)

## Part F — Constraints and goals for the strategy optimiser

These answers do not change any colour. They tell the optimiser (a mixed-integer linear program, MILP) what it may do, when, and with what money. The procurement department can fill F3–F4 later.

| # | Question | Answer format |
| --- | --- | --- |
| F1 | What should the plan aim for? | Pick one: most risk removed per euro · lowest expected cost of outages plus works · no red units left by a set date |
| F2 | What is the yearly budget? | € per year, total and per region |
| F3 | What does each type of work cost? | € per span or per hectare for: pruning · felling · corridor widening · mechanised clearing · monitoring only |
| F4 | How much contractor capacity is there? | Crew-days per region per month |
| F5 | When is work not allowed? | Months blocked for nesting season, fire season, snow, or high demand |
| F6 | How long do permits take? | Days for: hydrogeological restriction (vincolo idrogeologico) · Natura 2000 screening · landscape · owner notice |
| F7 | How hard is access? | Cost multiplier for: no road · steep slope · helicopter needed |
| F8 | What is the smallest job a contractor will take? | Minimum spans or km per job, and the maximum distance to bundle units into one job |
| F9 | Which actions are allowed? | Tick: prune · fell · widen corridor · replant with slow species · monitor only · engineering fixes such as insulated conductors (outside SPILE's scope) |
| F10 | Can you share a seasonal forecast? | Demand or traffic by month, to weight consequence (links to D4) |

## Part G — Consistency check and sign-off

The platform shows these checks after Parts B–F. They catch weights that look right on paper but colour the map wrongly.

- **G1. Swing ranking.** Picture two units identical except one criterion goes from its best to its worst value. Rank the five criteria whose swing worries you most. If the ranking clashes with your points in Part B, the platform flags it.
- **G2. Three test units.** The platform shows three real units from your network with their colour. For each: agree or disagree? If you disagree, which criterion is wrong?
- **G3. Hard rules.** Name any condition that makes a unit red whatever its score, for example vegetation inside the safety clearance (C1.1 high). A weighted score can hide one fatal condition, so these rules override it.
- **G4. Back-test.** Upload your vegetation outage log, if you have one. The platform reports how many past events fell in units it now marks red or amber.
- **G5. Sign-off.** Name, role, date, version of these answers, and the next review date.

## How the platform turns answers into the map

Each map unit gets a likelihood score from Parts B1 and C, a consequence score from B2 and D, and a colour from the Part E matrix. Hard rules (G3) are applied last.

1. **Score each criterion.** Low = 0, Medium = 0.5, High = 1. This is the value *v* for that criterion on that unit.
2. **Weight inside a domain.** Each criterion's weight is its importance divided by the sum of importances in its domain.
3. **Likelihood.** Domain points from B1 (divided by 100) times the weighted criteria, summed:

```latex
L_u = \sum_{d} \frac{P_d}{100} \sum_{c \in d} \frac{I_c}{\sum_{c' \in d} I_{c'}} \, v_c(u)
```

4. **Likelihood level.** L is split into four levels: Unlikely (under 0.25), Somewhat likely (0.25–0.5), Likely (0.5–0.75), Very likely (0.75 and over).
5. **Consequence.** The worst level across the B2 dimensions with 20 points or more, raised one level if D3 says the service cannot be rerouted.
6. **Colour.** Look up likelihood level × consequence level in the E1 matrix, then apply the G3 hard rules.

**The optimiser (Part F).** For each unit *u*, action *a* and month *t*, a yes/no variable *x* says whether to do it. The plan picks the set that removes the most risk, weighted by the month (D4), within budget and crew limits:

```latex
\max \sum_{u,a,t} \Delta R_{u,a}\, m_t \, x_{u,a,t} \quad \text{s.t.} \quad \sum_{u,a,t} c_{u,a}\, x_{u,a,t} \le B, \quad \sum_{u \in r,\,a} h_{u,a}\, x_{u,a,t} \le K_{r,t}, \quad \sum_{a,t} x_{u,a,t} \le 1
```

Here x = 0 is forced in blocked months (F5) and before permits are ready (F6). ΔR is the risk removed, m the month weight, c the cost (F3, F7), B the budget (F2), h the crew-days and K the capacity per region r (F4).

**Open question:** the weights come from one person. Before the pilot, check them with the G4 back-test, or have two or three risk managers answer and compare.

## Starting templates by sector

The answer to A1 pre-fills Part B with one of these columns. They are our starting assumptions, to be replaced by each company's answers.

| | Grid (Terna) | Rail (RFI) | Road (ANAS) | Hydro |
| --- | --- | --- | --- | --- |
| **B1 Vegetation hazard** | 50 | 50 | 55 | 40 |
| **B1 Site and terrain** | 20 | 25 | 25 | 40 |
| **B1 Weather and season** | 30 | 25 | 20 | 20 |
| **B2 Service interruption** | 35 | 30 | 25 | 35 |
| **B2 Safety of people** | 25 | 35 | 45 | 20 |
| **B2 Fire** | 20 | 15 | 10 | 10 |
| **B2 Asset damage** | 10 | 10 | 10 | 25 |
| **B2 Regulatory and reputation** | 10 | 10 | 10 | 10 |
| **Extra criteria to add in C4** | Ice sleeves on conductors · line shut-downs for nearby fires | Leaf fall on rails (loss of grip) · signal visibility · fire on embankments | Visibility at bends and junctions · tree falls on carriageway | Woody debris at intakes · landslides on penstock routes · reservoir bank trees |

## Sources

- [ISA Basic Tree Risk Assessment Form, V3](https://www.isa-arbor.com/Portals/0/Assets/PDF/Certification/Tree_Risk_Assessment_Form_V3.pdf) — likelihood and consequence scales, risk matrix (E1)
- [SIA protocol on tree stability](https://www.isaitalia.org/images/pdf/Protocollo_valutazione_di_stabilita.pdf) — failure-propensity classes A–D (C1.4)
- [Terna–RSE resilience methodology, Grid Code Annex A.76](https://arera.it/allegati/docs/22/009-22metodologiaResilienza.pdf) — exposure, vulnerability, energy not served
- [ARERA resilience guidelines, 2017](https://arera.it/allegati/docs/17/002-17dieu_alla.pdf) — risk index = probability × users cut off
- [E-Distribuzione development and resilience plan 2021–2023](https://www.e-distribuzione.it/content/dam/e-distribuzione/documenti/e-distribuzione/Piano_di_Sviluppo_delle_infrastrutture_di_EDistribuzione_2021_2023.pdf) — tree falls outside the corridor, wet snow above 600 m (C2.5)
- [Terna vegetation cutting report, Emilia-Romagna](https://serviziambiente.regione.emilia-romagna.it/vinca/screening/BO/2026_037_RER/Relazione.pdf) — safety distances of 5 m and 7 m under D.Lgs. 81/2008 (C1.1)
- [RFI project file on planting distances (DPR 753/80)](https://va.mite.gov.it/File/Documento/465874) — tree height + 2 m from the track; woods 50 m (C1.2)
- [Project file on road and rail setback strips](https://va.mite.gov.it/File/Documento/567373) — highway code: trees no closer than their maximum height (C1.2)
- [RFI vegetation management goals (Comune di Padova)](https://padovanet.it/gestione-verde-indesiderato-competenza-fs) — signal visibility, tree falls, fire (rail template)
- [Network Rail Lineside Vegetation Management Manual](https://www.networkrail.co.uk/wp-content/uploads/2020/04/Lineside-Vegetation-Management-Manual.pdf) — leaf fall and tree hazard forms (rail template)
- [NERC FAC-003-5, Transmission Vegetation Management](https://www.nerc.com/pa/Stand/Reliability%20Standards/FAC-003-5.pdf) — grow-in priority (C1.1)
- [ARERA decision on Grid Code Annex A.21](https://arera.it/fileadmin/allegati/docs/24/228-24.pdf) — line shut-downs for wildfires (grid template)
