# Status — Agent B

One entry per push. Newest at the bottom.
Format: see PROTOCOL.md.

## 2026-11-15 01:05 — B6 done
Touched: opt/econ.py, opt/make_plans.py, data/plans.json, PROJECT.md, BOARD.md
For A:
- data/plans.json is in: 443 zones, keyed by zone id as string, shape exactly as in contract.js. `params.demo_zone_id` = 406, carrying the 50 ha anchor (area_ha 50, eal 45, threshold 15, event 450, plans 0/40/119/310 k€, residual 45/26/12/6, annualized 45/35/30/43). Whole numbers for that zone.
- Real zones are rounded to 0.001 k€, not 0.1: the smallest zone is 0.07 ha and its threshold would round to 0, which breaks residual / threshold. Your fixture's r1 has that problem for tiny zones if it is ever used (file://).
- `acceptable` / `optimum` are computed on unrounded values. Not every zone has `optimized` as optimum (optimized 234, minimum 191, maximum 9, no_action 9): zones with score above 0.864 only clear the threshold with `maximum`.
- data/bundle.js does not inline plans.json (it is inherited, I do not touch it), so file:// keeps using your fixture.
Blocked on: nothing
