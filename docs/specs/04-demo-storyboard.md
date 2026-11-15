# Demo storyboard — 45-second video

Spec exported from the team doc (Nov 15, 2026). PROJECT.md wins on any conflict, including screen numbering. Slogan: "For Reliable Infrastructure".

One place on the map goes through the whole cycle in 44 seconds: risk scored, plan saved, cut requested, contractor assigned. Fifteen screens means about 3 seconds each, so role pickers and loading screens get 1–1.5 seconds and the time goes to the map and the pop-ups.

## Storyboard and script

Each panel is a full screen. A voice-over line can run across several panels; "…" means the line carries on.

| # | Time (s) | Screen | What the viewer sees | Voice-over |
| --- | --- | --- | --- | --- |
| 1 | 0–3 | Role picker | Three profile cards side by side: risk manager, regional operator, procurement | "Three users. One platform. From vegetation risk to clearance." |
| 2 | 3–4 | Login | Risk manager card expands into a login; credentials autofill | "The risk manager sets the company's risk priorities… |
| 3 | 4–8 | Questionnaire | Points slider across the three domains moves; "Fall-in reach" (tree taller than its distance to the line) clicks to importance 5 | …in one questionnaire." |
| 4 | 8–9.5 | Loading | Friend's loading design (handover) | "From those priorities, SPILE scores every span… |
| 5 | 9.5–13 | Risk map | Corridors fade in red, amber, green; compass top right | …high, medium or low risk." |
| 6 | 13–17 | Area detail | Tap one red corridor; camera tilts to 3D; side card: area, vegetation, species; flood, fire, fault risk at the bottom, with Fault showing "Fall-in reach: 14 trees taller than their distance to the line" highlighted and those trees glowing in 3D; button "Create plan for selected areas" | "One tap: the trees, and the flood, fire and fault risk." |
| 7 | 17–18.5 | Optimiser running | Friend's MILP loading design (handover) | "Our optimiser builds the management plan within budget… |
| 8 | 18.5–21.5 | Plan result | Proposed actions, cost and months → Save; first ring segment fills | …Saved." |
| 9 | 21.5–22.5 | Role picker | Regional operator card highlighted | "The regional operator sees the plan on the map… |
| 10 | 22.5–25.5 | Operator map | Same map, now with one pin; ring shows Plan done | … |
| 11 | 25.5–30.5 | Cutting request | Tap pin → "Request cutting job?" → pop-up fills fast → Save; second segment fills | …and requests the cut in one form." |
| 12 | 30.5–31.5 | Role picker | Procurement card highlighted | "Procurement sees both… |
| 13 | 31.5–34.5 | Procurement map | Same pin, two segments full; button "Procure resources?" | … |
| 14 | 34.5–39.5 | Assignment | Pop-up: contractor picked, dates set → Done; dashboard row turns "Assigned" | …assigns a qualified contractor and sends the work order." |
| 15 | 39.5–44.5 | Final map | Split screen, three thin views, same pin updating in all three; third segment partly full, "verified" and "paid" faded | "Every role sees the same pin update live." |

## Full voice-over

About 95 words, which is 40–45 seconds at a calm pace. Record it first, then cut the screens to the audio.

> Three users. One platform. From vegetation risk to clearance.
>
> The risk manager sets the company's risk priorities in one questionnaire. From those priorities, SPILE scores every span: high, medium or low risk.
>
> One tap: the trees, and the flood, fire and fault risk. Our optimiser builds the management plan within budget. Saved.
>
> The regional operator sees the plan on the map, and requests the cut in one form.
>
> Procurement sees both, assigns a qualified contractor and sends the work order.
>
> Every role sees the same pin update live.

## Map and pin rules

- Risk lies along corridors, so the corridor itself carries the risk colour (red, amber, green).
- Pins appear only where there is an active plan, request or job. Zoomed out, pins group with a count, e.g. "VCO: 12 red, 4 in procurement".
- Each pin has a progress ring: Plan → Request → Procurement (assigned → done and verified → paid). Colour = risk, ring = progress; never mix the two.
- 2D for overviews; tilt to 3D only when zooming into one area.
- All three roles see the same pins in real time, with a different default filter (risk manager: everything; operator: own region; procurement: requested and assigned). Pins needing the current user's action pulse.
- A finished pin fades to "Cleared <date> · next check <month>" and comes back if monitoring flags regrowth.

## Clean-screen rules for every panel

The viewer gets about 3 seconds per screen, so each screen must say one thing.

- **One action per screen.** Show the cursor or a tap ring on the one thing being pressed.
- **One caption at most,** five words or fewer, placed where the eye already is. The voice-over carries the rest.
- **The same place all the way through.** Same corridor, same pin, same camera start, so the viewer follows one job.
- **Two signals only.** Colour on the corridor means risk; the ring on the pin means progress. No other colours on the map.
- **No real data or logos you don't own.** Label the map "demo data" in a corner; no Terna logo unless they agree to it.
- **Pop-ups filled fast-forward.** Show fields filling in about 2 seconds; the judges need the idea, not each field.
- **One accent colour per role** on the role picker and the top bar, so each switch of user reads at a glance.
- **3D only from panel 6.** Overview maps stay flat; tilt when zooming into the area.

## Decisions taken

1. **Plan for a selection, not one area.** The optimiser exists to split one budget and one set of crews across many areas. The button in panel 6 reads "Create plan for selected areas", with a lasso or "whole region" option. The demo selects one area. Final wording depends on the optimiser handover.
2. **Tie panel 6's risks to the questionnaire.** Under each of flood, fire and fault, show the criteria driving it. The criterion clicked to 5 in panel 3 is Fall-in reach, and panel 6 shows it again under Fault, so the viewer sees that one click shape the map.
3. **End on real-time proof.** Panel 15 splits into three thin views, one per role, with the same pin updating in all three at once.

## Waiting on the handover

- [ ] Panel 4: loading screen design and prompt
- [ ] Panel 7: optimiser loading screen design
- [ ] Panel 8: what the plan result shows: actions, cost, months, risk removed
- [ ] Overall design style: colours, type, the three role accents
- [ ] One-line description of the optimiser for the pitch
