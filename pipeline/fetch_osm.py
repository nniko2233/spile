"""Scarica confine e infrastrutture di Verbania da OpenStreetMap (Overpass).

Output (in cache/): osm_boundary.json, osm_assets.json, osm_buildings.json
Output (in data/):  boundary.geojson
"""
import json
import time
import sys

import requests
import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, shape
from shapely.ops import linemerge, unary_union, polygonize

from config import (CACHE, DATA, OSM_RELATION_ID, OVERPASS_ENDPOINTS,
                    USER_AGENT, CRS_METRIC)

STATUS = {}


def overpass(query, cache_name, force=False):
    path = CACHE / cache_name
    if path.exists() and not force:
        return json.loads(path.read_text(encoding="utf-8"))
    last_err = None
    for attempt in range(2):
        for ep in OVERPASS_ENDPOINTS:
            try:
                r = requests.post(ep, data={"data": query},
                                  headers={"User-Agent": USER_AGENT}, timeout=240)
                if r.status_code == 200 and r.text.lstrip().startswith("{"):
                    js = r.json()
                    path.write_text(json.dumps(js), encoding="utf-8")
                    print(f"  [overpass] {cache_name}: {len(js['elements'])} elementi da {ep}")
                    return js
                last_err = f"{ep} -> HTTP {r.status_code}"
            except Exception as e:  # noqa
                last_err = f"{ep} -> {e}"
            print(f"  [overpass] fallito {last_err}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Overpass non raggiungibile: {last_err}")


def build_boundary(js):
    """Assembla il poligono del comune dalle way outer della relation."""
    lines = []
    for el in js["elements"]:
        if el["type"] == "relation":
            for m in el.get("members", []):
                if m["type"] == "way" and m.get("role") in ("outer", "") and "geometry" in m:
                    lines.append(LineString([(p["lon"], p["lat"]) for p in m["geometry"]]))
    merged = linemerge(unary_union(lines))
    polys = list(polygonize(merged))
    if not polys:
        raise RuntimeError("Impossibile chiudere il confine comunale")
    geom = unary_union(polys)
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    return geom


def el_geometry(el):
    if el["type"] == "node":
        return Point(el["lon"], el["lat"])
    if el["type"] == "way" and "geometry" in el:
        pts = [(p["lon"], p["lat"]) for p in el["geometry"]]
        if len(pts) >= 4 and pts[0] == pts[-1] and el.get("tags", {}).get("building"):
            return Polygon(pts)
        if len(pts) >= 2:
            return LineString(pts)
    if "center" in el:
        return Point(el["center"]["lon"], el["center"]["lat"])
    return None


def classify(tags):
    p = tags.get("power")
    if p in ("line", "minor_line"):
        v = 0
        for tok in str(tags.get("voltage", "")).replace(",", ";").split(";"):
            try:
                v = max(v, int(float(tok.strip())))
            except ValueError:
                pass
        if p == "line" and (v >= 60000 or v == 0):
            return "power_hv", v or None
        return "power_mv", v or None
    if p in ("tower", "pole"):
        return "power_support", None
    if p == "substation":
        return "substation", None
    if p == "plant":
        return "plant_hydro" if tags.get("plant:source") == "hydro" else "plant_other", None
    if p == "generator":
        return "generator_hydro" if tags.get("generator:source") == "hydro" else "generator_other", None
    rw = tags.get("railway")
    if rw in ("rail", "narrow_gauge"):
        return "rail", None
    if rw in ("station", "halt"):
        return "station", None
    hw = tags.get("highway")
    if hw in ("trunk", "primary", "secondary"):
        return f"road_{hw}", None
    if hw:
        return "road_minor", None
    ww = tags.get("waterway")
    if ww in ("river", "stream", "canal"):
        return "waterway", None
    return None, None


def main(force=False):
    print("[1/3] confine comunale")
    bjs = overpass(f"[out:json][timeout:120];relation({OSM_RELATION_ID});out geom;",
                   "osm_boundary.json", force)
    boundary = build_boundary(bjs)
    gb = gpd.GeoDataFrame({"name": ["Verbania"]}, geometry=[boundary], crs="EPSG:4326")
    gb.to_file(DATA / "boundary.geojson", driver="GeoJSON")
    minx, miny, maxx, maxy = gb.to_crs(CRS_METRIC).buffer(1500).to_crs("EPSG:4326").total_bounds
    bbox = f"{miny:.5f},{minx:.5f},{maxy:.5f},{maxx:.5f}"
    print(f"  bbox esteso: {bbox}")

    print("[2/3] infrastrutture (bbox + 1.5 km, poi ritaglio)")
    q_assets = f"""[out:json][timeout:240][bbox:{bbox}];
(
  way["power"~"^(line|minor_line)$"];
  node["power"~"^(tower|pole|substation|plant|generator)$"];
  way["power"~"^(substation|plant|generator)$"];
  way["railway"~"^(rail|narrow_gauge)$"];
  node["railway"~"^(station|halt)$"];
  way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|track)$"];
  way["waterway"~"^(river|stream|canal)$"];
);
out geom;"""
    ajs = overpass(q_assets, "osm_assets.json", force)

    print("[3/3] edifici (solo centroide)")
    q_bld = f"""[out:json][timeout:240][bbox:{bbox}];
way["building"];
out center;"""
    bl = overpass(q_bld, "osm_buildings.json", force)

    rows = []
    for el in ajs["elements"]:
        tags = el.get("tags", {})
        cls, volt = classify(tags)
        if not cls:
            continue
        g = el_geometry(el)
        if g is None:
            continue
        rows.append({
            "osm_id": f"{el['type'][0]}{el['id']}",
            "cls": cls,
            "name": tags.get("name"),
            "operator": tags.get("operator"),
            "voltage": volt,
            "ref": tags.get("ref"),
            "tag_power": tags.get("power"), "tag_railway": tags.get("railway"),
            "tag_highway": tags.get("highway"), "tag_waterway": tags.get("waterway"),
            "tunnel": tags.get("tunnel"), "bridge": tags.get("bridge"),
            "geometry": g,
        })
    ga = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    # Per reti e corsi d'acqua teniamo anche il tratto fuori comune (entro il buffer),
    # perche' un albero dentro Verbania puo' cadere su un asset appena fuori.
    ga.to_file(CACHE / "osm_assets_raw.geojson", driver="GeoJSON")

    bpts = []
    for el in bl["elements"]:
        g = el_geometry(el)
        if g is not None:
            bpts.append({"osm_id": f"w{el['id']}", "geometry": g.centroid})
    gbl = gpd.GeoDataFrame(bpts, crs="EPSG:4326")
    gbl.to_file(CACHE / "osm_buildings.geojson", driver="GeoJSON")

    counts = ga["cls"].value_counts().to_dict()
    print("  classi:", counts)
    print(f"  edifici: {len(gbl)}")
    status = {"osm_overpass": {"ok": True, "elements": len(ga), "buildings": len(gbl),
                               "timestamp": ajs.get("osm3s", {}).get("timestamp_osm_base")}}
    (CACHE / "status_osm.json").write_text(json.dumps(status, indent=1))
    return ga, gbl, gb


if __name__ == "__main__":
    main(force="--force" in sys.argv)
