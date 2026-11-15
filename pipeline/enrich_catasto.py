"""Arricchimento catastale: per le N zone a punteggio piu' alto interroga il WMS
INSPIRE dell'Agenzia delle Entrate (GetFeatureInfo su CP.CadastralParcel) nel
centroide della zona e salva foglio/particella in zones.geojson.

Il download massivo GML (ATOM/WFS) dell'AdE risulta non raggiungibile al momento
della scrittura (HTTP 500 / SOAP fault): il WMS, interrogato punto per punto, e'
l'alternativa gratuita e senza registrazione.
"""
import json
import re
import sys
import time

import requests

from config import DATA, USER_AGENT

WMS = "https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php"
N_ZONES = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 120
DELAY = 0.35


def query_parcel(lon, lat, session):
    d = 0.0008
    params = {
        "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetFeatureInfo",
        "LAYERS": "CP.CadastralParcel", "QUERY_LAYERS": "CP.CadastralParcel",
        "CRS": "EPSG:6706", "BBOX": f"{lat - d},{lon - d},{lat + d},{lon + d}",
        "WIDTH": 101, "HEIGHT": 101, "I": 50, "J": 50,
        "INFO_FORMAT": "text/html", "FEATURE_COUNT": 1,
    }
    r = session.get(WMS, params=params, timeout=30, headers={"User-Agent": USER_AGENT})
    r.raise_for_status()
    m = re.search(r"NationalCadastralReference</th><td>([^<]+)</td>", r.text)
    if not m:
        return None
    ref = m.group(1).strip()            # es. L746_007400.224  -> foglio 74, particella 224
    m2 = re.match(r"([A-Z]\d{3})_(\d{4})(\d{2})\.(.+)", ref)
    if not m2:
        return {"ref": ref}
    comune, foglio, sub, part = m2.groups()
    return {"ref": ref, "comune": comune, "foglio": int(foglio), "sub": sub, "particella": part}


def main():
    zp = DATA / "zones.geojson"
    zones = json.loads(zp.read_text(encoding="utf-8"))
    feats = sorted(zones["features"], key=lambda f: f["properties"]["rank"])[:N_ZONES]
    ok = fail = 0
    s = requests.Session()
    t0 = time.time()
    for f in feats:
        p = f["properties"]
        try:
            res = None
            for attempt in range(3):          # il WMS a volte risponde con una feature vuota
                res = query_parcel(p["lon"], p["lat"], s)
                if res:
                    break
                time.sleep(1.0 + attempt)
            if res:
                p["catasto"] = res
                ok += 1
            else:
                fail += 1
        except Exception as e:  # noqa
            fail += 1
            print(f"  zona {p['id']}: {e}", file=sys.stderr)
            if fail > 10 and ok == 0:
                break
        time.sleep(DELAY)
    zp.write_text(json.dumps(zones), encoding="utf-8")
    sp = DATA / "stats.json"
    stats = json.loads(sp.read_text(encoding="utf-8"))
    stats["sources"]["catasto_ade"] = {
        "ok": ok > 0, "label": "Catasto AdE (WMS INSPIRE)",
        "detail": f"{ok} zone con particella, {fail} senza" if ok else "WMS non raggiungibile"}
    stats["catasto"] = {"zones_with_parcel": ok, "zones_queried": len(feats)}
    sp.write_text(json.dumps(stats, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"catasto: {ok} ok, {fail} falliti su {len(feats)} zone in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
