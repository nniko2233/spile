"""SPILE economic constants. One place, plain Python, no solver.

PROTOTYPE FIGURES, NOT CALIBRATIONS. Orders of magnitude chosen so the 50 ha
reference scenario of PROJECT.md comes out as stated there. Event probabilities
are not derived from local time series. Mirrors PROJECT.md, "Economic model".
"""

# Expected annual loss with no action: EAL = EAL_K_PER_HA * area_ha * (score / SCORE_REF)  [k€/yr]
EAL_K_PER_HA = 0.9          # k€/ha/yr at the reference score
SCORE_REF = 0.7             # zone score at which EAL_K_PER_HA applies

# Acceptance threshold, the "green" level: threshold = THRESHOLD_K_PER_HA * area_ha  [k€/yr]
THRESHOLD_K_PER_HA = 0.30

# Capital recovery factor, 3% over 20 years. Mirrors SPILE.ANNUALIZATION in app/contract.js.
ANNUALIZATION = 0.0672

# Single wildfire event, for screen 6: 18 k€/ha (PROJECT.md) on the share of the
# zone expected to burn in one event. 18 * 0.5 * 50 ha = 450 k€.
FIRE_COST_K_PER_HA = 18.0
FIRE_BURNT_SHARE = 0.5

# The 50 ha reference scenario is pinned on one real zone (A's choice, see PROJECT.md).
DEMO_ZONE_ID = 406
DEMO_AREA_HA = 50.0
DEMO_SCORE = 0.7

# Display order = contract SPILE.PLAN_IDS.
PLAN_IDS = ["no_action", "minimum", "optimized", "maximum"]

_MIN = ["ROW vegetation management", "Access tracks"]
_OPT = _MIN + ["Insulated conductor on the critical spans",
               "Check dams and drainage works", "Water points", "Monitoring"]
_MAX = _OPT + ["Full line undergrounding"]

# capex_ha [k€/ha], opex_ha [k€/ha/yr], residual = share of EAL left after the plan
PLANS = {
    "no_action": dict(label="No action", capex_ha=0.00, opex_ha=0.00, residual=1.00, actions=[]),
    "minimum": dict(label="Minimum plan (ROW + access)", capex_ha=0.80, opex_ha=0.12, residual=0.58, actions=_MIN),
    "optimized": dict(label="Optimized plan (MILP)", capex_ha=2.38, opex_ha=0.20, residual=0.27, actions=_OPT),
    "maximum": dict(label="Maximum plan (undergrounding)", capex_ha=6.20, opex_ha=0.32, residual=0.13, actions=_MAX),
}
