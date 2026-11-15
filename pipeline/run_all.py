"""Esegue la pipeline SPILE end-to-end.

    python run_all.py            # usa la cache se presente
    python run_all.py --force    # riscarica tutto
    python run_all.py --no-catasto
"""
import sys
import time

import fetch_osm
import fetch_rasters
import compute_risk

force = "--force" in sys.argv
t = time.time()
print("=== 1. OpenStreetMap")
fetch_osm.main(force=force)
print("=== 2. Raster (WorldCover, DEM, canopy height)")
fetch_rasters.main(force=force)
print("=== 3. Modello di rischio")
compute_risk.main()
if "--no-catasto" not in sys.argv:
    print("=== 4. Catasto (WMS AdE)")
    import enrich_catasto
    enrich_catasto.main()
import export_bundle
export_bundle.main()
print(f"=== fatto in {time.time() - t:.0f}s -> data/")
