# Regional operator — cutting request

Spec exported from the team doc (Nov 14, 2026). Screens 10–11 of the demo. PROJECT.md wins on any conflict.

The regional operator turns a red area on the map into a work request that procurement can price and assign without calling back. The pop-up has eight short steps; about half the fields are pre-filled by the platform.

## Why the regional operator files the request

The risk map is a model; the regional operator is the ground truth. They are the only one of the three users who knows all of these:

- **What is really there:** they can confirm or correct the map after a site visit.
- **When the asset can be touched:** they plan line outages, track possessions (rail) or lane closures (road) with dispatch.
- **How to get in:** tracks, gates, slopes, who holds the keys, which landowner to call.
- **What permits and owners are involved locally:** comune, Region office, park authority.
- **Who on their team supervises the site** on the day.

The operator does not choose the contractor or the price. That is procurement's job, so the form asks for quantities and constraints, not costs.

## What the platform pre-fills

When the operator taps a red or amber area, the pop-up opens with these already filled. The operator can correct any of them in step 2.

| Pre-filled field | Comes from |
| --- | --- |
| Request ID, date, requester name and region | Login |
| Units selected (spans, tower numbers or km markers) and a polygon of the area | Map selection |
| Asset: line name and voltage, track or road ID | Company asset register (Part A) |
| Risk colour, score and the top three criteria driving it | Risk model (risk manager's questionnaire) |
| Deadline to act | Response time for that colour (Part E2) |
| Corridor length (m) and area to clear (ha) | Map geometry |
| Estimated trees inside clearance and within fall-in reach | LiDAR or satellite canopy model |
| Land ownership per parcel: own corridor, easement, third party | Cadastral layer |
| Permits likely needed: hydrogeological restriction, Natura 2000, landscape | Overlay of protected-area layers |
| Blocked months: nesting, fire season, high demand | Part F5 |
| Last cut date and past vegetation outages here | Cut records and outage log |

## The pop-up form

Eight steps, one screen each. *Pre-filled* means the platform proposes a value the operator confirms or changes.

**Step 1 — Scope**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 1.1 | Units included | Add or remove units on the map (*pre-filled*) | Yes |
| 1.2 | Request type | Risk-driven from map · planned maintenance · urgent after inspection · emergency after an event | Yes |
| 1.3 | Linked event | Outage or incident ID | If emergency |
| 1.4 | Short description | Text, 300 characters | Yes |

**Step 2 — Field check**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 2.1 | Site visited? | Yes + date · no, desk check only | Yes |
| 2.2 | Is the map colour right? | Agree · should be higher · should be lower, + reason | Yes |
| 2.3 | Photos | Upload, at least 2 | If visited |
| 2.4 | Trees to fell | Number (*pre-filled* estimate) | Yes |
| 2.5 | Trees to prune | Number (*pre-filled* estimate) | Yes |
| 2.6 | Typical tree size | Height: under 10 m · 10–20 m · over 20 m; trunk: under 20 cm · 20–40 cm · over 40 cm | Yes |
| 2.7 | Main species | Pick from the forest-map list | No |
| 2.8 | Hazard trees outside the corridor | Count + pins on the map | No |
| 2.9 | Tree survey attached | Upload ISA or SIA form | No |

**Step 3 — Work needed**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 3.1 | Actions | Tick: prune · fell · clear undergrowth · widen corridor · remove fallen tree · treat stumps | Yes |
| 3.2 | Clearance to reach after the work | Metres (default from company rule) | Yes |
| 3.3 | Area or length per action | ha or m (*pre-filled*) | Yes |
| 3.4 | What happens to the wood | Leave on site · chip on site · take away · hand to the landowner | Yes |
| 3.5 | Follow-up | Replant with slow-growing species · monitor · none | No |

**Step 4 — Timing**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 4.1 | Priority | Emergency (48 h) · urgent · planned (*pre-filled* from colour) | Yes |
| 4.2 | Must be done by | Date (*pre-filled* deadline) | Yes |
| 4.3 | Earliest start | Date | Yes |
| 4.4 | Preferred windows | Date ranges | No |
| 4.5 | Dates to avoid, and why | Date ranges + reason (*pre-filled* blocked months) | No |
| 4.6 | Estimated duration | Working days | Yes |

**Step 5 — Safety and asset constraints**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 5.1 | Must the asset be taken out of service? | Line outage · track possession · lane or road closure · no | Yes |
| 5.2 | Agreed outage windows | Date-time ranges confirmed with dispatch | If 5.1 is not "no" |
| 5.3 | Work near live parts? | Yes + minimum approach distance (m) · no | Grid: yes |
| 5.4 | Qualified staff needed | Tick: electrical-risk qualified (Italy: CEI 11-27, to confirm) · tree climbers · traffic marshals · rail lookouts | Yes |
| 5.5 | Other networks on site | Gas · water · telecom · none | No |
| 5.6 | Public exposure | None · path or road nearby · houses within one tree height | Yes |
| 5.7 | Operator's site supervisor | Name + phone | Yes |

**Step 6 — Access and logistics**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 6.1 | Access | Paved road · forest track · on foot only · helicopter | Yes |
| 6.2 | Distance from the last vehicle point | Metres | Yes |
| 6.3 | Largest vehicle that can reach the site | Car · 4×4 · truck · tracked machine | Yes |
| 6.4 | Slope at the work site | Under 35% · over 35% (*pre-filled*) | Yes |
| 6.5 | Gates, keys, access agreements | Text | No |
| 6.6 | Equipment likely needed | Tick: chainsaws · aerial platform · climbing kit · forestry mulcher · crane · cable crane · helicopter | Yes |
| 6.7 | Crew estimate | People × days | Yes |
| 6.8 | Staging and wood storage area | Pin on the map | No |

**Step 7 — Land, permits and environment**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 7.1 | Ownership per parcel | Confirm: own corridor · easement · third party (*pre-filled*) | Yes |
| 7.2 | Owner contact per third-party parcel | Not needed · notified + date · consent received · unreachable | If third party |
| 7.3 | Permits needed | Tick: hydrogeological restriction · Natura 2000 screening · landscape · protected tree · park authority (*pre-filled*) | Yes |
| 7.4 | Status of each permit | Not started · submitted + date · granted + upload | Yes |
| 7.5 | Ecological constraints seen | Nesting birds · protected species · watercourse within 10 m · none | Yes |
| 7.6 | Fire-season rules in force? | Yes · no | In fire season |

**Step 8 — Contacts and hand-over**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| 8.1 | Local contacts | Name, role (comune, landowner, park), phone | No |
| 8.2 | Budget line | Pick from the company's cost centres | Yes |
| 8.3 | Notes for procurement | Text | No |
| 8.4 | Confirmation | "The site details are accurate to my knowledge" | Yes |

## Rules the form enforces

The form blocks a submit that procurement could not act on.

- **No submit without the required fields.** Conditional fields ("If …") become required when their trigger is ticked.
- **Downgrading a red unit needs evidence.** Step 2.2 "should be lower" requires photos and a reason, and the risk manager is notified (Part E4).
- **Dates must fit.** The earliest start must come after permits are expected to be granted; outage windows must fall inside the work window. A clash shows a warning, not a block.
- **Hard rules stay red.** A unit flagged by a hard rule (Part G3) can't be marked "no action".
- **Draft and bundle.** The operator can save a draft, and can bundle neighbouring units into one request so contractors get a viable job.

**Status flow**

1. Draft — the operator is filling it in.
2. Submitted — locked for the operator; visible to procurement.
3. Returned for information — procurement asks a question; back to the operator.
4. In procurement — being priced and assigned.
5. Assigned — contractor and dates set.
6. Work done — the contractor reports completion with photos.
7. Verified — the operator confirms on site; the unit's colour is re-scored.

## What the request hands to procurement

Procurement receives one row per request with everything needed to write a work order. The procurement pop-up will start from these fields.

| Procurement needs | Taken from |
| --- | --- |
| Scope of work: actions, quantities, clearance target, wood handling | Steps 2–3 |
| Time window and deadline | Step 4 |
| Outage or closure windows and safety qualifications | Step 5 |
| Access, equipment and crew size, for pricing | Step 6 |
| Permit and owner status, for the start date | Step 7 |
| Budget line and contacts | Step 8 |

**Open question for the team:** should the operator see the optimiser's suggested strategy (Part F) before filing, or only the risk colour? Showing it saves time but may anchor the operator's judgement.
