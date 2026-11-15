"""Write data/plans.json for every zone of data/zones.geojson.

Plain Python, standard library only. No PuLP, no scipy, no solver: the plans are
the closed formulas of PROJECT.md ("Economic model"), constants in opt/econ.py.

Run from anywhere:  python opt/make_plans.py
"""
import json
import math
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import econ  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZONES = os.path.join(ROOT, "data", "zones.geojson")
OUT = os.path.join(ROOT, "data", "plans.json")


def rnd(x, nd):
    """Round half up (Python's round() is banker's), after killing float noise."""
    f = 10 ** nd
    v = math.floor(round(x * f, 6) + 0.5) / f
    return int(v) if nd == 0 else v


def zone_plans(zone_id, area_ha, score):
    # Whole k€ from 10 ha up (the precision of the PROJECT.md table), 0.001 k€ (1 €)
    # below: real zones go down to a few hundred m2 and must keep a non-zero
    # threshold, because the map divides residual by threshold.
    nd = 0 if area_ha >= 10 else 3
    eal = econ.EAL_K_PER_HA * area_ha * (score / econ.SCORE_REF)
    threshold = econ.THRESHOLD_K_PER_HA * area_ha

    plans = []
    for pid in econ.PLAN_IDS:
        p = econ.PLANS[pid]
        capex = p["capex_ha"] * area_ha
        opex = p["opex_ha"] * area_ha
        residual = p["residual"] * eal
        annualized = capex * econ.ANNUALIZATION + opex + residual
        plans.append({
            "id": pid,
            "label": p["label"],
            "capex_k": rnd(capex, nd),
            "opex_k_yr": rnd(opex, nd),
            "residual_k_yr": rnd(residual, nd),
            "annualized_k_yr": rnd(annualized, nd),
            "acceptable": residual <= threshold + 1e-9,
            "optimum": False,
            "actions": list(p["actions"]),
            "_ann": annualized,
        })

    ok = [p for p in plans if p["acceptable"]]
    if ok:
        min(ok, key=lambda p: p["_ann"])["optimum"] = True
    for p in plans:
        del p["_ann"]

    return {
        "zone_id": zone_id,
        "area_ha": area_ha,
        "eal_k_yr": rnd(eal, nd),
        "threshold_k_yr": rnd(threshold, nd),
        "event_cost_k": rnd(econ.FIRE_COST_K_PER_HA * econ.FIRE_BURNT_SHARE * area_ha, nd),
        "plans": plans,
    }


def check_anchor(zp):
    """The 50 ha table of PROJECT.md, screen 7. Must come out exact."""
    want = {  # id: (capex, opex, residual, annualized, acceptable, optimum)
        "no_action": (0, 0, 45, 45, False, False),
        "minimum": (40, 6, 26, 35, False, False),
        "optimized": (119, 10, 12, 30, True, True),
        "maximum": (310, 16, 6, 43, True, False),
    }
    assert (zp["area_ha"], zp["eal_k_yr"], zp["threshold_k_yr"], zp["event_cost_k"]) == (50, 45, 15, 450), zp
    for p in zp["plans"]:
        got = (p["capex_k"], p["opex_k_yr"], p["residual_k_yr"], p["annualized_k_yr"], p["acceptable"], p["optimum"])
        assert got == want[p["id"]], (p["id"], got, want[p["id"]])


def main():
    with open(ZONES, encoding="utf-8") as fh:
        feats = json.load(fh)["features"]

    zones = {}
    for f in feats:
        z = f["properties"]
        if z["id"] == econ.DEMO_ZONE_ID:
            zp = zone_plans(z["id"], int(econ.DEMO_AREA_HA), econ.DEMO_SCORE)
            check_anchor(zp)
        else:
            zp = zone_plans(z["id"], z["area_ha"], z["score"])
        zones[str(z["id"])] = zp
    assert str(econ.DEMO_ZONE_ID) in zones, "demo zone missing from zones.geojson"

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "params": {
            "demo_zone_id": econ.DEMO_ZONE_ID,
            "demo_area_ha": econ.DEMO_AREA_HA,
            "demo_score": econ.DEMO_SCORE,
            "eal_k_per_ha": econ.EAL_K_PER_HA,
            "score_ref": econ.SCORE_REF,
            "threshold_k_per_ha": econ.THRESHOLD_K_PER_HA,
            "annualization": econ.ANNUALIZATION,
            "fire_cost_k_per_ha": econ.FIRE_COST_K_PER_HA,
            "fire_burnt_share": econ.FIRE_BURNT_SHARE,
            "plans": {k: {"capex_ha": v["capex_ha"], "opex_ha": v["opex_ha"], "residual": v["residual"]}
                      for k, v in econ.PLANS.items()},
            "note": "Prototype figures, not calibrations. Precomputed, no solver.",
        },
        "zones": zones,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    opt = {}
    for zp in zones.values():
        o = next((p["id"] for p in zp["plans"] if p["optimum"]), None)
        opt[o] = opt.get(o, 0) + 1
    print("wrote %s: %d zones, optimum by plan: %s" % (os.path.relpath(OUT, ROOT), len(zones), opt))
    print("anchor zone %d OK" % econ.DEMO_ZONE_ID)


if __name__ == "__main__":
    main()
