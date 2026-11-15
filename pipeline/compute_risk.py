"""Modello di rischio vegetazionale SPILE su griglia 10 m.

Legge cache/grid_*.tif e cache/osm_*.geojson, produce:
  data/zones.geojson   zone critiche (poligoni) con lista di rischi
  data/assets.geojson  reti e punti notevoli (ritagliati)
  data/stats.json      numeri per la dashboard
  data/top50.csv       segmenti di asset piu' minacciati
"""
import csv
import json
import sys
import functools
from datetime import datetime, timezone

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from scipy import ndimage
from scipy.signal import fftconvolve
import geopandas as gpd
import pandas as pd
from shapely.geometry import shape, LineString, Point, box
from shapely.ops import substring

from config import (CACHE, DATA, CRS_METRIC, GRID_RES, FASCIA, W_ASSET, HV_VOLTAGE_MIN,
                    BUILDING_RADIUS, FIRE_FUEL_RADIUS, FIRE_IGNITION_RADIUS,
                    HYDRO_WATER_RADIUS, HYDRO_PLANT_RADIUS, MAX_TREE_HEIGHT,
                    CHM_FALLBACK_HEIGHT, CLASS_HIGH, CLASS_MED, MIN_ZONE_CELLS, IN_FASCIA_FACTOR)

print = functools.partial(print, flush=True)
SEG_LEN = 25.0
RISK_TYPES = ["power", "rail", "road", "fire", "hydro"]
RISK_LABELS = {"power": "Blocco fornitura elettrica", "rail": "Interruzione ferroviaria",
               "road": "Blocco viabilita'", "fire": "Incendio boschivo",
               "hydro": "Ostruzione prese idroelettriche"}


# --------------------------------------------------------------------------- utils
def disk(r_cells):
    r = int(round(r_cells))
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y <= r * r).astype("float32")


def segmentize(gdf, seg_len=SEG_LEN):
    """Spezza ogni linea in segmenti di ~seg_len m; ritorna GeoDataFrame di segmenti."""
    rows = []
    for _, r in gdf.iterrows():
        geom = r.geometry
        lines = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
        k = 0
        for ln in lines:
            L = ln.length
            n = max(1, int(np.ceil(L / seg_len)))
            for i in range(n):
                s = substring(ln, i * L / n, (i + 1) * L / n)
                if s.is_empty or s.length == 0:
                    continue
                d = r.to_dict()
                d["geometry"] = s
                d["seg_idx"] = k
                k += 1
                rows.append(d)
    return gpd.GeoDataFrame(rows, crs=gdf.crs)


def dist_and_nearest(mask_ids, shape_, res):
    """EDT: distanza (m) dalla cella piu' vicina con id>0 e quell'id."""
    if not mask_ids.any():
        return np.full(shape_, 1e6, "float32"), np.zeros(shape_, "int32")
    dist, (iy, ix) = ndimage.distance_transform_edt(mask_ids == 0, return_indices=True)
    return (dist * res).astype("float32"), mask_ids[iy, ix]


def norm_rank(x, mask):
    """Normalizzazione per rango 0-1 sui soli valori in mask."""
    out = np.zeros_like(x, dtype="float32")
    v = x[mask]
    if v.size:
        order = v.argsort().argsort()
        out[mask] = order / max(1, v.size - 1)
    return out


# --------------------------------------------------------------------------- main
def main():
    t0 = datetime.now(timezone.utc)
    st_osm = json.loads((CACHE / "status_osm.json").read_text())
    st_ras = json.loads((CACHE / "status_rasters.json").read_text())

    with rasterio.open(CACHE / "grid_treecover.tif") as src:
        wc = src.read(1)
        tr = src.transform
    H, W = wc.shape
    res = GRID_RES
    print(f"griglia {W}x{H}")

    gb = gpd.read_file(DATA / "boundary.geojson").to_crs(CRS_METRIC)
    inside = rasterize([(g, 1) for g in gb.geometry], out_shape=(H, W), transform=tr,
                       fill=0, dtype="uint8").astype(bool)
    tree = (wc == 10) & inside

    # altezza chioma
    chm_ok = st_ras.get("canopy_height", {}).get("ok") and (CACHE / "grid_chm.tif").exists()
    if chm_ok:
        chm = rasterio.open(CACHE / "grid_chm.tif").read(1)
        h = np.where(chm >= 0, chm, CHM_FALLBACK_HEIGHT).astype("float32")
        h = np.clip(h, 0, MAX_TREE_HEIGHT)
        # celle bosco (WorldCover) con chioma < 3 m: dato CHM mancante o taglio recente,
        # usiamo un minimo prudenziale di 3 m
        h[tree & (h < 3)] = 3.0
    else:
        h = np.full((H, W), CHM_FALLBACK_HEIGHT, "float32")
    h[~tree] = 0

    # DEM -> pendenza, esposizione
    dem = rasterio.open(CACHE / "grid_dem.tif").read(1).astype("float32")
    dem[dem < -9000] = np.nan
    dem = np.where(np.isnan(dem), np.nanmean(dem), dem)
    dem_s = ndimage.gaussian_filter(dem, 1.0)
    gy, gx = np.gradient(dem_s, res)
    slope = np.degrees(np.arctan(np.hypot(gx, gy))).astype("float32")
    aspect = (np.degrees(np.arctan2(gx, -gy)) + 360) % 360   # 0=N, 90=E, 180=S
    aspect = aspect.astype("float32")

    # ------------------------------------------------------------------ asset
    ga = gpd.read_file(CACHE / "osm_assets_raw.geojson").to_crs(CRS_METRIC)
    ga["voltage"] = pd.to_numeric(ga["voltage"], errors="coerce")
    # riclassifica AT/MT con soglia italiana (>= 30 kV = AT)
    is_line = ga["cls"].isin(["power_hv", "power_mv"])
    ga.loc[is_line & (ga["voltage"] >= HV_VOLTAGE_MIN), "cls"] = "power_hv"
    ga.loc[is_line & (ga["voltage"] < HV_VOLTAGE_MIN), "cls"] = "power_mv"
    gbl = gpd.read_file(CACHE / "osm_buildings.geojson").to_crs(CRS_METRIC)

    lines = ga[ga.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    # ritaglio al bbox esteso: Overpass restituisce le way intere (la 220 kV e' lunga 100 km)
    bb_clip = box(*gb.total_bounds).buffer(800)
    lines = lines[lines.intersects(bb_clip)].copy()
    lines["geometry"] = lines.geometry.intersection(bb_clip)
    lines = lines[~lines.geometry.is_empty]
    if "tunnel" in lines.columns:
        n_tun = int(lines["tunnel"].isin(["yes", "building_passage"]).sum())
        lines = lines[~lines["tunnel"].isin(["yes", "building_passage"])]
        print(f"  escluse {n_tun} way in galleria")
    groups = {
        "power": lines[lines["cls"].isin(["power_hv", "power_mv"])],
        "rail": lines[lines["cls"] == "rail"],
        "road": lines[lines["cls"].isin(["road_trunk", "road_primary", "road_secondary"])],
    }
    segs = {}
    seg_tables = {}
    dist = {}
    near = {}
    for g, df in groups.items():
        sg = segmentize(df).reset_index(drop=True)
        sg["seg_id"] = np.arange(1, len(sg) + 1, dtype="int32")
        segs[g] = sg
        ras = rasterize(((geom, int(i)) for geom, i in zip(sg.geometry, sg["seg_id"])),
                        out_shape=(H, W), transform=tr, fill=0, dtype="int32", all_touched=True)
        d, n = dist_and_nearest(ras, (H, W), res)
        dist[g], near[g] = d, n
        seg_tables[g] = sg.drop(columns="geometry")
        print(f"  {g}: {len(df)} way -> {len(sg)} segmenti da {SEG_LEN:.0f} m")

    # pesi per segmento
    def seg_weight(g):
        sg = segs[g]
        w = np.zeros(len(sg) + 1, "float32")
        for i, c in zip(sg["seg_id"], sg["cls"]):
            w[i] = W_ASSET.get(c, 0.5)
        return w
    wmap = {g: seg_weight(g) for g in groups}

    # densita' edifici entro 500 m (proxy utenze)
    bras = rasterize(((p, 1) for p in gbl.geometry), out_shape=(H, W), transform=tr,
                     fill=0, dtype="float32", merge_alg=rasterio.enums.MergeAlg.add)
    bdens = fftconvolve(bras, disk(BUILDING_RADIUS / res), mode="same")
    bdens_n = np.clip(bdens / max(1.0, np.percentile(bdens[inside], 95)), 0, 1).astype("float32")

    # ------------------------------------------------------------------ rischio caduta
    risk = {t: np.zeros((H, W), "float32") for t in RISK_TYPES}
    fall = {}
    in_fascia = {}
    slope_f = (1 + np.clip(slope, 0, 60) / 45.0)
    for g in groups:
        d = np.maximum(dist[g], 5.0)     # cella attraversata dall'asset: distanza sub-cella
        dist[g] = d
        fz = tree & (d <= h)
        fall[g] = fz
        base = np.where(fz, np.clip((h - d) / np.maximum(h, 1e-3), 0, 1), 0) * slope_f
        wseg = wmap[g][near[g]]
        r = base * wseg
        if g == "power":
            r = r * (0.6 + 0.4 * bdens_n)
        risk[g] = np.clip(r, 0, 1).astype("float32")
        # fascia di rispetto per classe del segmento vicino
        fas = np.zeros(len(segs[g]) + 1, "float32")
        for i, c in zip(segs[g]["seg_id"], segs[g]["cls"]):
            fas[i] = FASCIA["power_hv" if c == "power_hv" else "power_mv" if c == "power_mv"
                            else "rail" if c == "rail" else "road"]
        in_fascia[g] = fz & (d <= fas[near[g]])
        # dentro fascia il taglio e' gia' programmato: rischio residuo ridotto (parametro)
        risk[g] = np.where(in_fascia[g], risk[g] * IN_FASCIA_FACTOR, risk[g]).astype("float32")

    # ------------------------------------------------------------------ incendio
    fuel = fftconvolve(tree.astype("float32"), disk(FIRE_FUEL_RADIUS / res), mode="same")
    fuel_n = np.clip(fuel / disk(FIRE_FUEL_RADIUS / res).sum(), 0, 1)
    slope_n = np.clip(slope / 45.0, 0, 1)
    south = ((1 + np.cos(np.radians(aspect - 180))) / 2).astype("float32")
    allroads = lines[lines["cls"].str.startswith("road")]
    ign_src = rasterize(((g_, 1) for g_ in allroads.geometry), out_shape=(H, W), transform=tr,
                        fill=0, dtype="uint8", all_touched=True)
    ign_src = np.maximum(ign_src, (bras > 0).astype("uint8"))
    d_ign, _ = dist_and_nearest(ign_src.astype("int32"), (H, W), res)
    ignition = np.clip(1 - d_ign / FIRE_IGNITION_RADIUS, 0, 1)
    d_bld, _ = dist_and_nearest((bras > 0).astype("int32"), (H, W), res)
    target = np.clip(1 - d_bld / 300.0, 0, 1)            # interfaccia bosco-urbano
    fire_raw = (0.30 * fuel_n + 0.20 * slope_n + 0.15 * south + 0.15 * ignition + 0.20 * target)
    fire_raw = np.where(tree, fire_raw, 0).astype("float32")
    # normalizzazione per rango sulle sole celle bosco con combustibile continuo
    fire_mask = tree & (fuel_n > 0.5)
    risk["fire"] = (0.9 * norm_rank(fire_raw, fire_mask) ** 8).astype("float32")  # solo la coda alta e' critica; cap 0.9

    # ------------------------------------------------------------------ idro
    hydro_pts = ga[ga["cls"].isin(["plant_hydro", "generator_hydro"])].copy()
    hydro_pts["geometry"] = hydro_pts.geometry.centroid
    water = lines[lines["cls"] == "waterway"]
    hydro_water = water.iloc[0:0]
    if len(hydro_pts) and len(water):
        buf = hydro_pts.buffer(HYDRO_PLANT_RADIUS).union_all()
        hydro_water = water[water.intersects(buf)].copy()
        hydro_water["geometry"] = hydro_water.geometry.intersection(buf)
        hydro_water = hydro_water[~hydro_water.geometry.is_empty]
    if len(hydro_water):
        wras = rasterize(((g_, 1) for g_ in hydro_water.geometry), out_shape=(H, W), transform=tr,
                         fill=0, dtype="int32", all_touched=True)
        d_w, _ = dist_and_nearest(wras, (H, W), res)
        # quota minima degli impianti: a monte = piu' in alto
        rows_, cols_ = rasterio.transform.rowcol(tr, hydro_pts.geometry.x.values, hydro_pts.geometry.y.values)
        rows_ = np.clip(np.asarray(rows_), 0, H - 1); cols_ = np.clip(np.asarray(cols_), 0, W - 1)
        z_plant = float(np.min(dem[rows_, cols_]))
        hz = tree & (d_w <= HYDRO_WATER_RADIUS) & (dem >= z_plant - 5)
        # legname flottante: contano alberi grandi su sponde ripide vicino all'acqua
        risk["hydro"] = np.where(hz, 0.9 * (1 - d_w / HYDRO_WATER_RADIUS) * np.clip(h / 25.0, 0, 1)
                                 * (0.35 + 0.65 * slope_n), 0).astype("float32")
    print("  impianti idro:", len(hydro_pts), " tratti d'acqua a monte:", len(hydro_water))

    # ------------------------------------------------------------------ aggregazione
    stack = np.stack([risk[t] for t in RISK_TYPES])      # (5,H,W)
    score = stack.max(axis=0)
    dom = stack.argmax(axis=0)
    crit = score >= CLASS_MED
    for t in RISK_TYPES:
        print(f"  {t}: celle >= medio {(risk[t] >= CLASS_MED).sum()}, >= alto {(risk[t] >= CLASS_HIGH).sum()}")
    any_fall = fall["power"] | fall["rail"] | fall["road"]
    any_in = in_fascia["power"] | in_fascia["rail"] | in_fascia["road"]
    out_fascia_cell = any_fall & ~any_in

    # zone = componenti connesse (8-conn) di celle critiche con stesso tipo dominante,
    # spezzate su tessere di 250 m per avere zone cliccabili di dimensione ragionevole
    tile = 25
    ty, tx = np.indices((H, W))
    tile_id = (ty // tile) * (W // tile + 2) + (tx // tile)
    zone_id = np.zeros((H, W), "int32")
    nz = 0
    for ti, t in enumerate(RISK_TYPES):
        m = crit & (dom == ti)
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        if n == 0:
            continue
        key = lab.astype("int64") * (tile_id.max() + 1) + tile_id
        key[lab == 0] = 0
        uniq, inv = np.unique(key, return_inverse=True)
        inv = inv.reshape(H, W)
        newids = np.where(uniq == 0, 0, np.arange(len(uniq)) + nz)
        if uniq[0] != 0:
            newids = np.arange(len(uniq)) + nz + 1
        z = newids[inv]
        zone_id = np.where(z > 0, z, zone_id)
        nz = int(zone_id.max())
    # scarta zone troppo piccole
    counts = np.bincount(zone_id.ravel())
    small = np.isin(zone_id, np.where(counts < MIN_ZONE_CELLS)[0])
    zone_id[small] = 0
    ids = np.unique(zone_id); ids = ids[ids > 0]
    print(f"  celle critiche: {crit.sum()}  zone: {len(ids)}")

    # statistiche per zona (vettorializzate con ndimage)
    idx = ids
    def zmax(a): return ndimage.maximum(a, zone_id, idx)
    def zmean(a): return ndimage.mean(a, zone_id, idx)
    def zsum(a): return ndimage.sum(a, zone_id, idx)
    def zmin(a): return ndimage.minimum(a, zone_id, idx)

    n_cells = np.asarray(zsum(np.ones((H, W))))
    z_score = np.asarray(zmax(score))
    z_h_mean = np.asarray(zmean(h)); z_h_max = np.asarray(zmax(h))
    z_slope = np.asarray(zmean(slope)); z_aspect = np.asarray(zmean(aspect))
    z_elev = np.asarray(zmean(dem))
    z_out = np.asarray(zsum(out_fascia_cell.astype("float32")))
    z_in = np.asarray(zsum(any_in.astype("float32")))
    z_fall = np.asarray(zsum(any_fall.astype("float32")))
    z_bld = np.asarray(zmean(bdens))
    z_type_max = {t: np.asarray(zmax(risk[t])) for t in RISK_TYPES}
    z_dmin = {g: np.asarray(zmin(np.where(fall[g], dist[g], 1e6))) for g in groups}
    com = ndimage.center_of_mass(np.ones((H, W)), zone_id, idx)
    cy = [c[0] for c in com]; cx = [c[1] for c in com]
    # zone dominante: moda del tipo
    z_dom = np.asarray(ndimage.labeled_comprehension(dom, zone_id, idx,
                                                     lambda v: np.bincount(v).argmax(), int, 0))
    # asset piu' vicino per gruppo (moda del seg_id tra le celle in zona di caduta)
    z_seg = {}
    for g in groups:
        arr = np.where(fall[g], near[g], 0)
        z_seg[g] = np.asarray(ndimage.labeled_comprehension(
            arr, zone_id, idx, lambda v: (np.bincount(v[v > 0]).argmax() if (v > 0).any() else 0), int, 0))

    def seg_desc(g, sid):
        if sid <= 0:
            return None
        r = seg_tables[g].iloc[sid - 1]
        c = r["cls"]
        if c == "power_hv":
            typ = f"Linea AT {int(r['voltage'] / 1000)} kV" if pd.notna(r['voltage']) else "Linea AT"
        elif c == "power_mv":
            typ = f"Linea MT {int(r['voltage'] / 1000)} kV" if pd.notna(r['voltage']) else "Linea MT"
        elif c == "rail":
            typ = "Ferrovia"
        else:
            typ = {"road_trunk": "Strada principale", "road_primary": "Strada primaria",
                   "road_secondary": "Strada secondaria"}.get(c, "Strada")
        name = r["name"] or r["ref"] or ""
        return {"cls": c, "type": typ, "name": name, "osm_id": r["osm_id"],
                "seg": f"{r['osm_id']}#{int(r['seg_idx']):03d}", "operator": r["operator"]}

    # poligoni
    polys = {}
    for geom, val in shapes(zone_id, mask=zone_id > 0, connectivity=8, transform=tr):
        polys.setdefault(int(val), []).append(shape(geom))
    feats = []
    xs, ys = rasterio.transform.xy(tr, cy, cx)
    pts = gpd.GeoSeries([Point(x, y) for x, y in zip(xs, ys)], crs=CRS_METRIC).to_crs("EPSG:4326")
    for k, zid in enumerate(ids):
        geom = gpd.GeoSeries(polys[int(zid)], crs=CRS_METRIC).union_all()
        geom = geom.buffer(6, join_style=1).buffer(-6, join_style=1).simplify(2)
        if geom.is_empty:
            continue
        types = [t for t in RISK_TYPES if z_type_max[t][k] >= CLASS_MED]
        dt = RISK_TYPES[z_dom[k]]
        if dt not in types:
            types.insert(0, dt)
        types.sort(key=lambda t: -z_type_max[t][k])
        s = float(z_score[k])
        cls = "alto" if s >= CLASS_HIGH else "medio" if s >= CLASS_MED else "basso"
        assets = {g: seg_desc(g, int(z_seg[g][k])) for g in groups}
        assets = {g: a for g, a in assets.items() if a}
        main_g = dt if dt in groups else next(iter(assets), None)
        d_main = float(z_dmin[main_g][k]) if main_g else None
        fall_cells = int(z_fall[k])
        out_cells = int(z_out[k])
        fascia = ("FUORI" if out_cells >= max(1, fall_cells - out_cells) else "DENTRO") if fall_cells else "N/A"
        feats.append({
            "type": "Feature",
            "geometry": gpd.GeoSeries([geom], crs=CRS_METRIC).to_crs("EPSG:4326").iloc[0].__geo_interface__,
            "properties": {
                "id": int(zid), "score": round(s, 3), "cls": cls, "dom": dt,
                "types": types, "risk": {t: round(float(z_type_max[t][k]), 3) for t in types},
                "n_cells": int(n_cells[k]), "area_ha": round(n_cells[k] * res * res / 1e4, 2),
                "h_mean": round(float(z_h_mean[k]), 1), "h_max": round(float(z_h_max[k]), 1),
                "d_min": round(d_main, 1) if d_main is not None and d_main < 1e5 else None,
                "slope": round(float(z_slope[k]), 1), "aspect": round(float(z_aspect[k])),
                "elev": round(float(z_elev[k])),
                "fascia": fascia, "cells_out": out_cells, "cells_in": int(z_in[k]), "cells_fall": fall_cells,
                "bld500": int(round(z_bld[k])),
                "assets": assets, "asset_main": assets.get(main_g) if main_g else None,
                "lon": round(float(pts.iloc[k].x), 6), "lat": round(float(pts.iloc[k].y), 6),
                "catasto": None,
            }})
    feats.sort(key=lambda f: -f["properties"]["score"])
    for rank, f in enumerate(feats, 1):
        f["properties"]["rank"] = rank
    (DATA / "zones.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}),
                                        encoding="utf-8")
    print(f"  zone esportate: {len(feats)}")

    # ------------------------------------------------------------------ segmenti top
    seg_rows = []
    for g in groups:
        arr = np.where(fall[g], near[g], 0)
        sids = np.unique(arr[arr > 0])
        if not sids.size:
            continue
        smax = ndimage.maximum(risk[g], arr, sids)
        scnt = ndimage.sum(np.ones((H, W)), arr, sids)
        sout = ndimage.sum((fall[g] & ~in_fascia[g]).astype("float32"), arr, sids)
        shm = ndimage.mean(h, arr, sids)
        for sid, mx, c, o, hm in zip(sids, smax, scnt, sout, shm):
            dsc = seg_desc(g, int(sid))
            seg_rows.append({"group": g, "seg": dsc["seg"], "cls": dsc["cls"], "type": dsc["type"],
                             "name": dsc["name"], "operator": dsc["operator"] or "",
                             "score": round(float(mx), 3), "cells": int(c), "cells_out": int(o),
                             "h_mean": round(float(hm), 1)})
    seg_rows.sort(key=lambda r: (-r["score"], -r["cells"]))
    with open(DATA / "top50.csv", "w", newline="", encoding="utf-8") as f:
        wri = csv.DictWriter(f, fieldnames=list(seg_rows[0].keys()) if seg_rows else ["seg"])
        wri.writeheader()
        for r in seg_rows[:50]:
            wri.writerow(r)

    # ------------------------------------------------------------------ assets.geojson
    bb = box(*gb.total_bounds).buffer(800)
    keep_lines = lines[lines["cls"].isin(["power_hv", "power_mv", "rail", "road_trunk", "road_primary",
                                           "road_secondary", "waterway"])].copy()
    keep_lines = keep_lines[keep_lines.intersects(bb)]
    keep_lines["geometry"] = keep_lines.geometry.intersection(bb)
    keep_lines["layer"] = keep_lines["cls"].map(lambda c: "power" if c.startswith("power") else
                                                "rail" if c == "rail" else "road" if c.startswith("road") else "water")
    if len(hydro_water):
        keep_lines.loc[keep_lines["osm_id"].isin(hydro_water["osm_id"]), "layer"] = "water_hydro"
    pts_ = ga[ga["cls"].isin(["substation", "plant_hydro", "generator_hydro", "station"])].copy()
    pts_["geometry"] = pts_.geometry.centroid
    pts_ = pts_[pts_.within(bb)]
    pts_["layer"] = pts_["cls"].map(lambda c: "hydro" if c.endswith("hydro") else c)
    # punti di innesco: celle bosco con massimo prodotto innesco*combustibile, campionati
    ign_score = np.where(tree, ignition * fuel_n * (0.5 + 0.5 * south), 0)
    ign_pts = []
    flat = ign_score.copy()
    for _ in range(14):
        i = int(flat.argmax())
        if flat.flat[i] <= 0:
            break
        r_, c_ = divmod(i, W)
        x, y = rasterio.transform.xy(tr, r_, c_)
        ign_pts.append({"cls": "ignition", "layer": "ignition", "name": "Punto di innesco potenziale",
                        "osm_id": None, "geometry": Point(x, y), "operator": None, "voltage": None, "ref": None})
        r0, r1 = max(0, r_ - 60), min(H, r_ + 60); c0, c1 = max(0, c_ - 60), min(W, c_ + 60)
        flat[r0:r1, c0:c1] = 0
    gign = gpd.GeoDataFrame(ign_pts, crs=CRS_METRIC)
    cols = ["osm_id", "cls", "layer", "name", "operator", "voltage", "ref", "geometry"]
    out_assets = pd.concat([keep_lines[cols], pts_[cols], gign[cols]], ignore_index=True)
    out_assets = gpd.GeoDataFrame(out_assets, crs=CRS_METRIC).to_crs("EPSG:4326")
    out_assets["geometry"] = out_assets.geometry.simplify(0.00002)
    out_assets.to_file(DATA / "assets.geojson", driver="GeoJSON")

    # ------------------------------------------------------------------ stats.json
    prev = None
    if (DATA / "stats.json").exists():
        try:
            prev = json.loads((DATA / "stats.json").read_text(encoding="utf-8"))
        except Exception:
            prev = None
    by_cls = {c: sum(1 for f in feats if f["properties"]["cls"] == c) for c in ("alto", "medio", "basso")}
    by_type = {t: sum(1 for f in feats if t in f["properties"]["types"]) for t in RISK_TYPES}
    by_type_high = {t: sum(1 for f in feats if t in f["properties"]["types"] and f["properties"]["cls"] == "alto")
                    for t in RISK_TYPES}
    # asset esposti: segmenti minacciati per tipo
    exposed = {}
    km_total = {}
    for key, clss in [("power_hv", ["power_hv"]), ("power_mv", ["power_mv"]), ("rail", ["rail"]),
                      ("road", ["road_trunk", "road_primary", "road_secondary"])]:
        g = "power" if key.startswith("power") else key
        sg = segs[g]
        sel = sg[sg["cls"].isin(clss)]
        km_total[key] = round(float(sel.length.sum()) / 1000, 1)
        threatened = {r["seg"] for r in seg_rows if r["cls"] in clss}
        exposed[key] = {"segments": len(threatened), "km": round(len(threatened) * SEG_LEN / 1000, 2),
                        "segments_total": int(len(sel)), "km_total": km_total[key]}
    n_hydro_zones = by_type["hydro"]
    exposed["hydro"] = {"segments": n_hydro_zones, "plants": int(len(hydro_pts)),
                        "km_total": round(float(hydro_water.length.sum()) / 1000, 1) if len(hydro_water) else 0}

    crit_fall = any_fall & crit
    out_cells = int((out_fascia_cell & crit).sum())
    in_cells = int((any_in & crit).sum())
    out_all = int(out_fascia_cell.sum())
    in_all = int(any_in.sum())
    slope_hist, edges = np.histogram(slope[crit], bins=[0, 10, 20, 30, 40, 50, 90])
    cells_total_in_zones = sum(f["properties"]["n_cells"] for f in feats)

    stats = {
        "generated_at": t0.isoformat(timespec="seconds"),
        "comune": "Verbania", "istat": "103072",
        "grid_res_m": res,
        "coverage": {
            "area_ha": round(float(inside.sum()) * res * res / 1e4),
            "forest_ha": round(float(tree.sum()) * res * res / 1e4),
            "forest_pct": round(100 * float(tree.sum()) / float(inside.sum()), 1),
            "km_network": km_total,
            "km_network_total": round(sum(km_total.values()), 1),
            "buildings": int(len(gbl)),
            "cells_analysed": int(tree.sum()),
            "last_image": {"worldcover": "2021", "canopy": "2020 (Meta/WRI v1, imm. 2018-2020)",
                           "dem": "Copernicus GLO-30 (2021 release)",
                           "osm": st_osm["osm_overpass"].get("timestamp")},
        },
        "zones": {"total": len(feats), "by_class": by_cls, "by_type": by_type, "by_type_high": by_type_high,
                  "cells": cells_total_in_zones,
                  "previous_total": prev["zones"]["total"] if prev else None,
                  "delta": (len(feats) - prev["zones"]["total"]) if prev else None,
                  "previous_at": prev["generated_at"] if prev else None},
        "fascia": {"cells_out": out_cells, "cells_in": in_cells,
                   "cells_out_all": out_all, "cells_in_all": in_all,
                   "pct_out_all": round(100 * out_all / max(1, out_all + in_all), 1),
                   "ha_out_all": round(out_all * res * res / 1e4, 1),
                   "cells_fall_total": int(crit_fall.sum()),
                   "pct_out": round(100 * out_cells / max(1, out_cells + in_cells), 1),
                   "zones_out": sum(1 for f in feats if f["properties"]["fascia"] == "FUORI"),
                   "zones_in": sum(1 for f in feats if f["properties"]["fascia"] == "DENTRO"),
                   "ha_out": round(out_cells * res * res / 1e4, 1)},
        "exposed": exposed,
        "slope_hist": {"bins": [int(e) for e in edges], "counts": [int(c) for c in slope_hist]},
        "top_segments": seg_rows[:10],
        "ticker": {"high_zones": by_cls["alto"]},
        "model": {"fascia_m": FASCIA, "w_asset": W_ASSET, "class_high": CLASS_HIGH, "class_med": CLASS_MED,
                  "in_fascia_factor": IN_FASCIA_FACTOR, "canopy_fallback": not chm_ok, "canopy_fallback_height": CHM_FALLBACK_HEIGHT},
        "sources": {
            "osm_overpass": {"ok": bool(st_osm["osm_overpass"]["ok"]), "label": "OpenStreetMap / Overpass",
                             "detail": f"{st_osm['osm_overpass']['elements']} asset, {st_osm['osm_overpass']['buildings']} edifici"},
            "esa_worldcover": {"ok": bool(st_ras.get("esa_worldcover", {}).get("ok")), "label": "ESA WorldCover 10 m",
                               "detail": "classe 10 = tree cover, 2021"},
            "canopy_height": {"ok": bool(chm_ok), "label": "Canopy height (Meta/WRI 1 m)",
                              "detail": "letto a 2.5 m, max su 10 m" if chm_ok else f"fallback {CHM_FALLBACK_HEIGHT:.0f} m"},
            "copernicus_dem": {"ok": bool(st_ras.get("copernicus_dem", {}).get("ok")), "label": "Copernicus DEM GLO-30",
                               "detail": "pendenza ed esposizione"},
            "catasto_ade": {"ok": False, "label": "Catasto AdE (WMS)", "detail": "non interrogato"},
            "basemap": {"ok": True, "label": "Basemap OpenFreeMap + terreno AWS",
                        "detail": "CARTO richiede ora una API key"},
            "sentinel2": {"ok": False, "label": "Sentinel-2 NDVI/NDWI", "detail": "opzionale, non integrato"},
            "osm_mt_lines": {"ok": bool((lines["cls"] == "power_mv").any()), "label": "Linee MT in OSM",
                             "detail": "rete MT e-distribuzione non mappata" if not (lines["cls"] == "power_mv").any()
                             else f"{int((lines['cls'] == 'power_mv').sum())} way"},
        },
    }
    (DATA / "stats.json").write_text(json.dumps(stats, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"  stats: zone {by_cls}, per tipo {by_type}, fuori fascia {out_cells} celle ({stats['fascia']['pct_out']}%)")
    return stats


if __name__ == "__main__":
    main()
