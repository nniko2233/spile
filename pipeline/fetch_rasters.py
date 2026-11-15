"""Scarica (a finestra, via HTTP range request) e riproietta i raster su una
griglia comune 10 m UTM 32N ritagliata sul bbox di Verbania.

Output (cache/): grid_treecover.tif, grid_dem.tif, grid_chm.tif, status_rasters.json
"""
import json
import math
import sys
import os
import functools
print = functools.partial(print, flush=True)

import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import from_bounds
from rasterio.transform import from_origin
import geopandas as gpd

from config import (CACHE, DATA, CRS_METRIC, GRID_RES, WORLDCOVER_URL, COPDEM_URL,
                    CHM_BUCKET, CHM_PREFIX, CHM_QUADKEY_LEVEL, CHM_FALLBACK_HEIGHT,
                    MAX_TREE_HEIGHT)

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "4")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
os.environ.setdefault("VSI_CACHE", "TRUE")
os.environ.setdefault("GDAL_CACHEMAX", "512")


def target_grid():
    gb = gpd.read_file(DATA / "boundary.geojson").to_crs(CRS_METRIC)
    minx, miny, maxx, maxy = gb.total_bounds
    pad = 300
    minx, miny = math.floor((minx - pad) / GRID_RES) * GRID_RES, math.floor((miny - pad) / GRID_RES) * GRID_RES
    maxx, maxy = math.ceil((maxx + pad) / GRID_RES) * GRID_RES, math.ceil((maxy + pad) / GRID_RES) * GRID_RES
    w, h = int((maxx - minx) / GRID_RES), int((maxy - miny) / GRID_RES)
    return from_origin(minx, maxy, GRID_RES, GRID_RES), w, h, (minx, miny, maxx, maxy)


def quadkey(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    lr = math.radians(lat)
    y = int((1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n)
    qk = ""
    for i in range(z, 0, -1):
        d, m = 0, 1 << (i - 1)
        if x & m:
            d += 1
        if y & m:
            d += 2
        qk += str(d)
    return qk


def write_grid(path, arr, transform, nodata, dtype):
    with rasterio.open(path, "w", driver="GTiff", height=arr.shape[0], width=arr.shape[1],
                       count=1, dtype=dtype, crs=CRS_METRIC, transform=transform,
                       nodata=nodata, compress="deflate") as dst:
        dst.write(arr.astype(dtype), 1)


def warp_source(url, dst_transform, w, h, bounds, resampling, dtype, nodata, read_scale=1.0):
    """Legge solo la finestra necessaria dalla sorgente remota e la riproietta."""
    dst = np.full((h, w), nodata, dtype=dtype)
    with rasterio.open(f"/vsicurl/{url}") as src:
        sb = transform_bounds(CRS_METRIC, src.crs, *bounds, densify_pts=21)
        win = from_bounds(*sb, transform=src.transform).round_offsets().round_lengths()
        win = rasterio.windows.Window(win.col_off - 4, win.row_off - 4, win.width + 8, win.height + 8)
        full = rasterio.windows.Window(0, 0, src.width, src.height)
        try:
            win = rasterio.windows.intersection(win, full)
        except Exception:
            raise RuntimeError("finestra fuori dal tile")
        if win.width < 1 or win.height < 1:
            raise RuntimeError("finestra fuori dal tile")
        out_shape = (max(1, int(win.height * read_scale)), max(1, int(win.width * read_scale)))
        data = src.read(1, window=win, out_shape=out_shape, resampling=Resampling.average
                        if read_scale < 1 else Resampling.nearest, masked=False)
        src_tr = src.window_transform(win) * rasterio.Affine.scale(1 / read_scale)
        reproject(data, dst, src_transform=src_tr, src_crs=src.crs, src_nodata=src.nodata,
                  dst_transform=dst_transform, dst_crs=CRS_METRIC, dst_nodata=nodata,
                  resampling=resampling)
        info = {"src_crs": str(src.crs), "src_res": src.res, "window_px": [int(win.width), int(win.height)],
                "read_shape": list(out_shape)}
    return dst, info


def main(force=False):
    tr, w, h, bounds = target_grid()
    print(f"griglia: {w}x{h} celle a {GRID_RES} m, bounds {bounds}")
    status = {}

    # --- ESA WorldCover (tree cover) ---
    p = CACHE / "grid_treecover.tif"
    if force or not p.exists():
        try:
            arr, info = warp_source(WORLDCOVER_URL, tr, w, h, bounds, Resampling.nearest, "uint8", 0)
            write_grid(p, arr, tr, 0, "uint8")
            tree = int((arr == 10).sum())
            print(f"  WorldCover ok: {tree} celle bosco ({tree * GRID_RES**2 / 1e4:.0f} ha nel bbox)")
            status["esa_worldcover"] = {"ok": True, "tree_cells_bbox": tree, "year": 2021, **info}
        except Exception as e:
            print(f"  WorldCover FALLITO: {e}", file=sys.stderr)
            status["esa_worldcover"] = {"ok": False, "error": str(e)}
    else:
        status["esa_worldcover"] = {"ok": True, "cached": True}

    # --- Copernicus DEM ---
    p = CACHE / "grid_dem.tif"
    if force or not p.exists():
        try:
            arr, info = warp_source(COPDEM_URL, tr, w, h, bounds, Resampling.bilinear, "float32", -9999.0)
            write_grid(p, arr, tr, -9999.0, "float32")
            v = arr[arr > -9000]
            print(f"  DEM ok: quota {v.min():.0f}-{v.max():.0f} m")
            status["copernicus_dem"] = {"ok": True, "zmin": float(v.min()), "zmax": float(v.max()), **info}
        except Exception as e:
            print(f"  DEM FALLITO: {e}", file=sys.stderr)
            status["copernicus_dem"] = {"ok": False, "error": str(e)}
    else:
        status["copernicus_dem"] = {"ok": True, "cached": True}

    # --- Canopy height (Meta/WRI 1 m, letto a ~4 m dalle overview, poi max su 10 m) ---
    p = CACHE / "grid_chm.tif"
    if force or not p.exists():
        gb = gpd.read_file(DATA / "boundary.geojson")
        minx, miny, maxx, maxy = gb.total_bounds
        qks = sorted({quadkey(x, y, CHM_QUADKEY_LEVEL) for x in (minx - 0.02, maxx + 0.02)
                      for y in (miny - 0.02, maxy + 0.02)})
        print(f"  CHM quadkey: {qks}")
        acc = np.full((h, w), -1.0, dtype="float32")
        okc = 0
        for qk in qks:
            url = f"{CHM_BUCKET}/{CHM_PREFIX}{qk}.tif"
            try:
                arr, info = warp_source(url, tr, w, h, bounds, Resampling.max, "float32", -1.0, read_scale=0.25)
                acc = np.maximum(acc, arr)
                okc += 1
                print(f"    tile {qk} ok ({info['read_shape']})")
            except Exception as e:
                print(f"    tile {qk} FALLITO: {e}", file=sys.stderr)
        if okc:
            acc = np.clip(acc, -1, MAX_TREE_HEIGHT)
            write_grid(p, acc, tr, -1.0, "float32")
            v = acc[acc >= 0]
            print(f"  CHM ok: altezza media {v.mean():.1f} m, p95 {np.percentile(v, 95):.1f} m")
            status["canopy_height"] = {"ok": True, "tiles": okc, "fallback": False,
                                       "source": "Meta/WRI Global Canopy Height 1 m (AWS Open Data)"}
        else:
            print(f"  CHM non disponibile: uso altezza costante {CHM_FALLBACK_HEIGHT} m", file=sys.stderr)
            status["canopy_height"] = {"ok": False, "fallback": True, "fallback_height": CHM_FALLBACK_HEIGHT}
    else:
        status["canopy_height"] = {"ok": True, "cached": True, "fallback": False,
                                   "source": "Meta/WRI Global Canopy Height 1 m (AWS Open Data)"}

    (CACHE / "status_rasters.json").write_text(json.dumps(status, indent=1, default=str))
    return status


if __name__ == "__main__":
    main(force="--force" in sys.argv)
