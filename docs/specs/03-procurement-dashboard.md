# Procurement — dashboard and job assignment

Spec exported from the team doc (Nov 15, 2026). Screens 13–14 of the demo. PROJECT.md wins on any conflict.

Procurement turns each submitted cutting request into an assigned, paid and verified job. One table holds every request; one pop-up assigns it; the same row closes the loop for the risk manager and the regional operator.

## What procurement sees on login

Three panels. Procurement reads the first two and works in the third.

| Panel | Shows | Comes from |
| --- | --- | --- |
| Plan | Risk map, the optimiser's suggested strategy, yearly budget and how much is committed, blocked months | Risk manager (Parts E–F) |
| Request detail | The full cutting request for the selected row: map, photos, quantities, windows, access, permits, contacts | Regional operator (Steps 1–8) |
| Dashboard | One row per request, sortable and filterable, with assignment, ordering, invoice and completion columns | Procurement's own work |

Procurement can view the plan and the request but not change them. Anything wrong goes back to the operator with "Return for information".

## The dashboard table

One row per cutting request, sorted by deadline by default. Columns are grouped so procurement reads left to right: what, when, who, money, done.

| Group | Column | What it shows | Filled by |
| --- | --- | --- | --- |
| What | Request ID | Link that opens the request detail | Platform |
| What | Region · asset | Region, line or track or road, units | Operator |
| What | Risk | Colour and score | Risk model |
| What | Scope | Trees to fell and prune, ha or km, main actions | Operator |
| What | Flags | Icons: outage needed · permits pending · owner not reached · helicopter or cable crane | Platform |
| When | Window | Earliest start → deadline, and outage windows | Operator |
| When | Status | Submitted · returned · in procurement · assigned · work done · verified · closed | Platform |
| Who | Contractor | Assigned company, with a "send work order" button | Procurement |
| Who | Planned dates | Start and end agreed with the contractor | Procurement |
| Money | Estimate (€) | Quantities × unit rates, plus access multiplier | Platform |
| Money | Order value (€) | Agreed price | Procurement |
| Money | Order number | Purchase order number from the company's own system | Procurement |
| Money | Invoice | Received · matched · disputed · paid | Platform + procurement |
| Done | Evidence | Contractor's completion photos and quantities done | Contractor |
| Done | Verified | Operator's sign-off and date | Operator |

**Sample rows** (invented for illustration)

| Request | Region · asset | Risk | Scope | Window | Status | Contractor | Estimate (€) | Invoice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CR-0142 | VCO · 380 kV line, spans 41–44 | Red | 38 fell, 12 prune, 1.6 ha | 20 Nov → 15 Dec | In procurement | — | 14,200 | — |
| CR-0139 | VCO · 132 kV line, spans 7–9 | Red | 9 fell, 0.4 ha | 25 Nov → 10 Dec | Assigned | Forestry firm A | 4,100 | — |
| CR-0131 | Novara · 220 kV line, spans 18–22 | Amber | 25 prune, 2.1 ha | 1 Nov → 30 Jan | Verified | Forestry firm B | 9,800 | Matched |

## Assigning a job

Clicking "Procure resources" on a row opens a pop-up in four steps. The platform proposes; procurement decides.

**Step 1 — Choose the contractor**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| P1.1 | Suggested contractors | Ranked list: covers this region · holds the qualifications in Step 5.4 · free in the window · past score | Shown |
| P1.2 | Contractor chosen | Pick from the company's qualified suppliers (e.g. registered in the regional forestry firms list) | Yes |
| P1.3 | Reason if not the top suggestion | Text | If not first |

**Step 2 — Contract route and price**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| P2.1 | Contract route | Call-off from an existing framework agreement · direct award · request for quotes · tender | Yes |
| P2.2 | Framework agreement | Agreement ID, unit rates pulled in | If call-off |
| P2.3 | Quotes received | Up to 3 uploads + amounts | If request for quotes |
| P2.4 | Price basis | Unit rates (€/tree, €/ha, €/day) · lump sum | Yes |
| P2.5 | Order value | €, compared with the estimate and the remaining budget line | Yes |
| P2.6 | Approval needed? | Shown automatically when the value exceeds the buyer's limit | Shown |

**Step 3 — Schedule**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| P3.1 | Planned start and end | Dates; must sit inside the operator's window and outage windows | Yes |
| P3.2 | Site meeting before start | Date + who attends | No |
| P3.3 | Bundle with nearby requests | Tick other rows for the same contractor and trip | No |

**Step 4 — Documents**

| # | Field | Format | Required |
| --- | --- | --- | --- |
| P4.1 | Work order | Generated from the request: scope, map, windows, access, contacts | Auto |
| P4.2 | Safety documents | Contractor's safety plan, qualifications, insurance | Yes |
| P4.3 | Permits and owner consents | Attached from Step 7 of the request | Auto |
| P4.4 | Purchase order number | From the company's own purchasing system | Yes |

**Check with Terna:** as a utility, Terna buys under the special-sector procurement rules and its own supplier qualification system. The routes in P2.1 must match theirs, and SPILE should hand the order to their purchasing system rather than replace it.

## Sending the work order and handling the invoice

The platform sends the order and prepares the paperwork; the contractor still issues the invoice. In Italy invoices between companies are electronic and pass through the national exchange system (SdI), so SPILE checks invoices rather than writing them.

1. **Send.** "Send work order" emails the contractor a PDF plus a link to a contractor view of the job: map, windows, contacts, upload buttons. The contractor accepts or proposes new dates.
2. **Report.** The contractor marks start, progress and completion, with geotagged photos and quantities done.
3. **Statement of work.** On completion the platform drafts the statement of work done: quantities × agreed rates. The contractor invoices against it.
4. **Match.** When the invoice arrives, the platform compares three things: order, verified work and invoice. Matching → "Matched", ready to pay. Different → "Disputed", with the difference shown line by line.
5. **Pay.** Payment stays in the company's own finance system; SPILE records "Paid" and the date.

## Closing the loop

A job is closed only when three things are true: the operator has verified the site, the map has been re-scored, and the invoice is matched.

- **Verification.** The operator checks the contractor's evidence, visits if needed, and signs off. A failed check reopens the job with the contractor.
- **Re-scoring.** The units drop to their new colour, using the new clearance and last-cut date. The risk manager sees the risk removed and the euros spent for that job.
- **Monitoring after closure.** Each new satellite or LiDAR pass re-checks the units. If regrowth or a new hazard pushes a unit back to amber or red, the platform alerts the operator and links the new alert to the closed job.
- **Contractor score.** Each closed job records on time or late, cost against estimate, and rework needed. The score feeds the ranking in P1.1.

**Dashboard numbers for procurement:** jobs open by status, on-time share, cost per hectare against estimate, budget committed and remaining, and invoices disputed.

## Who sees what, and when

Every status change on a row notifies the people who need it. Nobody re-types anything.

| Event | Risk manager | Regional operator | Procurement | Contractor |
| --- | --- | --- | --- | --- |
| Request submitted | Count rises on the plan | Confirmation | New row | — |
| Returned for information | — | Task with the question | Waiting | — |
| Job assigned | Budget committed updates | Contractor and dates | Row assigned | Work order email |
| Contractor proposes new dates | — | Asked to accept | Asked to accept | Waiting |
| Work done reported | — | Asked to verify | Statement drafted | Confirmation |
| Verified | Risk removed and cost added; map re-scored | Unit turns green or amber | Ready to match invoice | Notified |
| Invoice matched or disputed | Spend final | — | Pay or resolve | Paid or query |
| Regrowth alert after closure | Map changes colour | New alert, linked to the old job | Contractor's rework clause flagged | — |
